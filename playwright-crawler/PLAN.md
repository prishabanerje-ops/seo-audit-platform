# Playwright + Crawlee — Crawler Plan

> Goal: Replace Screaming Frog CLI dependency with a self-hosted Node.js crawler
> Strategy: Build in parallel, validate against SF output, then cut over
> SF keeps running in production throughout the entire build

---

## Architecture

```
playwright-crawler/
├── PLAN.md                        # This file
├── package.json                   # Standalone package — own dependencies
├── src/
│   ├── index.js                   # Entry point — exports crawl()
│   ├── crawler.js                 # Crawlee + Playwright core crawler
│   ├── extractors/
│   │   ├── meta.js                # title, description, robots meta
│   │   ├── headings.js            # H1–H6 extraction
│   │   ├── canonical.js           # canonical, hreflang
│   │   ├── links.js               # internal + external links
│   │   ├── images.js              # src, alt, width, height, format
│   │   ├── schema.js              # JSON-LD, microdata
│   │   ├── response.js            # status codes, headers, redirects
│   │   ├── resources.js           # JS/CSS/font resources
│   │   └── content.js             # word count, text ratio, viewport
│   ├── parsers/
│   │   └── robots-txt.js          # Fetch + parse robots.txt per-bot
│   ├── output/
│   │   └── sf-format.js           # Shape output to match SF CSV columns exactly
│   └── utils/
│       ├── url.js                 # URL normalisation, dedup
│       └── logger.js              # Crawl progress logging
└── tests/
    ├── extractor.test.js          # Unit tests per extractor
    └── parity.test.js             # Compare output vs SF CSV for same URL
```

---

## Core Design Decisions

### 1. Match SF Output Schema Exactly
All extractors must output field names that match SF CSV column headers.
Downstream parsers (`sf-parser.service.js`) must not change during the build.
Migration = swap the crawl runner, keep everything else identical.

### 2. Dual Crawler Mode
Use Crawlee's router to pick the right crawler per page:

| Mode | Crawler | When |
|---|---|---|
| Fast | `CheerioCrawler` | Page returns full HTML (SSR, WordPress, static) |
| Full | `PlaywrightCrawler` | Page returns JS shell (`<div id="root">` only) |

Detection logic: if cheerio parse finds `<title>` and meaningful body text → use cheerio result. Else → re-fetch with Playwright.

### 3. Feature Flag in .env
```
USE_PLAYWRIGHT_CRAWLER=false   # true = use new crawler, false = use SF
```
Instant rollback. No code change needed post-cutover.

### 4. Standalone Package
Lives in `playwright-crawler/` with its own `package.json`.
Called from `backend/services/crawl.service.js` via:
```js
const { crawl } = require('../../playwright-crawler/src/index')
```
No tight coupling until cutover.

---

## SF CSV Columns to Replicate

These are the SF output files and columns your current parser reads.
Every extractor must produce equivalent data.

### internal_all.csv
- Address, Content Type, Status Code, Status, Indexability, Indexability Status
- Title 1, Title 1 Length, Title 1 Pixel Width, Title 2
- Meta Description 1, Meta Description 1 Length, Meta Description 2
- H1-1, H1-1 Length, H1-2, H2-1, H2-1 Length, H2-2
- Meta Robots 1, X-Robots-Tag 1, Meta Refresh, Canonical Link Element 1
- rel="next", rel="prev", Size, Word Count, Text Ratio
- Crawl Depth, Link Score, Unique Inlinks, Unique Outlinks
- Response Time, Last Modified, Redirect URL, Redirect Type

### response_codes_all.csv
- Address, Status Code, Status, Redirect URL, Redirect Type

### canonicals_all.csv
- Address, Canonical Link Element 1, Canonical HTTP Header, Canonical Link Element Match HTTP Header

### page_titles_all.csv
- Address, Title 1, Title 1 Length, Title 1 Pixel Width, Title 2, Title 2 Length

### meta_description_all.csv
- Address, Meta Description 1, Meta Description 1 Length, Meta Description 2

### h1_all.csv / h2_all.csv
- Address, H1-1, H1-1 Length, H1-2, H2-1, H2-1 Length, H2-2

### images_all.csv
- Address, Source, Alt Text, Alt Text Length, Title, Missing Alt Text, Alt Text Too Long

