/**
 * Sitemap fetcher.
 * Fetches one or more sitemap XML files, handles sitemap indexes (recursive),
 * and returns a flat array of page URLs extracted from <loc> tags.
 *
 * Supports:
 *   - Regular sitemaps   (<urlset><url><loc>...)
 *   - Sitemap indexes    (<sitemapindex><sitemap><loc>...)
 *   - Gzip-compressed sitemaps (via Node fetch auto-decompression)
 *
 * No external dependencies — uses Node 18+ built-in fetch.
 */

const MAX_URLS_PER_SITEMAP = 50_000; // standard sitemap limit
const FETCH_TIMEOUT_MS     = 15_000;
const MAX_DEPTH            = 5;      // prevent infinite index recursion

/**
 * Fetch a URL and return the response body as text.
 * Throws on network error or non-2xx status.
 */
async function fetchText(url) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent':      'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} fetching sitemap: ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract all <loc> values from an XML string.
 */
function extractLocs(xml) {
  const locs = [];
  const re   = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    if (raw) locs.push(raw);
  }
  return locs;
}

/**
 * Returns true if the XML is a sitemap index (points to child sitemaps
 * rather than directly to pages).
 */
function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Recursively fetch and parse a sitemap URL.
 * Returns an array of page URLs.
 *
 * @param {string}   url
 * @param {Set}      visited   — prevents duplicate/circular fetches
 * @param {number}   depth
 * @returns {Promise<string[]>}
 */
async function fetchSitemapUrls(url, visited, depth = 0) {
  if (depth > MAX_DEPTH) {
    console.warn(`[sitemap-fetcher] Max depth reached, skipping: ${url}`);
    return [];
  }
  if (visited.has(url)) return [];
  visited.add(url);

  let xml;
  try {
    xml = await fetchText(url);
  } catch (err) {
    // Always throw — caller decides whether to propagate or swallow
    throw new Error(`Failed to fetch sitemap at ${url}: ${err.message}`);
  }

  if (isSitemapIndex(xml)) {
    // Index — each <loc> points to a child sitemap
    const childUrls = extractLocs(xml);
    console.log(`[sitemap-fetcher] Index at ${url} — ${childUrls.length} child sitemaps`);

    const settled = await Promise.allSettled(
      childUrls.map((child) => fetchSitemapUrls(child, visited, depth + 1)),
    );
    return settled
      .filter((r) => {
        if (r.status === 'rejected') {
          console.warn(`[sitemap-fetcher] Child sitemap failed: ${r.reason?.message ?? r.reason}`);
          return false;
        }
        return true;
      })
      .flatMap((r) => r.value);
  }

  // Regular sitemap — <loc> values are page URLs
  const pageUrls = extractLocs(xml);
  console.log(`[sitemap-fetcher] ${url} — ${pageUrls.length} URLs`);
  return pageUrls;
}

/**
 * Fetch one or more sitemap URLs and return a deduplicated flat array
 * of all page URLs found.
 *
 * @param {string|string[]} sitemapUrls  — one URL or an array of URLs
 * @returns {Promise<string[]>}
 */
export async function fetchUrlsFromSitemaps(sitemapUrls) {
  const urls    = Array.isArray(sitemapUrls) ? sitemapUrls : [sitemapUrls];
  const visited = new Set();

  // Use allSettled so one bad sitemap URL doesn't abort the others
  const settled = await Promise.allSettled(
    urls.map((u) => fetchSitemapUrls(u, visited)),
  );

  const pageUrls = [];
  const errors   = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === 'fulfilled') {
      pageUrls.push(...result.value);
    } else {
      errors.push(`[${urls[i]}] ${result.reason?.message ?? result.reason}`);
      console.warn(`[sitemap-fetcher] Skipping failed sitemap: ${errors.at(-1)}`);
    }
  }

  // Only throw if every sitemap failed — partial success is usable
  if (pageUrls.length === 0) {
    const detail = errors.length ? `\n${errors.join('\n')}` : '';
    throw new Error(`No URLs found in the provided sitemap(s).${detail}`);
  }

  if (errors.length) {
    console.warn(`[sitemap-fetcher] ${errors.length} sitemap(s) failed but continuing with ${pageUrls.length} URLs from the rest.`);
  }

  // Deduplicate while preserving order
  const seen = new Set();
  return pageUrls
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    })
    .slice(0, MAX_URLS_PER_SITEMAP);
}
