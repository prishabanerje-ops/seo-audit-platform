// playwright-crawler/src/extractors/jsrender.js
/**
 * JS Render extractor — per-page, Playwright mode only.
 * Serves: Section 7 (JS Rendering), Section 23 (geo_content_without_js, geo_faq_html).
 *
 * Compares raw (pre-JS) HTML from a plain fetch() with Playwright-rendered HTML.
 * The fetcher param defaults to globalThis.fetch for testability.
 */
import { load as cheerioLoad } from 'cheerio';

function countWords(html) {
  const $ = cheerioLoad(html);
  $('script, style, noscript').remove();
  return ($('body').text() || '').trim().split(/\s+/).filter(Boolean).length;
}

function countLinks(html) {
  return cheerioLoad(html)('a[href]').length;
}

function hasH1(html)      { return cheerioLoad(html)('h1').length > 0; }
function hasTitle(html)   { return cheerioLoad(html)('title').length > 0; }
function hasMetaDesc(html) { return cheerioLoad(html)('meta[name="description"]').length > 0; }
function hasJsonLd(html)  { return cheerioLoad(html)('script[type="application/ld+json"]').length > 0; }

function getRenderBlockingScripts(html) {
  const $ = cheerioLoad(html);
  const scripts = [];
  $('head script[src]:not([async]):not([defer]):not([type="module"])').each((_, el) => {
    const src = $(el).attr('src');
    if (src) scripts.push(src);
  });
  return scripts;
}

/**
 * @param {import('playwright').Page} page — Playwright page after networkidle
 * @param {string} url
 * @param {Function} [fetcher]
 * @returns {Promise<object>}
 */
export async function extractJsRender(page, url, fetcher = globalThis.fetch) {
  // Get pre-JS HTML via plain fetch (same URL, no JavaScript execution)
  let rawHtml = '';
  try {
    const r = await fetcher(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'SEOAuditBot/1.0' } });
    if (r.ok) rawHtml = await r.text();
  } catch {}

  const renderedHtml = await page.content();

  let domContentLoadedMs = 0;
  try {
    domContentLoadedMs = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return nav ? Math.round(nav.domContentLoadedEventEnd - nav.requestStart) : 0;
    });
  } catch {}

  let lazyContentLinks = 0;
  try {
    lazyContentLinks = await page.evaluate(() =>
      document.querySelectorAll('a[href][data-src], a[href][loading="lazy"]').length
    );
  } catch {}

  return {
    rawHtml,
    renderedHtml,
    rawWordCount:           countWords(rawHtml),
    renderedWordCount:      countWords(renderedHtml),
    rawLinkCount:           countLinks(rawHtml),
    renderedLinkCount:      countLinks(renderedHtml),
    rawHasH1:               hasH1(rawHtml),
    renderedHasH1:          hasH1(renderedHtml),
    rawHasTitle:            hasTitle(rawHtml),
    rawHasMetaDesc:         hasMetaDesc(rawHtml),
    rawHasJsonLd:           hasJsonLd(rawHtml),
    renderBlockingScripts:  getRenderBlockingScripts(rawHtml),
    domContentLoadedMs,
    lazyContentLinks,
  };
}
