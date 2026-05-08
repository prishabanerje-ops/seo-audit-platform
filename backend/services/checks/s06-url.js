// backend/services/checks/s06-url.js
const SECTION = 'URL Structure';
const URL_LENGTH_MAX   = 100;
const MAX_DIR_DEPTH    = 4;
const GENERIC_SLUG_RE  = /^(page-\d+|p=|content\/\d+|index|home|untitled|post-\d+)$/i;
const DATE_FORMAT_RE   = /(\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{2}[\/\-]\d{2}[\/\-]\d{4})/;

export function runUrlChecks(records, _ctx) {
  const failures = [];

  // Trailing slash consistency — site-level
  let withSlash = 0, withoutSlash = 0;
  for (const r of records) {
    if (!r.url || r['Indexability'] !== 'Indexable') continue;
    let path = '';
    try { path = new URL(r.url).pathname; } catch { continue; }
    if (path === '/') continue;
    if (path.endsWith('/')) withSlash++; else withoutSlash++;
  }
  const trailingSlashInconsistent = withSlash > 0 && withoutSlash > 0;

  // Subdomain vs subfolder detection — site-level
  const allHosts = new Set();
  let rootHost = '';
  for (const r of records) {
    if (!r.url) continue;
    try {
      const u = new URL(r.url);
      if (!rootHost) rootHost = u.hostname.replace(/^www\./, '');
      allHosts.add(u.hostname);
    } catch { /* skip */ }
  }
  const subdomainContent = [...allHosts].filter(h => {
    if (!rootHost) return false;
    const isSubdomain = h.endsWith('.' + rootHost) && h !== 'www.' + rootHost;
    if (!isSubdomain) return false;
    const sub = h.replace('.' + rootHost, '');
    return /^(blog|docs|shop|news|store|app|help|support)$/.test(sub);
  });

  // Date format consistency
  const dateFormats = { ymd: 0, dmy: 0 };

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const urlData = r._url || {};
    let path = '', slug = '';
    try {
      const u = new URL(url);
      path = u.pathname;
      slug = path.split('/').filter(Boolean).pop() || '';
    } catch { continue; }

    // url_length
    if (url.length > URL_LENGTH_MAX) {
      failures.push({ check_id: 'url_length', passed: false, severity: 'info', section: SECTION,
        message: `URL is ${url.length} characters — exceeds ${URL_LENGTH_MAX}-character limit`, details: url });
    }

    // url_lowercase
    if (urlData.isLowercase === false || path !== path.toLowerCase()) {
      failures.push({ check_id: 'url_lowercase', passed: false, severity: 'warning', section: SECTION,
        message: `URL path contains uppercase characters`, details: url });
    }

    // url_hyphens — underscores instead of hyphens
    if (urlData.hasHyphens === false || slug.includes('_')) {
      failures.push({ check_id: 'url_hyphens', passed: false, severity: 'warning', section: SECTION,
        message: `URL slug uses underscores instead of hyphens`, details: url });
    }

    // url_special_chars — percent-encoded special chars in path (not / or -)
    if (/%((?!2F|2D)[0-9A-Fa-f]{2})/i.test(path)) {
      failures.push({ check_id: 'url_special_chars', passed: false, severity: 'warning', section: SECTION,
        message: `URL path contains percent-encoded special characters`, details: url });
    }

    // url_descriptive — generic slug patterns
    if (slug && GENERIC_SLUG_RE.test(slug)) {
      failures.push({ check_id: 'url_descriptive', passed: false, severity: 'info', section: SECTION,
        message: `Non-descriptive URL slug: "${slug}"`, details: url });
    }

    // url_trailing_slash
    if (trailingSlashInconsistent) {
      failures.push({ check_id: 'url_trailing_slash', passed: false, severity: 'warning', section: SECTION,
        message: 'Inconsistent trailing slash usage across the site', details: url });
    }

    // url_deep_nesting
    const dirDepth = urlData.dirDepth ?? path.split('/').filter(Boolean).length;
    if (dirDepth > MAX_DIR_DEPTH) {
      failures.push({ check_id: 'url_deep_nesting', passed: false, severity: 'warning', section: SECTION,
        message: `URL has ${dirDepth} directory levels — exceeds maximum of ${MAX_DIR_DEPTH}`, details: url });
    }

    // url_date_format — collect for consistency check
    const dateMatch = path.match(DATE_FORMAT_RE);
    if (dateMatch) {
      if (/\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(dateMatch[0])) dateFormats.ymd++;
      else dateFormats.dmy++;
    }
  }

  // url_date_format — flag inconsistency if both formats found
  if (dateFormats.ymd > 0 && dateFormats.dmy > 0) {
    failures.push({ check_id: 'url_date_format', passed: false, severity: 'info', section: SECTION,
      message: `Inconsistent date format in URLs (mix of YYYY/MM/DD and DD/MM/YYYY)`, details: null });
  }

  // subdomain_vs_subfolder
  if (subdomainContent.length > 0) {
    failures.push({ check_id: 'subdomain_vs_subfolder', passed: false, severity: 'info', section: SECTION,
      message: `Content hosted on subdomains instead of subdirectories: ${subdomainContent.join(', ')}`,
      details: null });
  }

  return failures;
}
