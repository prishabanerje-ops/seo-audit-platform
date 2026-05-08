/**
 * @module routes/notifications
 * Notification CRUD — reads/writes to notifications table.
 * Scoped by user_id and company_id (non-superadmin only).
 */
import { Router } from 'express';
import db          from '../db/sqlite.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the WHERE clause fragments for user + company scoping.
 * Superadmin: filter by user_id only (no company_id guarantee).
 * Everyone else: filter by user_id AND company_id.
 */
function buildScopeClause(user) {
  const { sub, company_id, role } = user;
  if (role === 'superadmin') {
    return { clause: 'user_id = ?', params: [sub] };
  }
  return { clause: 'user_id = ? AND company_id = ?', params: [sub, company_id] };
}

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { unread } = req.query;
    const { clause, params } = buildScopeClause(req.user);

    // Total unread count (always, regardless of ?unread filter)
    const { unread_count } = db.prepare(
      `SELECT COUNT(*) AS unread_count FROM notifications WHERE ${clause} AND is_read = 0`
    ).get(...params);

    // Main query — optionally filtered to unread only
    let query = `SELECT id, type, title, body, link, is_read, created_at
                 FROM notifications
                 WHERE ${clause}`;
    const queryParams = [...params];

    if (unread === 'true') {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const notifications = db.prepare(query).all(...queryParams);

    res.json({ notifications, unread_count });
  } catch (err) {
    console.error('[notifications] GET / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
// Must be registered BEFORE /:id routes so Express doesn't treat "read-all" as an id.
router.patch('/read-all', (req, res) => {
  try {
    const { clause, params } = buildScopeClause(req.user);

    const result = db.prepare(
      `UPDATE notifications SET is_read = 1 WHERE ${clause} AND is_read = 0`
    ).run(...params);

    res.json({ updated: result.changes });
  } catch (err) {
    console.error('[notifications] PATCH /read-all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch('/:id/read', (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership + company scope before updating
    const { clause, params } = buildScopeClause(req.user);
    const existing = db.prepare(
      `SELECT id FROM notifications WHERE id = ? AND ${clause}`
    ).get(id, ...params);

    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);

    res.json({ ok: true });
  } catch (err) {
    console.error('[notifications] PATCH /:id/read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership + company scope before deleting
    const { clause, params } = buildScopeClause(req.user);
    const existing = db.prepare(
      `SELECT id FROM notifications WHERE id = ? AND ${clause}`
    ).get(id, ...params);

    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);

    res.status(204).send();
  } catch (err) {
    console.error('[notifications] DELETE /:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
