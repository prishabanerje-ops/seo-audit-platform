// playwright-crawler/src/extractors/monitoring.js
/**
 * Monitoring extractor — per-page, Playwright mode only.
 * Serves: Section 9 (Security — SSL, mixed content), Section 10 (CWV lab),
 *         Section 21 (update_history_visible — via domContentLoadedMs).
 *
 * TLS check uses Node.js tls.connect() — faster and more reliable than
 * accessing certificates through Playwright's CDP.
 */
import tls from 'tls';

/**
 * @param {string} hostname
 * @param {number} [port=443]
 * @returns {Promise<{ sslValid: boolean, sslExpiryDays: number, sslChainComplete: boolean, sslIssuer: string }>}
 */
function checkTls(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, timeout: 10000, rejectUnauthorized: false },
      () => {
        const cert       = socket.getPeerCertificate(true);
        const authorized = socket.authorized;
        const expiryDate = cert.valid_to ? new Date(cert.valid_to) : null;
        const daysLeft   = expiryDate ? Math.floor((expiryDate - Date.now()) / 86400000) : -1;
        socket.destroy();
        resolve({
          sslValid:         authorized,
          sslExpiryDays:    daysLeft,
          sslChainComplete: authorized,
          sslIssuer:        cert.issuer?.O ?? '',
        });
      }
    );
    socket.on('error',   () => { socket.destroy(); resolve({ sslValid: false, sslExpiryDays: -1, sslChainComplete: false, sslIssuer: '' }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ sslValid: false, sslExpiryDays: -1, sslChainComplete: false, sslIssuer: '' }); });
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function extractMonitoring(page, url) {
  const parsed  = new URL(url);
  const isHttps = parsed.protocol === 'https:';

  // TLS (HTTPS only)
  let tlsData = { sslValid: false, sslExpiryDays: -1, sslChainComplete: false, sslIssuer: '' };
  if (isHttps) {
    try { tlsData = await checkTls(parsed.hostname); } catch {}
  }

  // Performance timing via Navigation Timing API
  let ttfbMs = 0, domContentLoadedMs = 0, totalRequests = 0, jsCssTransferBytes = 0;
  try {
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return nav
        ? { ttfb: nav.responseStart - nav.requestStart, dcl: nav.domContentLoadedEventEnd - nav.requestStart }
        : null;
    });
    if (timing) { ttfbMs = Math.round(timing.ttfb); domContentLoadedMs = Math.round(timing.dcl); }

    totalRequests       = await page.evaluate(() => performance.getEntriesByType('resource').length);
    jsCssTransferBytes  = await page.evaluate(() =>
      performance.getEntriesByType('resource')
        .filter(r => r.initiatorType === 'script' || r.initiatorType === 'css')
        .reduce((sum, r) => sum + (r.transferSize || 0), 0)
    );
  } catch {}

  // Mixed content (HTTP resources on HTTPS page)
  let mixedContentUrls = [];
  if (isHttps) {
    try {
      mixedContentUrls = await page.evaluate(() =>
        [
          ...document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"], iframe[src^="http:"]'),
        ].map(el => el.src || el.href).filter(Boolean)
      );
    } catch {}
  }

  // LCP element (buffered entries from PerformanceObserver)
  let lcpTagName = null, lcpClassName = null, lcpIsDecorative = false;
  try {
    const lcp = await page.evaluate(() =>
      new Promise(resolve => {
        const obs = new PerformanceObserver(list => {
          const entries = list.getEntries();
          const last    = entries[entries.length - 1];
          obs.disconnect();
          if (last?.element) {
            resolve({ tagName: last.element.tagName?.toLowerCase() ?? null, className: last.element.className ?? null, alt: last.element.alt ?? null });
          } else {
            resolve(null);
          }
        });
        obs.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => { obs.disconnect(); resolve(null); }, 3000);
      })
    );
    if (lcp) {
      lcpTagName      = lcp.tagName;
      lcpClassName    = lcp.className;
      lcpIsDecorative = lcp.tagName === 'img' && !lcp.alt;
    }
  } catch {}

  // CLS sources (layout shifts without recent user input)
  let clsSources = [];
  try {
    clsSources = await page.evaluate(() =>
      new Promise(resolve => {
        const sources = [];
        const obs = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              for (const src of (entry.sources ?? [])) {
                sources.push({
                  tagName:       src.node?.tagName?.toLowerCase() ?? '',
                  id:            src.node?.id                      ?? '',
                  className:     src.node?.className               ?? '',
                  shiftDelta:    entry.value,
                  hadRecentInput: false,
                });
              }
            }
          }
        });
        obs.observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => { obs.disconnect(); resolve(sources); }, 3000);
      })
    );
  } catch {}

  return {
    ...tlsData,
    mixedContentUrls,
    ttfbMs,
    domContentLoadedMs,
    totalRequests,
    jsCssTransferBytes,
    lcpTagName,
    lcpClassName,
    lcpIsDecorative,
    clsSources,
  };
}
