/**
 * Core Crawler
 *
 * Strategy:
 *   1. Start with CheerioCrawler (fast, no browser).
 *   2. If a page looks like a JS shell (no meaningful content), re-queue
 *      it for PlaywrightCrawler (full browser render).
 *   3. Extract response data from every page.
 *   4. Discover and enqueue in-scope links.
 *   5. Return a flat array of page records when done.
 *
 * Each record contains all raw fields needed by the Phase 2 extractors.
 * The sf-format.js layer (Phase 3) maps these to SF CSV column names.
 */

import { CheerioCrawler, PlaywrightCrawler, Configuration } from 'crawlee';
import { createLogger }    from './utils/logger.js';
import { resolveUrl, isInScope, UrlSet } from './utils/url.js';
import { extractResponse, deriveIndexability } from './extractors/response.js';
import { extractMeta }      from './extractors/meta.js';
import { extractHeadings }  from './extractors/headings.js';
import { extractCanonical } from './extractors/canonical.js';
import { extractLinks }     from './extractors/links.js';
import { extractImages }    from './extractors/images.js';
import { extractContent }   from './extractors/content.js';
import { extractSchema }    from './extractors/schema.js';
import { extractResources } from './extractors/resources.js';
import { extractUrl }                        from './extractors/url.js';
import { extractRobots, probeUrlMdSample }   from './extractors/robots.js';
import { extractSitemap }                    from './extractors/sitemap.js';
import { extractJsRender }                   from './extractors/jsrender.js';
import { extractMobile }                     from './extractors/mobile.js';
import { extractMonitoring }                 from './extractors/monitoring.js';

const logger = createLogger('crawler');

// ─── Heuristic: is this a JS-rendered shell? ──────────────────────────────────

function isJsShell($) {
  const title      = $('title').first().text().trim();
  const bodyText   = $('body').text().replace(/\s+/g, ' ').trim();
  const hasSpaRoot = !!($('#root').length || $('#app').length || $('#__next').length);
  const isTitleWeak   = !title || title.toLowerCase().includes('loading') || title.length < 3;
  const isContentThin = bodyText.length < 200;
  return hasSpaRoot && isTitleWeak && isContentThin;
}

// ─── URL pattern matching ─────────────────────────────────────────────────────

/**
 * Returns true if the URL passes include/exclude pattern filters.
 * - includePatterns: URL must match at least one (if any are set)
 * - excludePatterns: URL must not match any
 * Patterns are plain strings (substring match).
 */
function passesPatterns(url, includePatterns, excludePatterns) {
  if (excludePatterns.length > 0 && excludePatterns.some(p => url.includes(p))) return false;
  if (includePatterns.length > 0 && !includePatterns.some(p => url.includes(p))) return false;
  return true;
}

// ─── Link discovery ───────────────────────────────────────────────────────────

/**
 * Discover unique hrefs from a cheerio-parsed page that should be queued.
 *
 * @param {CheerioAPI} $
 * @param {string}     pageUrl
 * @param {string}     startUrl
 * @param {object}     opts
 * @param {boolean}    opts.followExternal   — follow links outside the start domain
 * @param {string[]}   opts.includePatterns
 * @param {string[]}   opts.excludePatterns
 * @returns {string[]}
 */
function discoverLinks($, pageUrl, startUrl, { followExternal, includePatterns, excludePatterns }) {
  const links = [];
  $('a[href]').each((_, el) => {
    const href     = $(el).attr('href') || '';
    const resolved = resolveUrl(href, pageUrl);
    if (!resolved) return;
    if (!followExternal && !isInScope(resolved, startUrl)) return;
    if (!passesPatterns(resolved, includePatterns, excludePatterns)) return;
    links.push(resolved);
  });
  return [...new Set(links)];
}

/**
 * Collect hreflang alternate URLs from <link rel="alternate" hreflang="..."> tags.
 */
function discoverHreflangUrls($, pageUrl) {
  const urls = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const href     = $(el).attr('href') || '';
    const resolved = resolveUrl(href, pageUrl);
    if (resolved) urls.push(resolved);
  });
  return [...new Set(urls)];
}

