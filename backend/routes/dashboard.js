/**
 * @module routes/dashboard
 * Admin cross-site dashboard aggregation.
 */
import { Router }      from 'express';
import db              from '../db/sqlite.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Module-scope prepared statements
const stmtSitesByCompany = db.prepare('SELECT id, label, color, url FROM sites WHERE company_id = ? ORDER BY label');
const stmtAllSites       = db.prepare('SELECT id, label, color, url FROM sites ORDER BY label');
const stmtGscCurr        = db.prepare(`
  SELECT
    COALESCE(SUM(clicks), 0)      AS clicks,
    COALESCE(SUM(impressions), 0) AS impressions,
    CASE WHEN COALESCE(SUM(impressions), 0) > 0
         THEN CAST(SUM(clicks) AS REAL) / SUM(impressions)
         ELSE 0 END               AS ctr,
    COALESCE(AVG(position), 0)    AS position
  FROM gsc_cache WHERE site_id = ? AND period = 'current'
`);
const stmtGscPrev = db.prepare(`
  SELECT COALESCE(SUM(clicks), 0) AS clicks, COALESCE(SUM(impressions), 0) AS impressions
  FROM gsc_cache WHERE site_id = ? AND period = 'previous'
`);
const stmtGa4 = db.prepare(`
  SELECT
    COALESCE(SUM(sessions), 0)             AS sessions,
    COALESCE(AVG(bounce_rate), 0)          AS bounce_rate,
    COALESCE(AVG(avg_session_duration), 0) AS avg_duration
  FROM ga4_cache WHERE site_id = ?
`);
const stmtJob = db.prepare(`
  SELECT health_score, completed_at
  FROM crawl_jobs WHERE site_id = ? AND status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
`);
const stmtTasksByCompany = db.prepare('SELECT status, COUNT(*) AS cnt FROM task_status WHERE company_id = ? GROUP BY status');
const stmtAllTasks       = db.prepare('SELECT status, COUNT(*) AS cnt FROM task_status GROUP BY status');

// ─── GET /api/dashboard/admin ─────────────────────────────────────────────────
router.get('/admin', requireRole('admin', 'superadmin'), (req, res) => {
  const { company_id, role } = req.user;

  try {
    const sites = role === 'superadmin'
      ? stmtAllSites.all()
      : stmtSitesByCompany.all(company_id);

    const result = sites.map(site => {
      const gscCurr = stmtGscCurr.get(site.id);
      const gscPrev = stmtGscPrev.get(site.id);
      const hasGsc  = gscCurr.clicks > 0 || gscCurr.impressions > 0;
      const ga4     = stmtGa4.get(site.id);
      const hasGa4  = ga4.sessions > 0;
      const job     = stmtJob.get(site.id);

      return {
        id:           site.id,
        label:        site.label,
        color:        site.color,
        url:          site.url,
        gsc:          hasGsc ? {
          clicks:            gscCurr.clicks,
          impressions:       gscCurr.impressions,
          ctr:               gscCurr.ctr,
          position:          gscCurr.position,
          clicks_delta:      gscCurr.clicks - gscPrev.clicks,
          impressions_delta: gscCurr.impressions - gscPrev.impressions,
        } : null,
        ga4:          hasGa4 ? {
          sessions:    ga4.sessions,
          bounce_rate: ga4.bounce_rate,
          avg_duration: ga4.avg_duration,
        } : null,
        health_score: job?.health_score ?? null,
        last_crawl:   job?.completed_at ?? null,
      };
    });

    const taskRows = role === 'superadmin'
      ? stmtAllTasks.all()
      : stmtTasksByCompany.all(company_id);

    // Intentional whitelist: only these four status values are surfaced
    const task_summary = { backlog: 0, in_progress: 0, review: 0, done: 0 };
    for (const row of taskRows) {
      if (row.status in task_summary) task_summary[row.status] = row.cnt;
    }

    res.json({ sites: result, task_summary });
  } catch (err) {
    console.error('[dashboard] GET /admin error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

export default router;
