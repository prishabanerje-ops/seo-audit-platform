# Audit Phase 2 — 13 Missing Categories Design

> **Date:** 2026-04-19
> **Author:** Aakash Srivastava
> **Status:** Approved

---

## Goal

Implement all 13 missing audit categories end-to-end: new crawler extractors, audit-parser check functions, and frontend empty-state handling. Results land in the existing `audit_results` table with no new tables. Two special-case flows: Speed & Performance (on-demand PSI trigger) and Rankings & Traffic Drops (post-crawl GSC analysis). All others run automatically during the normal crawl pipeline.

---

## Architecture Overview

```
Crawl pipeline (per crawl)
  ├── Existing extractors (response, meta, headings, canonical, links, images, content, schema, resources)
  ├── NEW per-page extractors
  │     ├── hreflang.js      — hreflang tags + html lang attr
  │     ├── mobile.js        — viewport, AMP link, render-blocking, third-party scripts
  │     ├── jsrender.js      — title/content/schema changes after JS execution
  │     └── monitoring.js    — HTTPS, HSTS + security headers, analytics script presence
  └── NEW site-level extractors (run ONCE per crawl before page crawling begins)
        ├── robots.js        — robots.txt + llms.txt fetch and parse
        └── sitemap.js       — sitemap.xml fetch, parse, validate

Post-crawl (after all pages crawled)
  ├── audit-parser.service.js  — extended with 11 new check functions for 11 categories
  └── rankings-audit.service.js — NEW: reads gsc_cache, writes Rankings & Traffic findings

On-demand (user triggered)
  └── speed-audit.service.js   — NEW: PSI API for top N URLs, writes Speed & Performance findings
        └── POST /api/reports/:siteId/speed-audit
              └── Socket.io events: speed:progress { url, done, total }
```

---

## Data Flow

**Per-page extractor data** → stored as fields on each crawl dataset record → `audit-parser.service.js` check functions read across all records → insert into `audit_results`.

**Site-level extractor data** → stored as a single `_siteData` object on the crawl dataset → passed as a separate argument to audit-parser check functions that need it.

**Rankings audit** → `rankings-audit.service.js` reads `gsc_cache` (WHERE `site_id = ? AND period IN ('current','previous')`) → cross-references with `audit_results` (for noindex, 5xx, robots, 404 checks) → inserts into `audit_results` with `section = 'Rankings & Traffic Drops'`.

**Speed audit** → `speed-audit.service.js` selects top 10 URLs from latest crawl by internal inlink count → calls PSI API (both mobile + desktop) sequentially (1 req/sec) → maps PSI audit IDs to issue_types → inserts into `audit_results` with `section = 'Speed & Performance'` — replaces existing rows for that crawl job (idempotent).

---

## New Extractors

### `playwright-crawler/src/extractors/robots.js` (site-level)

Runs once per crawl at crawl start. Called from `crawler.js` before the crawl loop. Returns a `_robotsData` object attached to the crawl dataset.

**Fetches:** `GET {origin}/robots.txt` and `GET {origin}/llms.txt`

**Returns:**
```js
{
  robotsTxtExists: boolean,
  robotsTxtStatusCode: number,
  robotsTxtSize: number,            // bytes
  robotsTxtContentType: string,
  sitemapDeclared: boolean,
  sitemapUrls: string[],
  disallowRules: [{ agent, path }],
  allowRules: [{ agent, path }],
  blockedPaths: string[],           // Disallow paths for '*' or 'Googlebot'
  userAgents: string[],             // all User-agent values found
  hasMalformedRules: boolean,
  llmsTxtExists: boolean,
  llmsTxtStatusCode: number,
  llmsTxtContent: string,           // raw content, max 10KB
}
```

### `playwright-crawler/src/extractors/sitemap.js` (site-level)

Runs once per crawl. Reads sitemapUrls from `_robotsData` (or falls back to `/sitemap.xml`). Fetches and parses XML sitemap(s) with a max of 5 sitemap index children.

