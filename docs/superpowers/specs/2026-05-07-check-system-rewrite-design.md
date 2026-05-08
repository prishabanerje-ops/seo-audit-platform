# Check System Rewrite — Design Spec

**Date:** 2026-05-07
**Status:** Design — pre-implementation
**Owner:** Aakash Srivastava (aakashsrivastava1@policybazaar.com)

---

## 1. Context & References

### Why this rewrite

The platform has 482 checks registered in `backend/db/seed/audit-checks.js` and `docs/audit-checks/canonical-checks-v1.csv`. Of these:

- Only **3 are fully implemented** (confirmed in `docs/audit-checks/roadmap-summary.md`)
- **149 are missing entirely**, 14 are partial
- The remaining 300+ have no clear, verifiable implementation path — the logic was never defined

The root cause is that checks were registered first and implementation was deferred indefinitely. The result is a UI that shows 482 check categories but produces almost no real audit data.

This spec replaces the check registry, extractor layer, and audit parsing with a **feasibility-first** system where every registered check has a concrete, verified implementation path before it enters the catalog.

### Supersedes

| Old spec | What it proposed | Why superseded |
|---|---|---|
| `2026-04-15-audit-checks-upgrade-design.md` | Incremental additions to existing 482-check set | Existing set is structurally unimplementable |
| `2026-04-27-audit-checks-roadmap-design.md` | P0/P1/P2 sequencing of 163 missing checks | Starting fresh is faster than patching |
| `2026-04-15-platform-audit-fresh-start-design.md` | Full platform rewrite | Too broad — platform shell stays |

### Primary reference

**`docs/audit-checks/check-catalog.md` (v1.4)** is the canonical source of truth for this rewrite. Every check implemented must match the `check_id`, `severity`, `section`, and implementation notes in that file exactly. Do not implement anything not in that file.

---

## 2. Goals

1. Replace the 482-check seed with the 346-check catalog from `check-catalog.md`
2. Build 6 new extractors and 3 new backend services to cover all ✅ checks
3. Add 4 new platform features: `site_settings` table, `schema_rules` system, keyword mapping upload, backlink upload
4. Add Schema Rules Editor UI and per-site configuration UI to the dashboard
5. Define and enforce a standard `CheckResult` contract across every check
6. Keep the existing platform shell untouched: auth, SQLite, React UI, multi-site management, GSC/GA4/AI integrations

---

## 3. Scope

### In scope

- `backend/db/seed/audit-checks.js` — full replacement
- `backend/db/migrations/` — new migration files for new tables
- `playwright-crawler/src/extractors/` — 6 new extractor files
- `backend/services/audit-parser.service.js` — rewrite to consume new extractors
- `backend/services/scoring.service.js` — new
- `backend/services/crux.js` — new
- `backend/services/backlinks.service.js` — new
- `backend/routes/` — new routes for schema rules, site settings, keyword upload, backlink upload
- `frontend/src/pages/` — Schema Rules Editor UI, keyword upload, backlink upload, site settings
- `docs/audit-checks/check-catalog.md` — living reference document (already complete)

### Out of scope

- Auth system, JWT, cookie handling — no changes
- User management routes — no changes
- GSC, GA4, AI (`ai.service.js`) integrations — already exist, no changes
- PSI route (`psi.js`) — already exists, no changes
- Frontend routing, AuthContext, SitesContext — no changes
- Multi-tenancy architecture — separate future phase
- Existing crawl job scheduling — no changes
- `seo-automation.db` contents — migrations run automatically, data preserved

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Playwright Crawler                        │
│                                                                  │
│  Site-level (once per crawl):         Per-page:                 │
│  ┌────────────┐ ┌────────────┐   ┌──────────┐ ┌─────────────┐  │
│  │ robots.js  │ │ sitemap.js │   │ meta.js  │ │ headings.js │  │
│  └────────────┘ └────────────┘   │ links.js │ │ content.js  │  │
│                                  │ images.js│ │ schema.js   │  │
│                                  │canonical │ │ response.js │  │
│                                  │resources │ │ url.js (new)│  │
│                                  │jsrender  │ │ mobile.js   │  │
│                                  │(new)     │ │ monitoring  │  │
│                                  └──────────┘ │ (new)       │  │
│                                               └─────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ raw extractor output
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   audit-parser.service.js                        │
│                                                                  │
│  Reads: extractor output + site_settings + schema_rules +        │
│         keyword_mappings + backlinks                             │
│  Calls: crux.js, backlinks.service.js (for non-crawl checks)    │
│  Emits: CheckResult[] per page                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ CheckResult[]
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    scoring.service.js                            │
│  Computes page score and section scores from CheckResult[]       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ scored results
                               ▼
                      audit_results table (SQLite)
```

---

## 5. Check Contract

Every check — without exception — must return a `CheckResult` object matching this shape. This is enforced at the audit-parser level; any extractor function that returns something different will throw at parse time.

```js
// backend/services/audit-parser.service.js
/**
 * @typedef {Object} CheckResult
 * @property {string}  check_id  - matches check_id in check-catalog.md exactly
 * @property {boolean} passed
 * @property {'critical'|'warning'|'info'} severity
 * @property {string}  section   - section name from check-catalog.md
 * @property {string}  message   - human-readable one-line result summary
 * @property {string|null} details - specific URL, value, or element that failed; null if passed
 */
