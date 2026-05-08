/**
 * @module routes/companies
 * Full CRUD for companies — superadmin only.
 */
import { Router }        from 'express';
import { z }             from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db                from '../db/sqlite.js';
import { validate }      from '../middleware/validate.js';
import { requireSuperAdmin } from '../middleware/auth.js';
import { logAction }     from '../services/audit-log.service.js';

const router = Router();

// Every route in this file requires superadmin
router.use(requireSuperAdmin);

const companySchema = z.object({
  name:          z.string().min(1).max(200),
  contact_email: z.string().email().optional().default(''),
  domain:        z.string().max(200).optional().default(''),
  plan:          z.string().max(50).optional().default('Starter'),
  is_paid:       z.boolean().optional().default(true),
  max_seats:     z.number().int().min(1).max(1000).optional().default(10),
  status:        z.enum(['active', 'inactive']).optional().default('active'),
});

// ─── GET /api/companies ───────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const companies = db.prepare(`
    SELECT
      c.*,
      (SELECT COUNT(*) FROM users  WHERE company_id = c.id AND status = 'active') AS user_count,
      (SELECT COUNT(*) FROM sites  WHERE company_id = c.id)                       AS site_count,
      (SELECT COUNT(*) FROM invites WHERE company_id = c.id AND accepted = 0 AND expires_at > ?) AS pending_invites
    FROM companies c
    ORDER BY c.created_at DESC
  `).all(new Date().toISOString());

  res.json({ companies });
});

// ─── POST /api/companies ──────────────────────────────────────────────────────
router.post('/', validate(companySchema), (req, res) => {
  const { name, contact_email, domain, plan, is_paid, max_seats, status } = req.body;
  const id  = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO companies (id, name, contact_email, domain, plan, is_paid, max_seats, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, contact_email, domain, plan, is_paid ? 1 : 0, max_seats, status, now, now);

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);

  logAction(req.user, {
    action:     'company.create',
    targetType: 'company',
    targetId:   id,
    companyId:  id,
    metadata:   { name },
  });

  res.status(201).json({ company });
});

// ─── PATCH /api/companies/:id ─────────────────────────────────────────────────
const PATCH_ALLOWED = ['name', 'contact_email', 'domain', 'plan', 'is_paid', 'max_seats', 'status'];

router.patch('/:id', validate(companySchema.partial()), (req, res) => {
  const { id } = req.params;
  const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const pairs = Object.entries(req.body).filter(([k]) => PATCH_ALLOWED.includes(k));
  if (!pairs.length) return res.status(400).json({ error: 'No valid fields to update' });

  // SQLite stores booleans as integers
  const processed = pairs.map(([k, v]) => [k, k === 'is_paid' ? (v ? 1 : 0) : v]);

  const setClause = processed.map(([k]) => `${k} = ?`).join(', ') + ', updated_at = ?';
  const values    = [...processed.map(([, v]) => v), new Date().toISOString(), id];

  db.prepare(`UPDATE companies SET ${setClause} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);

  logAction(req.user, {
    action:     'company.update',
    targetType: 'company',
    targetId:   id,
    companyId:  id,
    metadata:   req.body,
  });

  res.json({ company: updated });
});

// ─── DELETE /api/companies/:id ────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const { activeUsers } = db.prepare(
    "SELECT COUNT(*) AS activeUsers FROM users WHERE company_id = ? AND status = 'active'"
  ).get(id);

  if (activeUsers > 0) {
    return res.status(409).json({
      error: `Cannot delete a company with ${activeUsers} active user(s). Deactivate all users first.`,
    });
  }

  db.prepare('DELETE FROM companies WHERE id = ?').run(id);

  logAction(req.user, {
    action:     'company.delete',
    targetType: 'company',
    targetId:   id,
    companyId:  id,
    metadata:   { name: company.name },
  });

  res.status(204).end();
});

// ─── GET /api/companies/:id/users ─────────────────────────────────────────────
router.get('/:id/users', (req, res) => {
  const { id } = req.params;
  const company = db.prepare('SELECT id, name FROM companies WHERE id = ?').get(id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const users = db.prepare(`
    SELECT id, email, name, role, status, last_active_at, created_at
    FROM users
    WHERE company_id = ?
    ORDER BY created_at
  `).all(id);

  const invites = db.prepare(`
    SELECT id, email, role, expires_at, created_at
    FROM invites
    WHERE company_id = ? AND accepted = 0 AND expires_at > ?
    ORDER BY created_at DESC
  `).all(id, new Date().toISOString());

  res.json({ company, users, invites });
});

export default router;