**Returns:**
```js
{
  sitemapExists: boolean,
  sitemapUrl: string,
  isIndex: boolean,
  childSitemaps: string[],
  totalUrlCount: number,
  urlsWithLastmod: number,
  urlsWithImages: number,
  invalidUrls: string[],            // non-absolute, wrong domain
  redirectUrls: string[],           // HEAD check: 3xx responses
  oversized: boolean,               // > 50MB or > 50,000 URLs
  parseErrors: string[],            // XML parse error messages
}
```

### `playwright-crawler/src/extractors/hreflang.js` (per-page)

**Reads:** `<link rel="alternate" hreflang="...">` tags and `<html lang="...">`.

**Returns:**
```js
{
  hreflangTags: [{ lang, href }],   // all hreflang link tags on the page
  htmlLang: string,                 // value of <html lang="">
  hasHreflang: boolean,
  hasXDefault: boolean,
}
```

### `playwright-crawler/src/extractors/mobile.js` (per-page)

**Reads:** viewport meta, `<link rel="amphtml">`, render-blocking `<link rel="stylesheet">` / `<script>` in `<head>`, third-party script domains.

**Returns:**
```js
{
  hasViewport: boolean,
  viewportContent: string,
  hasAmpLink: boolean,
  ampHref: string,
  renderBlockingCount: number,      // sync scripts + stylesheets in <head>
  thirdPartyScriptCount: number,    // external scripts from off-domain hosts
  thirdPartyDomains: string[],
}
```

### `playwright-crawler/src/extractors/jsrender.js` (per-page, Playwright only)

Only runs for pages processed by the Playwright pass. Compares pre-render (Cheerio) vs post-render (Playwright) values.

**Returns:**
```js
{
  titleChangedAfterRender: boolean,
  preRenderTitle: string,
  postRenderTitle: string,
  wordCountChange: number,          // post - pre word count
  preRenderWordCount: number,
  postRenderWordCount: number,
  schemaOnlyAfterRender: boolean,   // schema absent in raw HTML, present in rendered
  hasHashRouting: boolean,          // URL contains # fragment, detected from hrefs
  hasInfiniteScroll: boolean,       // heuristic: no pagination links + large page height
  criticalContentJsOnly: boolean,   // main content (h1, article) absent in raw HTML
}
```

### `playwright-crawler/src/extractors/monitoring.js` (per-page)

**Reads:** response headers (from `extractResponse`), inline script content for GA/GTM detection.

**Returns:**
```js
{
  isHttps: boolean,
  hasHsts: boolean,
  hasXContentTypeOptions: boolean,
  hasXFrameOptions: boolean,
  hasContentSecurityPolicy: boolean,
  analyticsDetected: boolean,       // GA4 (gtag/G-...) or GTM (GTM-...)
  analyticsType: string,            // 'ga4' | 'gtm' | 'ua' | 'none'
  ga4DoubleFiring: boolean,         // > 1 GA4 measurement IDs found
  serverResponseTime: number,       // milliseconds from extractResponse
}
```

---

## Audit-Parser Extensions

`backend/services/audit-parser.service.js` — add 11 new check functions, called from `parseAndStoreFromDatasets()`.

### Check functions and their issue_types

#### `checkRobotsIndexability(rows, siteData, jobId, siteId, companyId)`
Section: `'Robots / Indexability'`

| issue_type | Detection |
|---|---|
| `Robots.txt Missing` | `siteData.robots.robotsTxtExists === false` |
| `Robots.txt Wrong Content-Type` | `robotsTxtExists && !robotsTxtContentType.includes('text/plain')` |
| `Robots.txt Too Large` | `robotsTxtSize > 512000` (> 512KB) |
| `No Sitemap in Robots.txt` | `robotsTxtExists && !sitemapDeclared` |
| `CSS/JS Blocked by Robots.txt` | Any `.css` or `.js` path in `blockedPaths` |
| `Critical Pages Blocked by Robots.txt` | Homepage (`/`) in blockedPaths for `*` or `Googlebot` |
| `Conflicting Allow/Disallow Rules` | `hasMalformedRules === true` |
| `Noindex on Important Pages` | Row has `Meta Robots` containing `noindex` AND `Unique Inlinks` > 5 |
| `Internal Search Pages Not Blocked` | URL matches `?q=` / `?search=` / `?query=` pattern AND not in blockedPaths |
| `High Crawl Depth` | Row's crawl depth (from `_depth` field) > 5 |
| `Orphan Pages` | Row has `Unique Inlinks` = 0 AND status 200 AND is HTML |

