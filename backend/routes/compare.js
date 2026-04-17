/**
 * @module routes/compare
 * Compare two completed crawl jobs — issue-type-level diff.
 */
import { Router } from 'express';
import db         from '../db/sqlite.js';

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function verifyJob(jobId, companyId, role) {
  const job = db.prepare(`
    SELECT j.id, j.site_id, j.started_at, j.total_urls, j.health_score,
           s.company_id, s.label
    FROM crawl_jobs j
    JOIN sites s ON s.id = j.site_id
    WHERE j.id = ? AND j.status = 'completed'
  `).get(jobId);
  if (!job) return { error: 'Job not found', status: 404 };
  if (role !== 'superadmin' && job.company_id !== companyId) {
    return { error: 'Access denied', status: 403 };
  }
  return { job };
}

// ─── GET /api/compare/jobs ────────────────────────────────────────────────────
router.get('/jobs', (req, res) => {
  try {
    const { company_id, role } = req.user;

    const jobs = role === 'superadmin'
      ? db.prepare(`
          SELECT j.id, j.site_id AS siteId, s.label AS siteLabel,
                 j.started_at AS startedAt, j.total_urls AS totalUrls, j.health_score AS healthScore
          FROM crawl_jobs j
          JOIN sites s ON s.id = j.site_id
          WHERE j.status = 'completed'
          ORDER BY j.started_at DESC
        `).all()
      : db.prepare(`
          SELECT j.id, j.site_id AS siteId, s.label AS siteLabel,
                 j.started_at AS startedAt, j.total_urls AS totalUrls, j.health_score AS healthScore
          FROM crawl_jobs j
          JOIN sites s ON s.id = j.site_id
          WHERE j.status = 'completed' AND s.company_id = ?
          ORDER BY j.started_at DESC
        `).all(company_id);

    res.json({ jobs });
  } catch (err) {
    console.error('[compare] GET /jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/compare?jobA=x&jobB=y ──────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { jobA, jobB } = req.query;
    const { company_id, role } = req.user;

    if (!jobA) return res.status(400).json({ error: 'jobA is required' });
    if (!jobB) return res.status(400).json({ error: 'jobB is required' });
    if (jobA === jobB) return res.status(400).json({ error: 'Cannot compare a job with itself' });

    const checkA = verifyJob(jobA, company_id, role);
    if (checkA.error) return res.status(checkA.status).json({ error: checkA.error });

    const checkB = verifyJob(jobB, company_id, role);
    if (checkB.error) return res.status(checkB.status).json({ error: checkB.error });

    const { job: jA } = checkA;
    const { job: jB } = checkB;

    // Aggregate counts per (section, issue_type, severity) for each job
    const aggStmt = db.prepare(`
      SELECT section, issue_type, severity, COUNT(*) AS count
      FROM audit_results
      WHERE crawl_job_id = ?
      GROUP BY section, issue_type, severity
    `);
    const rowsA = aggStmt.all(jobA);
    const rowsB = aggStmt.all(jobB);

    // Build lookup maps keyed by "section|||issue_type|||severity"
    const mapA = {};
    for (const r of rowsA) mapA[`${r.section}|||${r.issue_type}|||${r.severity}`] = r.count;
    const mapB = {};
    for (const r of rowsB) mapB[`${r.section}|||${r.issue_type}|||${r.severity}`] = r.count;

    // Union of all keys
    const allKeys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

    let criticalA = 0, criticalB = 0;
    let warningA  = 0, warningB  = 0;
    let infoA     = 0, infoB     = 0;

    const rows = [];
    for (const key of allKeys) {
      const [section, issue_type, severity] = key.split('|||');
      const countA = mapA[key] || 0;
      const countB = mapB[key] || 0;
      const delta  = countB - countA; // positive = more issues in B (regression)

      if (severity === 'critical')     { criticalA += countA; criticalB += countB; }
      else if (severity === 'warning') { warningA  += countA; warningB  += countB; }
      else if (severity === 'info')    { infoA     += countA; infoB     += countB; }

      rows.push({ section, issue_type, severity, countA, countB, delta });
    }

    // Sort by absolute delta descending (biggest changes first)
    rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    res.json({
      jobA: {
        id: jA.id, siteLabel: jA.label,
        startedAt: jA.started_at, totalUrls: jA.total_urls, healthScore: jA.health_score,
      },
      jobB: {
        id: jB.id, siteLabel: jB.label,
        startedAt: jB.started_at, totalUrls: jB.total_urls, healthScore: jB.health_score,
      },
      summary: {
        scoreDelta:    (jB.health_score || 0) - (jA.health_score || 0),
        criticalDelta: criticalB - criticalA,
        warningDelta:  warningB  - warningA,
        infoDelta:     infoB     - infoA,
        urlsDelta:     (jB.total_urls || 0) - (jA.total_urls || 0),
      },
      rows,
    });
  } catch (err) {
    console.error('[compare] GET / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
