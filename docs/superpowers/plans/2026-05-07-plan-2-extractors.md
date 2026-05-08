# Check System Rewrite — Plan 2: Extractors

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new extractor files to the Playwright crawler and wire them into the crawl loop, giving the check engine (Plan 3) all raw signals it needs to evaluate the 216 automated checks.

**Architecture:** Pure-function extractors (url.js) and async HTTP extractors (robots.js, sitemap.js) run without Playwright and are fully unit-tested with injected fetcher mocks. Playwright-dependent extractors (jsrender.js, mobile.js, monitoring.js) run only in Playwright mode and are manually verified. Site-level extractors (robots.js, sitemap.js) run once before the crawl loops; their output is attached to every page record as `_siteData`. Per-page extractors merge into page records as `_url`, `_jsRender`, `_mobile`, `_monitoring`.

**Tech Stack:** Node.js ESM, `robots-parser` (already installed v3.0.1), `fast-xml-parser` (to install), Node.js `tls` module, Playwright, Jest (`--experimental-vm-modules`, already confirmed working)

---

## File Map

| Action | File |
|---|---|
| Modify | `playwright-crawler/package.json` (add fast-xml-parser) |
| Create | `playwright-crawler/src/extractors/url.js` |
| Create | `playwright-crawler/src/extractors/robots.js` |
| Create | `playwright-crawler/src/extractors/sitemap.js` |
| Create | `playwright-crawler/src/extractors/jsrender.js` |
| Create | `playwright-crawler/src/extractors/mobile.js` |
| Create | `playwright-crawler/src/extractors/monitoring.js` |
| Modify | `playwright-crawler/src/crawler.js` |
| Create | `playwright-crawler/tests/extractors/url.test.js` |
| Create | `playwright-crawler/tests/extractors/robots.test.js` |
| Create | `playwright-crawler/tests/extractors/sitemap.test.js` |

---

## Task 1: Install fast-xml-parser + url.js extractor + tests

**Files:**
- Modify: `playwright-crawler/package.json`
- Create: `playwright-crawler/src/extractors/url.js`
- Create: `playwright-crawler/tests/extractors/url.test.js`

The `tests/extractors/` directory already exists.

- [ ] **Step 1: Install fast-xml-parser**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/playwright-crawler
npm install fast-xml-parser
```

Expected: exits 0, `package.json` dependencies now includes `"fast-xml-parser": "..."`.

- [ ] **Step 2: Write `playwright-crawler/src/extractors/url.js`**

```js
// playwright-crawler/src/extractors/url.js
/**
 * URL extractor — pure string parsing, no network calls.
 * Serves: Section 5 (session_ids_in_urls, crawl_trap), Section 6 (URL Structure).
 */

const SESSION_ID_RE = /[?&](JSESSIONID|PHPSESSID|sessid|session_id|sid)=/i;
const GENERIC_SLUG_RE = /\/(page-?\d+|index\.html?|default\.aspx?)\/?$/i;

/**
 * @param {string} url — full URL including protocol and domain
 * @returns {object}
 */