#### `checkSitemap(rows, siteData, jobId, siteId, companyId)`
Section: `'Sitemap'`

| issue_type | Detection |
|---|---|
| `Sitemap Missing` | `siteData.sitemap.sitemapExists === false` |
| `Sitemap Parse Error` | `parseErrors.length > 0` |
| `Sitemap Contains Error URLs` | `invalidUrls.length > 0` |
| `Sitemap Contains Redirect URLs` | `redirectUrls.length > 0` |
| `Sitemap URLs Not Canonical` | Sitemap URL differs from canonical URL in crawl row |
| `Noindex Pages in Sitemap` | Sitemap URL appears in crawl rows with noindex meta robots |
| `Blocked Pages in Sitemap` | Sitemap URL path matches disallow rules in robots.txt |
| `Sitemap Orphan Pages` | Sitemap URL not found in any crawl row (not crawled) |
| `Sitemap Exceeds URL Limit` | `totalUrlCount > 50000` |
| `Sitemap Oversized` | `oversized === true` |
| `URLs Missing Lastmod` | `urlsWithLastmod / totalUrlCount < 0.5` (< 50% have lastmod) |

#### `checkInternalLinking(rows, jobId, siteId, companyId)`
Section: `'Internal Linking'`

| issue_type | Detection |
|---|---|
| `Orphan Pages` | `Unique Inlinks` = 0 AND status 200 AND HTML |
| `Broken Internal Links` | Row is 4xx/5xx AND has referrer internal links |
| `Too Many Internal Links` | Row's outgoing internal link count > 150 |
| `Deep Pages` | Crawl depth > 4 |
| `Non-Descriptive Anchor Text` | `>= 30%` of internal inlinks to this page have generic anchor (`click here`, `read more`, `here`, `link`) |
| `Nofollow Internal Links` | Row has internal inlinks with `rel=nofollow` |
| `Breadcrumb Navigation Missing` | HTML page with depth > 2 AND no `<nav aria-label>` / `.breadcrumb` / BreadcrumbList schema |
| `JS-Only Internal Links` | Page has `<a href="#...">` or `onclick` links with no real href AND is a JS-rendered page |

#### `checkImages(rows, jobId, siteId, companyId)`
Section: `'Images'`  
(Extends existing image checks)

| issue_type | Detection |
|---|---|
| `Missing Alt Text` | Image `alt` attribute absent (already exists — skip if duplicate) |
| `Generic Alt Text` | Alt matches `/^(image|photo|img|pic|picture|banner|logo)\d*$/i` |
| `Alt Text Keyword Stuffed` | Alt text word count > 15 OR contains pipe-separated list of words |
| `Alt Text Too Long` | Alt text character length > 125 |
| `No Modern Image Format` | Image src does not end in `.webp`, `.avif`, `.svg` |
| `Missing Width/Height Attributes` | `<img>` missing `width` or `height` attribute |
| `Missing Lazy Loading` | `<img>` below-the-fold (position > 3rd image on page) without `loading="lazy"` |
| `Broken Images` | Image src returns 4xx/5xx (from existing response tracking) |
| `Images Served via Redirect` | Image src returns 3xx |
| `Generic Image Filename` | Filename matches `/^(image|img|photo|pic|dsc|screenshot|untitled)[\d_-]*/i` |

#### `checkSchemaExtended(rows, jobId, siteId, companyId)`
Section: `'Schema / Structured Data'`  
(Supplements existing `checkStructuredData`)

