// playwright-crawler/src/extractors/robots.js
/**
 * Robots extractor — site-level, runs once per crawl.
 * Serves: Section 3 (Robots), Section 4 (sitemap_in_robots),
 *         Section 23 (geo_llms_txt, geo_llms_full_txt, geo_url_md_endpoint, geo_ai_bot_robots).
 *
 * All network calls use the injected `fetcher` parameter (defaults to globalThis.fetch),
 * making this function fully unit-testable without network access.
 */
import robotsParser from 'robots-parser';

const AI_BOTS = [
  'GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended',
  'Bytespider', 'CCBot', 'anthropic-ai', 'cohere-ai',
];

function parseSitemapUrls(raw) {
  const urls = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^Sitemap:\s*(.+)/i);
    if (m) urls.push(m[1].trim());
  }
  return urls;
}

function parseDisallowedPaths(raw) {
  const paths = [];
  let inWildcard = false;
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (/^User-agent:\s*\*\s*$/i.test(t)) { inWildcard = true; continue; }
    if (/^User-agent:/i.test(t))          { inWildcard = false; continue; }
    if (inWildcard && /^Disallow:/i.test(t)) {
      const p = t.replace(/^Disallow:\s*/i, '').trim();
      if (p) paths.push(p);
    }
  }
  return paths;
}

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * @param {string} baseUrl — e.g. 'https://example.com'
 * @param {Function} [fetcher] — injected for testing; defaults to globalThis.fetch
 * @param {string} [userAgent] — User-Agent header to send; defaults to Chrome UA
 * @returns {Promise<object>}
 */
export async function extractRobots(baseUrl, fetcher = globalThis.fetch, userAgent = DEFAULT_UA) {
  const origin     = new URL(baseUrl).origin;
  const robotsUrl  = `${origin}/robots.txt`;
  const headers    = { 'User-Agent': userAgent };

  let raw = '', exists = false;
  try {
    const r = await fetcher(robotsUrl, {
      headers,
      signal:  AbortSignal.timeout(10000),
    });
    if (r.ok) { raw = await r.text(); exists = true; }
  } catch {}

  const parsed = exists ? robotsParser(robotsUrl, raw) : null;

  const agentRules = {};
  for (const bot of AI_BOTS) {
    agentRules[bot] = {
      allowed:    parsed ? (parsed.isAllowed(`${origin}/`, bot) ?? true) : true,
      crawlDelay: parsed?.getCrawlDelay(bot) ?? null,
    };
  }

  let llmsTxt = null, llmsFullTxt = null;
  try {
    const r = await fetcher(`${origin}/llms.txt`, { headers, signal: AbortSignal.timeout(5000) });
    if (r.ok) llmsTxt = await r.text();
  } catch {}
  try {
    const r = await fetcher(`${origin}/llms-full.txt`, { headers, signal: AbortSignal.timeout(5000) });
    if (r.ok) llmsFullTxt = await r.text();
  } catch {}

  return {
    exists,
    raw,
    parsed,
    sitemapUrls:     parseSitemapUrls(raw),
    llmsTxt,
    llmsFullTxt,
    urlMdSample:     { tested: [], found: [], hasAny: false }, // filled post-crawl by probeUrlMdSample
    disallowedPaths: parseDisallowedPaths(raw),
    agentRules,
  };
}

/**
 * Probe up to 5 crawled content URLs for .md variants.
 * Call after the main crawl to fill in urlMdSample.
 *
 * @param {string}   baseUrl
 * @param {string[]} pageUrls — all crawled page URLs
 * @param {Function} [fetcher]
 * @returns {Promise<{ tested: string[], found: string[], hasAny: boolean }>}
 */
export async function probeUrlMdSample(baseUrl, pageUrls, fetcher = globalThis.fetch) {
  const origin = new URL(baseUrl).origin;

  // Pick up to 5 content-looking URLs (at least one path segment)
  const candidates = pageUrls
    .filter(u => { try { const p = new URL(u).pathname; return p !== '/' && p.split('/').filter(Boolean).length >= 1; } catch { return false; } })
    .slice(0, 5);

  const tested = [], found = [];

  for (const pageUrl of candidates) {
    const mdUrl = pageUrl.replace(/\/$/, '') + '.md';
    tested.push(mdUrl);
    try {
      const r   = await fetcher(mdUrl, { signal: AbortSignal.timeout(5000) });
      const ct  = r.headers.get('content-type') ?? '';
      if (r.ok && !ct.includes('text/html')) { found.push(mdUrl); continue; }
    } catch {}

    const mdTxtUrl = pageUrl.replace(/\/$/, '') + '.md.txt';
    tested.push(mdTxtUrl);
    try {
      const r  = await fetcher(mdTxtUrl, { signal: AbortSignal.timeout(5000) });
      const ct = r.headers.get('content-type') ?? '';
      if (r.ok && !ct.includes('text/html')) { found.push(mdTxtUrl); }
    } catch {}
  }

  return { tested, found, hasAny: found.length > 0 };
}
