// backend/services/checks/s07-jsrender.js
const SECTION = 'JavaScript Rendering';

export function runJsRenderChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const js = r._jsRender;
    if (!js) continue;

    const rawWords  = js.rawWordCount      || 0;
    const rendWords = js.renderedWordCount  || 0;
    const rawLinks  = js.rawLinkCount      || 0;
    const rendLinks = js.renderedLinkCount || 0;
    const dcl       = js.domContentLoadedMs || 0;
    const blocking  = js.renderBlockingScripts || [];

    // js_critical_content — H1 not in raw HTML
    if (!js.rawHasH1) {
      failures.push({ check_id: 'js_critical_content', passed: false, severity: 'critical', section: SECTION,
        message: 'H1 tag only present in rendered DOM — not in raw HTML (JS-injected)', details: url });
    }

    // js_metadata
    if (!js.rawHasTitle || !js.rawHasMetaDesc) {
      const missing = [!js.rawHasTitle && 'title', !js.rawHasMetaDesc && 'meta description'].filter(Boolean).join(', ');
      failures.push({ check_id: 'js_metadata', passed: false, severity: 'critical', section: SECTION,
        message: `Missing in raw HTML: ${missing} (JS-injected)`, details: url });
    }

    // js_link_discovery — rendered has > 20% more links than raw
    if (rawLinks > 0 && rendLinks > rawLinks * 1.20) {
      const pct = Math.round((rendLinks - rawLinks) / rawLinks * 100);
      failures.push({ check_id: 'js_link_discovery', passed: false, severity: 'critical', section: SECTION,
        message: `Rendered DOM has ${pct}% more links than raw HTML — links may not be crawled`, details: url });
    }

    // js_structured_data
    if (!js.rawHasJsonLd) {
      failures.push({ check_id: 'js_structured_data', passed: false, severity: 'warning', section: SECTION,
        message: 'JSON-LD structured data not present in raw HTML (JS-injected)', details: url });
    }

    // js_render_comparison — rendered content > 30% different from raw
    if (rawWords > 0 && rendWords > 0) {
      const diff = Math.abs(rendWords - rawWords) / rawWords;
      if (diff > 0.30) {
        failures.push({ check_id: 'js_render_comparison', passed: false, severity: 'warning', section: SECTION,
          message: `Rendered content differs ${Math.round(diff * 100)}% from raw HTML word count`, details: url });
      }

      // js_csr_vs_ssr — raw < 100 words, rendered > 300 words
      if (rawWords < 100 && rendWords > 300) {
        failures.push({ check_id: 'js_csr_vs_ssr', passed: false, severity: 'info', section: SECTION,
          message: `Full client-side rendering detected: raw ${rawWords} words, rendered ${rendWords} words`, details: url });
      }

      // js_two_wave_risk — core content only in rendered DOM
      if (rawWords < rendWords * 0.5) {
        failures.push({ check_id: 'js_two_wave_risk', passed: false, severity: 'info', section: SECTION,
          message: 'Core content may be at risk of two-wave indexing delay', details: url });
      }
    }

    // js_lazy_loaded — links only visible after scroll
    if ((js.lazyContentLinks || 0) > 0) {
      failures.push({ check_id: 'js_lazy_loaded', passed: false, severity: 'warning', section: SECTION,
        message: `${js.lazyContentLinks} links only visible after scroll (lazy-loaded)`, details: url });
    }

    // js_dependencies_order — render-blocking scripts in <head>
    if (blocking.length > 0) {
      failures.push({ check_id: 'js_dependencies_order', passed: false, severity: 'info', section: SECTION,
        message: `${blocking.length} render-blocking script(s) in <head> without defer/async`, details: url });
    }

    // js_crawl_budget_render — DCL > 2000ms
    if (dcl > 2000) {
      failures.push({ check_id: 'js_crawl_budget_render', passed: false, severity: 'warning', section: SECTION,
        message: `domContentLoaded took ${dcl}ms — exceeds 2s budget for Googlebot`, details: url });
    }
  }

  return failures;
}
