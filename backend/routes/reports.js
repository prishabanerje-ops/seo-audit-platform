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

// ─── GET /api/reports/results/:resultId ──────────────────────────────────────
/**
 * @route GET /api/reports/results/:resultId
 * @desc  Returns a single audit result row plus its matching audit_checks entry.
 * @access auth
 */
router.get('/results/:resultId', (req, res) => {
  try {
    const { resultId } = req.params;
    const { company_id, role } = req.user;

    const result = db.prepare(`
      SELECT id, url, issue_type, section, severity, data, company_id
      FROM audit_results
      WHERE id = ?
    `).get(resultId);

    if (!result) return res.status(404).json({ error: 'Result not found' });
    if (role !== 'superadmin' && result.company_id !== company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const check = db.prepare(`
      SELECT id, name, description, seo_impact, implementation_rule, subsection
      FROM audit_checks
      WHERE name = ?
    `).get(result.issue_type) || null;

    res.json({ result, check });
  } catch (err) {
    console.error('[reports] GET /results/:resultId error:', err);
    res.status(500).json({ error: 'Failed to load result' });
  }
});

// ─── GET /api/reports/:siteId/category ───────────────────────────────────────
/**
 * @route GET /api/reports/:siteId/category
 * @desc  Returns grouped issue counts by issue_type+severity for a given section.
 *        Uses the latest completed crawl job unless job_id is provided.
 * @access auth
 */
router.get('/:siteId/category', (req, res) => {
  try {
  const { siteId } = req.params;
  const { section, job_id } = req.query;
  const { company_id, role } = req.user;

  if (!section) return res.status(400).json({ error: 'section param is required' });

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let jobId = job_id || null;
  if (jobId) {
    const jobCheck = db.prepare(
      'SELECT id FROM crawl_jobs WHERE id = ? AND site_id = ?'
    ).get(jobId, siteId);
    if (!jobCheck) return res.status(404).json({ error: 'Job not found for this site' });
  }
  if (!jobId) {
    const latestJob = db.prepare(`
      SELECT id FROM crawl_jobs
      WHERE site_id = ? AND status = 'completed'
      ORDER BY started_at DESC LIMIT 1
    `).get(siteId);
    jobId = latestJob?.id || null;
  }

  if (!jobId) {
    return res.json({ jobId: null, section, groups: [] });
  }

  const groups = db.prepare(`
    SELECT issue_type, severity, COUNT(*) AS count
    FROM audit_results
    WHERE crawl_job_id = ? AND section = ?
    GROUP BY issue_type, severity
    ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
      count DESC
  `).all(jobId, section);

  res.json({ jobId, section, groups });
  } catch (err) {
    console.error('[reports] GET /:siteId/category error:', err);
    res.status(500).json({ error: 'Failed to load category data' });
  }
});

// ─── GET /api/reports/:siteId/issues ─────────────────────────────────────────
/**
 * @route GET /api/reports/:siteId/issues
 * @desc  Returns paginated individual audit results for a given section + issue_type.
 *        Uses the latest completed crawl job unless job_id is provided.
 * @access auth
 */
router.get('/:siteId/issues', (req, res) => {
  try {
  const { siteId } = req.params;
  const { section, issue_type, job_id, limit: rawLimit, offset: rawOffset } = req.query;
  const { company_id, role } = req.user;

  if (!section)    return res.status(400).json({ error: 'section param is required' });
  if (!issue_type) return res.status(400).json({ error: 'issue_type param is required' });

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const limit  = Math.min(Math.max(parseInt(rawLimit  || '50',  10) || 50,  1), 200);
  const offset = Math.max(parseInt(rawOffset || '0',   10) || 0,  0);

  let jobId = job_id || null;
  if (jobId) {
    const jobCheck = db.prepare(
      'SELECT id FROM crawl_jobs WHERE id = ? AND site_id = ?'
    ).get(jobId, siteId);
    if (!jobCheck) return res.status(404).json({ error: 'Job not found for this site' });
  }
  if (!jobId) {
    const latestJob = db.prepare(`
      SELECT id FROM crawl_jobs
      WHERE site_id = ? AND status = 'completed'
      ORDER BY started_at DESC LIMIT 1
    `).get(siteId);
    jobId = latestJob?.id || null;
  }

  if (!jobId) {
    return res.json({ results: [], total: 0, limit, offset });
  }

  const results = db.prepare(`
    SELECT id, url, severity, data
    FROM audit_results
    WHERE crawl_job_id = ? AND section = ? AND issue_type = ?
    ORDER BY url
    LIMIT ? OFFSET ?
  `).all(jobId, section, issue_type, limit, offset);

  const { total } = db.prepare(`
    SELECT COUNT(*) AS total
    FROM audit_results
    WHERE crawl_job_id = ? AND section = ? AND issue_type = ?
  `).get(jobId, section, issue_type);

  res.json({ results, total, limit, offset });
  } catch (err) {
    console.error('[reports] GET /:siteId/issues error:', err);
    res.status(500).json({ error: 'Failed to load issues' });
  }
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

// ─── GET /api/reports/:siteId/developer-summary ───────────────────────────────
router.get('/:siteId/developer-summary', (req, res) => {
  try {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const latestJob = db.prepare(`
    SELECT id, total_urls, health_score, started_at, completed_at
    FROM crawl_jobs WHERE site_id = ? AND status = 'completed'
    ORDER BY started_at DESC LIMIT 1
  `).get(siteId);

  if (!latestJob) {
    return res.json({ job: null, response_codes: {}, top_issues: [], custom_extraction: [] });
  }

  // Duration in seconds
  const durationSeconds = latestJob.started_at && latestJob.completed_at
    ? Math.round((new Date(latestJob.completed_at) - new Date(latestJob.started_at)) / 1000)
    : null;

  // Response code buckets from audit_results
  const rcRows = db.prepare(`
    SELECT issue_type, COUNT(*) AS cnt
    FROM audit_results
    WHERE crawl_job_id = ? AND section = 'Response Codes'
    GROUP BY issue_type
  `).all(latestJob.id);

  const response_codes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  for (const row of rcRows) {
    // issue_type strings like "404 Not Found", "301 Redirect", "200 OK"
    const code = parseInt(row.issue_type, 10);
    if (code >= 200 && code < 300) response_codes['2xx'] += row.cnt;
    else if (code >= 300 && code < 400) response_codes['3xx'] += row.cnt;
    else if (code >= 400 && code < 500) response_codes['4xx'] += row.cnt;
    else if (code >= 500) response_codes['5xx'] += row.cnt;
  }

  // Top 10 issues by count across all sections
  const SECTION_SLUG = {
    'Response Codes':           'response-codes',
    'Canonical':                'canonicals',
    'Robots / Indexability':    'robots',
    'Sitemap':                  'sitemap',
    'URL Structure':            'crawl-depth',
    'Title Tags':               'title-tags',
    'Meta Description':         'meta-desc',
    'Headings':                 'headings',
    'Internal Linking':         'links',
    'Images':                   'images',
    'Schema / Structured Data': 'structured-data',
    'Content':                  'content',
    'Speed & Performance':      'page-speed',
    'Mobile SEO':               'mobile',
    'JavaScript Rendering':     'custom',
    'International SEO':        'international',
    'Monitoring & Operations':  'security',
    'Rankings & Traffic Drops': 'custom',
    'LLM / AI Crawlers':        'custom',
  };

  const topIssueRows = db.prepare(`
    SELECT
      issue_type,
      section,
      MIN(CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END) AS sev_rank,
      COUNT(*) AS count
    FROM audit_results
    WHERE crawl_job_id = ?
    GROUP BY issue_type, section
    ORDER BY sev_rank, count DESC
    LIMIT 10
  `).all(latestJob.id);

  const SEV_LABEL = { 1: 'critical', 2: 'warning', 3: 'info' };

  const top_issues = topIssueRows.map(r => ({
    issue_type: r.issue_type,
    section:    r.section,
    severity:   SEV_LABEL[r.sev_rank] || 'info',
    count:      r.count,
    slug:       SECTION_SLUG[r.section] || 'custom',
  }));

  // Custom extraction results
  const custom_extraction = db.prepare(`
    SELECT issue_type, url, data
    FROM audit_results
    WHERE crawl_job_id = ? AND section = 'Custom Extraction'
    LIMIT 50
  `).all(latestJob.id);

  res.json({
    job: {
      id:               latestJob.id,
      total_urls:       latestJob.total_urls,
      health_score:     latestJob.health_score,
      started_at:       latestJob.started_at,
      completed_at:     latestJob.completed_at,
      duration_seconds: durationSeconds,
    },
    response_codes,
    top_issues,
    custom_extraction,
  });
  } catch (err) {
    console.error('[reports] GET /:siteId/developer-summary error:', err);
    res.status(500).json({ error: 'Failed to load developer summary' });
  }
});

export default router;