```

### Scoring model

```js
// backend/services/scoring.service.js
const WEIGHTS = { critical: 25, warning: 10, info: 1 }

/**
 * @param {CheckResult[]} checkResults
 * @returns {number} 0–100
 */
function computePageScore(checkResults) {
  const deductions = checkResults
    .filter(r => !r.passed)
    .reduce((sum, r) => sum + (WEIGHTS[r.severity] ?? 0), 0)
  return Math.max(0, 100 - deductions)
}

/**
 * @param {CheckResult[]} checkResults
 * @param {string} section
 * @returns {number} 0–100
 */
function computeSectionScore(checkResults, section) {
  return computePageScore(checkResults.filter(r => r.section === section))
}
```

---

## 6. YMYL Page Classification

Shared logic used by `ymyl_disclaimer_present`, `ymyl_date_disclosure`, `ymyl_outbound_authority`, and `author_credentials_schema`. Computed once per page during audit parsing and stored as page metadata — not itself a pass/fail check.

```js
// backend/services/audit-parser.service.js

/**
 * @param {string} url
 * @param {string} bodyText  - extracted body text (nav/header/footer stripped)
 * @param {string[]} customUrlPatterns  - from site_settings key 'ymyl_url_patterns'
 * @returns {'finance'|'health'|'legal'|null}
 */
function classifyYmyl(url, bodyText, customUrlPatterns = []) {
  const defaultPatterns = [
    '/insurance', '/health', '/investment', '/loan', '/finance',
    '/policy', '/premium', '/medical', '/legal', '/compare',
    '/term-plan', '/motor', '/life', '/credit', '/tax'
  ]
  const allPatterns = [...defaultPatterns, ...customUrlPatterns]
  const urlMatch = allPatterns.some(p => url.includes(p))

  const ymylWords = [
    'premium', 'policy', 'coverage', 'claim', 'sum assured',
    'deductible', 'nominee', 'maturity', 'annuity', 'interest rate',
    'dividend', 'portfolio', 'liability', 'indemnity', 'underwriting'
  ]
  const wordCount = ymylWords.filter(w => bodyText.toLowerCase().includes(w)).length
  const contentMatch = wordCount >= 3

  if (!urlMatch && !contentMatch) return null

  if (url.includes('/health') || url.includes('/medical')) return 'health'
  if (url.includes('/legal') || url.includes('/law')) return 'legal'
  return 'finance'
}
```

---

## 7. Database Schema Changes

All changes delivered via numbered migration files. Never edit existing migration files.

### 7a — New tables

```sql
-- Migration: add_schema_rules_table
CREATE TABLE IF NOT EXISTS schema_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  pattern     TEXT NOT NULL,          -- glob pattern, e.g. '/health/*'
  required_types TEXT NOT NULL,       -- JSON array: '["Product","FAQPage"]'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_schema_rules_site ON schema_rules(site_id, sort_order);
