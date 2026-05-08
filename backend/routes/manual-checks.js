/**
 * @module routes/manual-checks
 * Per-site manual check results — GET list + PUT upsert.
 */
import { Router }      from 'express';
import { requireRole } from '../middleware/auth.js';
import db              from '../db/sqlite.js';

const router = Router();
const VALID_STATUSES = new Set(['pass', 'fail', 'needs_review']);

// ─── GET /:siteId/manual-checks ──────────────────────────────────────────────
router.get('/:siteId/manual-checks', (req, res) => {
  try {
    const siteId = req.params.siteId;
    const site   = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (req.user.role !== 'superadmin' && site.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const checks = db.prepare(`
      SELECT
        ac.check_number,
        ac.name,
        ac.category,
        ac.severity_default,
        ac.implementation_rule,
        mcr.status,
        mcr.notes,
        mcr.updated_at
      FROM audit_checks ac
      LEFT JOIN manual_check_results mcr
        ON mcr.check_number = ac.check_number AND mcr.site_id = ?
      WHERE ac.automation_type = 'manual'
      ORDER BY ac.category, ac.check_number
    `).all(siteId);

    res.json({ checks });
  } catch (err) {
    console.error('[manual-checks] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /:siteId/manual-checks/:checkNum ────────────────────────────────────
router.put('/:siteId/manual-checks/:checkNum', requireRole('admin', 'seo', 'superadmin'), (req, res) => {
  try {
    const siteId   = req.params.siteId;
    const checkNum = parseInt(req.params.checkNum, 10);
    if (isNaN(checkNum)) return res.status(400).json({ error: 'Invalid checkNum' });
    const { status, notes } = req.body;
    if (notes && notes.length > 5000) {
      return res.status(400).json({ error: 'notes must be 5000 characters or fewer' });
    }

    if (status !== null && status !== undefined && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: "status must be 'pass', 'fail', 'needs_review', or null" });
    }

    const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (req.user.role !== 'superadmin' && site.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const check = db.prepare(
      "SELECT check_number FROM audit_checks WHERE check_number = ? AND automation_type = 'manual'"
    ).get(checkNum);
    if (!check) return res.status(404).json({ error: 'Manual check not found' });

    db.prepare(`
      INSERT INTO manual_check_results (site_id, check_number, status, notes, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(site_id, check_number) DO UPDATE SET
        status     = excluded.status,
        notes      = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).run(siteId, checkNum, status ?? null, (notes ?? '').trim() || null);

    const row = db.prepare(`
      SELECT
        ac.check_number, ac.name, ac.category, ac.severity_default, ac.implementation_rule,
        mcr.status, mcr.notes, mcr.updated_at
      FROM audit_checks ac
      LEFT JOIN manual_check_results mcr
        ON mcr.check_number = ac.check_number AND mcr.site_id = ?
      WHERE ac.check_number = ?
    `).get(siteId, checkNum);

    res.json(row);
  } catch (err) {
    console.error('[manual-checks] PUT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
