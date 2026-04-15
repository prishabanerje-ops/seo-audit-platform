/**
 * @module routes/reports
 * Audit health summary, trend history, and check registry counts.
 */
import { Router } from 'express';
import db         from '../db/sqlite.js';

const router = Router();

// ─── GET /api/reports/checks/count ───────────────────────────────────────────
/**
 * @route GET /api/reports/checks/count
 * @desc  Returns total number of seeded audit checks.
 * @access auth
 */
router.get('/checks/count', (req, res) => {
  const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM audit_checks').get();
  res.json({ total: cnt, seeded: cnt > 0 });
});

// ─── GET /api/reports/:siteId/summary ────────────────────────────────────────
/**
 * @route GET /api/reports/:siteId/summary
 * @desc  Computes live audit health score from latest completed crawl job for the site.
 *        Returns per-category breakdown, total counts, health score, and check registry counts.
 * @access auth
 */
router.get('/:siteId/summary', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  // Verify site exists and belongs to caller's company
  const site = db.prepare('SELECT id, label, url, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get latest completed crawl job
  const latestJob = db.prepare(`
    SELECT id, total_urls, health_score, started_at, completed_at
    FROM crawl_jobs
    WHERE site_id = ? AND status = 'completed'
    ORDER BY started_at DESC LIMIT 1
  `).get(siteId);

  if (!latestJob) {
    return res.json({
      jobId:       null,
      totalUrls:   0,
      healthScore: null,
      totals:      { critical: 0, warning: 0, info: 0 },
      sections:    {},
      checkCounts: [],
    });
  }

  // Count severities per section
  const sectionCounts = db.prepare(`
    SELECT section, severity, COUNT(*) AS count
    FROM audit_results
    WHERE crawl_job_id = ?
    GROUP BY section, severity
  `).all(latestJob.id);

  // Aggregate into sections object
  const sections = {};
  for (const row of sectionCounts) {
    if (!sections[row.section]) {
      sections[row.section] = { critical: 0, warning: 0, info: 0, ok: 0 };
    }
    sections[row.section][row.severity] = (sections[row.section][row.severity] || 0) + row.count;
  }

  // Compute health score
  const totals = Object.values(sections).reduce(
    (acc, s) => ({
      critical: acc.critical + (s.critical || 0),
      warning:  acc.warning  + (s.warning  || 0),
      info:     acc.info     + (s.info     || 0),
    }),
    { critical: 0, warning: 0, info: 0 }
  );

  const totalUrls  = Math.max(latestJob.total_urls || 1, 1);
  const penalty    = (totals.critical * 3 + totals.warning * 2 + totals.info * 1);
  const healthScore = Math.max(0, Math.round(100 - (penalty / totalUrls) * 10));

  // Persist computed score back to crawl_jobs for Sites list display
  if (latestJob.health_score === null) {
    db.prepare('UPDATE crawl_jobs SET health_score = ? WHERE id = ?')
      .run(healthScore, latestJob.id);
  }

  // Audit check counts per category (for accordion headers)
  const checkCounts = db.prepare(`
    SELECT category, severity_default, COUNT(*) AS total
    FROM audit_checks
    GROUP BY category, severity_default
  `).all();

  // All individual checks — used to render per-check rows in accordion
  const allChecks = db.prepare(`
    SELECT name, category, severity_default
    FROM audit_checks
    ORDER BY category, check_number
  `).all();

  // Per-issue_type counts for this crawl job
  const issueTypeCounts = db.prepare(`
    SELECT issue_type, COUNT(*) AS count
    FROM audit_results
    WHERE crawl_job_id = ?
    GROUP BY issue_type
  `).all(latestJob.id);

  // Which sections have any audit data (determines pass vs no-data)
  const coveredSections = db.prepare(`
    SELECT DISTINCT section FROM audit_results WHERE crawl_job_id = ?
  `).all(latestJob.id).map(r => r.section);

  res.json({
    jobId:          latestJob.id,
    totalUrls:      latestJob.total_urls,
    startedAt:      latestJob.started_at,
    completedAt:    latestJob.completed_at,
    healthScore,
    totals,
    sections,
    checkCounts,
    allChecks,
    issueTypeCounts,
    coveredSections,
  });
});

// ─── GET /api/reports/:siteId/trend ──────────────────────────────────────────
/**
 * @route GET /api/reports/:siteId/trend
 * @desc  Returns health score history for the last 10 completed crawl jobs.
 * @access auth
 */
router.get('/:siteId/trend', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const jobs = db.prepare(`
    SELECT id, started_at, completed_at, health_score, total_urls
    FROM crawl_jobs
    WHERE site_id = ? AND status = 'completed'
    ORDER BY started_at DESC LIMIT 10
  `).all(siteId);

  // Return in chronological order for charts
  res.json({ trend: jobs.reverse() });
});

export default router;
