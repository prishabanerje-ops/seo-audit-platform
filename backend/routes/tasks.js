/**
 * @module routes/tasks
 * Task board CRUD — reads/writes to task_status and task_comments tables.
 */
import { Router }     from 'express';
import { randomUUID } from 'crypto';
import db             from '../db/sqlite.js';

const router = Router();

const VALID_STATUSES   = ['backlog', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

function groupByStatus(tasks) {
  const kanban = { backlog: [], in_progress: [], review: [], done: [] };
  for (const t of tasks) {
    if (t.status in kanban) kanban[t.status].push(t);
  }
  return kanban;
}

function verifyTaskOwnership(taskId, companyId, role) {
  const task = db.prepare(`
    SELECT t.id, s.company_id
    FROM task_status t
    JOIN sites s ON s.id = t.site_id
    WHERE t.id = ?
  `).get(taskId);
  if (!task) return { error: 'Task not found', status: 404 };
  if (role !== 'superadmin' && task.company_id !== companyId) {
    return { error: 'Access denied', status: 403 };
  }
  return { task };
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { siteId, status, assigneeId } = req.query;
    const { company_id, role } = req.user;

    let query = `
      SELECT t.*,
        u.name  AS assignee_name,
        u.email AS assignee_email,
        s.label AS site_label,
        s.color AS site_color
      FROM task_status t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN sites s ON s.id = t.site_id
      WHERE (? = 'superadmin' OR s.company_id = ?)
    `;
    const params = [role, company_id];

    if (siteId)     { query += ' AND t.site_id = ?';     params.push(siteId); }
    if (status)     { query += ' AND t.status = ?';      params.push(status); }
    if (assigneeId) { query += ' AND t.assignee_id = ?'; params.push(assigneeId); }

    query += ' ORDER BY t.created_at DESC';

    const tasks = db.prepare(query).all(...params);
    res.json({ tasks, kanban: groupByStatus(tasks) });
  } catch (err) {
    console.error('[tasks] GET / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { site_id, title, description, priority, assignee_id, due_date } = req.body;
    const { company_id, role, sub } = req.user;

    if (!title)   return res.status(400).json({ error: 'title is required' });
    if (!site_id) return res.status(400).json({ error: 'site_id is required' });

    const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(site_id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (role !== 'superadmin' && site.company_id !== company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const resolvedPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
    const id  = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO task_status
        (id, site_id, title, description, status, priority, assignee_id, due_date,
         company_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?, ?, ?, ?, ?)
    `).run(id, site_id, title, description || null, resolvedPriority,
           assignee_id || null, due_date || null, site.company_id, sub, now, now);

    const task = db.prepare(`
      SELECT t.*, u.name AS assignee_name, u.email AS assignee_email,
        s.label AS site_label, s.color AS site_color
      FROM task_status t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN sites s ON s.id = t.site_id
      WHERE t.id = ?
    `).get(id);

    res.status(201).json({ task });
  } catch (err) {
    console.error('[tasks] POST / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, role } = req.user;
    const { status, priority, assignee_id, due_date, title, description } = req.body;

    // Validate status if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    const check = verifyTaskOwnership(id, company_id, role);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const fields = [];
    const params = [];

    if (status      !== undefined) { fields.push('status = ?');      params.push(status); }
    if (priority    !== undefined) { fields.push('priority = ?');     params.push(priority); }
    if (assignee_id !== undefined) { fields.push('assignee_id = ?'); params.push(assignee_id); }
    if (due_date    !== undefined) { fields.push('due_date = ?');     params.push(due_date); }
    if (title       !== undefined) { fields.push('title = ?');        params.push(title); }
    if (description !== undefined) { fields.push('description = ?');  params.push(description); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    db.prepare(`UPDATE task_status SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    const task = db.prepare(`
      SELECT t.*, u.name AS assignee_name, u.email AS assignee_email,
        s.label AS site_label, s.color AS site_color
      FROM task_status t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN sites s ON s.id = t.site_id
      WHERE t.id = ?
    `).get(id);

    res.json({ task });
  } catch (err) {
    console.error('[tasks] PATCH /:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, role } = req.user;

    const check = verifyTaskOwnership(id, company_id, role);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const task = db.prepare(`
      SELECT t.*, u.name AS assignee_name, u.email AS assignee_email,
        s.label AS site_label, s.color AS site_color
      FROM task_status t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN sites s ON s.id = t.site_id
      WHERE t.id = ?
    `).get(id);

    const comments = db.prepare(`
      SELECT c.id, c.body, c.created_at, u.name AS user_name, u.email AS user_email
      FROM task_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `).all(id);

    res.json({ task, comments });
  } catch (err) {
    console.error('[tasks] GET /:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/tasks/:id/comments ─────────────────────────────────────────────
router.post('/:id/comments', (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    const { company_id, role, sub } = req.user;

    if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });

    const check = verifyTaskOwnership(id, company_id, role);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const insertResult = db.prepare(
      'INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)'
    ).run(id, sub, body.trim());

    const comment = db.prepare(`
      SELECT c.id, c.body, c.created_at, u.name AS user_name, u.email AS user_email
      FROM task_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `).get(insertResult.lastInsertRowid);

    res.status(201).json({ comment });
  } catch (err) {
    console.error('[tasks] POST /:id/comments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
