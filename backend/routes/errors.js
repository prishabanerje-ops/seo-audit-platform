import { Router } from 'express';
import { z }      from 'zod';
import db          from '../db/sqlite.js';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const errorSchema = z.object({
  level:   z.enum(['error', 'warn', 'info']).default('error'),
  source:  z.enum(['frontend', 'backend']).default('frontend'),
  message: z.string().max(1000),
  stack:   z.string().max(5000).optional(),
  url:     z.string().max(500).optional(),
});

// POST /api/errors — frontend error reporting (public)
router.post('/', validate(errorSchema), (req, res) => {
  const { level, source, message, stack, url } = req.body;
  const userId = req.user?.sub || null;

  try {
    db.prepare(`
      INSERT INTO error_log (level, source, message, stack, user_id, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(level, source, message, stack || null, userId, url || null);
  } catch {
    // Never fail the client because of logging
  }

  res.status(204).end();
});

// GET /api/errors — admin-only list
router.get('/', requireRole('admin', 'superadmin'), (req, res) => {
  const { limit = 100, offset = 0, level } = req.query;

  let sql = 'SELECT * FROM error_log';
  const params = [];
  if (level) { sql += ' WHERE level = ?'; params.push(level); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows  = db.prepare(sql).all(...params);
  const { c } = db.prepare(
    level ? 'SELECT COUNT(*) AS c FROM error_log WHERE level = ?' : 'SELECT COUNT(*) AS c FROM error_log'
  ).get(...(level ? [level] : []));

  res.json({ errors: rows, total: c });
});

export default router;
