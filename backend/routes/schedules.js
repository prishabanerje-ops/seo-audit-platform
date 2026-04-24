/**
 * Schedules routes — CRUD for automated crawl schedules.
 * All routes are company-scoped. Superadmins may pass ?company_id= on GET.
 */
import { Router } from 'express';
import { randomUUID } from 'crypto';
import cron from 'node-cron';
import db from '../db/sqlite.js';
import {
  registerSchedule,
  unregisterSchedule,
  reloadSchedule,
} from '../services/schedule.service.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSchedule(row) {
  return {
    ...row,
    site_ids:      _tryParse(row.site_ids,      []),
    crawl_results: _tryParse(row.crawl_results,  []),
    notify_slack:  Boolean(row.notify_slack),
    notify_email:  Boolean(row.notify_email),
    enabled:       Boolean(row.enabled),
  };
}

function _tryParse(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function _resolveCompanyId(req) {
  const { company_id, role } = req.user;
  return role === 'superadmin'
    ? (req.query.company_id || req.body.company_id || null)
    : company_id;
}

// ─── GET /api/schedules ───────────────────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    const cid = _resolveCompanyId(req);
    if (!cid) return res.status(400).json({ error: 'company_id query param is required for superadmin' });

    const rows = db.prepare(
      `SELECT * FROM schedules WHERE company_id = ? ORDER BY created_at DESC`
    ).all(cid);

    res.json({ schedules: rows.map(parseSchedule) });
  } catch (err) {
    console.error('[schedules] GET /', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/schedules ──────────────────────────────────────────────────────

router.post('/', (req, res) => {
  try {
    const { site_ids, cron_expression, notify_slack = false, notify_email = false } = req.body;

    // Validate site_ids
    if (!Array.isArray(site_ids) || site_ids.length === 0) {
      return res.status(400).json({ error: 'site_ids must be a non-empty array' });
    }

    // Validate cron expression
    if (!cron_expression || !cron.validate(cron_expression)) {
      return res.status(400).json({ error: 'Invalid cron_expression' });
    }

    const { company_id, role } = req.user;
    const cid = role === 'superadmin'
      ? (req.body.company_id || company_id)
      : company_id;

    if (!cid) {
      return res.status(400).json({ error: 'company_id is required' });
    }

    // Verify all site_ids belong to this company (single IN-list query, not N+1)
    {
      const placeholders = site_ids.map(() => '?').join(',');
      const found = db.prepare(
        `SELECT id FROM sites WHERE company_id = ? AND id IN (${placeholders})`
      ).all(cid, ...site_ids).map(r => r.id);
      const missing = site_ids.filter(id => !found.includes(id));
      if (missing.length) {
        return res.status(400).json({ error: `Site ${missing[0]} not found or does not belong to this company` });
      }
    }

    const id  = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO schedules
        (id, site_ids, cron_expression, notify_slack, notify_email, enabled, crawl_results, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, 1, '[]', ?, ?)
    `).run(
      id,
      JSON.stringify(site_ids),
      cron_expression,
      notify_slack ? 1 : 0,
      notify_email ? 1 : 0,
      cid,
      now,
    );

    const row = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(id);

    // Register immediately with the cron scheduler
    const io = req.app.get('io');
    registerSchedule(row, db, io);

    res.status(201).json({ schedule: parseSchedule(row) });
  } catch (err) {
    console.error('[schedules] POST /', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/schedules/:id ─────────────────────────────────────────────────

router.patch('/:id', (req, res) => {
  try {
    const { company_id, role } = req.user;
    const row = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(req.params.id);

    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    if (role !== 'superadmin' && row.company_id !== company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { site_ids, cron_expression, notify_slack, notify_email, enabled } = req.body;

    // Validate cron if provided
    if (cron_expression !== undefined && !cron.validate(cron_expression)) {
      return res.status(400).json({ error: 'Invalid cron_expression' });
    }

    // Validate site_ids if provided
    if (site_ids !== undefined) {
      if (!Array.isArray(site_ids) || site_ids.length === 0) {
        return res.status(400).json({ error: 'site_ids must be a non-empty array' });
      }
      const cid = row.company_id;
      const placeholders = site_ids.map(() => '?').join(',');
      const found = db.prepare(
        `SELECT id FROM sites WHERE company_id = ? AND id IN (${placeholders})`
      ).all(cid, ...site_ids).map(r => r.id);
      const missing = site_ids.filter(id => !found.includes(id));
      if (missing.length) {
        return res.status(400).json({ error: `Site ${missing[0]} not found or does not belong to this company` });
      }
    }

    // Build update
    const updates = {};
    if (site_ids        !== undefined) updates.site_ids        = JSON.stringify(site_ids);
    if (cron_expression !== undefined) updates.cron_expression = cron_expression;
    if (notify_slack    !== undefined) updates.notify_slack    = notify_slack ? 1 : 0;
    if (notify_email    !== undefined) updates.notify_email    = notify_email ? 1 : 0;
    if (enabled         !== undefined) updates.enabled         = enabled ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values     = Object.values(updates);

    db.prepare(`UPDATE schedules SET ${setClauses} WHERE id = ?`).run(...values, row.id);

    const updated = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(row.id);

    // Reload cron task when expression, enabled state, or site_ids changes
    if (cron_expression !== undefined || enabled !== undefined || site_ids !== undefined) {
      const io = req.app.get('io');
      reloadSchedule(updated, db, io);
    }

    res.json({ schedule: parseSchedule(updated) });
  } catch (err) {
    console.error('[schedules] PATCH /:id', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/schedules/:id ───────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  try {
    const { company_id, role } = req.user;
    const row = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(req.params.id);

    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    if (role !== 'superadmin' && row.company_id !== company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    unregisterSchedule(row.id);
    db.prepare(`DELETE FROM schedules WHERE id = ?`).run(row.id);

    res.status(204).end();
  } catch (err) {
    console.error('[schedules] DELETE /:id', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
