/**
 * Speed Audit Service
 *
 * On-demand PageSpeed Insights audit for a site.
 * Runs PSI (mobile + desktop) on the site's top pages, stores findings in
 * audit_results, and emits Socket.io progress events to the site:${siteId} room.
 *
 * Triggered by POST /api/reports/:siteId/speed-audit.
 */

import db from '../db/sqlite.js';

const SECTION   = 'Speed & Performance';
const MAX_URLS  = 20;   // max pages to audit per run

// PSI score thresholds (0–100)
const SCORE_POOR = 49;
const SCORE_WARN = 89;

// Core Web Vital thresholds (ms unless noted)
const LCP_POOR   = 4000;   // > 4 s = poor
const LCP_WARN   = 2500;   // > 2.5 s = needs improvement
const CLS_POOR   = 0.25;   // > 0.25 = poor (unitless)
const CLS_WARN   = 0.1;    // > 0.1 = needs improvement
const FCP_POOR   = 3000;
const FCP_WARN   = 1800;
const TTFB_POOR  = 1800;
const TTFB_WARN  = 800;

function getPsiApiKey() {
  const env = process.env.PSI_API_KEY;
  if (env) return env;
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'psi_api_key'`).get();
  return row?.value || null;
}

/**
 * Collect URLs to audit — top GSC pages + site homepage, capped at MAX_URLS.
 */
function collectUrls(siteId, siteUrl) {
  const urls = new Set();

  // Always include the homepage
  try { urls.add(new URL(siteUrl).origin + '/'); } catch { urls.add(siteUrl); }

  // Top pages from GSC cache (by impressions)
  const gscRows = db.prepare(`
    SELECT DISTINCT url FROM gsc_cache
    WHERE site_id = ? AND period = 'current'
    ORDER BY impressions DESC
    LIMIT ?
  `).all(siteId, MAX_URLS);

  for (const { url } of gscRows) if (url) urls.add(url);

  // Fill from audit_results if still under cap (distinct crawled URLs)
  if (urls.size < MAX_URLS) {
    const arRows = db.prepare(`
      SELECT DISTINCT url FROM audit_results
      WHERE site_id = ?
      LIMIT ?
    `).all(siteId, MAX_URLS - urls.size);
    for (const { url } of arRows) if (url) urls.add(url);
  }

  return [...urls].slice(0, MAX_URLS);
}

/**
 * Call PSI API for one URL and return extracted metrics.
 */
async function fetchPsi(url, strategy, apiKey) {
  const psiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  psiUrl.searchParams.set('url',      url);
  psiUrl.searchParams.set('strategy', strategy);
  psiUrl.searchParams.set('key',      apiKey);

  const res = await fetch(psiUrl.toString(), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.status);
    throw new Error(`PSI ${res.status}: ${msg}`);
  }

  const data    = await res.json();
  const audits  = data?.lighthouseResult?.audits  || {};
  const cats    = data?.lighthouseResult?.categories || {};

  return {
    score: cats?.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
    lcp:   audits['largest-contentful-paint']?.numericValue != null ? Math.round(audits['largest-contentful-paint'].numericValue) : null,
    cls:   audits['cumulative-layout-shift']?.numericValue  != null ? Math.round(audits['cumulative-layout-shift'].numericValue * 1000) / 1000 : null,
    fcp:   audits['first-contentful-paint']?.numericValue   != null ? Math.round(audits['first-contentful-paint'].numericValue) : null,
    ttfb:  audits['server-response-time']?.numericValue     != null ? Math.round(audits['server-response-time'].numericValue) : null,
  };
}

/**
 * Convert PSI metrics for one URL+strategy into audit findings.
 */
function toFindings(url, strategy, metrics, jobId, siteId, companyId) {
  const findings = [];
  const base = { crawlJobId: jobId, siteId, section: SECTION, url, companyId };
  const { score, lcp, cls, fcp, ttfb } = metrics;

  if (score !== null) {
    if (score <= SCORE_POOR) {
      findings.push({ ...base, severity: 'critical', issueType: `Poor Performance Score (${strategy})`, data: JSON.stringify({ score, strategy }) });
    } else if (score <= SCORE_WARN) {
      findings.push({ ...base, severity: 'warning', issueType: `Low Performance Score (${strategy})`, data: JSON.stringify({ score, strategy }) });
    }
  }

  if (lcp !== null) {
    if (lcp > LCP_POOR)      findings.push({ ...base, severity: 'critical', issueType: `Poor LCP (${strategy})`, data: JSON.stringify({ lcp, strategy }) });
    else if (lcp > LCP_WARN) findings.push({ ...base, severity: 'warning',  issueType: `LCP Needs Improvement (${strategy})`, data: JSON.stringify({ lcp, strategy }) });
  }

  if (cls !== null) {
    if (cls > CLS_POOR)      findings.push({ ...base, severity: 'critical', issueType: `Poor CLS (${strategy})`, data: JSON.stringify({ cls, strategy }) });
    else if (cls > CLS_WARN) findings.push({ ...base, severity: 'warning',  issueType: `CLS Needs Improvement (${strategy})`, data: JSON.stringify({ cls, strategy }) });
  }

  if (fcp !== null) {
    if (fcp > FCP_POOR)      findings.push({ ...base, severity: 'warning',  issueType: `Slow FCP (${strategy})`, data: JSON.stringify({ fcp, strategy }) });
    else if (fcp > FCP_WARN) findings.push({ ...base, severity: 'info',     issueType: `FCP Needs Improvement (${strategy})`, data: JSON.stringify({ fcp, strategy }) });
  }

  if (ttfb !== null) {
    if (ttfb > TTFB_POOR)      findings.push({ ...base, severity: 'critical', issueType: `Slow TTFB (${strategy})`, data: JSON.stringify({ ttfb, strategy }) });
    else if (ttfb > TTFB_WARN) findings.push({ ...base, severity: 'warning',  issueType: `TTFB Needs Improvement (${strategy})`, data: JSON.stringify({ ttfb, strategy }) });
  }

  return findings;
}

function bulkInsert(findings) {
  if (!findings.length) return;
  const stmt = db.prepare(`
    INSERT INTO audit_results (crawl_job_id, site_id, section, url, data, severity, issue_type, company_id)
    VALUES (@crawlJobId, @siteId, @section, @url, @data, @severity, @issueType, @companyId)
  `);
  db.transaction((rows) => { for (const r of rows) stmt.run(r); })(findings);
}

/**
 * Run the on-demand speed audit for a site.
 *
 * @param {string}      siteId
 * @param {string}      jobId      — most recent crawl job ID (for audit_results FK)
 * @param {string|null} companyId
 * @param {object}      io         — Socket.io server instance
 */
export async function runSpeedAudit(siteId, jobId, companyId, io) {
  const room = `site:${siteId}`;

  const emit = (event, payload) => {
    if (io) io.to(room).emit(event, payload);
  };

  try {
    const apiKey = getPsiApiKey();
    if (!apiKey) {
      emit('speed:error', { siteId, error: 'PSI API key not configured' });
      return 0;
    }

    const site = db.prepare('SELECT url FROM sites WHERE id = ?').get(siteId);
    if (!site) {
      emit('speed:error', { siteId, error: 'Site not found' });
      return 0;
    }

    const urls = collectUrls(siteId, site.url);
    emit('speed:start', { siteId, total: urls.length * 2 }); // ×2 for mobile+desktop

    // Clear previous speed findings for this site so results stay fresh
    db.prepare(`DELETE FROM audit_results WHERE site_id = ? AND section = ?`).run(siteId, SECTION);

    const allFindings = [];
    let done = 0;

    for (const url of urls) {
      for (const strategy of ['mobile', 'desktop']) {
        try {
          const metrics = await fetchPsi(url, strategy, apiKey);
          const findings = toFindings(url, strategy, metrics, jobId, siteId, companyId);
          allFindings.push(...findings);
        } catch (err) {
          console.warn(`[speed-audit] PSI failed for ${url} (${strategy}): ${err.message}`);
        }

        done++;
        emit('speed:progress', { siteId, done, total: urls.length * 2, url, strategy });
      }
    }

    if (allFindings.length) bulkInsert(allFindings);

    emit('speed:complete', { siteId, findings: allFindings.length });
    console.log(`[speed-audit] ${allFindings.length} findings for site ${siteId}.`);
    return allFindings.length;

  } catch (err) {
    console.error(`[speed-audit] Unexpected error for site ${siteId}:`, err);
    emit('speed:error', { siteId, error: err.message });
    return 0;
  }
}
