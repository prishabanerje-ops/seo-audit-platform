/**
 * @module routes/audit-log
 * Read-only view of the audit_log table — superadmin only.
 */
import { Router } from 'express';
import db         from '../db/sqlite.js';
import { requireSuperAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireSuperAdmin);

// ─── GET /api/audit-log ───────────────────────────────────────────────────────
/**
 * @route GET /api/audit-log
 * @desc  Returns paginated audit log entries, newest first.
 * @query limit      {number} default 50
 * @query offset     {number} default 0
 * @query company_id {string} filter by company
 * @query action     {string} partial match on action field
 * @access superadmin
 */
router.get('/', (req, res) => {
  const limit  = Math.min(Number(req.query.limit)  || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const { company_id, action } = req.query;

  const conditions = [];
  const params     = [];

  if (company_id) {
    conditions.push('a.company_id = ?');
    params.push(company_id);
  }
  if (action) {
    conditions.push('a.action LIKE ?');
    params.push(`%${action}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const entries = db.prepare(`
    SELECT a.*, c.name AS company_name
    FROM   audit_log a
    LEFT   JOIN companies c ON a.company_id = c.id
    ${where}
    ORDER  BY a.created_at DESC
    LIMIT  ? OFFSET ?
  `).all(...params, limit, offset);

  const { total } = db.prepare(`
    SELECT COUNT(*) AS total
    FROM   audit_log a
    ${where}
  `).get(...params);

  res.json({ entries, total, limit, offset });
});

export default router;