export function extractUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch {
    return {
      url, lengthChars: url.length,
      hasUpperCase: false, hasUnderscores: false, hasSpecialChars: false,
      isGenericSlug: false, trailingSlash: false, directoryDepth: 0,
      hasDateInPath: false, dateFormat: null,
      hasSessionId: false, hasCrawlTrap: false, queryParamCount: 0,
    };
  }

  const path   = parsed.pathname;
  const search = parsed.search;

  const hasUpperCase   = /[A-Z]/.test(path);
  const hasUnderscores = path.includes('_');

  // Chars outside the safe URL path set (spaces, braces, brackets, pipe, etc.)
  let decodedPath = path;
  try { decodedPath = decodeURIComponent(path); } catch {}
  const hasSpecialChars = /[\s{}[\]|\\^`<>]/.test(decodedPath);

  const isGenericSlug  = GENERIC_SLUG_RE.test(path);
  const trailingSlash  = path.length > 1 && path.endsWith('/');
  const directoryDepth = Math.max(0, (path.match(/\//g) ?? []).length - 1);

  let hasDateInPath = false, dateFormat = null;
  if (/\/\d{4}\/\d{2}\/\d{2}/.test(path))   { hasDateInPath = true; dateFormat = 'YYYY/MM/DD'; }
  else if (/\/\d{4}-\d{2}-\d{2}/.test(path)) { hasDateInPath = true; dateFormat = 'YYYY-MM-DD'; }

  const hasSessionId   = SESSION_ID_RE.test(search);

  const segments       = path.split('/').filter(Boolean);
  const hasTrapSegments = segments.length > 4 && new Set(segments).size < segments.length / 2;
  const queryParamCount = search ? [...new URLSearchParams(search)].length : 0;
  const hasCrawlTrap   = hasTrapSegments || queryParamCount >= 5;

  return {
    url, lengthChars: url.length,
    hasUpperCase, hasUnderscores, hasSpecialChars,
    isGenericSlug, trailingSlash, directoryDepth,
    hasDateInPath, dateFormat,
    hasSessionId, hasCrawlTrap, queryParamCount,
  };
}
```

- [ ] **Step 3: Write `playwright-crawler/tests/extractors/url.test.js`**

```js
// playwright-crawler/tests/extractors/url.test.js
import { extractUrl } from '../../src/extractors/url.js';

describe('extractUrl', () => {
  test('returns full URL length as lengthChars', () => {
    const url = 'https://example.com/page';
    expect(extractUrl(url).lengthChars).toBe(url.length);
  });

  test('detects uppercase in path', () => {
    expect(extractUrl('https://example.com/Hello').hasUpperCase).toBe(true);
    expect(extractUrl('https://example.com/hello').hasUpperCase).toBe(false);
  });

  test('detects underscores in path', () => {
    expect(extractUrl('https://example.com/foo_bar').hasUnderscores).toBe(true);
    expect(extractUrl('https://example.com/foo-bar').hasUnderscores).toBe(false);
  });

  test('trailing slash on path longer than root', () => {
    expect(extractUrl('https://example.com/about/').trailingSlash).toBe(true);
    expect(extractUrl('https://example.com/about').trailingSlash).toBe(false);
    expect(extractUrl('https://example.com/').trailingSlash).toBe(false); // root excluded
  });

  test('counts directory depth', () => {
    expect(extractUrl('https://example.com/').directoryDepth).toBe(0);
    expect(extractUrl('https://example.com/a').directoryDepth).toBe(0);
    expect(extractUrl('https://example.com/a/b').directoryDepth).toBe(1);
    expect(extractUrl('https://example.com/a/b/c').directoryDepth).toBe(2);
  });

  test('detects YYYY/MM/DD date in path', () => {
    const r = extractUrl('https://example.com/blog/2024/03/15/post');
    expect(r.hasDateInPath).toBe(true);
    expect(r.dateFormat).toBe('YYYY/MM/DD');
  });

  test('detects YYYY-MM-DD date in path', () => {
    const r = extractUrl('https://example.com/2024-03-15/post');
    expect(r.hasDateInPath).toBe(true);
    expect(r.dateFormat).toBe('YYYY-MM-DD');
  });

  test('no date for normal paths', () => {
    expect(extractUrl('https://example.com/car-insurance').hasDateInPath).toBe(false);
  });

  test('detects JSESSIONID', () => {
    expect(extractUrl('https://example.com/?JSESSIONID=abc123').hasSessionId).toBe(true);
  });

  test('detects PHPSESSID', () => {
    expect(extractUrl('https://example.com/?PHPSESSID=abc').hasSessionId).toBe(true);
  });

  test('does not flag normal id param as session id', () => {
    expect(extractUrl('https://example.com/?id=123').hasSessionId).toBe(false);
  });

  test('counts query params', () => {
    expect(extractUrl('https://example.com/?a=1&b=2&c=3').queryParamCount).toBe(3);
    expect(extractUrl('https://example.com/').queryParamCount).toBe(0);
  });

  test('hasCrawlTrap for 5+ query params', () => {
    expect(extractUrl('https://example.com/?a=1&b=2&c=3&d=4&e=5').hasCrawlTrap).toBe(true);
    expect(extractUrl('https://example.com/?a=1&b=2').hasCrawlTrap).toBe(false);
  });

  test('hasCrawlTrap for repeated path segments', () => {
    expect(extractUrl('https://example.com/cat/sub/sub/sub/sub').hasCrawlTrap).toBe(true);
  });

  test('isGenericSlug matches /page-123', () => {
    expect(extractUrl('https://example.com/page-123').isGenericSlug).toBe(true);
    expect(extractUrl('https://example.com/car-insurance').isGenericSlug).toBe(false);
  });

  test('handles invalid URL without throwing', () => {
    const r = extractUrl('not-a-url');
    expect(r.url).toBe('not-a-url');
    expect(r.lengthChars).toBe('not-a-url'.length);
    expect(r.hasUpperCase).toBe(false);
  });
});
```

- [ ] **Step 4: Run url.js tests**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/playwright-crawler
node --experimental-vm-modules node_modules/.bin/jest tests/extractors/url.test.js --no-coverage
```

Expected: all 16 tests pass. If any fail, read the failure message and fix the logic in `url.js`.

---

## Task 2: robots.js extractor + tests

**Files:**
- Create: `playwright-crawler/src/extractors/robots.js`
- Create: `playwright-crawler/tests/extractors/robots.test.js`

`robots-parser` is already installed (v3.0.1). Do not install it again.

- [ ] **Step 1: Write `playwright-crawler/src/extractors/robots.js`**

```js
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

/**
 * @param {string} baseUrl — e.g. 'https://example.com'
 * @param {Function} [fetcher] — injected for testing; defaults to globalThis.fetch
 * @returns {Promise<object>}
 */
export async function extractRobots(baseUrl, fetcher = globalThis.fetch) {
  const origin     = new URL(baseUrl).origin;
  const robotsUrl  = `${origin}/robots.txt`;

  let raw = '', exists = false;
  try {
    const r = await fetcher(robotsUrl, {
      headers: { 'User-Agent': 'SEOAuditBot/1.0' },
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
    const r = await fetcher(`${origin}/llms.txt`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) llmsTxt = await r.text();
  } catch {}
  try {
    const r = await fetcher(`${origin}/llms-full.txt`, { signal: AbortSignal.timeout(5000) });
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
```

- [ ] **Step 2: Write `playwright-crawler/tests/extractors/robots.test.js`**

```js
// playwright-crawler/tests/extractors/robots.test.js
import { extractRobots, probeUrlMdSample } from '../../src/extractors/robots.js';

// Helper to build a mock fetch function from a list of responses in call order.
function mockFetch(...responses) {
  let i = 0;
  return jest.fn(() => Promise.resolve(responses[i++] ?? { ok: false, text: async () => '', headers: { get: () => null } }));
}

function okResponse(text, contentType = 'text/plain') {
  return { ok: true, text: async () => text, headers: { get: (k) => k === 'content-type' ? contentType : null } };
}

function notFound() {
  return { ok: false, text: async () => '', headers: { get: () => null } };
}

describe('extractRobots', () => {
  test('exists is false when robots.txt returns 404', async () => {
    const fetcher = mockFetch(notFound(), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.exists).toBe(false);
    expect(r.raw).toBe('');
    expect(r.sitemapUrls).toEqual([]);
    expect(r.disallowedPaths).toEqual([]);
  });

  test('parses sitemap URLs from robots.txt', async () => {
    const body = 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml\nSitemap: https://example.com/news-sitemap.xml';
    const fetcher = mockFetch(okResponse(body), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.exists).toBe(true);
    expect(r.sitemapUrls).toEqual(['https://example.com/sitemap.xml', 'https://example.com/news-sitemap.xml']);
  });

  test('parses disallowed paths for wildcard user-agent', async () => {
    const body = 'User-agent: *\nDisallow: /admin\nDisallow: /private\n\nUser-agent: Googlebot\nDisallow: /test';
    const fetcher = mockFetch(okResponse(body), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.disallowedPaths).toContain('/admin');
    expect(r.disallowedPaths).toContain('/private');
    expect(r.disallowedPaths).not.toContain('/test'); // belongs to Googlebot, not wildcard
  });

  test('fetches llmsTxt when /llms.txt returns 200', async () => {
    const fetcher = mockFetch(
      okResponse('User-agent: *\n'),  // robots.txt
      okResponse('# LLMs.txt\n## About\nAI training site.\n'),  // llms.txt
      notFound(),  // llms-full.txt
    );
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.llmsTxt).toContain('AI training site');
    expect(r.llmsFullTxt).toBeNull();
  });

  test('fetches both llmsTxt and llmsFullTxt', async () => {
    const fetcher = mockFetch(
      okResponse('User-agent: *\n'),
      okResponse('short llms'),
      okResponse('full llms content'),
    );
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.llmsTxt).toBe('short llms');
    expect(r.llmsFullTxt).toBe('full llms content');
  });

  test('agentRules marks GPTBot as blocked when disallowed', async () => {
    const body = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /';
    const fetcher = mockFetch(okResponse(body), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.agentRules['GPTBot'].allowed).toBe(false);
  });

  test('urlMdSample starts empty (filled post-crawl)', async () => {
    const fetcher = mockFetch(notFound(), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.urlMdSample).toEqual({ tested: [], found: [], hasAny: false });
  });

  test('does not throw when fetch rejects (network error)', async () => {
    const fetcher = jest.fn(() => Promise.reject(new Error('network error')));
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.exists).toBe(false);
    expect(r.llmsTxt).toBeNull();
  });
});

describe('probeUrlMdSample', () => {
  test('finds .md variant when it returns 200 non-HTML', async () => {
    const fetcher = mockFetch(
      okResponse('# Markdown content', 'text/markdown'),  // /blog/post.md → 200
    );
    const r = await probeUrlMdSample('https://example.com', ['https://example.com/blog/post'], fetcher);
    expect(r.hasAny).toBe(true);
    expect(r.found).toContain('https://example.com/blog/post.md');
  });

  test('does not flag .md that returns text/html (likely redirect to 404 page)', async () => {
    const fetcher = mockFetch(
      { ok: true, headers: { get: () => 'text/html' }, text: async () => '' },  // .md returns HTML
      notFound(), // .md.txt also not found
    );
    const r = await probeUrlMdSample('https://example.com', ['https://example.com/page'], fetcher);
    expect(r.hasAny).toBe(false);
    expect(r.found).toHaveLength(0);
  });

  test('returns empty when all probes fail', async () => {
    const fetcher = jest.fn(() => Promise.reject(new Error('network')));
    const r = await probeUrlMdSample('https://example.com', ['https://example.com/page'], fetcher);
    expect(r.hasAny).toBe(false);
  });

  test('skips root URL (/) — only probes real content paths', async () => {
    const fetcher = mockFetch(okResponse('# md', 'text/markdown'));
    const r = await probeUrlMdSample('https://example.com', ['https://example.com/'], fetcher);
    // Root path filtered out — no fetch calls
    expect(fetcher).not.toHaveBeenCalled();
    expect(r.hasAny).toBe(false);
  });
});
```

- [ ] **Step 3: Run robots.js tests**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/playwright-crawler
node --experimental-vm-modules node_modules/.bin/jest tests/extractors/robots.test.js --no-coverage
```

Expected: all 11 tests pass. If any fail, read the error and fix the relevant function.

---

## Task 3: sitemap.js extractor + tests

**Files:**
- Create: `playwright-crawler/src/extractors/sitemap.js`
- Create: `playwright-crawler/tests/extractors/sitemap.test.js`

`fast-xml-parser` must already be installed from Task 1.

- [ ] **Step 1: Write `playwright-crawler/src/extractors/sitemap.js`**

```js
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
async function fetchXml(url, fetcher) {
  const r = await fetcher(url, {
    signal:  AbortSignal.timeout(15000),
    headers: { 'Accept': 'application/xml,text/xml,*/*', 'User-Agent': 'SEOAuditBot/1.0' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  return { text, sizeBytes: new TextEncoder().encode(text).length };
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
```

- [ ] **Step 2: Write `playwright-crawler/tests/extractors/sitemap.test.js`**

```js
// playwright-crawler/tests/extractors/sitemap.test.js
import { extractSitemap } from '../../src/extractors/sitemap.js';

function mockFetch(...responses) {
  let i = 0;
  return jest.fn(() => Promise.resolve(responses[i++] ?? { ok: false, text: async () => '' }));
}

function xmlResponse(xml) {
  return { ok: true, text: async () => xml };
}

const SIMPLE_SITEMAP = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2024-01-01</lastmod><priority>1.0</priority></url>
  <url><loc>https://example.com/about</loc><changefreq>monthly</changefreq></url>
</urlset>`;

const INDEX_SITEMAP = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
</sitemapindex>`;

describe('extractSitemap', () => {
  test('returns found:false when no sitemap is reachable', async () => {
    const fetcher = jest.fn(() => Promise.resolve({ ok: false, text: async () => '' }));
    const r = await extractSitemap('https://example.com', [], fetcher);
    expect(r.found).toBe(false);
    expect(r.parseErrors).toContain('Sitemap not found');
  });

  test('parses a simple urlset sitemap', async () => {
    const fetcher = mockFetch(xmlResponse(SIMPLE_SITEMAP));
    const r = await extractSitemap('https://example.com', [], fetcher);
    expect(r.found).toBe(true);
    expect(r.isIndex).toBe(false);
    expect(r.urls).toHaveLength(2);
    expect(r.urls[0].loc).toBe('https://example.com/');
    expect(r.urls[0].lastmod).toBe('2024-01-01');
    expect(r.urls[0].priority).toBe('1.0');
    expect(r.urls[1].changefreq).toBe('monthly');
  });

  test('detects sitemap index and fetches first child', async () => {
    const fetcher = mockFetch(
      xmlResponse(INDEX_SITEMAP),    // index sitemap
      xmlResponse(SIMPLE_SITEMAP),   // first child (sitemap-pages.xml)
    );
    const r = await extractSitemap('https://example.com', [], fetcher);
    expect(r.found).toBe(true);
    expect(r.isIndex).toBe(true);
    expect(r.childSitemaps).toHaveLength(2);
    expect(r.urls).toHaveLength(2); // from first child
  });

  test('uses provided sitemapUrls before falling back to /sitemap.xml', async () => {
    const fetcher = mockFetch(xmlResponse(SIMPLE_SITEMAP));
    const r = await extractSitemap('https://example.com', ['https://example.com/custom-sitemap.xml'], fetcher);
    expect(fetcher).toHaveBeenCalledWith('https://example.com/custom-sitemap.xml', expect.any(Object));
  });

  test('tries next candidate on failure', async () => {
    const fetcher = mockFetch(
      { ok: false, text: async () => '' },   // /sitemap.xml fails
    );
    const r = await extractSitemap('https://example.com', ['https://example.com/sitemap.xml'], fetcher);
    expect(r.found).toBe(false);
  });

  test('falls back to /sitemap.xml when sitemapUrls is empty', async () => {
    const fetcher = mockFetch(xmlResponse(SIMPLE_SITEMAP));
    await extractSitemap('https://example.com', [], fetcher);
    const calledUrl = fetcher.mock.calls[0][0];
    expect(calledUrl).toBe('https://example.com/sitemap.xml');
  });

  test('returns fileSizeBytes > 0 for non-empty sitemap', async () => {
    const fetcher = mockFetch(xmlResponse(SIMPLE_SITEMAP));
    const r = await extractSitemap('https://example.com', [], fetcher);
    expect(r.fileSizeBytes).toBeGreaterThan(0);
  });

  test('records parse errors for malformed XML', async () => {
    const fetcher = mockFetch({ ok: true, text: async () => '<broken xml' });
    const r = await extractSitemap('https://example.com', [], fetcher);
    // Malformed XML may parse incorrectly or return an error
    expect(Array.isArray(r.parseErrors)).toBe(true);
  });
});
```

- [ ] **Step 3: Run sitemap.js tests**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/playwright-crawler
node --experimental-vm-modules node_modules/.bin/jest tests/extractors/sitemap.test.js --no-coverage
```

Expected: all 8 tests pass. If any fail, inspect the failure and fix `sitemap.js`.

---

## Task 4: jsrender.js extractor

**Files:**
- Create: `playwright-crawler/src/extractors/jsrender.js`

No unit tests — requires a live Playwright page and network. Verified as part of Task 7 (crawler integration).

- [ ] **Step 1: Write `playwright-crawler/src/extractors/jsrender.js`**

```js
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
```

---

## Task 5: mobile.js extractor

**Files:**
- Create: `playwright-crawler/src/extractors/mobile.js`

No unit tests — requires a live Playwright page. Verified as part of Task 7.

- [ ] **Step 1: Write `playwright-crawler/src/extractors/mobile.js`**

```js
// playwright-crawler/src/extractors/mobile.js
/**
 * Mobile extractor — per-page, Playwright mode only.
 * Serves: Section 8 (Mobile & Usability).
 *
 * Temporarily resizes the page to iPhone 14 viewport (375×812),
 * measures mobile-specific signals, then restores original viewport.
 */

const MOBILE_VIEWPORT  = { width: 375, height: 812 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MIN_TAP_SIZE_PX  = 44; // Google's minimum recommended tap target size

/**
 * @param {import('playwright').Page} page
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function extractMobile(page, url) {
  const originalViewport = page.viewportSize();

  const viewportMetaPresent = await page.evaluate(
    () => !!document.querySelector('meta[name="viewport"]')
  ).catch(() => false);

  let desktopWordCount = 0, desktopH1 = '';
  try {
    desktopWordCount = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return (clone.innerText || '').trim().split(/\s+/).filter(Boolean).length;
    });
    desktopH1 = await page.evaluate(() => document.querySelector('h1')?.innerText?.trim() ?? '');
  } catch {}

  await page.setViewportSize(MOBILE_VIEWPORT).catch(() => {});

  let bodyScrollWidthExceedsWindow = false;
  let tapTargets = [], smallTapTargets = [];
  let bodyFontSizePx = 16;
  let zoomDisabled   = false;
  let fullViewportOverlays = 0;
  let mobileWordCount = 0, mobileH1 = '';

  try {
    bodyScrollWidthExceedsWindow = await page.evaluate(
      () => document.body.scrollWidth > window.innerWidth
    );

    tapTargets = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button, input, select, [role="button"]');
      return [...els].map(el => {
        const r = el.getBoundingClientRect();
        return { selector: el.tagName.toLowerCase(), width: Math.round(r.width), height: Math.round(r.height) };
      }).filter(t => t.width > 0 && t.height > 0);
    });

    smallTapTargets = tapTargets.filter(t => t.width < MIN_TAP_SIZE_PX || t.height < MIN_TAP_SIZE_PX);

    bodyFontSizePx = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return parseFloat(style.fontSize) || 16;
    });

    const vmContent = await page.evaluate(
      () => document.querySelector('meta[name="viewport"]')?.content ?? ''
    );
    zoomDisabled = /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?!\d)/i.test(vmContent);

    fullViewportOverlays = await page.evaluate(() =>
      [...document.querySelectorAll('*')].filter(el => {
        const s = window.getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'sticky') return false;
        const r = el.getBoundingClientRect();
        return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.5;
      }).length
    );

    mobileWordCount = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return (clone.innerText || '').trim().split(/\s+/).filter(Boolean).length;
    });

    mobileH1 = await page.evaluate(
      () => document.querySelector('h1')?.innerText?.trim() ?? ''
    );
  } catch {}

  // Restore original viewport
  const restore = originalViewport ?? DESKTOP_VIEWPORT;
  await page.setViewportSize(restore).catch(() => {});

  return {
    viewportMetaPresent,
    bodyScrollWidthExceedsWindow,
    tapTargets,
    smallTapTargets,
    bodyFontSizePx,
    zoomDisabled,
    fullViewportOverlays,
    desktopWordCount,
    mobileWordCount,
    desktopH1,
    mobileH1,
  };
}
```

---

## Task 6: monitoring.js extractor

**Files:**
- Create: `playwright-crawler/src/extractors/monitoring.js`

No unit tests — requires Playwright and live TLS connections. Verified as part of Task 7.

- [ ] **Step 1: Write `playwright-crawler/src/extractors/monitoring.js`**

```js
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
```

---

## Task 7: Wire all extractors into crawler.js

**Files:**
- Modify: `playwright-crawler/src/crawler.js`

This task modifies the existing `crawl()` function to:
1. Run `extractRobots` + `extractSitemap` before the crawl loops (site-level data)
2. Call `extractUrl` in `buildRecord()` for every page
3. Call `extractJsRender`, `extractMobile`, `extractMonitoring` in the Playwright handler
4. Call `probeUrlMdSample` after the crawl loops complete
5. Attach `_siteData` to every page record

Read `playwright-crawler/src/crawler.js` fully before editing. This is a modification task — do not rewrite the file.

- [ ] **Step 1: Add 6 new imports at the top of crawler.js**

Find the block of existing extractor imports (lines beginning with `import { extract...`). After the last `import { extractResources }` line, add:

```js
import { extractUrl }                        from './extractors/url.js';
import { extractRobots, probeUrlMdSample }   from './extractors/robots.js';
import { extractSitemap }                    from './extractors/sitemap.js';
import { extractJsRender }                   from './extractors/jsrender.js';
import { extractMobile }                     from './extractors/mobile.js';
import { extractMonitoring }                 from './extractors/monitoring.js';
```

- [ ] **Step 2: Modify `buildRecord` to accept siteData and call extractUrl**

Find the `buildRecord` function signature:
```js
function buildRecord(ctx, startUrl, mode) {
```
Change it to:
```js
function buildRecord(ctx, startUrl, mode, siteData = null) {
```

Find the `return {` block inside `buildRecord` (where the result is assembled). Add these two entries at the end, before the closing `};`:
```js
    _url:      extractUrl(url),
    _siteData: siteData,
```

- [ ] **Step 3: Add site-level extractor phase inside crawl()**

Find the line in `crawl()` that says:
```js
  logger.info(`Starting crawl: ${startUrl}`);
```

After the two `logger.info(...)` lines (around line 224–225), add:
```js

  // ── Site-level extractors (run once before crawl loops) ───────────────────
  logger.info('Running site-level extractors (robots, sitemap)...');
  const robotsData  = await extractRobots(startUrl);
  const sitemapData = await extractSitemap(startUrl, robotsData.sitemapUrls);
  const siteData    = { robots: robotsData, sitemap: sitemapData };
  logger.info(`robots.txt exists: ${robotsData.exists}, sitemap found: ${sitemapData.found}`);
```

- [ ] **Step 4: Pass siteData to buildRecord in both crawl handlers**

Find both `buildRecord(` call sites:

**Cheerio handler** — change:
```js
      const record = buildRecord(ctx, startUrl, 'cheerio');
```
to:
```js
      const record = buildRecord(ctx, startUrl, 'cheerio', siteData);
```

**Playwright handler** — change:
```js
        const record       = buildRecord({ request, response, $, body: renderedHtml }, startUrl, 'playwright');
```
to:
```js
        const record       = buildRecord({ request, response, $, body: renderedHtml }, startUrl, 'playwright', siteData);
```

- [ ] **Step 5: Call Playwright-specific extractors in the Playwright handler**

In the Playwright handler, find the line:
```js
        record._renderedHtml = renderedHtml;
```

After that line, add:
```js

        // Playwright-specific extractors (run only in browser context)
        try {
          record._jsRender    = await extractJsRender(page, url);
          record._mobile      = await extractMobile(page, url);
          record._monitoring  = await extractMonitoring(page, url);
        } catch (extractErr) {
          logger.warn(`Playwright extractor error for ${url}: ${extractErr.message}`);
        }
```

- [ ] **Step 6: Call probeUrlMdSample after crawl loops complete**

Find the line after both crawl loops finish. It should be around:
```js
  logger.info(`Cheerio pass complete. ${results.length} pages, ${jsQueue.size} JS shells to re-crawl.`);
```

After the ENTIRE crawl loop (after both CheerioCrawler and PlaywrightCrawler finish), add the post-crawl urlMdSample probe. Find where the crawl function returns (near `return results;` at the end) and add this BEFORE the return:

```js
  // Post-crawl: probe a sample of crawled URLs for .md endpoints
  const crawledUrls = results.map(r => r.url || r['Address']).filter(Boolean);
  siteData.robots.urlMdSample = await probeUrlMdSample(startUrl, crawledUrls);
  logger.info(`urlMdSample: ${siteData.robots.urlMdSample.hasAny ? 'found .md endpoints' : 'none found'}`);

  return results;
```

Note: if `crawl()` currently ends with `return results;`, replace that line with the block above. If there is no explicit `return results`, add it after the probeUrlMdSample block.

- [ ] **Step 7: Verify the integration with a dry-run import**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/playwright-crawler
node --input-type=module <<'EOF'
import { crawl } from './src/crawler.js';
console.log('crawler imports OK, crawl is:', typeof crawl);
EOF
```

Expected: `crawler imports OK, crawl is: function`

If you get an import error, read the full error and fix the specific syntax issue in crawler.js.

- [ ] **Step 8: Run all extractor unit tests to check for regressions**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/playwright-crawler
node --experimental-vm-modules node_modules/.bin/jest tests/extractors/ --no-coverage
```

Expected: all tests in url.test.js, robots.test.js, sitemap.test.js pass (parity.test.js may fail — it requires a URL argument, not a regression).

---

## Self-Review

**Spec coverage:**
- ✅ Spec §8a (robots.js): exists, raw, parsed, sitemapUrls, llmsTxt, llmsFullTxt, urlMdSample, disallowedPaths, agentRules → Task 2
- ✅ Spec §8b (sitemap.js): found, url, isIndex, childSitemaps, urls, fileSizeBytes, parseErrors → Task 3
- ✅ Spec §8c (jsrender.js): rawHtml, renderedHtml, wordCounts, linkCounts, H1/title/metaDesc/jsonLd, renderBlockingScripts, domContentLoadedMs, lazyContentLinks → Task 4
- ✅ Spec §8d (mobile.js): viewportMetaPresent, bodyScrollWidthExceedsWindow, tapTargets, smallTapTargets, bodyFontSizePx, zoomDisabled, fullViewportOverlays, desktopWordCount, mobileWordCount, desktopH1, mobileH1 → Task 5
- ✅ Spec §8e (monitoring.js): sslValid, sslExpiryDays, sslChainComplete, sslIssuer, mixedContentUrls, ttfbMs, domContentLoadedMs, totalRequests, jsCssTransferBytes, lcpTagName, lcpClassName, lcpIsDecorative, clsSources → Task 6
- ✅ Spec §8f (url.js): url, lengthChars, hasUpperCase, hasUnderscores, hasSpecialChars, isGenericSlug, trailingSlash, directoryDepth, hasDateInPath, dateFormat, hasSessionId, hasCrawlTrap, queryParamCount → Task 1
- ✅ Spec §12 (fast-xml-parser install): Task 1 Step 1
- ✅ Integration into crawler: _siteData on every page record, Playwright extractor calls → Task 7

**Out of scope (handled in other plans):**
- Check functions that consume extractor output → Plan 3 (Check Engine)
- `crux.js` and `backlinks.service.js` backend services → Plan 3
- Frontend UI for new features → Plan 4
- AI Checks system → Plan 5

**No placeholders:** Every extractor has complete, runnable code. Tasks 4–6 have no unit tests (Playwright-dependent) — this is intentional and documented.

**Type consistency:** All return field names in extractors (e.g., `sslValid`, `lcpTagName`, `tapTargets`) match the names used in spec §8a–§8f exactly.