### structured_data_all.csv
- Address, Type, Property, Content, Errors

### sitemaps_all.csv
- Address, Status Code, Status, In Sitemap, In Crawl

### javascript_all.csv
- Address, Rendered Word Count, Raw Word Count, Rendered Title, Raw Title

---

## Crawl Configuration

Match SF crawl settings that backend currently sends via XML config:

```js
const crawlConfig = {
  maxConcurrency: 5,          // SF default
  maxRequestsPerCrawl: 500,   // Respect crawl limit
  requestHandlerTimeoutSecs: 30,
  navigationTimeoutSecs: 30,
  retryOnBlocked: true,
  respectRobotsTxt: true,
  userAgent: 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
}
```

---

## Validation Plan

Before cutting over from SF:

1. Run SF crawl on `testsite.com` → save CSVs
2. Run Playwright crawler on same URL → save output
3. Run `parity.test.js` → diff field by field
4. Target: >95% field-level match on core fields
5. Fix gaps → re-run parity test
6. Only cut over when parity test passes

---

## Build Phases

### Phase 1 — Core Crawler (Week 1) ✅ COMPLETE
- [x] Set up `playwright-crawler/package.json` with crawlee, playwright, cheerio
- [x] Build `crawler.js` — URL queue, concurrency, link following, dedup
- [x] Build `response.js` extractor — status codes, headers, redirect chain
- [x] Build `url.js` util — normalisation, dedup, scope filtering
- [x] Test: crawled books.toscrape.com — 18 pages, 0 failures, cheerio + playwright dual mode working

### Phase 2 — Data Extractors (Week 2) ✅ COMPLETE
- [x] `meta.js` — title, description, robots meta, viewport, refresh
- [x] `headings.js` — H1–H6, count, length
- [x] `canonical.js` — canonical tag, HTTP header canonical, hreflang
- [x] `links.js` — internal/external, follow/nofollow, anchor text
- [x] `images.js` — src, alt, dimensions, format detection
- [x] `content.js` — word count, text ratio, word count rendered vs raw
- [x] All extractors wired into crawler.js and verified on live site

### Phase 3 — SF Parity Layer (Week 3) ✅ COMPLETE
- [x] `sf-format.js` — map extractor output → SF CSV column names
- [x] `schema.js` — JSON-LD extraction + validation
- [x] `resources.js` — JS/CSS/font resource classification (13 vendor categories)
- [x] `robots-txt.js` — per-bot allow/disallow parsing (13 bots)
- [x] Dual mode: CheerioCrawler fast pass + PlaywrightCrawler fallback
- [x] All 12 SF CSV datasets verified producing correct rows end-to-end

### Phase 4 — Validation + Cutover (Week 4) ✅ COMPLETE
- [x] `parity.test.js` — automated diff against SF output
- [x] Run on Cars24 (10 pages sample) — 3599 assertions, 0 failures, 100% PASS
- [x] Add `USE_PLAYWRIGHT_CRAWLER=false` feature flag to `.env`
- [x] Wire into `crawl-runner.js` behind the flag
  - `_runPlaywrightCrawl()` — async helper: crawl → toSfFormat → write CSVs → parseAndStore
  - `writeDatasetAsCsv()` — RFC 4180 serialiser, writes 12 datasets as CSV files
  - Dynamic imports (playwright-crawler only loaded when flag is true)
  - Supports spider mode; list/sitemap modes return a clear error
- [ ] Test full crawl job end-to-end in dev
- [ ] Cut over in production

---

## Dependencies

```json
{
  "crawlee": "^3.x",
  "playwright": "^1.x",
  "cheerio": "^1.x",
  "node-fetch": "^3.x",
  "robots-parser": "^3.x",
  "p-limit": "^5.x"
}
```

---

## What Does NOT Change During Build

- `backend/services/sf-parser.service.js` — untouched
- `backend/services/crawl.service.js` — only the crawl runner swaps
- `backend/db/` — no schema changes
- All 204 check definitions — untouched
- Frontend — untouched

---

## Out of Scope for This Build

- Replacing PageSpeed Insights checks (keep PSI API)
- Replacing Log File analysis (keep log parser)
- Replacing Manual checks (not automatable)
- AEO single-page audit (separate — see AIO.md)
