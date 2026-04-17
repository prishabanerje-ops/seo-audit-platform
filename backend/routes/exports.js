/**
 * @module routes/exports
 * Audit result exports — CSV download and Google Sheets push.
 */
import { Router } from 'express';
import db         from '../db/sqlite.js';
import { pushToSheets } from '../services/sheets.service.js';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verifySite(siteId, companyId, role) {
  const site = db.prepare(
    'SELECT id, company_id, label, sheets_tab_name, sheets_spreadsheet_id FROM sites WHERE id = ?'
  ).get(siteId);
  if (!site) return { error: 'Site not found', status: 404 };
  if (role !== 'superadmin' && site.company_id !== companyId) {
    return { error: 'Access denied', status: 403 };
  }
  return { site };
}

function verifyJob(jobId, companyId, role) {
  const job = db.prepare(`
    SELECT j.id, j.site_id, j.started_at, j.completed_at, j.total_urls, j.health_score,
           s.company_id, s.label, s.sheets_tab_name, s.sheets_spreadsheet_id
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

function buildFilterQuery(jobId, severity, sections) {
  const severityList = severity ? String(severity).split(',').filter(Boolean) : null;
  const sectionList  = sections  ? String(sections).split(',').filter(Boolean)  : null;

  let query = `
    SELECT url, section, issue_type, severity, data
    FROM audit_results
    WHERE crawl_job_id = ?
  `;
  const params = [jobId];

  if (severityList?.length) {
    query += ` AND severity IN (${severityList.map(() => '?').join(',')})`;
    params.push(...severityList);
  }
  if (sectionList?.length) {
    query += ` AND section IN (${sectionList.map(() => '?').join(',')})`;
    params.push(...sectionList);
  }

  query += ' ORDER BY section, severity, url';
  return { query, params };
}

// ─── GET /api/exports/jobs?siteId=x ──────────────────────────────────────────
router.get('/jobs', (req, res) => {
  try {
    const { siteId } = req.query;
    const { company_id, role } = req.user;

    if (!siteId) return res.status(400).json({ error: 'siteId is required' });

    const check = verifySite(siteId, company_id, role);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const jobs = db.prepare(`
      SELECT id, started_at, completed_at, total_urls, health_score
      FROM crawl_jobs
      WHERE site_id = ? AND status = 'completed'
      ORDER BY started_at DESC
    `).all(siteId);

    res.json({ jobs });
  } catch (err) {
    console.error('[exports] GET /jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/exports/sections?jobId=x ───────────────────────────────────────
router.get('/sections', (req, res) => {
  try {
    const { jobId } = req.query;
    const { company_id, role } = req.user;

    if (!jobId) return res.status(400).json({ error: 'jobId is required' });

    const check = verifyJob(jobId, company_id, role);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const sections = db.prepare(`
      SELECT DISTINCT section FROM audit_results
      WHERE crawl_job_id = ?
      ORDER BY section
    `).all(jobId).map(r => r.section);

    res.json({ sections });
  } catch (err) {
    console.error('[exports] GET /sections error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/exports/csv?jobId=x&severity=a,b&sections=s1,s2 ────────────────
router.get('/csv', (req, res) => {
  try {
    const { jobId, severity, sections } = req.query;
    const { company_id, role } = req.user;

    if (!jobId) return res.status(400).json({ error: 'jobId is required' });

    const check = verifyJob(jobId, company_id, role);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const { job } = check;
    const { query, params } = buildFilterQuery(jobId, severity, sections);

    // Derive filename from site label and crawl date
    const dateStr   = job.started_at ? new Date(job.started_at).toISOString().slice(0, 10) : 'export';
    const siteSlug  = (job.label || 'site').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename  = `audit-${siteSlug}-${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write CSV header
    res.write('URL,Section,Issue Type,Severity,Details\r\n');

    // Stream rows using better-sqlite3 iterator — memory-efficient for large audits
    const stmt = db.prepare(query);
    for (const row of stmt.iterate(...params)) {
      const cols = [row.url, row.section, row.issue_type, row.severity, row.data || '']
        .map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`);
      res.write(cols.join(',') + '\r\n');
    }

    res.end();
  } catch (err) {
    console.error('[exports] GET /csv error:', err);
    // Headers may already be sent if streaming started
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.end();
    }
  }
});

// ─── POST /api/exports/sheets ─────────────────────────────────────────────────
router.post('/sheets', async (req, res) => {
  try {
    const { jobId, severity, sections } = req.body;
    const { company_id, role } = req.user;

    if (!jobId) return res.status(400).json({ error: 'jobId is required' });

    const check = verifyJob(jobId, company_id, role);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const { job } = check;

    if (!job.sheets_tab_name) {
      return res.status(400).json({ error: 'Configure a Sheets tab name in Site Settings first' });
    }
    if (!job.sheets_spreadsheet_id) {
      return res.status(400).json({ error: 'Configure a Sheets spreadsheet ID in Site Settings first' });
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return res.status(503).json({ error: 'Google Sheets not configured — set GOOGLE_APPLICATION_CREDENTIALS in .env' });
    }

    // Parse body arrays (may be string or array depending on how client sends)
    const severityStr = Array.isArray(severity) ? severity.join(',') : (severity || null);
    const sectionsStr = Array.isArray(sections)  ? sections.join(',')  : (sections  || null);

    const { query, params } = buildFilterQuery(jobId, severityStr, sectionsStr);
    const dbRows = db.prepare(query).all(...params);

    const rows = [
      ['URL', 'Section', 'Issue Type', 'Severity', 'Details'],
      ...dbRows.map(r => [r.url, r.section, r.issue_type, r.severity, r.data || '']),
    ];

    const { rowsWritten } = await pushToSheets({
      spreadsheetId: job.sheets_spreadsheet_id,
      tabName:        job.sheets_tab_name,
      rows,
    });

    res.json({ success: true, rowsWritten });
  } catch (err) {
    console.error('[exports] POST /sheets error:', err);
    // Surface Google API 403 as a helpful message
    const msg = err.message || '';
    if (err.code === 403 || err.status === 403 || msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      return res.status(400).json({ error: 'Sheets access denied — share the spreadsheet with your service account email' });
    }
    res.status(500).json({ error: msg || 'Failed to push to Google Sheets' });
  }
});

export default router;
