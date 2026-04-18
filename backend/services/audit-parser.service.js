/**
 * Audit Parser Service
 *
 * Accepts in-memory SF-format datasets (output of toSfFormat()) and runs
 * all audit check logic, inserting findings into `audit_results`.
 *
 * In-memory processing — no CSV file I/O.
 *
 * Usage:
 *   import { parseAndStoreFromDatasets } from './audit-parser.service.js';
 *   const count = await parseAndStoreFromDatasets(datasets, jobId, siteId, companyId);
 */

import db from '../db/sqlite.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True if the row's Indexability column is exactly "Indexable" */
const isIndexable = (row) => (row['Indexability'] || '').trim() === 'Indexable';

/** Safe integer parse — returns NaN if blank or non-numeric */
const toInt = (v) => parseInt(String(v ?? '').trim(), 10);

/** Normalise a string field — trim + collapse inner whitespace */
const str = (v) => String(v ?? '').trim();

// ─── Bulk insert helper ───────────────────────────────────────────────────────

function bulkInsert(findings) {
  if (!findings.length) return;

  const stmt = db.prepare(`
    INSERT INTO audit_results (crawl_job_id, site_id, section, url, data, severity, issue_type, company_id)
    VALUES (@crawlJobId, @siteId, @section, @url, @data, @severity, @issueType, @companyId)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) stmt.run(row);
  });

  insertMany(findings);
  console.log(`[audit-parser] Inserted ${findings.length} finding(s).`);
}

// ─── Check implementations ────────────────────────────────────────────────────

function checkResponseCodes(rows, jobId, siteId) {
  const findings = [];

  for (const row of rows) {
    const url = str(row['Address']);
    if (!url) continue;

    const statusCode   = str(row['Status Code']);
    const status       = str(row['Status']);
    const redirectType = str(row['Redirect Type']);
    const redirectUrl  = str(row['Redirect URL']);

    if (statusCode.startsWith('3')) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Response Codes', url, severity: 'warning',
        issueType: '3xx Redirects',
        data: JSON.stringify({ statusCode, redirectUrl, redirectType }),
      });
    }

    if (statusCode.startsWith('4')) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Response Codes', url, severity: 'critical',
        issueType: '4xx Client Errors',
        data: JSON.stringify({ statusCode, status }),
      });
    }

    if (statusCode.startsWith('5')) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Response Codes', url, severity: 'critical',
        issueType: '5xx Server Errors',
        data: JSON.stringify({ statusCode, status }),
      });
    }

    if (redirectType && redirectType.toLowerCase().includes('chain')) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Response Codes', url, severity: 'warning',
        issueType: 'Redirect Chains',
        data: JSON.stringify({ redirectType, redirectUrl }),
      });
    }

    if (status === 'Redirect Loop') {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Response Codes', url, severity: 'critical',
        issueType: 'Redirect Loops',
        data: JSON.stringify({ status, redirectUrl }),
      });
    }
  }

  return findings;
}

function checkPageTitles(rows, jobId, siteId) {
  const findings    = [];
  const titleCounts = new Map();

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url   = str(row['Address']); if (!url) continue;
    const title = str(row['Title 1']); if (!title) continue;
    if (!titleCounts.has(title)) titleCounts.set(title, []);
    titleCounts.get(title).push(url);
  }

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url    = str(row['Address']); if (!url) continue;
    const title  = str(row['Title 1']);
    const length = toInt(row['Title 1 Length']);

    if (!title) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Title Tags', url,
        severity: 'critical', issueType: 'Missing Title Tag', data: JSON.stringify({}),
      });
      continue;
    }

    const dupeList = titleCounts.get(title);
    if (dupeList && dupeList.length > 1) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Title Tags', url,
        severity: 'warning', issueType: 'Duplicate Title Tag',
        data: JSON.stringify({ title, duplicateCount: dupeList.length }),
      });
    }

    if (!isNaN(length) && length < 30) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Title Tags', url,
        severity: 'warning', issueType: 'Title Too Short (under 30 chars)',
        data: JSON.stringify({ title, length }),
      });
    }

    if (!isNaN(length) && length > 60) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Title Tags', url,
        severity: 'warning', issueType: 'Title Too Long (over 60 chars)',
        data: JSON.stringify({ title, length }),
      });
    }

    if (title.includes('?') || title.includes('=')) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Title Tags', url,
        severity: 'warning', issueType: 'Dynamic Parameters in Titles',
        data: JSON.stringify({ title }),
      });
    }
  }

  return findings;
}

function checkMetaDescriptions(rows, jobId, siteId) {
  const findings   = [];
  const descCounts = new Map();

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url  = str(row['Address']); if (!url) continue;
    const desc = str(row['Meta Description 1']); if (!desc) continue;
    if (!descCounts.has(desc)) descCounts.set(desc, []);
    descCounts.get(desc).push(url);
  }

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url    = str(row['Address']); if (!url) continue;
    const desc   = str(row['Meta Description 1']);
    const length = toInt(row['Meta Description 1 Length']);

    if (!desc) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Meta Description', url,
        severity: 'warning', issueType: 'Missing Meta Description', data: JSON.stringify({}),
      });
      continue;
    }

    const dupeList = descCounts.get(desc);
    if (dupeList && dupeList.length > 1) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Meta Description', url,
        severity: 'warning', issueType: 'Duplicate Meta Description',
        data: JSON.stringify({ description: desc, duplicateCount: dupeList.length }),
      });
    }

    if (!isNaN(length) && length < 70) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Meta Description', url,
        severity: 'info', issueType: 'Meta Description Too Short (<70)',
        data: JSON.stringify({ description: desc, length }),
      });
    }

    if (!isNaN(length) && length > 160) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Meta Description', url,
        severity: 'warning', issueType: 'Meta Description Too Long (>160)',
        data: JSON.stringify({ description: desc, length }),
      });
    }
  }

  return findings;
}

function checkH1s(rows, jobId, siteId) {
  const findings   = [];
  const h1Counts   = new Map();
  const urlsWithH1 = new Set();

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url = str(row['Address']); if (!url) continue;
    const h1  = str(row['H1-1']);    if (!h1) continue;
    urlsWithH1.add(url);
    if (!h1Counts.has(h1)) h1Counts.set(h1, []);
    h1Counts.get(h1).push(url);
  }

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url         = str(row['Address']); if (!url) continue;
    const h1          = str(row['H1-1']);
    const occurrences = toInt(row['Occurrences']);

    if (!h1) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Headings', url,
        severity: 'critical', issueType: 'H1 Missing', data: JSON.stringify({}),
      });
      continue;
    }

    const dupeList = h1Counts.get(h1);
    if (dupeList && dupeList.length > 1) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Headings', url,
        severity: 'warning', issueType: 'H1 Duplicate',
        data: JSON.stringify({ h1, duplicateCount: dupeList.length }),
      });
    }

    if (!isNaN(occurrences) && occurrences > 1) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Headings', url,
        severity: 'warning', issueType: 'Multiple H1s',
        data: JSON.stringify({ h1, occurrences }),
      });
    }
  }

  return { findings, urlsWithH1 };
}

function checkH2s(rows, jobId, siteId, urlsWithH1) {
  const findings   = [];
  const urlsWithH2 = new Set();

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url = str(row['Address']); if (!url) continue;
    const h2  = str(row['H2-1']);
    if (h2) urlsWithH2.add(url);
  }

  for (const url of urlsWithH1) {
    if (!urlsWithH2.has(url)) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Headings', url,
        severity: 'info', issueType: 'Missing H2/H3', data: JSON.stringify({}),
      });
    }
  }

  return findings;
}

function checkCanonicals(rows, jobId, siteId) {
  const findings = [];

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url       = str(row['Address']); if (!url) continue;
    const canonical = str(row['Canonical Link Element 1']);

    if (!canonical) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Canonical', url,
        severity: 'warning', issueType: 'Missing Canonical', data: JSON.stringify({}),
      });
      continue;
    }

    if (canonical.startsWith('/')) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Canonical', url,
        severity: 'warning', issueType: 'Canonical is Relative',
        data: JSON.stringify({ canonical }),
      });
    }

    if (canonical.includes('#')) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Canonical', url,
        severity: 'warning', issueType: 'Canonical Contains Fragment (#)',
        data: JSON.stringify({ canonical }),
      });
    }
  }

  return findings;
}

function checkUrlStructure(rows, jobId, siteId) {
  const findings = [];

  for (const row of rows) {
    const address     = str(row['Address']); if (!address) continue;
    const statusCode  = str(row['Status Code']);
    const contentType = str(row['Content Type']).toLowerCase();
    const indexable   = str(row['Indexability']);

    if (statusCode !== '200') continue;
    if (!contentType.includes('text/html')) continue;

    let parsedPath = '';
    try {
      const parsed = new URL(address);
      parsedPath   = parsed.pathname + parsed.search;
    } catch {
      parsedPath = address;
    }

    if (parsedPath.includes('_')) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'URL Structure', url: address,
        severity: 'warning', issueType: 'Underscores in URLs',
        data: JSON.stringify({ url: address }),
      });
    }

    if (address.includes('%20') || address.includes('+')) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'URL Structure', url: address,
        severity: 'warning', issueType: 'Spaces in URLs',
        data: JSON.stringify({ url: address }),
      });
    }

    try {
      const parsed   = new URL(address);
      const pathOnly = parsed.pathname;
      if (pathOnly !== pathOnly.toLowerCase()) {
        findings.push({
          crawlJobId: jobId, siteId, section: 'URL Structure', url: address,
          severity: 'warning', issueType: 'Mixed Case URLs',
          data: JSON.stringify({ url: address }),
        });
      }
    } catch { /* malformed — skip */ }

    if (address.length > 115) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'URL Structure', url: address,
        severity: 'warning', issueType: 'URLs Over 115 Characters',
        data: JSON.stringify({ url: address, length: address.length }),
      });
    }

    if (address.includes('utm_') && indexable === 'Indexable') {
      findings.push({
        crawlJobId: jobId, siteId, section: 'URL Structure', url: address,
        severity: 'critical', issueType: 'Untracked UTMs Indexed',
        data: JSON.stringify({ url: address }),
      });
    }
  }

  return findings;
}

function checkStructuredData(rows, jobId, siteId) {
  const findings = [];

  for (const row of rows) {
    const url      = str(row['Address']); if (!url) continue;
    const errors   = toInt(row['Errors']);
    const warnings = toInt(row['Warnings']);

    if (!isNaN(errors) && errors > 0) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Schema / Structured Data', url,
        severity: 'critical', issueType: 'Structured Data Errors',
        data: JSON.stringify({ errors }),
      });
    }

    if (!isNaN(warnings) && warnings > 0) {
      findings.push({
        crawlJobId: jobId, siteId, section: 'Schema / Structured Data', url,
        severity: 'warning', issueType: 'Structured Data Warnings',
        data: JSON.stringify({ warnings }),
      });
    }
  }

  return findings;
}

function checkStructuredDataValidation(errorRows, warningRows, jobId, siteId) {
  const findings = [];

  if (errorRows) {
    for (const row of errorRows) {
      const url        = str(row['Address']); if (!url) continue;
      const richErrors = toInt(row['Rich Result Errors']);
      if (isNaN(richErrors) || richErrors === 0) continue;
      findings.push({
        crawlJobId: jobId, siteId, section: 'Schema / Structured Data', url,
        severity: 'critical', issueType: 'Structured Data Validation Errors',
        data: JSON.stringify({ richErrors, feature: str(row['Feature-1']) || null, type: str(row['Type-1']) || null }),
      });
    }
  }

  if (warningRows) {
    for (const row of warningRows) {
      const url          = str(row['Address']); if (!url) continue;
      const richWarnings = toInt(row['Rich Result Warnings']);
      if (isNaN(richWarnings) || richWarnings === 0) continue;
      findings.push({
        crawlJobId: jobId, siteId, section: 'Schema / Structured Data', url,
        severity: 'warning', issueType: 'Structured Data Validation Warnings',
        data: JSON.stringify({ richWarnings, feature: str(row['Feature-1']) || null, type: str(row['Type-1']) || null }),
      });
    }
  }

  return findings;
}

function checkInternalLinking(rows, jobId, siteId) {
  const findings = [];

  // Orphan pages: indexable pages with 0 unique inlinks (not the start URL)
  // Low inlinks: indexable pages with only 1 unique inlink
  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url      = str(row['Address']); if (!url) continue;
    const inlinks  = toInt(row['Unique Inlinks']);
    const outlinks = toInt(row['Unique Outlinks']);

    if (!isNaN(inlinks) && inlinks === 0) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Internal Linking', url,
        severity: 'warning', issueType: 'Orphan Page (0 Inlinks)',
        data: JSON.stringify({ inlinks }),
      });
    } else if (!isNaN(inlinks) && inlinks === 1) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Internal Linking', url,
        severity: 'info', issueType: 'Low Inlinks (1)',
        data: JSON.stringify({ inlinks }),
      });
    }

    if (!isNaN(outlinks) && outlinks > 100) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Internal Linking', url,
        severity: 'warning', issueType: 'Too Many Outlinks (>100)',
        data: JSON.stringify({ outlinks }),
      });
    }
  }

  return findings;
}

function checkImages(rows, jobId, siteId) {
  // rows = images_all — one row per image, Address = page URL
  const findings   = [];
  const missingAlt = new Map(); // url → count
  const altTooLong = new Map();

  for (const row of rows) {
    const url = str(row['Address']); if (!url) continue;

    if (str(row['Missing Alt Text']) === 'True') {
      missingAlt.set(url, (missingAlt.get(url) || 0) + 1);
    }
    if (str(row['Alt Text Too Long']) === 'True') {
      altTooLong.set(url, (altTooLong.get(url) || 0) + 1);
    }
  }

  for (const [url, count] of missingAlt) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Images', url,
      severity: 'warning', issueType: 'Images Missing Alt Text',
      data: JSON.stringify({ count }),
    });
  }

  for (const [url, count] of altTooLong) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Images', url,
      severity: 'info', issueType: 'Alt Text Too Long',
      data: JSON.stringify({ count }),
    });
  }

  return findings;
}

// Rich result types Google supports (used to flag unrecognised @type values)
const KNOWN_SCHEMA_TYPES = new Set([
  'Article', 'NewsArticle', 'BlogPosting', 'BreadcrumbList', 'Course',
  'Dataset', 'Event', 'FAQPage', 'HowTo', 'ImageObject', 'JobPosting',
  'LocalBusiness', 'Movie', 'Organization', 'Person', 'Product', 'QAPage',
  'Recipe', 'Review', 'SoftwareApplication', 'VideoObject', 'WebPage',
  'WebSite', 'SiteNavigationElement', 'ItemList', 'ListItem', 'MedicalCondition',
]);

function checkSchemaExtended(schemaRows, internalRows, jobId, siteId) {
  const findings = [];

  // Build set of URLs that have at least one schema block
  const urlsWithSchema = new Set();
  for (const row of schemaRows) {
    const url = str(row['Address']); if (!url) continue;
    urlsWithSchema.add(url);
  }

  // Flag indexable pages with no schema at all
  for (const row of internalRows) {
    if (!isIndexable(row)) continue;
    const url = str(row['Address']); if (!url) continue;
    if (!urlsWithSchema.has(url)) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Schema / Structured Data', url,
        severity: 'info', issueType: 'No Schema Markup on Page',
        data: JSON.stringify({}),
      });
    }
  }

  // Flag unrecognised @type values
  for (const row of schemaRows) {
    const url  = str(row['Address']); if (!url) continue;
    const type = str(row['Type']);    if (!type) continue;
    if (!KNOWN_SCHEMA_TYPES.has(type)) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Schema / Structured Data', url,
        severity: 'info', issueType: 'Unrecognised Schema Type',
        data: JSON.stringify({ type }),
      });
    }
  }

  return findings;
}

function checkContent(rows, jobId, siteId) {
  const findings = [];

  for (const row of rows) {
    if (!isIndexable(row)) continue;
    const url       = str(row['Address']); if (!url) continue;
    const wordCount = toInt(row['Word Count']);
    const textRatio = toInt(row['Text Ratio']);

    if (!isNaN(wordCount) && wordCount < 50) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Content', url,
        severity: 'critical', issueType: 'Page Has No Content (<50 Words)',
        data: JSON.stringify({ wordCount }),
      });
    } else if (!isNaN(wordCount) && wordCount < 300) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Content', url,
        severity: 'warning', issueType: 'Thin Content (<300 Words)',
        data: JSON.stringify({ wordCount }),
      });
    }

    if (!isNaN(textRatio) && textRatio < 10) {
      findings.push({
        crawlJobId: jobId, siteId,
        section: 'Content', url,
        severity: 'info', issueType: 'Low Text Ratio (<10%)',
        data: JSON.stringify({ textRatio }),
      });
    }
  }

  return findings;
}

function checkRobotsIndexability(robots, siteOrigin, jobId, siteId) {
  const findings = [];
  if (!robots) return findings;

  const robotsUrl = `${siteOrigin}/robots.txt`;

  if (!robots.robotsTxtExists) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Robots & Indexability', url: robotsUrl,
      severity: 'warning', issueType: 'Missing Robots.txt',
      data: JSON.stringify({ statusCode: robots.robotsTxtStatusCode }),
    });
    return findings;
  }

  const disallowAllWildcard  = robots.disallowRules.some(r => r.agent === '*' && r.path === '/');
  const disallowAllGooglebot = robots.disallowRules.some(r => r.agent === 'Googlebot' && r.path === '/');

  if (disallowAllWildcard) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Robots & Indexability', url: robotsUrl,
      severity: 'critical', issueType: 'Disallow All in Robots.txt',
      data: JSON.stringify({ agent: '*' }),
    });
  }

  if (disallowAllGooglebot) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Robots & Indexability', url: robotsUrl,
      severity: 'critical', issueType: 'Googlebot Blocked in Robots.txt',
      data: JSON.stringify({ agent: 'Googlebot' }),
    });
  }

  if (robots.hasMalformedRules) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Robots & Indexability', url: robotsUrl,
      severity: 'warning', issueType: 'Malformed Robots.txt Rules',
      data: JSON.stringify({}),
    });
  }

  if (!robots.sitemapDeclared) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Robots & Indexability', url: robotsUrl,
      severity: 'info', issueType: 'Sitemap Not Declared in Robots.txt',
      data: JSON.stringify({}),
    });
  }

  return findings;
}

function checkSitemap(sitemap, siteOrigin, jobId, siteId) {
  const findings = [];
  if (!sitemap) return findings;

  const sitemapUrl = sitemap.sitemapUrl || `${siteOrigin}/sitemap.xml`;

  if (!sitemap.sitemapExists) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Sitemaps', url: sitemapUrl,
      severity: 'critical', issueType: 'Missing Sitemap.xml',
      data: JSON.stringify({}),
    });
    return findings;
  }

  if (sitemap.oversized) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Sitemaps', url: sitemapUrl,
      severity: 'warning', issueType: 'Sitemap Too Large (>50k URLs)',
      data: JSON.stringify({ totalUrlCount: sitemap.totalUrlCount }),
    });
  }

  if (sitemap.parseErrors?.length > 0) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Sitemaps', url: sitemapUrl,
      severity: 'warning', issueType: 'Sitemap Parse Errors',
      data: JSON.stringify({ errors: sitemap.parseErrors.slice(0, 5) }),
    });
  }

  if (sitemap.invalidUrls?.length > 0) {
    findings.push({
      crawlJobId: jobId, siteId,
      section: 'Sitemaps', url: sitemapUrl,
      severity: 'warning', issueType: 'Sitemap Contains Invalid URLs',
      data: JSON.stringify({ count: sitemap.invalidUrls.length, examples: sitemap.invalidUrls.slice(0, 3) }),
    });
  }

  return findings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all audit checks against in-memory SF-format datasets and bulk-insert
 * findings into `audit_results`.
 *
 * @param {object} datasets   — output of toSfFormat() from playwright-crawler
 * @param {string} jobId      — crawl_jobs.id
 * @param {string} siteId     — sites.id
 * @param {string|null} companyId
 * @param {{ robots: object|null, sitemap: object|null }|null} siteData
 * @returns {number}          — total findings inserted
 */
export function parseAndStoreFromDatasets(datasets, jobId, siteId, companyId = null, siteData = null) {
  console.log(`[audit-parser] Starting parse for job ${jobId} (site ${siteId})`);

  // Derive site origin from the first crawled page (for site-level finding URLs)
  let siteOrigin = '';
  try {
    const firstAddr = (datasets.internal_all || [])[0]?.['Address'];
    if (firstAddr) siteOrigin = new URL(firstAddr).origin;
  } catch { /* ignore */ }

  const allFindings = [];

  const run = (label, fn) => {
    const f = fn();
    console.log(`[audit-parser] ${label}: ${f.length} finding(s)`);
    allFindings.push(...f);
  };

  if (siteData) {
    run('Robots & Indexability', () => checkRobotsIndexability(siteData.robots, siteOrigin, jobId, siteId));
    run('Sitemaps',              () => checkSitemap(siteData.sitemap, siteOrigin, jobId, siteId));
  }

  run('Response Codes',  () => checkResponseCodes(datasets.response_codes_all || [], jobId, siteId));
  run('Page Titles',     () => checkPageTitles(datasets.page_titles_all || [], jobId, siteId));
  run('Meta Desc',       () => checkMetaDescriptions(datasets.meta_description_all || [], jobId, siteId));

  let urlsWithH1 = new Set();
  {
    const { findings, urlsWithH1: h1Set } = checkH1s(datasets.h1_all || [], jobId, siteId);
    console.log(`[audit-parser] H1: ${findings.length} finding(s)`);
    urlsWithH1 = h1Set;
    allFindings.push(...findings);
  }

  run('H2/H3 (missing)', () => checkH2s(datasets.h2_all || [], jobId, siteId, urlsWithH1));
  run('Canonicals',      () => checkCanonicals(datasets.canonicals_all || [], jobId, siteId));
  run('URL Structure',   () => checkUrlStructure(datasets.internal_all || [], jobId, siteId));
  run('Internal Linking', () => checkInternalLinking(datasets.internal_all || [], jobId, siteId));
  run('Images',           () => checkImages(datasets.images_all || [], jobId, siteId));
  run('Content',          () => checkContent(datasets.internal_all || [], jobId, siteId));
  run('Structured Data', () => checkStructuredData(datasets.structured_data_all || [], jobId, siteId));
  run('Schema Extended', () => checkSchemaExtended(datasets.structured_data_all || [], datasets.internal_all || [], jobId, siteId));
  run('SD Validation',   () => checkStructuredDataValidation(
    datasets.structured_data_validation_errors,
    datasets.structured_data_validation_warnings,
    jobId, siteId,
  ));

  if (companyId) {
    for (const f of allFindings) f.companyId = companyId;
  }

  console.log(`[audit-parser] Total findings: ${allFindings.length}. Inserting…`);
  bulkInsert(allFindings);
  console.log(`[audit-parser] Done for job ${jobId}.`);

  return allFindings.length;
}
