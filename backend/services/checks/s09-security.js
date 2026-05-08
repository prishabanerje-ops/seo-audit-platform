// backend/services/checks/s09-security.js
const SECTION = 'Security & HTTPS';
const HSTS_MIN_MAX_AGE = 31_536_000; // 1 year

export function runSecurityChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url = r.url || '';
    if (!url) continue;

    const isHttps     = r._isHttps ?? url.startsWith('https://');
    const hsts        = r._hsts        || '';
    const csp         = r._csp         || '';
    const xFrame      = r._xFrameOptions      || '';
    const xContent    = r._xContentTypeOptions || '';
    const referrer    = r._referrerPolicy      || '';
    const permissions = r._permissionsPolicy   || '';
    const mon         = r._monitoring          || {};

    // https_enabled
    if (!isHttps) {
      failures.push({ check_id: 'https_enabled', passed: false, severity: 'critical', section: SECTION,
        message: 'Page served over HTTP — must use HTTPS', details: url });
    }

    // ssl_valid
    if (mon.sslValid === false) {
      failures.push({ check_id: 'ssl_valid', passed: false, severity: 'critical', section: SECTION,
        message: `SSL certificate invalid or expired (${mon.sslExpiryDays < 0 ? 'expired' : `${mon.sslExpiryDays} days remaining`})`,
        details: url });
    }

    // ssl_chain_complete
    if (mon.sslChainComplete === false) {
      failures.push({ check_id: 'ssl_chain_complete', passed: false, severity: 'critical', section: SECTION,
        message: 'SSL certificate chain incomplete — intermediate certificate missing', details: url });
    }

    // hsts_header
    if (!hsts) {
      failures.push({ check_id: 'hsts_header', passed: false, severity: 'warning', section: SECTION,
        message: 'Strict-Transport-Security header missing', details: url });
    } else {
      const maxAgeMatch = hsts.match(/max-age=(\d+)/i);
      const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
      if (maxAge < HSTS_MIN_MAX_AGE) {
        failures.push({ check_id: 'hsts_header', passed: false, severity: 'warning', section: SECTION,
          message: `HSTS max-age is ${maxAge}s — must be ≥ ${HSTS_MIN_MAX_AGE}s (1 year)`, details: url });
      }
    }

    // csp_header
    if (!csp) {
      failures.push({ check_id: 'csp_header', passed: false, severity: 'warning', section: SECTION,
        message: 'Content-Security-Policy header missing', details: url });
    } else if (csp.includes("'unsafe-inline'") && !csp.includes('nonce-') && !csp.includes('sha256-')) {
      failures.push({ check_id: 'csp_header', passed: false, severity: 'warning', section: SECTION,
        message: "CSP uses 'unsafe-inline' without nonce/hash — weakens protection", details: url });
    }

    // x_frame_options
    if (!xFrame) {
      failures.push({ check_id: 'x_frame_options', passed: false, severity: 'warning', section: SECTION,
        message: 'X-Frame-Options header missing', details: url });
    } else if (!['DENY', 'SAMEORIGIN'].includes(xFrame.toUpperCase())) {
      failures.push({ check_id: 'x_frame_options', passed: false, severity: 'warning', section: SECTION,
        message: `X-Frame-Options must be DENY or SAMEORIGIN, got: ${xFrame}`, details: url });
    }

    // x_content_type_options
    if (!xContent || xContent.toLowerCase() !== 'nosniff') {
      failures.push({ check_id: 'x_content_type_options', passed: false, severity: 'warning', section: SECTION,
        message: `X-Content-Type-Options must be "nosniff", got: "${xContent || 'missing'}"`, details: url });
    }

    // referrer_policy
    if (!referrer) {
      failures.push({ check_id: 'referrer_policy', passed: false, severity: 'info', section: SECTION,
        message: 'Referrer-Policy header missing', details: url });
    }

    // permissions_policy
    if (!permissions) {
      failures.push({ check_id: 'permissions_policy', passed: false, severity: 'info', section: SECTION,
        message: 'Permissions-Policy header missing', details: url });
    }

    // mixed_content
    const mixed = mon.mixedContentUrls || [];
    if (isHttps && mixed.length > 0) {
      failures.push({ check_id: 'mixed_content', passed: false, severity: 'critical', section: SECTION,
        message: `${mixed.length} HTTP resource(s) loaded on HTTPS page: ${mixed.slice(0,2).join(', ')}`,
        details: url });
    }

    // security_headers_grade — score presence of 5 headers
    const present = [!!hsts, !!csp, !!xFrame, !!xContent, !!referrer].filter(Boolean).length;
    if (present < 4) {
      failures.push({ check_id: 'security_headers_grade', passed: false, severity: 'warning', section: SECTION,
        message: `Only ${present}/5 security headers present (need ≥ 4)`, details: url });
    }
  }

  return failures;
}
