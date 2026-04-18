/**
 * Rankings Audit Service
 *
 * Runs after a crawl completes. Reads gsc_cache data for the site and
 * generates audit findings in audit_results for the Rankings & Traffic category.
 *
 * Returns 0 findings (and logs a skip) when GSC data is not available.
 */

import db from '../db/sqlite.js';

const SECTION = 'Rankings & Traffic';

// Thresholds
const HIGH_IMPRESSIONS_THRESHOLD = 100;
const LOW_CTR_THRESHOLD          = 0.03;   // 3 %
const MIN_IMPRESSIONS_FOR_CHECKS = 50;
const LOW_POSITION_THRESHOLD     = 10;     // outside top 10

function bulkInsert(findings) {
  if (!findings.length) return;

  const stmt = db.prepare(`
    INSERT INTO audit_results (crawl_job_id, site_id, section, url, data, severity, issue_type, company_id)
    VALUES (@crawlJobId, @siteId, @section, @url, @data, @severity, @issueType, @companyId)
  `);

  db.transaction((rows) => {
    for (const row of rows) stmt.run(row);
  })(findings);
}

/**
 * Run rankings checks using gsc_cache data and insert findings.
 *
 * @param {string}      siteId
 * @param {string}      jobId
 * @param {string|null} companyId
 * @returns {number}  — findings inserted
 */
export function runRankingsAudit(siteId, jobId, companyId = null) {
  // Fetch current-period GSC rows for this site
  const gscRows = db.prepare(`
    SELECT url, clicks, impressions, ctr, position
    FROM   gsc_cache
    WHERE  site_id = ? AND period = 'current'
  `).all(siteId);

  if (!gscRows.length) {
    console.log(`[rankings-audit] No GSC data for site ${siteId} — skipping.`);
    return 0;
  }

  const findings = [];

  for (const row of gscRows) {
    const { url, clicks, impressions, ctr, position } = row;
    if (!url) continue;

    const base = { crawlJobId: jobId, siteId, section: SECTION, url, companyId };

    // High impressions, low CTR — opportunity
    if (impressions >= HIGH_IMPRESSIONS_THRESHOLD && ctr < LOW_CTR_THRESHOLD) {
      findings.push({
        ...base,
        severity:  'warning',
        issueType: 'High Impressions, Low CTR',
        data:      JSON.stringify({ impressions, clicks, ctr: +ctr.toFixed(4), position }),
      });
    }

    if (impressions >= MIN_IMPRESSIONS_FOR_CHECKS) {
      // Ranking outside top 10
      if (position > LOW_POSITION_THRESHOLD) {
        findings.push({
          ...base,
          severity:  'info',
          issueType: 'Low Search Position (Page 2+)',
          data:      JSON.stringify({ position: +position.toFixed(1), impressions }),
        });
      }

      // Impressions but zero clicks
      if (clicks === 0) {
        findings.push({
          ...base,
          severity:  'info',
          issueType: 'Zero Clicks Despite Impressions',
          data:      JSON.stringify({ impressions, position: +position.toFixed(1) }),
        });
      }
    }
  }

  if (findings.length) bulkInsert(findings);

  console.log(`[rankings-audit] ${findings.length} findings for site ${siteId} (job ${jobId}).`);
  return findings.length;
}