| issue_type | Detection |
|---|---|
| `Missing Organization Schema` | Homepage (`/`) has no `Organization` type in schema |
| `Missing WebSite Schema` | Homepage has no `WebSite` type |
| `Missing SearchAction Schema` | Homepage WebSite schema missing `potentialAction` SearchAction |
| `Missing BreadcrumbList Schema` | Page depth > 1, has no BreadcrumbList schema |
| `Missing Product/Vehicle Schema` | URL path matches `/product/`, `/vehicle/`, `/listing/` with no Product schema |
| `Missing Offer Schema` | Product page has Product schema but no Offer |
| `Missing Article Schema` | URL path matches `/blog/`, `/news/`, `/article/` with no Article/NewsArticle schema |
| `Missing FAQ Schema` | Page contains `<details>` or FAQ-pattern headings with no FAQPage schema |
| `Missing HowTo Schema` | Page contains numbered step list with no HowTo schema |
| `Missing LocalBusiness Schema` | Page contains address/phone patterns with no LocalBusiness schema |
| `Missing Review Schema` | Page contains star rating HTML with no Review/AggregateRating schema |
| `Missing ItemList Schema` | Category/listing page with > 5 items with no ItemList schema |
| `Schema Only in Rendered DOM` | Schema absent in raw HTML but present in rendered HTML (`jsrender._schemaOnlyAfterRender`) |
| `Empty Schema Properties` | Schema node has empty string or null required properties (name, url) |
| `Schema Using Microdata/RDFa` | Page has `itemscope`/`itemtype` or `typeof` RDFa attributes |

#### `checkContent(rows, jobId, siteId, companyId)`
Section: `'Content'`

| issue_type | Detection |
|---|---|
| `Thin Content` | Word count < 300 AND is HTML AND status 200 AND not a homepage |
| `Thin Category Page Intro` | URL path matches category pattern AND word count before first product listing < 100 |
| `Auto-Generated Thin Pages` | Multiple pages with identical word count (within ±5 words) AND same template structure |
| `Template Dominant Page` | Nav + header + footer word count > 70% of total page word count |
| `Keyword Stuffing Detected` | Top keyword appears > 5% of all words on page |
| `Parameterized Duplicate URLs` | URL has query params AND canonical points to a different URL AND canonical is also in crawl |
| `Print Page Duplicate` | URL contains `?print=1` or `/print/` or `?format=print` |
| `Missing Language Attribute` | `<html>` tag has no `lang` attribute |
| `Missing Doctype` | Page HTML does not begin with `<!DOCTYPE html>` |
| `Content Has No Headings` | HTML page with no `<h1>` through `<h4>` tags |
| `Missing Author Byline` | URL matches blog/news pattern AND no author meta tag or author schema property |
| `Stale Content` | Page has `<meta name="date">` or `datePublished` schema older than 2 years AND no `dateModified` |

#### `checkJavaScriptRendering(rows, jobId, siteId, companyId)`
Section: `'JavaScript Rendering'`  
Only processes rows where `_mode = 'playwright'` (Playwright-rendered pages).

| issue_type | Detection |
|---|---|
| `Critical Content JS-Only` | `jsrender.criticalContentJsOnly === true` |
| `Missing Meta Pre-Render` | Meta description empty in Cheerio pass but present in Playwright pass |
| `Title Changes After Render` | `jsrender.titleChangedAfterRender === true` |
| `Significant Word Count Change` | `jsrender.wordCountChange > 200` (200+ words added by JS) |
| `Schema Only After JS Load` | `jsrender.schemaOnlyAfterRender === true` |
| `Infinite Scroll Without Pagination` | `jsrender.hasInfiniteScroll === true` |
| `Hash-Based SPA Routing` | `jsrender.hasHashRouting === true` |
| `Critical Lazy-Loaded Content` | Viewport-height content uses `loading="lazy"` (first image has lazy loading) |

#### `checkInternationalSeo(rows, jobId, siteId, companyId)`
Section: `'International SEO'`