// ─── Page record builder ──────────────────────────────────────────────────────

function buildRecord(ctx, startUrl, mode, siteData = null) {
  const { request, response, $ } = ctx;

  const url          = request.loadedUrl || request.url;
  // CheerioCrawler exposes statusCode + headers as plain properties (got response).
  // PlaywrightCrawler exposes status() + headers() as synchronous methods.
  const statusCode = response?.statusCode ?? (typeof response?.status   === 'function' ? response.status()   : 0);
  const headers    = typeof response?.headers === 'function'            ? response.headers()
                   : (response?.headers ?? {});
  const responseTime = request.userData?.responseTime ?? 0;
  const redirectChain = request.userData?.redirectChain ?? [];

  const responseData = extractResponse({ url, startUrl: request.url, statusCode, headers, responseTime, redirectChain });
  const rawHtml      = typeof ctx.body === 'string' ? ctx.body : '';
  const crawlDepth   = request.userData?.depth ?? 0;

  const metaData      = extractMeta($, url);
  const headingsData  = extractHeadings($, url);
  const canonicalData = extractCanonical($, url, headers);
  const linksData     = extractLinks($, url, startUrl);
  const imagesData    = extractImages($, url);
  const contentData   = extractContent($, url, rawHtml, ctx._renderedHtml || '');
  const schemaData    = extractSchema($, url);
  const resourceData  = extractResources($, url);

  const { indexability, indexabilityStatus } = deriveIndexability(
    statusCode,
    metaData['Meta Robots 1'] || '',
    responseData['X-Robots-Tag 1'] || '',
  );

  return {
    url, startUrl, mode, crawlDepth,
    $, rawHtml,
    ...responseData,
    ...metaData,
    ...headingsData,
    ...canonicalData,
    ...linksData,
    ...imagesData,
    ...contentData,
    ...schemaData,
    ...resourceData,
    'Indexability':        indexability,
    'Indexability Status': indexabilityStatus,
    'Crawl Depth':         String(crawlDepth),
    _url:      extractUrl(url),
    _siteData: siteData,
  };
}

// ─── Failed request record ────────────────────────────────────────────────────

function failedRecord(request, startUrl, mode, errorMessage) {
  return {
    url:              request.url,
    startUrl,
    mode,
    crawlDepth:       request.userData?.depth ?? 0,
    $:                null,
    rawHtml:          '',
    'Address':        request.url,
    'Status Code':    '0',
    'Status':         'Failed',
    'Content Type':   '',
    'Redirect URL':   '',
    'Redirect Type':  '',
    'Response Time':  '0',
    'Last Modified':  '',
    'X-Robots-Tag 1': '',
    'Vary':           '',
    _isHttps:         false,
    _redirectChain:   [],
    _error:           errorMessage,
  };
}

// ─── Main crawl function ──────────────────────────────────────────────────────

/**
 * Crawl a website and return an array of raw page records.
 *
 * @param {object}   options
 * @param {string}   options.startUrl              — e.g. 'https://example.com'
 * @param {number}   [options.maxUrls=500]          — max pages to crawl
 * @param {number}   [options.maxDepth=10]          — max link hops from start URL
 * @param {number}   [options.maxConcurrency=5]     — parallel requests
 * @param {number}   [options.timeoutSecs=30]       — per-page timeout
 * @param {string}   [options.userAgent]            — custom user-agent string
 * @param {boolean}  [options.respectRobotsTxt=true]
 * @param {boolean}  [options.followExternal=false] — follow links to other domains
 * @param {string[]} [options.includePatterns=[]]   — only queue URLs matching one of these substrings
 * @param {string[]} [options.excludePatterns=[]]   — skip URLs matching any of these substrings
 * @param {object}   [options.customHeaders={}]     — extra HTTP headers { 'Name': 'value' }
 * @param {string}   [options.basicAuthUser='']     — HTTP basic auth username
 * @param {string}   [options.basicAuthPass='']     — HTTP basic auth password
 * @param {boolean}  [options.crawlCanonicals=true] — enqueue canonical URLs discovered on pages
 * @param {boolean}  [options.crawlHreflang=true]   — enqueue hreflang alternate URLs
 * @param {Function} [options.onProgress]           — called with (crawledCount, queuedCount) per page
 * @param {AbortSignal} [options.signal]            — abort signal for cancellation
 * @param {string[]} [options.seedUrls=[]]          — additional start URLs queued alongside startUrl (list/sitemap modes)
 * @param {boolean}  [options.followLinks=true]     — when false, disables all link discovery (list/sitemap modes)
 *
 * @returns {Promise<object[]>}
 */
