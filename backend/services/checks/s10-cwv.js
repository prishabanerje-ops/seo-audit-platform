// backend/services/checks/s10-cwv.js
const SECTION = 'Core Web Vitals';
const TTFB_THRESHOLD_MS   = 800;
const REQUEST_COUNT_MAX   = 100;
const JS_CSS_BYTES_MAX    = 500_000; // 500 KB

export function runCwvChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;

    const mon = r._monitoring || {};

    // lab_ttfb
    if ((mon.ttfbMs || 0) > TTFB_THRESHOLD_MS) {
      failures.push({ check_id: 'lab_ttfb', passed: false, severity: 'info', section: SECTION,
        message: `TTFB = ${mon.ttfbMs}ms — exceeds ${TTFB_THRESHOLD_MS}ms threshold`, details: url });
    }

    // lab_render_blocking
    if ((mon.renderBlockingMs || 0) > 500) {
      failures.push({ check_id: 'lab_render_blocking', passed: false, severity: 'warning', section: SECTION,
        message: `Render-blocking resources delay first paint by ${mon.renderBlockingMs}ms`, details: url });
    }

    // lab_request_count
    if ((mon.totalRequests || 0) > REQUEST_COUNT_MAX) {
      failures.push({ check_id: 'lab_request_count', passed: false, severity: 'warning', section: SECTION,
        message: `${mon.totalRequests} requests — exceeds ${REQUEST_COUNT_MAX} limit`, details: url });
    }

    // lab_asset_weight — JS + CSS transfer bytes
    if ((mon.jsCssTransferBytes || 0) > JS_CSS_BYTES_MAX) {
      const kb = Math.round(mon.jsCssTransferBytes / 1024);
      failures.push({ check_id: 'lab_asset_weight', passed: false, severity: 'warning', section: SECTION,
        message: `JS + CSS transfer size is ${kb}KB — exceeds ${JS_CSS_BYTES_MAX / 1024}KB limit`, details: url });
    }

    // lcp_element_id — decorative element as LCP
    if (mon.lcpIsDecorative) {
      failures.push({ check_id: 'lcp_element_id', passed: false, severity: 'warning', section: SECTION,
        message: `LCP element is decorative (${mon.lcpTagName || 'unknown'}) — not meaningful content`, details: url });
    }

    // cls_causes
    if ((mon.clsSources || []).length > 0) {
      failures.push({ check_id: 'cls_causes', passed: false, severity: 'warning', section: SECTION,
        message: `${mon.clsSources.length} CLS source(s) detected: ${mon.clsSources.slice(0, 2).join(', ')}`, details: url });
    }
  }

  return failures;
}
