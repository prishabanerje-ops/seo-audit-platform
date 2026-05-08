// backend/services/checks/s05-crawlability.js
const SECTION = 'Crawlability & Indexability';
const NOFOLLOW_THRESHOLD = 0.05; // 5%

export function runCrawlabilityChecks(records, _ctx) {
  const failures = [];

  // nofollow_internal_links — site-level: > 5% of internal links use nofollow
  let totalLinks = 0, nofollowLinks = 0;
  for (const r of records) {
    for (const link of (r._internalLinks || [])) {
      totalLinks++;
      if ((link.rel || '').includes('nofollow')) nofollowLinks++;
    }
  }
  if (totalLinks > 0 && nofollowLinks / totalLinks > NOFOLLOW_THRESHOLD) {
    failures.push({ check_id: 'nofollow_internal_links', passed: false, severity: 'warning', section: SECTION,
      message: `${nofollowLinks}/${totalLinks} internal links (${Math.round(nofollowLinks/totalLinks*100)}%) use nofollow — exceeds 5%`,
      details: null });
  }

  for (const r of records) {
    const url    = r.url || '';
    if (!url) continue;
    const urlData = r._url || {};
    const isIdx  = r['Indexability'] === 'Indexable';
    const depth  = parseInt(r['Crawl Depth'] || '0', 10);
    const inlinks = parseInt(r['Unique Inlinks'] || '0', 10);
    const words  = parseInt(r['Word Count'] || '0', 10);
    const metaRobots = (r['Meta Robots 1'] || '').toLowerCase();
    const xRobots    = (r['X-Robots-Tag 1'] || '').toLowerCase();

    // session_ids_in_urls
    if (urlData.hasSessionId || /[?&;](jsessionid|phpsessid|sessionid|sid)=/i.test(url)) {
      failures.push({ check_id: 'session_ids_in_urls', passed: false, severity: 'critical', section: SECTION,
        message: 'Session ID detected in URL', details: url });
    }

    // crawl_trap
    if (urlData.isCrawlTrap) {
      failures.push({ check_id: 'crawl_trap', passed: false, severity: 'critical', section: SECTION,
        message: 'Potential crawl trap: repeating path segments or 5+ query parameters', details: url });
    }

    // crawl_depth — important page > 4 clicks deep
    if (isIdx && depth > 4) {
      failures.push({ check_id: 'crawl_depth', passed: false, severity: 'info', section: SECTION,
        message: `Page is ${depth} clicks deep from root — exceeds 4-click recommendation`, details: url });
    }

    // orphan_pages — indexable page with zero inlinks
    if (isIdx && inlinks === 0) {
      failures.push({ check_id: 'orphan_pages', passed: false, severity: 'warning', section: SECTION,
        message: 'Indexable page has no internal inlinks (orphan)', details: url });
    }

    // soft_404 — HTTP 200 + < 50 words + not-found text patterns
    const code = String(r['Status Code'] || '');
    if (code === '200' && words < 50) {
      const text = (r._bodyText || '').toLowerCase();
      const notFoundPatterns = ['not found', '404', "doesn't exist", 'page not found', 'no results'];
      if (notFoundPatterns.some(p => text.includes(p))) {
        failures.push({ check_id: 'soft_404', passed: false, severity: 'warning', section: SECTION,
          message: `Soft 404: HTTP 200 with < 50 words and "not found" text patterns`, details: url });
      }
    }

    // x_robots_tag — X-Robots-Tag conflicts with meta robots
    if (metaRobots && xRobots) {
      const metaNoindex = metaRobots.includes('noindex');
      const xNoindex    = xRobots.includes('noindex');
      const metaIndex   = !metaNoindex;
      const xIndex      = !xNoindex;
      if (metaIndex !== xIndex) {
        failures.push({ check_id: 'x_robots_tag', passed: false, severity: 'critical', section: SECTION,
          message: `X-Robots-Tag "${xRobots}" conflicts with meta robots "${metaRobots}"`, details: url });
      }
    }

    // meta_noindex_correct — noindex on a canonical content page (not paginated/admin)
    const isNoindex = metaRobots.includes('noindex') || xRobots.includes('noindex');
    if (isNoindex) {
      const path = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();
      const isLikelyContent = !path.match(/\/(page|p|pg)\/?\d+|\/admin|\/login|\/search|\/tag\/|\/author\//);
      if (isLikelyContent && (r['Canonical Link Element 1'] || '') === url) {
        failures.push({ check_id: 'meta_noindex_correct', passed: false, severity: 'critical', section: SECTION,
          message: `Noindex on self-referencing canonical content page`, details: url });
      }
    }

    // noindex_paginated — paginated pages mixing strategies
    const isNext = r['rel="next"'] || '';
    const isPrev = r['rel="prev"'] || '';
    if ((isNext || isPrev) && isNoindex) {
      const can = r['Canonical Link Element 1'] || '';
      if (can && can !== url) {
        failures.push({ check_id: 'noindex_paginated', passed: false, severity: 'info', section: SECTION,
          message: 'Paginated page uses both noindex and canonical-to-page-1 — pick one strategy', details: url });
      }
    }

    // url_parameters_handled — duplicate-creating params without canonical
    if (isIdx) {
      let search = '';
      try { search = new URL(url).search; } catch { /* skip */ }
      const can = r['Canonical Link Element 1'] || '';
      if (search && (!can || can === url)) {
        failures.push({ check_id: 'url_parameters_handled', passed: false, severity: 'warning', section: SECTION,
          message: `URL has query parameters (${search}) without canonical consolidation`, details: url });
      }
    }
  }

  return failures;
}