```

```sql
-- Migration: add_site_settings_table
-- Generic key-value store for per-site configuration.
-- Keys used by check system:
--   trusted_authority_domains  TEXT  newline-separated domain list
--   ymyl_url_patterns          TEXT  newline-separated path patterns
--   ymyl_disclaimer_patterns   TEXT  newline-separated regex strings
CREATE TABLE IF NOT EXISTS site_settings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, key)
);
```

```sql
-- Migration: add_keyword_mappings_table
CREATE TABLE IF NOT EXISTS keyword_mappings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id             INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url                 TEXT NOT NULL,
  primary_keyword     TEXT NOT NULL,
  search_volume       INTEGER,
  secondary_keywords  TEXT,            -- JSON array
  is_pillar           INTEGER NOT NULL DEFAULT 0,  -- boolean
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, url)
);
CREATE INDEX idx_keyword_mappings_site ON keyword_mappings(site_id);
```

```sql
-- Migration: add_backlinks_table
CREATE TABLE IF NOT EXISTS backlink_uploads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  row_count   INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backlinks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id         INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  upload_id       INTEGER NOT NULL REFERENCES backlink_uploads(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,
  target_url      TEXT NOT NULL,
  anchor_text     TEXT,
  domain_rating   INTEGER,
  is_dofollow     INTEGER NOT NULL DEFAULT 1,  -- boolean
  first_seen_date TEXT,
  link_type       TEXT NOT NULL DEFAULT 'other',
                  -- editorial | guest_post | pr | directory | other
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_backlinks_site ON backlinks(site_id, target_url);
```

### 7b — Existing tables

No structural changes to existing tables. `audit_results` already has `check_id`, `crawl_job_id`, `url`, `passed`, `severity`, `message`, `details` columns — verify these exist before implementing; add via migration if any are missing.

---

## 8. New Extractors

All files go in `playwright-crawler/src/extractors/`. Each exports a function that receives `(page, url, rawHtml, context)` and returns a plain object. They never write to DB — they return data only.

### 8a — `robots.js` (site-level, runs once per crawl)

**Sections served:** 3 (Robots), 4 (Sitemaps — `sitemap_in_robots`), 23 (GEO — `geo_llms_txt`, `geo_llms_full_txt`, `geo_url_md_endpoint`, `geo_ai_bot_robots`)

**Returns:**
```js
{
  exists: boolean,
  raw: string,               // full text of /robots.txt
  parsed: object,            // robots-parser output
  sitemapUrls: string[],
  llmsTxt: string|null,      // content of /llms.txt or null (geo_llms_txt)
  llmsFullTxt: string|null,  // content of /llms-full.txt or null (geo_llms_full_txt)
  urlMdSample: {             // geo_url_md_endpoint — test 5 content page URLs for .md variant
    tested: string[],        // URLs probed (e.g. /blog/foo.md, /blog/foo.md.txt)
    found: string[],         // URLs that returned 200 non-HTML
    hasAny: boolean
  },
  disallowedPaths: string[], // all Disallow values for *
  agentRules: object         // { GPTBot, ClaudeBot, PerplexityBot, GoogleBot, ... }
}
```

**npm dependency:** `robots-parser` (check if already installed; add if not)

---

### 8b — `sitemap.js` (site-level, runs once per crawl)

**Sections served:** 4 (XML Sitemaps)

**Returns:**
```js
{
  found: boolean,
  url: string,               // resolved sitemap URL
  isIndex: boolean,
  childSitemaps: string[],
  urls: Array<{
    loc: string,
    lastmod: string|null,
    changefreq: string|null,
    priority: string|null,
    images: Array<{ loc: string }>,
    videos: Array<{ loc: string }>,
    news: object|null        // <news:news> content if present
  }>,
  fileSizeBytes: number,
  parseErrors: string[]
}
```

**npm dependency:** `fast-xml-parser` (check if already installed; add if not)

---

### 8c — `jsrender.js` (per-page, dual-mode)

**Sections served:** 7 (JS Rendering), 23 (`geo_content_without_js`, `geo_faq_html`)

**Dual-mode pattern:** Both passes happen in the same Playwright session:
1. **Cheerio pass** — fetch raw HTML via `page.content()` before JS runs (or use separate `fetch()` with same cookies)
2. **Playwright pass** — `page.content()` after `networkidle`

**Returns:**
```js
{
  rawHtml: string,
  renderedHtml: string,
  rawWordCount: number,
  renderedWordCount: number,
  rawLinkCount: number,
  renderedLinkCount: number,
  rawHasH1: boolean,
  renderedHasH1: boolean,
  rawHasTitle: boolean,
  rawHasMetaDesc: boolean,
  rawHasJsonLd: boolean,
  renderBlockingScripts: string[],  // src values of blocking <script> in <head>
  domContentLoadedMs: number,
  lazyContentLinks: number          // links only visible after scroll
}
```

---

### 8d — `mobile.js` (per-page, Playwright mobile viewport)

**Sections served:** 8 (Mobile & Usability)

**Pattern:** Reuse existing Playwright page context; resize to 375×812 (iPhone 14) for mobile checks, restore after.

**Returns:**
```js
{
  viewportMetaPresent: boolean,
  bodyScrollWidthExceedsWindow: boolean,  // horizontal scroll
  tapTargets: Array<{ selector: string, width: number, height: number }>,
  smallTapTargets: Array<{ selector: string, width: number, height: number }>,
  bodyFontSizePx: number,
  zoomDisabled: boolean,
  fullViewportOverlays: number,           // fixed-position full-viewport elements
  desktopWordCount: number,
  mobileWordCount: number,
  desktopH1: string,
  mobileH1: string
}
```

---

### 8e — `monitoring.js` (per-page, Playwright + TLS)

**Sections served:** 9 (Security — SSL, mixed content), 10 (CWV lab metrics, LCP/CLS element), 21 (`update_history_visible`)

**Returns:**
```js
{
  // TLS
  sslValid: boolean,
  sslExpiryDays: number,
  sslChainComplete: boolean,
  sslIssuer: string,

  // Mixed content
  mixedContentUrls: string[],

  // Performance timing
  ttfbMs: number,
  domContentLoadedMs: number,
  totalRequests: number,
  jsCssTransferBytes: number,

  // LCP element
  lcpTagName: string|null,
  lcpClassName: string|null,
  lcpIsDecorative: boolean,

  // CLS causes
  clsSources: Array<{
    tagName: string,
    id: string,
    className: string,
    shiftDelta: number,
    hadRecentInput: boolean
  }>
}
```

**TLS check:** Use Node.js `tls.connect()` to inspect certificate without browser involvement — this is faster and more reliable than Playwright's cert access.

---

### 8f — `url.js` (per-page, pure string parsing)

**Sections served:** 5 (`session_ids_in_urls`, `crawl_trap`), 6 (URL Structure)

**Returns:**
```js
{
  url: string,
  lengthChars: number,
  hasUpperCase: boolean,
  hasUnderscores: boolean,
  hasSpecialChars: boolean,
  isGenericSlug: boolean,         // matches /page-\d+/, /p=/, /index/, etc.
  trailingSlash: boolean,
  directoryDepth: number,         // count of '/' in path
  hasDateInPath: boolean,
  dateFormat: string|null,        // 'YYYY/MM/DD' | 'YYYY-MM-DD' | 'mixed' | null
  hasSessionId: boolean,          // JSESSIONID, sid=, PHPSESSID, etc.
  hasCrawlTrap: boolean,          // repeating segments or 5+ query params
  queryParamCount: number
}
```

---

## 9. New Backend Services

### 9a — `backend/services/crux.js`

Calls the Chrome UX Report API. Requires `CRUX_API_KEY` environment variable (or `settings` table key `crux_api_key`).

**Endpoints used:**
- `POST https://chromeuxreport.googleapis.com/v1/records:queryRecord` — current p75 per URL
- `POST https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord` — 25-week trend (for `cwv_trend`)

**Checks served:** `crux_lcp`, `crux_inp`, `crux_cls`, `cwv_trend`

**Graceful degradation:** If no CrUX data for a URL (not enough real-user data), return `passed: true` with `severity: 'info'` and message "No CrUX data available for this URL".

---

### 9b — `backend/services/backlinks.service.js`

Reads from the `backlinks` table (populated via CSV upload). Computes all Section 20 checks against the most recent upload for a given site.

**Key functions:**
```js
/** @param {number} siteId @returns {CheckResult[]} */
async function runBacklinkChecks(siteId) { ... }

/** @param {number} siteId @param {string} csvText @returns {{ rowCount: number }} */
async function importBacklinkCsv(siteId, csvText) { ... }
```

**CSV column mapping (Semrush/Ahrefs compatible):**

| CSV column | DB column | Notes |
|---|---|---|
| `source_url` or `Page URL` | `source_url` | required |
| `target_url` or `Link URL` | `target_url` | required |
| `anchor` or `Anchor Text` | `anchor_text` | |
| `domain_rating` or `Domain Score` | `domain_rating` | integer |
| `dofollow` or `Type` | `is_dofollow` | "dofollow" → 1 |
| `first_seen` or `Discovered` | `first_seen_date` | |
| `link_type` | `link_type` | defaults to 'other' |

Parser must be tolerant of column name variants — both Semrush and Ahrefs export different header names for the same data.

---

### 9c — `backend/services/scoring.service.js`

Already fully specced in Section 5 (Check Contract). No additional logic — just `computePageScore` and `computeSectionScore` exported as named functions.

---

## 10. New Platform Features

### 10a — Schema Rules System

**What it is:** A per-site URL pattern → required `@type` mapping. The `schema_rules` check validates that each crawled URL's JSON-LD contains the schema types required by the first matching pattern.

**UI location:** New "Schema Rules" tab inside the existing site settings/edit flow.

**UI features:**
- Add / remove / reorder rules (drag or up/down buttons)
- Glob pattern text input per rule (e.g. `/insurance/*`, `/compare/*`, `*`)
- Required schema type picker: 16 predefined checkboxes + free-text custom type entry
- Import JSON / Export JSON (batch operations)
- A catch-all rule `{ pattern: "*", required: ["WebPage"] }` is always present at the bottom and cannot be deleted

**16 predefined types:** `WebPage`, `Product`, `FAQPage`, `NewsArticle`, `Article`, `BlogPosting`, `BreadcrumbList`, `DiscussionForumPosting`, `QAPage`, `ItemList`, `Event`, `HowTo`, `Review`, `LocalBusiness`, `Organization`, `SiteNavigationElement`

**Custom types** (insurance/finance examples): `InsuranceAgency`, `FinancialProduct`, `HealthInsurancePlan`, `MotorInsurance`, `TermInsurance`

**API routes:**
```
GET  /api/sites/:siteId/schema-rules        → SchemaRule[]
PUT  /api/sites/:siteId/schema-rules        → replace all rules atomically
```

**Rule evaluation at check time:**
```js
function matchSchemaRule(url, rules) {
  for (const rule of rules) {                     // top-to-bottom
    if (micromatch.isMatch(url, rule.pattern)) {  // npm: micromatch
      return rule.required_types                  // JSON.parse
    }
  }
  return ['WebPage']                              // fallback
}
```

**npm dependency:** `micromatch` for glob matching

---

### 10b — Keyword Mapping Upload

**What it is:** A CSV uploaded per site mapping URLs to their target keywords. Enables all ⚠️ KW-UPLOAD checks.

**UI location:** New "Keywords" tab in site settings.

**CSV format:**
```
url,primary_keyword,search_volume,secondary_keywords,is_pillar
/car-insurance/,car insurance,110000,"auto insurance,vehicle insurance",false
/health-insurance/,health insurance,90000,"medical insurance,family health cover",true
```

**API routes:**
```
POST /api/sites/:siteId/keyword-mappings/upload   → { rowCount }
GET  /api/sites/:siteId/keyword-mappings           → KeywordMapping[]
DELETE /api/sites/:siteId/keyword-mappings         → clears all for site
```

**Validation on upload:**
- `url` required, must start with `/`
- `primary_keyword` required
- `search_volume` optional integer
- `secondary_keywords` optional, comma-separated within quotes
- `is_pillar` optional boolean string ("true"/"false"/"1"/"0")
- Duplicate URLs: last row wins (upsert on `site_id + url`)

---

### 10c — Backlink Upload

**What it is:** Semrush or Ahrefs backlink export CSV uploaded per site. Enables all ⚠️ BL-UPLOAD checks. Users can also add individual links manually (for guest posts, PR coverage).

**UI location:** New "Backlinks" tab in site settings.

**UI features:**
- CSV upload button (Semrush/Ahrefs format)
- Upload history table (filename, date, row count)
- Manual link add form (source URL, target URL, anchor, DR, dofollow toggle, link type)
- "Compare vs previous upload" toggle (enables `lost_backlinks` check)

**API routes:**
```
POST /api/sites/:siteId/backlinks/upload          → { uploadId, rowCount }
POST /api/sites/:siteId/backlinks/manual          → { id }
GET  /api/sites/:siteId/backlinks/uploads         → BacklinkUpload[]
GET  /api/sites/:siteId/backlinks?uploadId=N      → Backlink[]
```

---

### 10d — Site Settings (Per-Site Configuration)

**What it is:** A generic key-value store for per-site configuration values used by checks. Managed in the dashboard.

**UI location:** New "Configuration" tab in site settings, rendered as a form with clearly labelled fields per key.

**Keys and their UI controls:**

| Key | UI Control | Used By |
|---|---|---|
| `trusted_authority_domains` | Multi-line textarea, one domain per line | `ymyl_outbound_authority` |
| `ymyl_url_patterns` | Multi-line textarea, one path pattern per line | YMYL classification |
| `ymyl_disclaimer_patterns` | Multi-line textarea, one regex per line | `ymyl_disclaimer_present` |
| `brand_name` | Single text input | `title_brand` |
| `site_topic` | Single text input (e.g. "insurance comparison") | `niche_relevance` |
| `crux_api_key` | Password input (falls back to global setting) | CrUX checks |

**API routes:**
```
GET  /api/sites/:siteId/settings           → { key: value, ... }
PUT  /api/sites/:siteId/settings           → upsert one or more key-value pairs
```

**Pre-populated defaults on site creation:**
```js
{ brand_name: '', trusted_authority_domains: '', ymyl_url_patterns: '' }
```

---

## 11. Check Feasibility Tiers — Runtime Behaviour

| Tier | Runtime behaviour |
|---|---|
| ✅ | Runs automatically on every crawl |
| ⚠️ GSC | Runs if GSC OAuth connected for site; skips with `passed: true, severity: 'info', message: 'GSC not connected'` |
| ⚠️ GA4 | Runs if GA4 OAuth connected for site; skips gracefully |
| ⚠️ PSI | Runs if `psi_api_key` present in settings; skips gracefully |
| ⚠️ CrUX | Runs if `crux_api_key` present in settings or site_settings; skips gracefully |
| ⚠️ KW-UPLOAD | Runs if `keyword_mappings` rows exist for this site; skips gracefully |
| ⚠️ BL-UPLOAD | Runs if `backlinks` rows exist for this site from at least one upload; skips gracefully |
| 🤖 | Never auto-runs. Triggered manually from Issues panel or bulk from dashboard. Results cached in `ai_suggestions` table. |
| 📋 | Not run by the system. Displayed as manual checklist items in the UI with pass/fail toggle for the operator. |

"Skips gracefully" means: the check is omitted from `CheckResult[]` for that crawl. It does not emit a failing result and does not count against the page score.

---

## 12. New npm Dependencies

| Package | Purpose | Where |
|---|---|---|
| `franc-min` | Language detection for `content_language_match` | crawler |
| `fast-xml-parser` | Sitemap XML parsing in `sitemap.js` | crawler |
| `robots-parser` | Robots.txt parsing in `robots.js` | crawler |
| `micromatch` | Glob pattern matching for schema_rules | backend |

Check if `fast-xml-parser` and `robots-parser` are already installed before adding. Add only what is missing.

---

## 13. Seed File Replacement

`backend/db/seed/audit-checks.js` must be fully replaced. The new seed registers exactly the 346 checks from `check-catalog.md`, with `check_id`, `name`, `section`, `severity`, `feasibility`, and `description` columns.

**Seed shape per row:**
```js
{
  check_id: 'http_status',
  name: '200 Status Code',
  section: 'Response Codes & Redirects',
  severity: 'critical',
  feasibility: 'automated',   // automated | gsc | ga4 | psi | crux | kw_upload | bl_upload | ai | manual
  description: 'HTTP status = 200 for all indexable pages'
}
```

The seed runs on server start via `runMigrations()` — no manual step needed.

---

## 14. `near_duplicate` — Scalability Note

Full Levenshtein distance across all page pairs is O(n²) in page count and O(m×n) in text length per pair. For sites with > 200 pages this is computationally prohibitive during a crawl.

**Required approach:**
1. Group pages by word count bucket (±10%)
2. Within each bucket, compute 4-gram MinHash signatures (128 hash functions)
3. Only compute exact similarity for pairs with Jaccard similarity > 0.7 from MinHash
4. Flag pairs where similarity > 0.80

For sites ≤ 200 pages, full Levenshtein is acceptable. For larger sites, MinHash is mandatory. The implementation must check crawl size and select the appropriate algorithm automatically.

**npm option:** `minhash` or implement 4-gram MinHash from scratch (~50 lines).

---

## 15. Migration Execution Plan

All delivered as separate migration files in `backend/db/migrations/`:

| Migration | Creates |
|---|---|
| `NNNN_add_site_settings.js` | `site_settings` table |
| `NNNN_add_schema_rules.js` | `schema_rules` table |
| `NNNN_add_keyword_mappings.js` | `keyword_mappings` table |
| `NNNN_add_backlinks.js` | `backlink_uploads` + `backlinks` tables |
| `NNNN_replace_audit_checks_seed.js` | Truncates old seed rows; inserts 346 new rows |

Migrations run automatically on server start. The `seo-automation.db` file is never deleted. Existing `audit_results` rows are preserved (they reference old `check_id` values — these rows become orphaned but are not deleted; the UI filters by crawl job, so orphaned rows do not surface).

---

## 16. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| `PerformanceObserver` for LCP/CLS not firing in headless Chromium | Test with `--enable-blink-features=LayoutInstabilityAPI` flag in Playwright config |
| `franc-min` false positives on short pages | Check passes silently if page body text < 200 words |
| CrUX API returning 404 for URLs with low traffic | Graceful pass with info message (already specced in 9a) |
| `micromatch` glob syntax differs from user expectations | Document supported patterns in UI tooltip; test with `/health/*`, `*` |
| Sitemap with 50,000 URLs — HEAD request for each (`no_4xx_in_sitemap`) | Rate-limit to 10 concurrent HEAD requests; skip check for sitemaps > 10,000 URLs with a warning |
| Old `audit_results` rows with non-catalog check_ids | Do not delete; filter in UI by `crawl_job_id`; orphaned rows cause no harm |
| `schema_rules` catch-all row deleted by user via API | Backend enforces: PUT always appends `{ pattern: "*", required: ["WebPage"] }` if missing |

---

## 17. Out of Scope Clarifications

- **No TypeScript port.** All new files are JavaScript + JSDoc, matching the existing codebase.
- **No new crawler.** The existing Playwright/Crawlee crawler is extended with new extractors.
- **No breaking changes to existing routes.** New routes are additive only.
- **`local_nap_consistency` and GBP checks stay 📋 manual.** Google Business Profile has no public API for automated verification.
- **AI checks stay on-demand.** No bulk pre-generation during crawl.
- **`ai_competitor_gap` and `ai_serp_opportunities` require `SERPAPI_KEY`.** If absent, these AI checks skip gracefully with a configuration prompt.

---

## 18. Feature — AI Checks (On-Demand URL & Site Analysis)

### 18.1 Overview

A second, distinct AI analysis system separate from the existing per-issue `POST /api/ai/suggest`. Where `ai/suggest` fixes a single detected issue on a single page, **AI Checks** synthesise data from multiple sources (crawl results, GSC, PSI, CrUX) to produce a rich narrative analysis — either for a single URL or across an entire site.

**Two modes:**
- **URL-level** — deep analysis of one page using all available data sources
- **Site-level** — holistic summary across all crawled URLs for the site

**Trigger:** On demand only. User clicks "Run Analysis" — never auto-runs during crawl.

**Output:** Streaming SSE — same pattern as existing `ai.js`. Rich narrative + prioritised recommendations, not `CheckResult` pass/fail data.

---

### 18.2 Skills System

Two categories of skills now exist in the platform:

| Type | When | Output | Inputs |
|---|---|---|---|
| Crawl-time checks (existing) | Every crawl, per URL | `passed / severity / message` | HTML + crawl signals |
| AI Check skills (new) | On demand, user-triggered | Rich narrative + recommendations | Crawl + GSC + PSI + CrUX |

#### Built-in skills (shipped, read-only prompts)

| Skill ID | Name | Description |
|---|---|---|
| `seo-technical` | Technical Health | Synthesises crawl signal failures into a ranked action list |
| `seo-content` | Content Quality + E-E-A-T | Content depth, YMYL signals, readability, entity coverage |
| `seo-performance` | Core Web Vitals + PSI | Lab + field data narrative with element-level causes |
| `seo-schema` | Schema Coverage | Schema type gaps, validation errors, rich result eligibility |
| `seo-programmatic` | Programmatic SEO Patterns | Thin content patterns, template duplication, crawl budget waste |
| `seo-competitor` | Competitive Gap | Position data from GSC, keyword gaps — no external URL fetching in v1 |

#### Custom skills (admin-created)

Admins can create, edit, and delete custom skills via the Skills admin UI. Custom skills use the same prompt editor and data source configuration as built-in skills. Built-in skill prompts can be edited (overridden) but not deleted.

---

### 18.3 Skills Storage

```
backend/skills/
  [skillId]/
    skill.json           ← skill metadata + system prompt
    references/
      [filename].md      ← context docs (brand voice, frameworks, guidelines)
```

**`skill.json` shape:**
```js
{
  id: string,             // e.g. 'seo-technical' | UUID for custom
  name: string,
  description: string,
  builtIn: boolean,       // true = shipped, prompt editable but not deletable
  systemPrompt: string,
  defaultDataSources: {
    crawl: boolean,       // always true — required for all skills
    gsc: boolean,
    psi: boolean,
    crux: boolean
  },
  createdAt: string,
  updatedAt: string
}
```

Built-in skills are initialised on server start if their `skill.json` does not exist (idempotent). Custom skill directories are created via the admin API.

---

### 18.4 Reference Documents

Each skill can have attached markdown context documents — brand voice guides, industry frameworks, regulatory checklists, scoring rubrics. At analysis time, all reference docs for the selected skill are read from disk and injected into the system prompt as additional context.

**Admin operations (via UI):**
- Upload `.md` file → saved to `backend/skills/[skillId]/references/[filename].md`
- Edit content inline
- Delete file

**npm dependency required:** `multer` — Express has no native multipart upload support. Add to `backend/package.json`.

---

### 18.5 Data Source Toggles

When running an analysis, the UI shows which data sources are available and lets the user override the skill's defaults:

| Source | Default for | Unavailable if |
|---|---|---|
| Crawl data | All skills (required, not toggleable off) | No completed crawl for this site |
| GSC data | `seo-content`, `seo-competitor`, `seo-programmatic` | GSC not connected for company |
| PSI score + lab metrics | `seo-performance` | `psi_api_key` not configured |
| CrUX field data | `seo-performance` | `crux_api_key` not configured |

If a data source is toggled **on** but not available, show a visible warning in the UI — do not silently omit the source from the prompt. The user must acknowledge before running.

---

### 18.6 Data Assembly Service

**File:** `backend/services/ai-checks.service.js`

Assembles the full prompt context for a given analysis request. Called by the new route before streaming begins.

```js
/**
 * @param {object} opts
 * @param {number} opts.siteId
 * @param {string|null} opts.url       - null for site-level analysis
 * @param {'site'|'url'} opts.scope
 * @param {object} opts.skill          - parsed skill.json
 * @param {object} opts.dataSources    - { crawl, gsc, psi, crux }
 * @param {number} opts.companyId
 * @returns {Promise<{ systemPrompt: string, userMessage: string, dataHash: string }>}
 */
async function assembleContext(opts) { ... }
```

**Assembly steps per data source:**

**Crawl data (always):**
- URL-level: fetch all `audit_results` rows for `(site_id, url)` from latest completed crawl job, grouped by section
- Site-level: fetch aggregate counts per section/severity + worst-performing pages per section (top 5 by failed check count)
- Serialise to a structured text block — never raw JSON (keeps token count predictable)

**GSC data:**
- Read stored GSC property tokens for the company from the `gsc_tokens` table (decrypt via `ads.crypto.js`)
- Call Google Search Console API v3 directly: `searchanalytics.query` for the site URL, 90-day window
- For URL-level: filter to specific page URL; extract clicks, impressions, CTR, average position, top 10 queries
- For site-level: top 20 pages by impressions + overall click/impression trend vs prior period

**PSI data:**
- Call internal PSI logic directly (not via HTTP) using the same `fetch()` + key resolution pattern as `psi.js`
- Extract: performance score, LCP, CLS, FCP, TTFB, top Lighthouse opportunity items
- URL-level only — PSI does not support site-level aggregation

**CrUX data:**
- Call `crux.js` service for p75 LCP, INP, CLS field data
- If CrUX History API enabled, include 4-week trend
- URL-level only (or origin-level for site scope)

**`dataHash`:** SHA-256 of `${siteId}:${url}:${skillId}:${JSON.stringify(dataSources)}` — used as cache key.

---

### 18.7 Database — Migration

One migration file: `backend/db/migrations/024_ai_checks.js`

```sql
-- Extend ai_suggestions to support AI Check results
ALTER TABLE ai_suggestions ADD COLUMN check_type TEXT NOT NULL DEFAULT 'suggest';
  -- 'suggest' = existing per-issue suggestions
  -- 'ai_check' = new on-demand analysis results

ALTER TABLE ai_suggestions ADD COLUMN skill_id TEXT DEFAULT NULL;
ALTER TABLE ai_suggestions ADD COLUMN scope TEXT DEFAULT NULL;       -- 'site' | 'url'
ALTER TABLE ai_suggestions ADD COLUMN analysis_url TEXT DEFAULT NULL; -- null = site-level
ALTER TABLE ai_suggestions ADD COLUMN data_sources_hash TEXT DEFAULT NULL;

-- Cache lookup index for AI Check results
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_check_cache
  ON ai_suggestions(site_id, analysis_url, skill_id, data_sources_hash)
  WHERE check_type = 'ai_check';
```

Migration ID: **024**. Register in `sqlite.js` MIGRATIONS array.

---

### 18.8 API Routes

All new routes are added to `backend/routes/ai.js` (extend existing file, do not create a new router file).

#### `GET /api/ai/skills`
Returns available skills. Auth: any authenticated user.

```js
// Response
[{
  id: string,
  name: string,
  description: string,
  builtIn: boolean,
  defaultDataSources: { crawl, gsc, psi, crux },
  referenceCount: number    // count of .md files in references/
}]
```

#### `POST /api/ai/checks`
Triggers analysis. Auth: `admin | seo | superadmin`. Rate limited: `aiLimiter` (10 req/min per IP).

```js
// Request body
{
  siteId: number,
  url: string | null,          // null = site-level
  scope: 'site' | 'url',
  skills: string[],            // skill IDs — one SSE stream per skill
  dataSources: {
    crawl: boolean,
    gsc: boolean,
    psi: boolean,
    crux: boolean
  }
}

// SSE event stream
data: { type: 'skill_start', skillId, skillName }
data: { type: 'delta', skillId, text }
data: { type: 'skill_done', skillId, id }  // id = cached ai_suggestions row id
data: { type: 'error', skillId, message }
data: [DONE]
```

**Cache fast-path:** Before streaming each skill, check `ai_suggestions` for matching `(site_id, analysis_url, skill_id, data_sources_hash)` with `check_type = 'ai_check'`. If found, emit the cached text as a single `delta` event followed immediately by `skill_done`.

**Multi-skill handling:** Skills run **sequentially** (not parallel) to avoid overwhelming the Anthropic API rate limit. Each skill emits its own `skill_start` / `delta` / `skill_done` event sequence.

#### `POST /api/ai/skills` — admin only
Create custom skill. Body: `{ name, description, systemPrompt, defaultDataSources }`. Creates `backend/skills/[uuid]/skill.json`.

#### `PUT /api/ai/skills/:id` — admin only
Update skill name, description, systemPrompt, or defaultDataSources. Works for both built-in (prompt override) and custom skills.

#### `DELETE /api/ai/skills/:id` — admin only
Delete custom skill directory. Returns `400` if `builtIn: true`.

#### `POST /api/ai/skills/:id/references` — admin only
Upload reference doc. Accepts `multipart/form-data` with a single `.md` file. Saved to `backend/skills/[id]/references/[original_filename].md`. Max file size: 500KB.

#### `DELETE /api/ai/skills/:id/references/:filename` — admin only
Delete reference doc file.

---

### 18.9 Frontend — AI Checks Page

**Route:** `/sites/:siteId/ai-checks`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  AI Checks                                          │
│  [Site name] · Last crawl: 2 days ago               │
├─────────────────────────────────────────────────────┤
│  Scope:  ● Site-level  ○ URL-level                  │
│  URL:    [https://example.com/page _____________]   │
│          (editable only when URL-level selected)    │
├─────────────────────────────────────────────────────┤
│  Select skills                                      │
│  ☑ Technical Health     ☑ Content Quality           │
│  ☑ Core Web Vitals      ☐ Schema Coverage           │
│  ☐ Programmatic SEO     ☐ Competitive Gap           │
│  ── Custom skills ──────────────────────────────── │
│  ☐ [custom skill name]                              │
├─────────────────────────────────────────────────────┤
│  Data sources                              (shown   │
│  ✅ Crawl data          (required)          after   │
│  ✅ GSC data            ⚠ Connected         skill   │
│  ☐ PSI metrics         ⚠ Key not configured select) │
│  ☐ CrUX field data     ⚠ Key not configured         │
├─────────────────────────────────────────────────────┤
│  [Run Analysis]  (disabled if no skill selected     │
│                   or no crawl data available)       │
└─────────────────────────────────────────────────────┤
│  Results                                            │
│  ┌─ Technical Health ─────────────────── ▼ ───────┐ │
│  │ [streamed narrative text...]                   │ │
│  │ Cached · 2 hours ago · [Re-run]                │ │
│  └────────────────────────────────────────────────┘ │
│  ┌─ Content Quality ──────────────────── ▼ ───────┐ │
│  │ [streaming...]                                  │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**State behaviour:**
- Cached results load immediately on page mount (GET results from `ai_suggestions` for this site)
- "Re-run" clears cache for that skill and streams fresh result
- If skill stream errors, show error state in that skill's card only — other skills continue
- Results persist across page navigations (stored in DB, fetched on mount)

---

### 18.10 Admin UI — Skills Management

**Route:** `/admin/skills` (admin-only, behind `requireRole('admin', 'superadmin')`)

**Features:**
- List built-in and custom skills
- Edit system prompt for any skill (built-in or custom)
- Create new custom skill
- Delete custom skill
- Per-skill reference docs management: upload `.md`, preview, delete
- Per-skill default data sources toggle

---

### 18.11 New npm Dependency

| Package | Purpose | Where |
|---|---|---|
| `multer` | Multipart file upload for reference doc upload route | backend |

Add to `backend/package.json` (or root `package.json` depending on project structure — check where `express` is declared).

---

### 18.12 What Is Not Built in v1

- External URL fetching / live competitor page scraping — deferred to v2
- Auto-run after crawl — on demand only
- Bulk pre-generation across all URLs
- Per-skill cost tracking (total AI spend per skill) — future enhancement
- Reference doc versioning / history
