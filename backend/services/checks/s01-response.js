// backend/services/checks/s01-response.js
const SECTION = 'Response Codes & Redirects';

export function runResponseChecks(records, _ctx) {
  const failures = [];

  const validPages = records.filter(r => r.url);
  const total = validPages.length;

  const redirectingCount = validPages.filter(r =>
    String(r['Status Code'] || '').startsWith('3')
  ).length;
  const count302 = validPages.filter(r =>
    String(r['Status Code'] || '') === '302'
  ).length;

  for (const r of records) {
    const url   = r.url || '';
    if (!url) continue;
    const code  = String(r['Status Code'] || '').trim();
    const isIdx = r['Indexability'] === 'Indexable';
    const rUrl  = r['Redirect URL'] || '';
    const chain = r._redirectChain || [];

    if (isIdx && code !== '200') {
      failures.push({ check_id: 'http_status', passed: false, severity: 'critical', section: SECTION,
        message: `Indexable page returned ${code}`, details: url });
    }

    if (code === '302' && rUrl) {
      failures.push({ check_id: 'redirect_301_vs_302', passed: false, severity: 'warning', section: SECTION,
        message: `Temporary 302 redirect should be 301`, details: url });
    }

    if (chain.length > 1) {
      failures.push({ check_id: 'redirect_chain', passed: false, severity: 'critical', section: SECTION,
        message: `Redirect chain (${chain.length} hops): ${chain.slice(0, 3).join(' → ')}`, details: url });
    }

    if (chain.length >= 2) {
      const chainSet = new Set(chain);
      if (chainSet.size < chain.length) {
        failures.push({ check_id: 'redirect_loop', passed: false, severity: 'critical', section: SECTION,
          message: `Redirect loop detected in chain`, details: url });
      }
    }

    if (url.startsWith('http://') && code.startsWith('3')) {
      if (!rUrl.startsWith('https://')) {
        failures.push({ check_id: 'redirect_to_https', passed: false, severity: 'critical', section: SECTION,
          message: `HTTP page redirects to non-HTTPS target`, details: url });
      }
    }

    if (code.startsWith('4')) {
      failures.push({ check_id: 'broken_pages_4xx', passed: false, severity: 'critical', section: SECTION,
        message: `4xx error (${code})`, details: url });
    }

    if (code.startsWith('5')) {
      failures.push({ check_id: 'server_errors_5xx', passed: false, severity: 'critical', section: SECTION,
        message: `5xx server error (${code})`, details: url });
    }

    if (code === '404') {
      failures.push({ check_id: 'gone_vs_not_found', passed: false, severity: 'info', section: SECTION,
        message: `404 Not Found — consider 410 Gone for permanently deleted content`, details: url });
    }
  }

  if (total > 0 && redirectingCount / total > 0.10) {
    failures.push({ check_id: 'redirect_count', passed: false, severity: 'info', section: SECTION,
      message: `${redirectingCount}/${total} pages (${Math.round(redirectingCount / total * 100)}%) redirect — exceeds 10% threshold`,
      details: null });
  }

  if (total > 0 && count302 / total > 0.05) {
    failures.push({ check_id: 'temp_redirect_overuse', passed: false, severity: 'warning', section: SECTION,
      message: `${count302} temporary 302 redirects found — consider converting to 301`,
      details: null });
  }

  return failures;
}
