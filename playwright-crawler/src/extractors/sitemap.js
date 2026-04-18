/**
 * Sitemap extractor (site-level)
 *
 * Runs once per crawl. Fetches and parses XML sitemap(s).
 * Uses sitemapUrls from the robots extractor, falling back to /sitemap.xml.
 */

import { load }          from 'cheerio';
import { createLogger }  from '../utils/logger.js';

const logger = createLogger('extractor:sitemap');

const MAX_CHILD_SITEMAPS = 5;
const MAX_SITEMAP_BYTES  = 52428800; // 50 MB
const MAX_URL_COUNT      = 50000;
const FETCH_TIMEOUT_MS   = 15000;

/**
 * Fetch a URL and return { ok, status, text, contentLength }.
 */
async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SEOAuditBot/1.0' },
      signal:  AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, status: res.status, text: '', contentLength: 0 };
    const text          = await res.text();
    const contentLength = Buffer.byteLength(text, 'utf8');
    return { ok: true, status: res.status, text, contentLength };
  } catch (err) {
    logger.warn(`Sitemap fetch failed for ${url}: ${err.message}`);
    return { ok: false, status: 0, text: '', contentLength: 0 };
  }
}

/**
 * Parse a single <urlset> sitemap XML and return stats.
 *
 * @param {string} xml
 * @param {string} siteOrigin  — used to detect invalid/wrong-domain URLs
 * @returns {{ urlCount, withLastmod, withImages, invalidUrls, parseErrors }}
 */
function parseUrlset(xml, siteOrigin) {
  const parseErrors = [];
  let $;
  try {
    $ = load(xml, { xmlMode: true });
  } catch (err) {
    parseErrors.push(err.message);
    return { urlCount: 0, withLastmod: 0, withImages: 0, invalidUrls: [], parseErrors };
  }

  let urlCount   = 0;
  let withLastmod = 0;
  let withImages  = 0;
  const invalidUrls = [];

  $('url').each((_, el) => {
    urlCount++;
    const loc     = $(el).find('loc').first().text().trim();
    const lastmod = $(el).find('lastmod').first().text().trim();
    const imgEl   = $(el).find('image\\:image, image').first();

    if (lastmod) withLastmod++;
    if (imgEl.length) withImages++;

    if (!loc) {
      invalidUrls.push('(empty loc)');
    } else {
      try {
        const parsed = new URL(loc);
        if (parsed.origin !== siteOrigin) invalidUrls.push(loc);
      } catch {
        invalidUrls.push(loc);
      }
    }
  });

  return { urlCount, withLastmod, withImages, invalidUrls: invalidUrls.slice(0, 50), parseErrors };
}

/**
 * Site-level extractor: fetch and parse sitemap(s).
 *
 * @param {string}   startUrl     — crawl start URL
 * @param {string[]} sitemapUrls  — from robots extractor; falls back to /sitemap.xml
 * @returns {Promise<object>}
 */
export async function extractSitemap(startUrl, sitemapUrls = []) {
  const origin      = new URL(startUrl).origin;
  const targetUrl   = sitemapUrls[0] || `${origin}/sitemap.xml`;
  const parseErrors = [];

  const { ok, status, text, contentLength } = await fetchText(targetUrl);

  if (!ok) {
    return {
      sitemapExists:  false,
      sitemapUrl:     targetUrl,
      isIndex:        false,
      childSitemaps:  [],
      totalUrlCount:  0,
      urlsWithLastmod: 0,
      urlsWithImages: 0,
      invalidUrls:    [],
      redirectUrls:   [],
      oversized:      false,
      parseErrors:    [],
    };
  }

  if (contentLength > MAX_SITEMAP_BYTES) {
    return {
      sitemapExists:  true,
      sitemapUrl:     targetUrl,
      isIndex:        false,
      childSitemaps:  [],
      totalUrlCount:  0,
      urlsWithLastmod: 0,
      urlsWithImages: 0,
      invalidUrls:    [],
      redirectUrls:   [],
      oversized:      true,
      parseErrors:    ['Sitemap exceeds 50 MB size limit'],
    };
  }

  let $;
  try {
    $ = load(text, { xmlMode: true });
  } catch (err) {
    return {
      sitemapExists:   true,
      sitemapUrl:      targetUrl,
      isIndex:         false,
      childSitemaps:   [],
      totalUrlCount:   0,
      urlsWithLastmod: 0,
      urlsWithImages:  0,
      invalidUrls:     [],
      redirectUrls:    [],
      oversized:       false,
      parseErrors:     [err.message],
    };
  }

  const isIndex = $('sitemapindex').length > 0;

  if (isIndex) {
    // Sitemap index — collect child sitemap URLs and aggregate
    const childUrls = [];
    $('sitemap loc').each((_, el) => {
      childUrls.push($(el).text().trim());
    });
    const toFetch = childUrls.slice(0, MAX_CHILD_SITEMAPS);

    let totalUrlCount   = 0;
    let urlsWithLastmod = 0;
    let urlsWithImages  = 0;
    const allInvalid    = [];

    await Promise.all(toFetch.map(async (childUrl) => {
      const child = await fetchText(childUrl);
      if (!child.ok) return;
      const stats = parseUrlset(child.text, origin);
      totalUrlCount   += stats.urlCount;
      urlsWithLastmod += stats.withLastmod;
      urlsWithImages  += stats.withImages;
      allInvalid.push(...stats.invalidUrls);
      parseErrors.push(...stats.parseErrors);
    }));

    logger.info(`Sitemap index: ${toFetch.length} children, ${totalUrlCount} URLs`);

    return {
      sitemapExists:   true,
      sitemapUrl:      targetUrl,
      isIndex:         true,
      childSitemaps:   childUrls,
      totalUrlCount,
      urlsWithLastmod,
      urlsWithImages,
      invalidUrls:     allInvalid.slice(0, 50),
      redirectUrls:    [],
      oversized:       totalUrlCount > MAX_URL_COUNT,
      parseErrors,
    };
  }

  // Regular urlset
  const stats = parseUrlset(text, origin);
  parseErrors.push(...stats.parseErrors);

  logger.info(`Sitemap: ${stats.urlCount} URLs, lastmod=${stats.withLastmod}`);

  return {
    sitemapExists:   true,
    sitemapUrl:      targetUrl,
    isIndex:         false,
    childSitemaps:   [],
    totalUrlCount:   stats.urlCount,
    urlsWithLastmod: stats.withLastmod,
    urlsWithImages:  stats.withImages,
    invalidUrls:     stats.invalidUrls,
    redirectUrls:    [],
    oversized:       stats.urlCount > MAX_URL_COUNT || contentLength > MAX_SITEMAP_BYTES,
    parseErrors,
  };
}