| issue_type | Detection |
|---|---|
| `Invalid Hreflang Value` | Any `hreflang.hreflangTags` where lang value does not match BCP 47 pattern (`/^[a-z]{2}(-[A-Z]{2})?$/`) |
| `Hreflang URL Returns Error` | Hreflang href target returns 4xx/5xx in crawl results |
| `Missing Return Hreflang` | Page A hreflang points to Page B, but Page B has no hreflang back to Page A |
| `Hreflang Points to Redirect` | Hreflang href target returns 3xx in crawl results |
| `Missing HTML Lang Attribute` | `hreflang.htmlLang` is empty AND page is HTML |
| `Missing x-default Hreflang` | `hreflang.hasHreflang === true` AND `hreflang.hasXDefault === false` |
| `Hreflang Scale Warning` | Total distinct hreflang URL pairs across site > 50,000 |

#### `checkMobileSeo(rows, jobId, siteId, companyId)`
Section: `'Mobile SEO'`

| issue_type | Detection |
|---|---|
| `Missing Viewport Meta Tag` | `mobile.hasViewport === false` AND page is HTML |
| `Mobile Content Mismatch` | Page served differently under mobile UA (detected if Playwright UA-switch shows diff title/word count > 20%) |
| `Render-Blocking Resources on Mobile` | `mobile.renderBlockingCount > 3` |
| `Excessive Third-Party Scripts` | `mobile.thirdPartyScriptCount > 5` |
| `Missing AMP Link` | URL matches `/blog/`, `/news/`, `/article/` AND `mobile.hasAmpLink === false` |

#### `checkMonitoring(rows, jobId, siteId, companyId)`
Section: `'Monitoring & Operations'`

| issue_type | Detection |
|---|---|
| `Page Not Served Over HTTPS` | `monitoring.isHttps === false` AND status 200 |
| `Slow Server Response` | `monitoring.serverResponseTime > 1800` (ms) |
| `Missing Security Headers` | `hasHsts === false` OR `hasXContentTypeOptions === false` OR `hasXFrameOptions === false` |
| `Analytics Script Not Detected` | `monitoring.analyticsDetected === false` AND page is HTML AND status 200 |
| `GA4 Double-Firing` | `monitoring.ga4DoubleFiring === true` |

#### `checkLlmAiCrawlers(rows, siteData, jobId, siteId, companyId)`
Section: `'LLM / AI Crawlers'`

Reads `siteData.robots` — no per-page rows needed.

| issue_type | Detection |
|---|---|
| `GPTBot Rules Missing` | `siteData.robots.userAgents` has no entry matching `GPTBot` (case-insensitive) |
| `ChatGPT-User Rules Missing` | No entry for `ChatGPT-User` |
| `ClaudeBot Rules Missing` | No entry for `ClaudeBot` |
| `Google-Extended Rules Missing` | No entry for `Google-Extended` |
| `OAI-SearchBot Rules Missing` | No entry for `OAI-SearchBot` |
| `AI Bot Blocks Critical Pages` | Any of the 5 above bots have a `Disallow: /` rule OR disallow rule covering homepage path |
| `LLMs.txt Missing` | `siteData.robots.llmsTxtExists === false` |

All 7 severities: `info`.

---

## New Backend Services

### `backend/services/rankings-audit.service.js`

**Function:** `generateRankingsAudit(siteId, crawlJobId, companyId)`

Called from `crawl-runner.js` after `parseAndStoreFromDatasets()` completes.

**Reads:** `gsc_cache WHERE site_id = ? AND period IN ('current', 'previous')`

**Cross-references:** `audit_results WHERE crawl_job_id = ? AND section IN ('Response Codes', 'Robots / Indexability')` for noindex/blocked/404/5xx overlap detection.

**Writes:** `audit_results` with `section = 'Rankings & Traffic Drops'`

