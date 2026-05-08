// backend/services/checks/s17-links.js
const SECTION = 'Internal Linking';
const GENERIC_ANCHORS = new Set(['click here', 'read more', 'here', 'this', 'link', 'learn more', 'more', 'more info']);
const MAX_INTERNAL_LINKS = 100;

export function runLinksChecks(records, _ctx) {
  const failures = [];

  // Cross-page: anchor text analysis (exact match overuse per target URL)
  const anchorsByTarget = new Map(); // targetUrl → array of anchor texts from all pages
  for (const r of records) {
    for (const link of (r._internalLinks || [])) {
      if (!link.href) continue;
      if (!anchorsByTarget.has(link.href)) anchorsByTarget.set(link.href, []);
      anchorsByTarget.get(link.href).push((link.text || '').trim().toLowerCase());
    }
  }

  let totalInternalLinks = 0, nofollowCount = 0;

  for (const r of records) {
    const url   = r.url || '';
    if (!url) continue;
    const links  = r._internalLinks || [];
    const inlinks = parseInt(r['Unique Inlinks'] || '0', 10);
    const isIdx  = r['Indexability'] === 'Indexable';

    totalInternalLinks += links.length;
    nofollowCount += links.filter(l => (l.rel || '').includes('nofollow')).length;

    // no_orphan_pages
    if (isIdx && inlinks === 0) {
      failures.push({ check_id: 'no_orphan_pages', passed: false, severity: 'warning', section: SECTION,
        message: 'Indexable page has no internal inlinks', details: url });
    }

    // internal_link_count — > 100 outbound internal links
    if (links.length > MAX_INTERNAL_LINKS) {
      failures.push({ check_id: 'internal_link_count', passed: false, severity: 'warning', section: SECTION,
        message: `${links.length} internal links on page — exceeds 100`, details: url });
    }

    for (const link of links) {
      if (!link.href) continue;

      // broken_internal_links
      if (link.statusCode && link.statusCode >= 400) {
        failures.push({ check_id: 'broken_internal_links', passed: false, severity: 'critical', section: SECTION,
          message: `Broken internal link (${link.statusCode}): ${link.href}`, details: url });
      }

      // internal_links_200 — same check, different check_id
      if (link.statusCode && link.statusCode >= 400) {
        failures.push({ check_id: 'internal_links_200', passed: false, severity: 'critical', section: SECTION,
          message: `Internal link returns ${link.statusCode}: ${link.href}`, details: url });
      }

      // redirect_internal_links — link resolves via redirect
      if (link.isRedirect) {
        failures.push({ check_id: 'redirect_internal_links', passed: false, severity: 'warning', section: SECTION,
          message: `Internal link redirects — update to point to final URL: ${link.href}`, details: url });
      }

      // anchor_descriptiveness — generic anchor text
      const anchor = (link.text || '').trim().toLowerCase();
      if (anchor && GENERIC_ANCHORS.has(anchor)) {
        failures.push({ check_id: 'anchor_descriptiveness', passed: false, severity: 'warning', section: SECTION,
          message: `Generic anchor text "${anchor}" for link to ${link.href}`, details: url });
      }
    }
  }

  // internal_nofollow — > 5% of internal links use nofollow
  if (totalInternalLinks > 0 && nofollowCount / totalInternalLinks > 0.05) {
    failures.push({ check_id: 'internal_nofollow', passed: false, severity: 'warning', section: SECTION,
      message: `${nofollowCount}/${totalInternalLinks} internal links (${Math.round(nofollowCount/totalInternalLinks*100)}%) use nofollow`,
      details: null });
  }

  // anchor_exact_match — all inlinks to a page use identical anchor text
  for (const [target, anchors] of anchorsByTarget) {
    if (anchors.length < 3) continue;
    const uniqueAnchors = new Set(anchors);
    if (uniqueAnchors.size === 1 && !GENERIC_ANCHORS.has([...uniqueAnchors][0])) {
      failures.push({ check_id: 'anchor_exact_match', passed: false, severity: 'info', section: SECTION,
        message: `All ${anchors.length} inlinks to ${target} use identical exact-match anchor: "${[...uniqueAnchors][0]}"`,
        details: target });
    }
  }

  // internal_crawl_depth — same as crawl_depth in s05, reported here too
  for (const r of records) {
    if (!r.url || r['Indexability'] !== 'Indexable') continue;
    const depth = parseInt(r['Crawl Depth'] || '0', 10);
    if (depth > 4) {
      failures.push({ check_id: 'internal_crawl_depth', passed: false, severity: 'warning', section: SECTION,
        message: `Page is ${depth} clicks deep from root`, details: r.url });
    }
  }

  return failures;
}
