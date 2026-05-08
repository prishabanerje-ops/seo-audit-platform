// backend/services/checks/s04-sitemap.js
const SECTION = 'XML Sitemaps';

const SITEMAP_URL_LIMIT  = 50_000;
const SITEMAP_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB

export function runSitemapChecks(records, _ctx) {
  const failures = [];

  const siteRecord = records.find(r => r._siteData?.sitemap);
  if (!siteRecord) return failures;

  const { sitemap, robots } = siteRecord._siteData;
  const crawledNoindex = new Set(
    records.filter(r => r['Indexability'] !== 'Indexable').map(r => r.url).filter(Boolean)
  );
  const robotsBlocked = robots?.disallowedPaths || [];

  // sitemap_exists
  if (!sitemap.found) {
    failures.push({ check_id: 'sitemap_exists', passed: false, severity: 'critical', section: SECTION,
      message: 'sitemap.xml not found', details: '/sitemap.xml' });
    return failures;
  }

  // sitemap_valid_xml
  if (sitemap.parseErrors?.length > 0) {
    failures.push({ check_id: 'sitemap_valid_xml', passed: false, severity: 'warning', section: SECTION,
      message: `Sitemap XML parse errors: ${sitemap.parseErrors.slice(0, 3).join('; ')}`, details: sitemap.url });
  }

  const sitemapUrls = sitemap.urls || [];

  // sitemap_url_count
  if (sitemapUrls.length > SITEMAP_URL_LIMIT) {
    failures.push({ check_id: 'sitemap_url_count', passed: false, severity: 'critical', section: SECTION,
      message: `Sitemap has ${sitemapUrls.length} URLs — exceeds Google's 50,000 URL limit`, details: sitemap.url });
  }

  // sitemap_file_size
  if (sitemap.fileSizeBytes > SITEMAP_SIZE_LIMIT) {
    failures.push({ check_id: 'sitemap_file_size', passed: false, severity: 'critical', section: SECTION,
      message: `Sitemap file is ${Math.round(sitemap.fileSizeBytes / 1024 / 1024)}MB — exceeds 50MB limit`,
      details: sitemap.url });
  }

  // sitemap_index_used — if multiple child sitemaps detected but no index
  if (!sitemap.isIndex && sitemap.childSitemaps?.length > 1) {
    failures.push({ check_id: 'sitemap_index_used', passed: false, severity: 'info', section: SECTION,
      message: `${sitemap.childSitemaps.length} sitemap files found but no sitemap index`, details: sitemap.url });
  }

  for (const entry of sitemapUrls) {
    const loc = entry.loc || '';
    if (!loc) continue;

    // no_blocked_urls_in_sitemap
    let path = '';
    try { path = new URL(loc).pathname; } catch { /* skip */ }
    if (path && robotsBlocked.some(b => b && path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'no_blocked_urls_in_sitemap', passed: false, severity: 'warning', section: SECTION,
        message: `Sitemap URL blocked by robots.txt: ${loc}`, details: loc });
    }

    // noindex_in_sitemap
    if (crawledNoindex.has(loc)) {
      failures.push({ check_id: 'noindex_in_sitemap', passed: false, severity: 'warning', section: SECTION,
        message: `Noindexed page in sitemap: ${loc}`, details: loc });
    }

    // sitemap_orphan_urls — in sitemap but zero inlinks (only flag when field is explicitly set)
    const crawledRecord = records.find(r => r.url === loc);
    const inlinksRaw = crawledRecord?.['Unique Inlinks'];
    if (crawledRecord && inlinksRaw !== undefined && inlinksRaw !== null && parseInt(inlinksRaw, 10) === 0) {
      failures.push({ check_id: 'sitemap_orphan_urls', passed: false, severity: 'info', section: SECTION,
        message: `Sitemap URL has zero internal inlinks (orphan page)`, details: loc });
    }

    // sitemap_lastmod — compare to HTTP Last-Modified
    if (entry.lastmod && crawledRecord?.['Last Modified']) {
      const sitemapDate = new Date(entry.lastmod);
      const httpDate    = new Date(crawledRecord['Last Modified']);
      const diffDays    = Math.abs(sitemapDate - httpDate) / (1000 * 60 * 60 * 24);
      if (!isNaN(diffDays) && diffDays > 30) {
        failures.push({ check_id: 'sitemap_lastmod', passed: false, severity: 'info', section: SECTION,
          message: `Sitemap lastmod (${entry.lastmod}) differs from HTTP Last-Modified by > 30 days`, details: loc });
      }
    }

    // no_redirect_in_sitemap — sitemap URLs that redirect
    if (crawledRecord) {
      const code = String(crawledRecord['Status Code'] || '');
      if (code.startsWith('3') && crawledRecord['Redirect URL']) {
        failures.push({ check_id: 'no_redirect_in_sitemap', passed: false, severity: 'warning', section: SECTION,
          message: `Sitemap URL redirects to ${crawledRecord['Redirect URL']}`, details: loc });
      }
    }

    // news_sitemap — validate required fields for <news:news> entries
    if (entry.news) {
      const news = entry.news;
      const missing = [];
      if (!news['news:publication']?.['news:name']) missing.push('news:name');
      if (!news['news:publication']?.['news:language']) missing.push('news:language');
      if (!news['news:title']) missing.push('news:title');
      if (!news['news:publication_date']) missing.push('news:publication_date');
      if (missing.length > 0) {
        failures.push({ check_id: 'news_sitemap', passed: false, severity: 'info', section: SECTION,
          message: `News sitemap entry missing required fields: ${missing.join(', ')}`, details: loc });
      }
    }
  }

  // sitemap_image — flag image-heavy site with no image sitemap
  const hasImages    = records.some(r => (r._images || []).length > 5);
  const hasImgSitemap = sitemapUrls.some(e => e.images?.length > 0);
  if (hasImages && !hasImgSitemap) {
    failures.push({ check_id: 'sitemap_image', passed: false, severity: 'info', section: SECTION,
      message: 'Image-heavy site has no image sitemap entries (<image:image>)', details: sitemap.url });
  }

  return failures;
}
