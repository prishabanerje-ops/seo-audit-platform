import { Router } from 'express';
import { z }      from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db          from '../db/sqlite.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const ALLOWED_PATCH_FIELDS = [
  'label', 'url', 'gsc_property', 'ga4_property_id',
  'color', 'sheets_tab_name', 'sheets_spreadsheet_id', 'linear_project_id', 'project_id',
  'crawl_config',
];

const siteSchema = z.object({
  label:             z.string().min(1).max(100),
  url:               z.string().url('Must be a valid URL'),
  gsc_property:      z.string().max(200).optional().default(''),
  ga4_property_id:   z.string().max(100).optional().default(''),
  color:             z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour').optional().default('#6366f1'),
  sheets_tab_name:   z.string().max(100).optional().default(''),
  sheets_spreadsheet_id: z.string().max(200).optional().default(''),
  linear_project_id: z.string().max(100).optional().default(''),
  project_id:        z.string().max(100).optional().default(''),
  // Crawl configuration — JSON string serialised by the frontend
  crawl_config:      z.string().optional().nullable(),
  // Superadmin may specify a target company when creating a site
  company_id:        z.string().uuid().optional(),
});

// ─── GET /api/sites ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { company_id: userCompanyId, role } = req.user;
  // Superadmin passes ?company_id= to scope results; regular users use their own
  const company_id = role === 'superadmin' ? (req.query.company_id || null) : userCompanyId;

  if (!company_id) return res.json({ data: [], total: 0, limit: 500, offset: 0 });

  const limit  = Math.min(Math.max(parseInt(req.query.limit  || '500', 10), 1), 500);
  const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);

  const sites = db.prepare(`
    SELECT
      s.*,
      (SELECT COUNT(*) FROM crawl_jobs WHERE site_id = s.id)                                                                                  AS crawl_count,
      (SELECT j.id   FROM crawl_jobs j WHERE j.site_id = s.id ORDER BY j.started_at DESC LIMIT 1)                                             AS latest_job_id,
      (SELECT j.status FROM crawl_jobs j WHERE j.site_id = s.id ORDER BY j.started_at DESC LIMIT 1)                                           AS latest_job_status,
      (SELECT j.health_score FROM crawl_jobs j WHERE j.site_id = s.id AND j.status = 'completed' ORDER BY j.completed_at DESC LIMIT 1)        AS latest_health_score,
      (SELECT j.completed_at FROM crawl_jobs j WHERE j.site_id = s.id AND j.status = 'completed' ORDER BY j.completed_at DESC LIMIT 1)        AS last_crawled_at
    FROM sites s
    WHERE s.company_id = ?
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(company_id, limit, offset);

  const { total } = db.prepare('SELECT COUNT(*) AS total FROM sites WHERE company_id = ?').get(company_id);

  res.json({ data: sites, total, limit, offset });
});

// ─── POST /api/sites ──────────────────────────────────────────────────────────
router.post('/', validate(siteSchema), (req, res) => {
  const { company_id: userCompanyId, role } = req.user;
  // Superadmin may supply company_id in body; regular users use their own
  const company_id = role === 'superadmin' ? (req.body.company_id || null) : userCompanyId;
  if (!company_id) return res.status(403).json({ error: 'No company context. Select a company first.' });

  const id = uuidv4();
  const { label, url, gsc_property, ga4_property_id, color, sheets_tab_name, sheets_spreadsheet_id, linear_project_id, project_id, crawl_config } = req.body;

  db.prepare(`
    INSERT INTO sites (id, company_id, label, url, gsc_property, ga4_property_id, color, sheets_tab_name, sheets_spreadsheet_id, linear_project_id, project_id, crawl_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, company_id, label, url, gsc_property, ga4_property_id, color, sheets_tab_name, sheets_spreadsheet_id, linear_project_id, project_id, crawl_config ?? null);

  res.status(201).json(db.prepare('SELECT * FROM sites WHERE id = ?').get(id));
});

// ─── GET /api/sites/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const { company_id, role } = req.user;
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(site);
});

// ─── PATCH /api/sites/:id ─────────────────────────────────────────────────────
router.patch('/:id', validate(siteSchema.partial()), (req, res) => {
  const { company_id, role } = req.user;
  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Whitelist fields to prevent column injection
  const fields = Object.entries(req.body)
    .filter(([k, v]) => ALLOWED_PATCH_FIELDS.includes(k) && v !== undefined);

  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
  const values    = [...fields.map(([, v]) => v), req.params.id];

  db.prepare(`UPDATE sites SET ${setClause} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id));
});

// ─── DELETE /api/sites/:id ────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { company_id, role } = req.user;
  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