| issue_type | Detection logic |
|---|---|
| `Significant Traffic Drop` | current.clicks < previous.clicks * 0.7 AND previous.clicks > 10 |
| `Impressions Drop Without Click Change` | current.impressions < previous.impressions * 0.6 AND abs(current.ctr - previous.ctr) < 0.01 |
| `Zero Impressions Pages` | current.impressions = 0 AND page exists in crawl AND is HTML status 200 |
| `Noindex on Pages With GSC Impressions` | URL has noindex in audit_results AND current.impressions > 0 |
| `5xx On Pages With Traffic` | URL has 5xx in audit_results AND current.clicks > 0 |
| `Robots-Blocked Pages With Traffic` | URL matches blocked path in robots AND current.impressions > 0 |
| `404 Pages With Residual Traffic` | URL has 404 in audit_results AND current.clicks > 0 |

**Covered flag logic:** `covered = true` if `gsc_cache` has rows for this `site_id`. If no GSC data, `audit_results` gets no rows for this section → `/api/reports/:siteId/category` returns `covered: false`.

### `backend/services/speed-audit.service.js`

**Function:** `runSpeedAudit(siteId, crawlJobId, companyId, io)`

Called from `POST /api/reports/:siteId/speed-audit` handler (new route in `reports.js`).

**Selects URLs:** `SELECT DISTINCT url FROM audit_results WHERE crawl_job_id = ? ORDER BY id ASC LIMIT 10` — the first 10 unique URLs from the crawl in discovery order (homepage and top-level pages appear first).

**Calls PSI:** Sequential, 1 req/sec. Both strategies (mobile + desktop) per URL. Uses `psi_api_key` from settings (same pattern as existing `routes/psi.js`).

**Emits:** `io.to(siteId).emit('speed:progress', { url, done, total })`

**PSI audit ID → issue_type mapping:**

| PSI audit ID | issue_type | Strategy |
|---|---|---|
| `largest-contentful-paint` (score < 0.5) | `Poor LCP` | mobile |
| `largest-contentful-paint` (0.5–0.9) | `Needs Improvement LCP` | mobile |
| `cumulative-layout-shift` (score < 0.5) | `Poor CLS` | mobile |
| `interaction-to-next-paint` (score < 0.5) | `Poor INP` | mobile |
| `first-contentful-paint` (score < 0.5) | `Poor FCP` | mobile |
| `server-response-time` (score < 0.5) | `High TTFB` | mobile |
| `unused-javascript` (score < 0.5) | `Unused JavaScript` | both |
| `unused-css-rules` (score < 0.5) | `Unused CSS` | both |
| `total-byte-weight` (score < 0.5) | `Total Page Size Excessive` | both |
| `network-requests` (score < 0.5) | `Excessive HTTP Requests` | both |
| `render-blocking-resources` (score < 0.5) | `Render-Blocking Resources` | both |
| Performance category score < 50 | `Low Mobile PSI Score` | mobile |
| Performance category score < 50 | `Low Desktop PSI Score` | desktop |

**Replaces existing rows:** `DELETE FROM audit_results WHERE crawl_job_id = ? AND section = 'Speed & Performance'` before inserting new results.

---

## New Backend Route

### `POST /api/reports/:siteId/speed-audit` (in `backend/routes/reports.js`)

- Auth: `authMiddleware` (existing global middleware)
- Company isolation: reject if `site.company_id !== req.user.company_id` (unless superadmin)
- Response: `202 { queued: N, message: 'Speed audit running...' }` (runs async)
- On PSI API key missing: `400 { error: 'PSI API key not configured' }`
- On no completed crawl: `404 { error: 'No completed crawl found' }`

---

## Frontend Changes

### `frontend/src/lib/auditCategories.js`

Add entries to `SLUG_TO_SECTION` and `SECTION_TO_SLUG` for all 13 new categories:

New slugs to add:
- `robots-indexability` → `'Robots / Indexability'`
- `sitemap` → `'Sitemap'`
- `internal-linking` → `'Internal Linking'`
- `javascript-rendering` → `'JavaScript Rendering'`
- `international-seo` → `'International SEO'`
- `mobile-seo` → `'Mobile SEO'`
- `monitoring-operations` → `'Monitoring & Operations'`
- `rankings-traffic` → `'Rankings & Traffic Drops'`
- `llm-ai-crawlers` → `'LLM / AI Crawlers'`
- `speed-performance` → `'Speed & Performance'`

