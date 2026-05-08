// backend/services/audit-parser.service.js
import db from '../db/sqlite.js';
import { runResponseChecks }     from './checks/s01-response.js';
import { runCanonicalChecks }    from './checks/s02-canonical.js';
import { runRobotsChecks }       from './checks/s03-robots.js';
import { runSitemapChecks }      from './checks/s04-sitemap.js';
import { runCrawlabilityChecks } from './checks/s05-crawlability.js';
import { runUrlChecks }          from './checks/s06-url.js';
import { runJsRenderChecks }     from './checks/s07-jsrender.js';
import { runMobileChecks }       from './checks/s08-mobile.js';
import { runSecurityChecks }     from './checks/s09-security.js';
import { runCwvChecks }          from './checks/s10-cwv.js';
import { runCruxChecks }         from './crux.js';
import { runTitleChecks }        from './checks/s11-titles.js';
import { runMetaDescChecks }     from './checks/s12-meta.js';
import { runHeadingChecks }      from './checks/s13-headings.js';
import { runContentChecks }      from './checks/s14-content.js';
import { runImageChecks }        from './checks/s15-images.js';
import { runSchemaChecks }       from './checks/s16-schema.js';
import { runLinksChecks }        from './checks/s17-links.js';
import { runIntlChecks }         from './checks/s18-intl.js';
import { runEeatChecks }         from './checks/s21-eeat.js';
import { runAioChecks }          from './checks/s22-aio.js';
import { runGeoChecks }          from './checks/s23-geo.js';
import { runLocalChecks }        from './checks/s24-local.js';

// ─── YMYL Classification ──────────────────────────────────────────────────────

export function classifyYmyl(url, bodyText = '', customPatterns = []) {
  const defaultPatterns = [
    '/insurance', '/health', '/investment', '/loan', '/finance',
    '/policy', '/premium', '/medical', '/legal', '/compare',
    '/term-plan', '/motor', '/life', '/credit', '/tax',
  ];
  const allPatterns = [...defaultPatterns, ...customPatterns];
  const urlMatch = allPatterns.some(p => url.includes(p));

  const ymylWords = [
    'premium', 'policy', 'coverage', 'claim', 'sum assured',
    'deductible', 'nominee', 'maturity', 'annuity', 'interest rate',
    'dividend', 'portfolio', 'liability', 'indemnity', 'underwriting',
  ];
  const lowerBody = (bodyText || '').toLowerCase();
  const wordCount = ymylWords.filter(w => lowerBody.includes(w)).length;
  const contentMatch = wordCount >= 3;

  if (!urlMatch && !contentMatch) return null;

  if (url.includes('/health') || url.includes('/medical')) return 'health';
  if (url.includes('/legal') || url.includes('/law')) return 'legal';
  return 'finance';
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

export function loadSiteSettings(siteId) {
  const rows = db.prepare(
    'SELECT key, value FROM site_settings WHERE site_id = ?'
  ).all(siteId);
  const map = new Map();
  for (const { key, value } of rows) map.set(key, value);
  return map;
}

export function loadSchemaRules(siteId) {
  return db.prepare(
    'SELECT pattern, required_types FROM schema_rules WHERE site_id = ? ORDER BY sort_order ASC'
  ).all(siteId).map(r => ({
    pattern:  r.pattern,
    required: JSON.parse(r.required_types || '[]'),
  }));
}

export function bulkInsertResults(failures, jobId, siteId, companyId) {
  if (!failures.length) return;
  const stmt = db.prepare(`
    INSERT INTO audit_results
      (crawl_job_id, site_id, company_id, url, check_id, passed, severity, section, message, details, issue_type, data)
    VALUES
      (@crawlJobId, @siteId, @companyId, @url, @checkId, @passed, @severity, @section, @message, @details, @checkId, @details)
  `);
  const insertMany = db.transaction(rows => { for (const r of rows) stmt.run(r); });
  insertMany(failures.map(f => ({
    crawlJobId: jobId,
    siteId,
    companyId:  companyId || null,
    url:        f.url || (typeof f.details === 'string' && f.details.startsWith('http') ? f.details : ''),
    checkId:    f.check_id,
    passed:     0,
    severity:   f.severity,
    section:    f.section,
    message:    f.message,
    details:    f.details || null,
  })));
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function parseAndStoreResults(pages, jobId, siteId, companyId = null) {
  const siteSettings = loadSiteSettings(siteId);
  const schemaRules  = loadSchemaRules(siteId);
  const ctx = { siteId, jobId, siteSettings, schemaRules };
  const failures = [];

  failures.push(...runResponseChecks(pages, ctx));
  failures.push(...runCanonicalChecks(pages, ctx));
  failures.push(...runRobotsChecks(pages, ctx));
  failures.push(...runSitemapChecks(pages, ctx));
  failures.push(...runCrawlabilityChecks(pages, ctx));
  failures.push(...runUrlChecks(pages, ctx));
  failures.push(...runJsRenderChecks(pages, ctx));
  failures.push(...runMobileChecks(pages, ctx));
  failures.push(...runSecurityChecks(pages, ctx));
  failures.push(...runCwvChecks(pages, ctx));
  failures.push(...runTitleChecks(pages, ctx));
  failures.push(...runMetaDescChecks(pages, ctx));
  failures.push(...runHeadingChecks(pages, ctx));
  failures.push(...runContentChecks(pages, ctx));
  failures.push(...runImageChecks(pages, ctx));
  failures.push(...runSchemaChecks(pages, ctx));
  failures.push(...runLinksChecks(pages, ctx));
  failures.push(...runIntlChecks(pages, ctx));
  failures.push(...runEeatChecks(pages, ctx));
  failures.push(...runAioChecks(pages, ctx));
  failures.push(...runGeoChecks(pages, ctx));
  failures.push(...runLocalChecks(pages, ctx));

  // CrUX is async (external API call)
  const cruxFailures = await runCruxChecks(pages, ctx);
  failures.push(...cruxFailures);

  bulkInsertResults(failures, jobId, siteId, companyId);
  return failures.length;
}

// ─── Legacy stub ─────────────────────────────────────────────────────────────

export function parseAndStoreFromDatasets(_datasets, _jobId, _siteId, _companyId = null) {
  return 0;
}
