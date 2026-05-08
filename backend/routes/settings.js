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
import {
  getGlobalSetting, setGlobalSetting,
  getCompanySetting, setCompanySetting,
  SECRET_KEYS,
} from '../services/secret-store.js';

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
    for (const key of ALLOWED_COMPANY_KEYS) {
      // Secret keys never leave the backend in cleartext — return a sentinel
      // that the UI can render as "••• saved" without exposing the value.
      if (SECRET_KEYS.has(key)) {
        const present = db.prepare(
          'SELECT 1 FROM company_settings WHERE company_id = ? AND key = ? AND value IS NOT NULL AND value != ""'
        ).get(targetCompanyId, key);
        companySettings[key] = present ? '__set__' : '';
      } else {
        companySettings[key] = getCompanySetting(targetCompanyId, key) ?? '';
      }
    }
  }

  const result = { settings: companySettings };

  if (role === 'superadmin') {
    result.global = {};
    for (const key of ALLOWED_GLOBAL_KEYS) {
      if (SECRET_KEYS.has(key)) {
        const present = db.prepare(
          "SELECT 1 FROM settings WHERE key = ? AND value IS NOT NULL AND value != ''"
        ).get(key);
        result.global[key] = present ? '__set__' : '';
      } else {
        result.global[key] = getGlobalSetting(key) ?? '';
      }
    }
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

  // Skip the "__set__" sentinel — the UI sends it when the user hasn't touched
  // a secret field, so we leave the existing stored value intact.
  const isSentinel = (v) => v === '__set__';

  if (targetCompanyId && Object.keys(settings).length > 0) {
    const saveMany = db.transaction((entries) => {
      for (const [key, value] of entries) {
        if (!ALLOWED_COMPANY_KEYS.includes(key)) continue;
        if (isSentinel(value)) continue;
        setCompanySetting(targetCompanyId, key, value);
      }
    });
    saveMany(Object.entries(settings));
  }

  if (role === 'superadmin' && Object.keys(global).length > 0) {
    const saveGlobal = db.transaction((entries) => {
      for (const [key, value] of entries) {
        if (!ALLOWED_GLOBAL_KEYS.includes(key)) continue;
        if (isSentinel(value)) continue;
        setGlobalSetting(key, value);
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