(Note: `images`, `schema`, `content` slugs already exist in the map — confirm they match the exact section strings used in new check functions.)

### `frontend/src/pages/AuditCategory.jsx`

Two special empty states beyond the existing `covered: true / false` branching:

**Rankings & Traffic Drops** — when `covered === false`:
```
"Connect Google Search Console to enable Rankings & Traffic analysis."
[Connect GSC button → /settings]
```

**Speed & Performance** — when `covered === false` OR `covered === true` (always show Run button):
- `covered === false`: "No performance data yet." + `[Run Performance Audit]` button
- `covered === true`: Normal issue groups displayed + `[Re-run Performance Audit]` button in page header

**Speed audit button behaviour:**
1. Click → `POST /api/reports/:siteId/speed-audit`
2. Show progress bar: `X / N URLs analysed` driven by `socket.on('speed:progress', ...)`
3. On completion (done === total): refetch category data, hide progress bar

No other category pages need frontend changes — the `covered: true/false` empty state handling added in Phase 1 already handles the "not yet implemented" case.

---

## Audit Checks Seed File

`backend/db/seeds/audit-checks.js` — add seed rows for all ~115 new `issue_type` entries across the 13 categories. Each row: `{ section, issue_type, severity, description, recommendation }`.

This ensures the AuditCategories picker page can show all categories as NOT AUDITED before any crawl completes.

---

## Testing

**New test file:** `backend/__tests__/speed-audit.test.js`
- POST /api/reports/:siteId/speed-audit — 401 no auth, 404 unknown site, 400 no PSI key, 202 queued

**New test file:** `backend/__tests__/rankings-audit.test.js`
- `generateRankingsAudit()` with mocked gsc_cache rows — verifies correct issue_types written

**Extractor unit tests:** `playwright-crawler/tests/extractors/robots.test.js`, `sitemap.test.js`, `hreflang.test.js`, `mobile.test.js`, `monitoring.test.js`
- Each extractor: valid input, missing input, malformed input

**Existing tests:** All 105 backend tests must continue to pass. No changes to existing check functions.

---

## Execution Order (Dependency-Ordered Tasks)

1. New extractor: `robots.js` + `sitemap.js` (site-level, crawler integration)
2. New extractor: `hreflang.js` (per-page)
3. New extractor: `mobile.js` (per-page)
4. New extractor: `monitoring.js` (per-page)
5. New extractor: `jsrender.js` (per-page, Playwright-only)
6. Integrate site-level extractors into `crawler.js` (run before crawl loop, attach to dataset)
7. Audit-parser: `checkRobotsIndexability` + `checkSitemap`
8. Audit-parser: `checkInternalLinking` + `checkImages` (extended)
9. Audit-parser: `checkSchemaExtended` + `checkContent`
10. Audit-parser: `checkJavaScriptRendering` + `checkInternationalSeo`
11. Audit-parser: `checkMobileSeo` + `checkMonitoring`
12. Audit-parser: `checkLlmAiCrawlers` (reads from robots extractor data)
13. New service: `rankings-audit.service.js` + wire into crawl-runner
14. New service: `speed-audit.service.js` + `POST /api/reports/:siteId/speed-audit` route
15. Audit checks seed: add ~115 new rows
16. Frontend: `auditCategories.js` — add 10 new slug mappings
17. Frontend: `AuditCategory.jsx` — Rankings & GSC empty state + Speed on-demand UI
18. End-to-end smoke test: trigger a crawl, verify all 13 categories produce audit_results rows

---

## Out of Scope

- Bulk pre-generation of AI recommendations for new issues (future roadmap)
- Scheduled speed audits (future roadmap)
- Per-page PSI (only top 10 URLs)
- Hreflang XML sitemap support (only `<link>` tag detection)
- Mobile Content Mismatch (Task 8 Mobile SEO) — requires second Playwright pass with mobile UA; **defer to Phase 3**, mark as `NOT AUDITED` in checks seed
