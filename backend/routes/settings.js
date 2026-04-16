/**
 * @module routes/settings
 * Per-company settings CRUD.
 * Superadmin also reads/writes the global `settings` table (Anthropic key).
 */
import { Router }   from 'express';
import { z }        from 'zod';
import db           from '../db/sqlite.js';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../services/audit-log.service.js';

const router = Router();

const ALLOWED_COMPANY_KEYS = [
  'slack_webhook_url', 'linear_api_key',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
  'psi_api_key',
];

const ALLOWED_GLOBAL_KEYS = ['anthropic_api_key'];

// ── GET /api/settings ─────────────────────────────────────────────────────────
router.get('/', requireRole('admin', 'superadmin'), (req, res) => {
  const { role, company_id } = req.user;
  const targetCompanyId = role === 'superadmin'
    ? (req.query.company_id || company_id)
    : company_id;

  if (req.user.role === 'superadmin' && req.query.company_id) {
    const co = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.query.company_id);
    if (!co) return res.status(404).json({ error: 'Company not found.' });
  }

  let companySettings = {};
  if (targetCompanyId) {
    const rows = db.prepare(
      'SELECT key, value FROM company_settings WHERE company_id = ?'
    ).all(targetCompanyId);
    companySettings = Object.fromEntries(rows.map(r => [r.key, r.value ?? '']));
  }

  const result = { settings: companySettings };

  if (role === 'superadmin') {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    result.global = Object.fromEntries(rows.map(r => [r.key, r.value ?? '']));
  }

  res.json(result);
});

// ── PUT /api/settings ─────────────────────────────────────────────────────────
const settingsSchema = z.object({
  settings: z.record(z.string(), z.string().max(2000)).optional().default({}),
  global:   z.record(z.string(), z.string().max(2000)).optional().default({}),
});

router.put('/', requireRole('admin', 'superadmin'), validate(settingsSchema), (req, res) => {
  const { role, company_id } = req.user;
  const { settings = {}, global = {} } = req.body;

  const targetCompanyId = role === 'superadmin'
    ? (req.query.company_id || company_id)
    : company_id;

  if (req.user.role === 'superadmin' && req.query.company_id) {
    const co = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.query.company_id);
    if (!co) return res.status(404).json({ error: 'Company not found.' });
  }

  const now = new Date().toISOString();

  if (targetCompanyId && Object.keys(settings).length > 0) {
    const upsert = db.prepare(`
      INSERT INTO company_settings (company_id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(company_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    const saveMany = db.transaction((entries) => {
      for (const [key, value] of entries) {
        if (ALLOWED_COMPANY_KEYS.includes(key)) {
          upsert.run(targetCompanyId, key, value === '' ? null : value, now, now);
        }
      }
    });
    saveMany(Object.entries(settings));
  }

  if (role === 'superadmin' && Object.keys(global).length > 0) {
    const upsertGlobal = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    const saveGlobal = db.transaction((entries) => {
      for (const [key, value] of entries) {
        if (ALLOWED_GLOBAL_KEYS.includes(key)) upsertGlobal.run(key, value === '' ? null : value);
      }
    });
    saveGlobal(Object.entries(global));
  }

  logAction(req.user, {
    action:     'settings.update',
    targetType: 'company',
    targetId:   targetCompanyId || null,
    companyId:  targetCompanyId || null,
  });

  res.json({ ok: true });
});

export default router;