export async function crawl(options = {}) {
  const {
    startUrl,
    maxUrls          = 500,
    maxDepth         = 10,
    maxConcurrency   = 5,
    timeoutSecs      = 30,
    userAgent        = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    respectRobotsTxt = true,
    followExternal   = false,
    includePatterns  = [],
    excludePatterns  = [],
    customHeaders    = {},
    basicAuthUser    = '',
    basicAuthPass    = '',
    crawlCanonicals  = true,
    crawlHreflang    = true,
    onProgress        = null,
    signal            = null,
    seedUrls          = [],
    followLinks       = true,
    requestDelaySecs  = 0,
  } = options;

  if (signal?.aborted) return [];
  if (!startUrl) throw new Error('crawl(): startUrl is required');

  logger.info(`Starting crawl: ${startUrl}`);
  logger.info(`Config: maxUrls=${maxUrls}, maxDepth=${maxDepth}, maxConcurrency=${maxConcurrency}, followExternal=${followExternal}`);

  // ── Site-level extractors (run once before crawl loops) ───────────────────
  logger.info('Running site-level extractors (robots, sitemap)...');
  const robotsData  = await extractRobots(startUrl, globalThis.fetch, userAgent);
  const sitemapData = await extractSitemap(startUrl, robotsData.sitemapUrls);
  const siteData    = { robots: robotsData, sitemap: sitemapData };
  logger.info(`robots.txt exists: ${robotsData.exists}, sitemap found: ${sitemapData.found}`);

  // ── Build HTTP headers ────────────────────────────────────────────────────
  const httpHeaders = { ...customHeaders };
  if (userAgent) httpHeaders['User-Agent'] = userAgent;
  if (basicAuthUser) {
    const encoded = Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64');
    httpHeaders['Authorization'] = `Basic ${encoded}`;
  }

  // ── Link discovery options (shared) ──────────────────────────────────────
  const linkOpts = { followExternal, includePatterns, excludePatterns };

  // ── Storage ───────────────────────────────────────────────────────────────
  const storageDir  = `/tmp/playwright-crawler-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const crawlConfig = new Configuration({ storageClientOptions: { localDataDirectory: storageDir } });

  const results = [];
  const seen    = new UrlSet();
  const jsQueue = new Set();

  // Mark all initial URLs as seen up-front to avoid duplicate queuing
  seen.add(startUrl);
  for (const u of seedUrls) seen.add(u);

  // ── Shared helpers ────────────────────────────────────────────────────────

  /** Enqueue discovered <a> links, respecting depth + URL limit */
  function enqueueLinks($, pageUrl, depth, addRequestFn) {
    if (results.length + jsQueue.size >= maxUrls) return;
    if (depth >= maxDepth) return; // depth limit reached — stop following links
    const links = discoverLinks($, pageUrl, startUrl, linkOpts);
    for (const link of links) {
      if (seen.add(link) && results.length + jsQueue.size < maxUrls) {
        addRequestFn({ url: link, userData: { depth: depth + 1, redirectChain: [] } });
      }
    }
  }

  /** Enqueue canonical / hreflang seed URLs (depth-independent — they are explicit targets) */
  function enqueueSeeds($, pageUrl, depth, addRequestFn) {
    const seeds = [];

    if (crawlCanonicals) {
      const canonical = $('link[rel="canonical"]').first().attr('href');
      if (canonical) {
        const resolved = resolveUrl(canonical, pageUrl);
        if (resolved) seeds.push(resolved);
      }
    }

    if (crawlHreflang) {
      for (const url of discoverHreflangUrls($, pageUrl)) {
        seeds.push(url);
      }
    }

    for (const seed of seeds) {
      if (!passesPatterns(seed, includePatterns, excludePatterns)) continue;
      if (seen.add(seed) && results.length + jsQueue.size < maxUrls) {
        // Seeds crawl at depth + 1 so they still contribute to depth budget
        addRequestFn({ url: seed, userData: { depth: depth + 1, redirectChain: [] } });
      }
    }
  }

  // ── CheerioCrawler (fast pass) ────────────────────────────────────────────
  const cheerioCrawler = new CheerioCrawler({
    maxRequestsPerCrawl:       maxUrls,
    maxRequestRetries:         0,
    maxConcurrency,
    requestHandlerTimeoutSecs: timeoutSecs,
    navigationTimeoutSecs:     timeoutSecs,
    ignoreSslErrors:           true,
    additionalMimeTypes:       ['application/xhtml+xml'],

    preNavigationHooks: [
      async (_ctx, gotOptions) => {
        if (requestDelaySecs > 0) {
          await new Promise((r) => setTimeout(r, requestDelaySecs * 1000));
        }
        if (Object.keys(httpHeaders).length > 0) {
          gotOptions.headers = { ...gotOptions.headers, ...httpHeaders };
        }
      },
    ],

    async requestHandler(ctx) {
      if (signal?.aborted) return;
      if (results.length >= maxUrls) return; // hard stop — Crawlee may dispatch slightly over limit

      const { request, response, $ } = ctx;
      const url   = request.loadedUrl || request.url;
      const depth = request.userData?.depth ?? 0;

      request.userData.responseTime = Date.now() - (request.userData?.startTime ?? Date.now());

      if (isJsShell($)) {
        logger.debug(`JS shell detected, re-queuing for Playwright: ${url}`);
        jsQueue.add(url);
        return;
      }

      const record = buildRecord(ctx, startUrl, 'cheerio', siteData);
      results.push(record);
      if (onProgress) onProgress(results.length, seen.size, url, record);
      logger.info(`[cheerio] ${response?.statusCode ?? '?'} ${url} (depth ${depth})`);

      if (followLinks) {
        const toQueue = [];
        enqueueLinks($, url, depth, (req) => toQueue.push(req));
        enqueueSeeds($, url, depth, (req) => toQueue.push(req));
        if (toQueue.length > 0) await ctx.addRequests(toQueue);
      }
    },

    async failedRequestHandler({ request, error }) {
      // 403 = site blocked the plain HTTP client — retry with real browser
      if (error.message.includes('403') || error.message.toLowerCase().includes('blocked')) {
        logger.warn(`Blocked (403): ${request.url} — queuing for Playwright`);
        jsQueue.add(request.url);
      } else {
        logger.warn(`Failed: ${request.url} — ${error.message}`);
        results.push(failedRecord(request, startUrl, 'cheerio', error.message));
      }
    },
  }, crawlConfig);

  // Build initial request list: startUrl + any additional seedUrls (list/sitemap modes)
  const initialRequests = [startUrl, ...seedUrls]
    .filter(Boolean)
    .map((u) => ({ url: u, userData: { depth: 0, redirectChain: [], startTime: Date.now() } }));

  await cheerioCrawler.run(initialRequests);

  logger.info(`Cheerio pass complete. ${results.length} pages, ${jsQueue.size} JS shells to re-crawl.`);

  // ── PlaywrightCrawler (JS pass) ───────────────────────────────────────────
  if (jsQueue.size > 0) {
    logger.info(`Starting Playwright pass for ${jsQueue.size} JS-rendered pages...`);

    // Separate storage dir so Playwright's queue is isolated from Cheerio's
    // (shared crawlConfig means shared RequestQueue — Crawlee counts consumed
    //  requests across both crawlers, which causes immediate limit-hit)
    const playwrightConfig = new Configuration({
      storageClientOptions: { localDataDirectory: storageDir + '-pw' },
    });

    const playwrightCrawler = new PlaywrightCrawler({
      maxRequestsPerCrawl:       maxUrls - results.length,
      maxConcurrency:            Math.min(maxConcurrency, 3),
      requestHandlerTimeoutSecs: timeoutSecs * 2,
      navigationTimeoutSecs:     timeoutSecs * 2,

      launchContext: {
        launchOptions: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },

      preNavigationHooks: [
        async ({ page }) => {
          if (requestDelaySecs > 0) {
            await new Promise((r) => setTimeout(r, requestDelaySecs * 1000));
          }
          if (Object.keys(httpHeaders).length > 0) {
            await page.setExtraHTTPHeaders(httpHeaders);
          }
        },
      ],

      async requestHandler(ctx) {
        if (signal?.aborted) return;
        if (results.length >= maxUrls) return; // hard stop — Crawlee may dispatch slightly over limit

        const { request, response, page } = ctx;
        const url   = request.loadedUrl || request.url;
        const depth = request.userData?.depth ?? 0;

        request.userData.responseTime = Date.now() - (request.userData?.startTime ?? Date.now());

        const renderedHtml = await page.content();
        const { load }     = await import('cheerio');
        const $            = load(renderedHtml);

        const record       = buildRecord({ request, response, $, body: renderedHtml }, startUrl, 'playwright', siteData);
        record._renderedHtml = renderedHtml;

        // Playwright-specific extractors (run only in browser context)
        record._jsRender   = null;
        record._mobile     = null;
        record._monitoring = null;
        try {
          record._jsRender    = await extractJsRender(page, url);
          record._mobile      = await extractMobile(page, url);
          record._monitoring  = await extractMonitoring(page, url);
        } catch (extractErr) {
          logger.warn(`Playwright extractor error for ${url}: ${extractErr.message}`);
        }

        results.push(record);
        if (onProgress) onProgress(results.length, seen.size, url, record);
        logger.info(`[playwright] ${response?.status() ?? '?'} ${url}`);

        if (followLinks && depth < maxDepth) {
          const newUrls = [];

          for (const link of discoverLinks($, url, startUrl, linkOpts)) {
            if (seen.add(link) && results.length < maxUrls) {
              newUrls.push({ url: link, userData: { depth: depth + 1, redirectChain: [], startTime: Date.now() } });
            }
          }

          // Canonical + hreflang seeds
          // Note: enqueueSeeds already calls seen.add() internally, so the URL
          // is already in `seen` when this callback fires — just check the limit.
          enqueueSeeds($, url, depth, (req) => {
            if (results.length + newUrls.length < maxUrls) {
              newUrls.push({ ...req, userData: { ...req.userData, startTime: Date.now() } });
            }
          });

          if (newUrls.length > 0) await ctx.addRequests(newUrls);
        }
      },

      async failedRequestHandler({ request, error }) {
        logger.warn(`[playwright] Failed: ${request.url} — ${error.message}`);
        results.push(failedRecord(request, startUrl, 'playwright', error.message));
      },
    }, playwrightConfig);

    await playwrightCrawler.run(
      [...jsQueue].map((url) => ({
        url,
        userData: { depth: 0, redirectChain: [], startTime: Date.now() },
      })),
    );

    logger.info(`Playwright pass complete. Total pages: ${results.length}`);
  }

  logger.info(`Crawl finished. ${results.length} total pages crawled.`);

  // Post-crawl: probe a sample of crawled URLs for .md endpoints
  const crawledUrls = results.map(r => r.url || r['Address']).filter(Boolean);
  siteData.robots.urlMdSample = await probeUrlMdSample(startUrl, crawledUrls);
  logger.info(`urlMdSample: ${siteData.robots.urlMdSample.hasAny ? 'found .md endpoints' : 'none found'}`);

  return results;
}
