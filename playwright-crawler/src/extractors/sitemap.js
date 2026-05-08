// playwright-crawler/src/extractors/sitemap.js
/**
 * Sitemap extractor — site-level, runs once per crawl.
 * Serves: Section 4 (XML Sitemaps).
 *
 * Accepts an optional `fetcher` for testing (defaults to globalThis.fetch).
 */
import { XMLParser } from 'fast-xml-parser';

const PARSER = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false });

/**
 * @param {string} url
 * @param {Function} fetcher
 * @returns {Promise<{ text: string, sizeBytes: number }>}
 */
const FALLBACK_UAS = [
  'SEOAuditBot/1.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

async function fetchXml(url, fetcher) {
  let lastErr;
  for (const ua of FALLBACK_UAS) {
    try {
      const r = await fetcher(url, {
        signal:  AbortSignal.timeout(15000),
        headers: { 'Accept': 'application/xml,text/xml,*/*', 'User-Agent': ua },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      return { text, sizeBytes: new TextEncoder().encode(text).length };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * @param {string} xmlText
 * @returns {{ urls: object[], childSitemaps: string[], isIndex: boolean, errors: string[] }}
 */
function parseSitemapXml(xmlText) {
  let doc;
  const errors = [];
  try { doc = PARSER.parse(xmlText); } catch (e) {
    errors.push(e.message);
    return { urls: [], childSitemaps: [], isIndex: false, errors };
  }

  // Sitemap index
  if (doc.sitemapindex) {
    const sitemaps = [].concat(doc.sitemapindex?.sitemap ?? []);
    return {
      urls:          [],
      childSitemaps: sitemaps.map(s => s.loc || '').filter(Boolean),
      isIndex:       true,
      errors,
    };
  }

  // Regular sitemap
  if (doc.urlset) {
    const items = [].concat(doc.urlset?.url ?? []);
    const urls  = items.map(item => ({
      loc:        String(item.loc   || ''),
      lastmod:    item.lastmod    ? String(item.lastmod)    : null,
      changefreq: item.changefreq ? String(item.changefreq) : null,
      priority:   item.priority   != null ? String(item.priority) : null,
      images:     [].concat(item['image:image'] ?? []).map(img => ({ loc: String(img['image:loc'] || '') })),
      videos:     [].concat(item['video:video'] ?? []).map(v  => ({ loc: String(v['video:content_loc'] || '') })),
      news:       item['news:news'] ?? null,
    }));
    return { urls, childSitemaps: [], isIndex: false, errors };
  }

  errors.push('Neither <sitemapindex> nor <urlset> found');
  return { urls: [], childSitemaps: [], isIndex: false, errors };
}

/**
 * @param {string}   baseUrl      — e.g. 'https://example.com'
 * @param {string[]} sitemapUrls  — from robots.txt Sitemap: directives (may be empty)
 * @param {Function} [fetcher]
 * @returns {Promise<object>}
 */
export async function extractSitemap(baseUrl, sitemapUrls = [], fetcher = globalThis.fetch) {
  const origin     = new URL(baseUrl).origin;
  const candidates = sitemapUrls.length > 0 ? sitemapUrls : [`${origin}/sitemap.xml`];

  for (const url of candidates) {
    try {
      const { text, sizeBytes } = await fetchXml(url, fetcher);
      const { urls, childSitemaps, isIndex, errors } = parseSitemapXml(text);

      // If sitemap index: fetch first child to get actual URL list
      let allUrls = urls;
      if (isIndex && childSitemaps.length > 0) {
        try {
          const { text: childText } = await fetchXml(childSitemaps[0], fetcher);
          allUrls = parseSitemapXml(childText).urls;
        } catch {}
      }

      return { found: true, url, isIndex, childSitemaps, urls: allUrls, fileSizeBytes: sizeBytes, parseErrors: errors };
    } catch { /* try next candidate */ }
  }

  return { found: false, url: '', isIndex: false, childSitemaps: [], urls: [], fileSizeBytes: 0, parseErrors: ['Sitemap not found'] };
}
