// backend/services/checks/s02-canonical.js
const SECTION = 'Canonicalisation';

export function runCanonicalChecks(records, _ctx) {
  const failures = [];

  // Build canonical graph for cross-page checks
  const canonicalMap = new Map(); // url → canonical target
  for (const r of records) {
    const url = r.url || '';
    const can = r['Canonical Link Element 1'] || '';
    if (url && can) canonicalMap.set(url, can);
  }

  // Trailing slash consistency across all canonical URLs
  let withSlash = 0, withoutSlash = 0;
  for (const can of canonicalMap.values()) {
    try {
      const p = new URL(can).pathname;
      if (p === '/') continue;
      if (p.endsWith('/')) withSlash++; else withoutSlash++;
    } catch { /* skip malformed */ }
  }
  const trailingSlashInconsistent = withSlash > 0 && withoutSlash > 0;

  const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'ref', 'source'];

  for (const r of records) {
    const url   = r.url || '';
    if (!url) continue;
    const can   = r['Canonical Link Element 1'] || '';
    const count = typeof r._canonicalCount === 'number' ? r._canonicalCount : (can ? 1 : 0);
    const isIdx = r['Indexability'] === 'Indexable';
    const tags  = r._hreflangTags || [];

    // self_referencing_canonical
    if (isIdx && !can) {
      failures.push({ check_id: 'self_referencing_canonical', passed: false, severity: 'critical', section: SECTION,
        message: 'Missing canonical tag on indexable page', details: url });
    }

    // duplicate_canonical_tags
    if (count > 1) {
      failures.push({ check_id: 'duplicate_canonical_tags', passed: false, severity: 'critical', section: SECTION,
        message: `${count} canonical tags found — only one allowed`, details: url });
    }

    // canonical_points_https
    if (can && can.startsWith('http://')) {
      failures.push({ check_id: 'canonical_points_https', passed: false, severity: 'critical', section: SECTION,
        message: `Canonical uses HTTP: ${can}`, details: url });
    }

    // canonical_loop — A → B → A
    if (can && can !== url) {
      const bCanonical = canonicalMap.get(can);
      if (bCanonical === url) {
        failures.push({ check_id: 'canonical_loop', passed: false, severity: 'critical', section: SECTION,
          message: `Canonical loop: ${url} → ${can} → ${url}`, details: url });
      }
    }

    // reciprocal_canonical — A canonicals to B, B doesn't canonical back to A
    if (can && can !== url) {
      const bCanonical = canonicalMap.get(can);
      if (bCanonical && bCanonical !== url) {
        failures.push({ check_id: 'reciprocal_canonical', passed: false, severity: 'warning', section: SECTION,
          message: `Canonical target ${can} does not point back to ${url}`, details: url });
      }
    }

    // trailing_slash_canonical
    if (trailingSlashInconsistent && can) {
      failures.push({ check_id: 'trailing_slash_canonical', passed: false, severity: 'info', section: SECTION,
        message: 'Inconsistent trailing slash usage in canonical URLs across the site', details: url });
    }

    // paginated_canonical — paginated page should self-canonical (can === url)
    const hasPagination = r['rel="next"'] || r['rel="prev"'];
    if (hasPagination && can && can !== url) {
      failures.push({ check_id: 'paginated_canonical', passed: false, severity: 'warning', section: SECTION,
        message: `Paginated page canonicals to ${can} — should self-canonical`, details: url });
    }

    // url_parameter_canonical — tracking params in canonical URL
    if (can) {
      let canSearch = '';
      try { canSearch = new URL(can).search; } catch { /* skip */ }
      if (canSearch) {
        const canParams = new URLSearchParams(canSearch);
        if (TRACKING_PARAMS.some(p => canParams.has(p))) {
          failures.push({ check_id: 'url_parameter_canonical', passed: false, severity: 'info', section: SECTION,
            message: `Canonical URL contains tracking parameters — should point to clean URL`, details: url });
        }
      }
    }

    // hreflang_canonical_conflict
    if (can && tags.length > 0) {
      const selfHreflang = tags.find(t => t.href === url || t.href === can);
      if (!selfHreflang) {
        failures.push({ check_id: 'hreflang_canonical_conflict', passed: false, severity: 'warning', section: SECTION,
          message: 'Canonical URL not listed in hreflang annotations', details: url });
      }
    }
  }

  return failures;
}
