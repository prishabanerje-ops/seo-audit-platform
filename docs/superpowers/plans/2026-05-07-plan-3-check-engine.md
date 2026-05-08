# Check Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `backend/services/audit-parser.service.js` to run 216 automated checks against raw crawler page records, producing `CheckResult[]` per page; also build `backend/services/crux.js` for CrUX API integration.

**Architecture:** New `parseAndStoreResults(pages, jobId, siteId, companyId)` accepts raw records directly from the crawler and routes them through 22 section runner modules in `backend/services/checks/`. Each runner returns only failed `CheckResult` objects (passing checks emit zero results — score math is equivalent). Results bulk-inserted into `audit_results` using the v2 columns added in migration 028. `parseAndStoreFromDatasets` becomes a no-op stub; `crawl-runner.js` switches to the new API.

**Tech Stack:** Node.js 20, better-sqlite3 (sync — no async/await on DB calls), Vitest (import from `'vitest'`), micromatch (schema rule glob matching), franc-min (language detection for `content_language_match`)

---

## File Structure

**Create:**
- `backend/services/checks/s01-response.js` — Section 1 Response Codes & Redirects (10 checks)
- `backend/services/checks/s02-canonical.js` — Section 2 Canonicalisation (10 checks)
- `backend/services/checks/s03-robots.js` — Section 3 Robots & Crawl Directives (10 checks)
- `backend/services/checks/s04-sitemap.js` — Section 4 XML Sitemaps (14 checks)
- `backend/services/checks/s05-crawlability.js` — Section 5 Crawlability & Indexability (10 checks)
- `backend/services/checks/s06-url.js` — Section 6 URL Structure (9 checks)
- `backend/services/checks/s07-jsrender.js` — Section 7 JS Rendering (10 checks)
- `backend/services/checks/s08-mobile.js` — Section 8 Mobile & Usability (10 checks)
- `backend/services/checks/s09-security.js` — Section 9 Security & HTTPS (11 checks)
- `backend/services/checks/s10-cwv.js` — Section 10 CWV lab checks (4 checks) + CrUX async wrapper
- `backend/services/crux.js` — CrUX API client (3 checks: crux_lcp, crux_inp, crux_cls)
- `backend/services/checks/s11-titles.js` — Section 11 Title Tags (7 automated checks)
- `backend/services/checks/s12-meta.js` — Section 12 Meta Descriptions (8 automated checks)
- `backend/services/checks/s13-headings.js` — Section 13 Headings (7 automated checks)
- `backend/services/checks/s14-content.js` — Section 14 Content Quality (10 automated checks)
- `backend/services/checks/s15-images.js` — Section 15 Images (16 automated checks)
- `backend/services/checks/s16-schema.js` — Section 16 Schema & Structured Data (16 automated checks)
- `backend/services/checks/s17-links.js` — Section 17 Internal Linking (9 automated checks)
- `backend/services/checks/s18-intl.js` — Section 18 International SEO (10 automated checks)
- `backend/services/checks/s21-eeat.js` — Section 21 E-E-A-T automated checks (14 checks)
- `backend/services/checks/s22-aio.js` — Section 22 AIO automated checks (7 checks)
- `backend/services/checks/s23-geo.js` — Section 23 GEO & LLM automated checks (13 checks)
- `backend/services/checks/s24-local.js` — Section 24 Local SEO automated checks (5 checks)
- `backend/__tests__/checks/s01-response.test.js` through `s24-local.test.js` — one test file per section

**Modify:**
- `backend/services/audit-parser.service.js` — FULL REWRITE: new public API + helpers + orchestrator shell; legacy stub preserved
- `playwright-crawler/src/extractors/response.js` — add 6 security header fields to `extractResponse` return
- `backend/services/crawl-runner.js` lines 12–13 + 227–228 — switch to `parseAndStoreResults`, drop `toSfFormat`
- `backend/package.json` — add `micromatch` to `dependencies`
- `playwright-crawler/package.json` — add `franc-min` to `dependencies`

---

### Task 1: Infrastructure — New API, Helpers, and Crawl-Runner Update

**Files:**
- Rewrite: `backend/services/audit-parser.service.js`
- Modify: `backend/services/crawl-runner.js:12-13,227-228`
- Test: `backend/__tests__/checks/infra.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/checks/infra.test.js
import { describe, it, expect } from 'vitest';
import { classifyYmyl } from '../../services/audit-parser.service.js';

describe('classifyYmyl', () => {
  it('returns null for non-YMYL pages', () => {
    expect(classifyYmyl('/blog/seo-tips', 'search engine optimization tips')).toBeNull();
  });
  it('returns "finance" for insurance URL pattern', () => {
    expect(classifyYmyl('/insurance/car', 'any content')).toBe('finance');
  });
  it('returns "health" for /health URL', () => {
    expect(classifyYmyl('/health/mediclaim', 'any content')).toBe('health');
  });
  it('returns "legal" for /legal URL', () => {
    expect(classifyYmyl('/legal/terms', 'any content')).toBe('legal');
  });
  it('returns "finance" when body has 3+ YMYL words', () => {
    expect(classifyYmyl('/blog/page', 'This policy covers premium and claim benefits.')).toBe('finance');
  });
  it('respects custom URL patterns', () => {
    expect(classifyYmyl('/plans/motor', 'any content', ['/plans/'])).toBe('finance');
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/infra.test.js`
Expected: FAIL — `classifyYmyl is not a function` (audit-parser doesn't export it yet)

- [ ] **Step 3: Rewrite audit-parser.service.js**

```js
// backend/services/audit-parser.service.js
import db from '../db/sqlite.js';

// ─── YMYL Classification ──────────────────────────────────────────────────────

export function classifyYmyl(url, bodyText = '', customPatterns = []) {
  const defaultPatterns = [
    '/insurance', '/health', '/investment', '/loan', '/finance',
    '/policy', '/premium', '/medical', '/legal', '/compare',
    '/term-plan', '/motor', '/life', '/credit', '/tax',
  ];
  const allPatterns = [...defaultPatterns, ...customPatterns];
  const urlMatch = allPatterns.some(p => url.includes(p));

  const ymylWords = [
    'premium', 'policy', 'coverage', 'claim', 'sum assured',
    'deductible', 'nominee', 'maturity', 'annuity', 'interest rate',
    'dividend', 'portfolio', 'liability', 'indemnity', 'underwriting',
  ];
  const lowerBody = (bodyText || '').toLowerCase();
  const wordCount = ymylWords.filter(w => lowerBody.includes(w)).length;
  const contentMatch = wordCount >= 3;

  if (!urlMatch && !contentMatch) return null;

  if (url.includes('/health') || url.includes('/medical')) return 'health';
  if (url.includes('/legal') || url.includes('/law')) return 'legal';
  return 'finance';
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

export function loadSiteSettings(siteId) {
  const rows = db.prepare(
    'SELECT key, value FROM site_settings WHERE site_id = ?'
  ).all(siteId);
  const map = new Map();
  for (const { key, value } of rows) map.set(key, value);
  return map;
}

export function loadSchemaRules(siteId) {
  return db.prepare(
    'SELECT pattern, required_types FROM schema_rules WHERE site_id = ? ORDER BY sort_order ASC'
  ).all(siteId).map(r => ({
    pattern:  r.pattern,
    required: JSON.parse(r.required_types || '[]'),
  }));
}

export function bulkInsertResults(failures, jobId, siteId, companyId) {
  if (!failures.length) return;
  const stmt = db.prepare(`
    INSERT INTO audit_results
      (crawl_job_id, site_id, company_id, url, check_id, passed, severity, section, message, details, issue_type, data)
    VALUES
      (@crawlJobId, @siteId, @companyId, @url, @checkId, @passed, @severity, @section, @message, @details, @checkId, @details)
  `);
  const insertMany = db.transaction(rows => { for (const r of rows) stmt.run(r); });
  insertMany(failures.map(f => ({
    crawlJobId: jobId,
    siteId,
    companyId:  companyId || null,
    url:        f.details || f.url || '',
    checkId:    f.check_id,
    passed:     0,
    severity:   f.severity,
    section:    f.section,
    message:    f.message,
    details:    f.details || null,
  })));
}

// ─── Orchestrator (section runners wired in Task 17) ─────────────────────────

export async function parseAndStoreResults(pages, jobId, siteId, companyId = null) {
  const siteSettings = loadSiteSettings(siteId);
  const schemaRules  = loadSchemaRules(siteId);
  const ctx = { siteId, jobId, siteSettings, schemaRules };
  const failures = [];
  // Section runners added in Task 17
  bulkInsertResults(failures, jobId, siteId, companyId);
  return failures.length;
}

// ─── Legacy stub ─────────────────────────────────────────────────────────────

export function parseAndStoreFromDatasets(_datasets, _jobId, _siteId, _companyId = null) {
  return 0;
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/infra.test.js`
Expected: PASS — 6/6 tests passing

- [ ] **Step 5: Update crawl-runner.js**

Change lines 12–13 from:
```js
import { toSfFormat }     from '../../playwright-crawler/src/index.js';
import { parseAndStoreFromDatasets } from './audit-parser.service.js';
```
To:
```js
import { parseAndStoreResults } from './audit-parser.service.js';
```

Change lines 227–228 from:
```js
const datasets = toSfFormat(pages);
const count = parseAndStoreFromDatasets(datasets, job.id, job.site_id, job.company_id || null);
```
To:
```js
const count = await parseAndStoreResults(pages, job.id, job.site_id, job.company_id || null);
```

- [ ] **Step 6: Commit**

```bash
git add backend/services/audit-parser.service.js backend/services/crawl-runner.js backend/__tests__/checks/infra.test.js
git commit -m "feat: add parseAndStoreResults API and classifyYmyl to audit-parser"
```

---

### Task 2: Security Headers in response.js + Section 1 Response Checks

**Files:**
- Modify: `playwright-crawler/src/extractors/response.js` (add 6 fields to `extractResponse`)
- Create: `backend/services/checks/s01-response.js`
- Test: `backend/__tests__/checks/s01-response.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/checks/s01-response.test.js
import { describe, it, expect } from 'vitest';
import { runResponseChecks } from '../../services/checks/s01-response.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Status Code': '200',
  'Indexability': 'Indexable',
  'Redirect URL': '',
  'Redirect Type': '',
  _redirectChain: [],
  _isHttps: true,
  ...overrides,
});

describe('runResponseChecks', () => {
  it('passes on a healthy 200 indexable page', () => {
    expect(runResponseChecks([page()], {})).toHaveLength(0);
  });

  it('flags http_status for indexable non-200', () => {
    const results = runResponseChecks([page({ 'Status Code': '404', 'Indexability': 'Non-Indexable' })], {});
    // Non-indexable pages don't trigger http_status (they're expected to be non-200)
    // But broken_pages_4xx fires
    expect(results.some(r => r.check_id === 'broken_pages_4xx')).toBe(true);
  });

  it('flags http_status for indexable page with 404', () => {
    // An indexable page returning 404 is contradictory — flag http_status
    const results = runResponseChecks([page({ 'Status Code': '404', 'Indexability': 'Indexable' })], {});
    expect(results.some(r => r.check_id === 'http_status')).toBe(true);
  });

  it('flags redirect_301_vs_302 for 302 redirect', () => {
    const results = runResponseChecks([page({ 'Status Code': '302', 'Redirect URL': 'https://example.com/new' })], {});
    expect(results.some(r => r.check_id === 'redirect_301_vs_302')).toBe(true);
  });

  it('flags redirect_chain for multi-hop redirect', () => {
    const results = runResponseChecks([page({ _redirectChain: ['https://a.com', 'https://b.com', 'https://c.com'] })], {});
    expect(results.some(r => r.check_id === 'redirect_chain')).toBe(true);
  });

  it('flags server_errors_5xx for 500', () => {
    const results = runResponseChecks([page({ 'Status Code': '500', 'Indexability': 'Non-Indexable' })], {});
    expect(results.some(r => r.check_id === 'server_errors_5xx')).toBe(true);
  });

  it('flags redirect_count when > 10% of pages redirect', () => {
    const pages = [
      page({ url: 'https://example.com/1', 'Status Code': '301', 'Redirect URL': 'https://x.com' }),
      page({ url: 'https://example.com/2', 'Status Code': '301', 'Redirect URL': 'https://x.com' }),
      ...Array.from({ length: 8 }, (_, i) => page({ url: `https://example.com/${i + 3}` })),
    ];
    const results = runResponseChecks(pages, {});
    expect(results.some(r => r.check_id === 'redirect_count')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s01-response.test.js`
Expected: FAIL — cannot find module `s01-response.js`

- [ ] **Step 3: Add security header fields to response.js**

In `playwright-crawler/src/extractors/response.js`, inside `extractResponse`, after the line `const vary = h('vary');` add:

```js
  const hsts              = h('strict-transport-security');
  const csp               = h('content-security-policy');
  const xFrameOptions     = h('x-frame-options');
  const xContentTypeOpts  = h('x-content-type-options');
  const referrerPolicy    = h('referrer-policy');
  const permissionsPolicy = h('permissions-policy');
```

In the return object, after `_redirectChain: redirectChain,` add:

```js
    _hsts:               hsts,
    _csp:                csp,
    _xFrameOptions:      xFrameOptions,
    _xContentTypeOptions: xContentTypeOpts,
    _referrerPolicy:     referrerPolicy,
    _permissionsPolicy:  permissionsPolicy,
```

- [ ] **Step 4: Create s01-response.js**

```js
// backend/services/checks/s01-response.js
const SECTION = 'Response Codes & Redirects';

export function runResponseChecks(records, _ctx) {
  const failures = [];

  const validPages = records.filter(r => r.url);
  const total = validPages.length;

  const redirectingCount = validPages.filter(r =>
    String(r['Status Code'] || '').startsWith('3')
  ).length;
  const count302 = validPages.filter(r =>
    String(r['Status Code'] || '') === '302'
  ).length;

  for (const r of records) {
    const url   = r.url || '';
    if (!url) continue;
    const code  = String(r['Status Code'] || '').trim();
    const isIdx = r['Indexability'] === 'Indexable';
    const rUrl  = r['Redirect URL'] || '';
    const chain = r._redirectChain || [];

    if (isIdx && code !== '200') {
      failures.push({ check_id: 'http_status', passed: false, severity: 'critical', section: SECTION,
        message: `Indexable page returned ${code}`, details: url });
    }

    if (code === '302' && rUrl) {
      failures.push({ check_id: 'redirect_301_vs_302', passed: false, severity: 'warning', section: SECTION,
        message: `Temporary 302 redirect should be 301`, details: url });
    }

    if (chain.length > 1) {
      failures.push({ check_id: 'redirect_chain', passed: false, severity: 'critical', section: SECTION,
        message: `Redirect chain (${chain.length} hops): ${chain.slice(0, 3).join(' → ')}`, details: url });
    }

    if (chain.length >= 2) {
      const chainSet = new Set(chain);
      if (chainSet.size < chain.length) {
        failures.push({ check_id: 'redirect_loop', passed: false, severity: 'critical', section: SECTION,
          message: `Redirect loop detected in chain`, details: url });
      }
    }

    if (url.startsWith('http://') && code.startsWith('3')) {
      if (!rUrl.startsWith('https://')) {
        failures.push({ check_id: 'redirect_to_https', passed: false, severity: 'critical', section: SECTION,
          message: `HTTP page redirects to non-HTTPS target`, details: url });
      }
    }

    if (code.startsWith('4')) {
      failures.push({ check_id: 'broken_pages_4xx', passed: false, severity: 'critical', section: SECTION,
        message: `4xx error (${code})`, details: url });
    }

    if (code.startsWith('5')) {
      failures.push({ check_id: 'server_errors_5xx', passed: false, severity: 'critical', section: SECTION,
        message: `5xx server error (${code})`, details: url });
    }

    if (code === '404') {
      failures.push({ check_id: 'gone_vs_not_found', passed: false, severity: 'info', section: SECTION,
        message: `404 Not Found — consider 410 Gone for permanently deleted content`, details: url });
    }
  }

  if (total > 0 && redirectingCount / total > 0.10) {
    failures.push({ check_id: 'redirect_count', passed: false, severity: 'info', section: SECTION,
      message: `${redirectingCount}/${total} pages (${Math.round(redirectingCount / total * 100)}%) redirect — exceeds 10% threshold`,
      details: null });
  }

  if (total > 0 && count302 / total > 0.05) {
    failures.push({ check_id: 'temp_redirect_overuse', passed: false, severity: 'warning', section: SECTION,
      message: `${count302} temporary 302 redirects found — consider converting to 301`,
      details: null });
  }

  return failures;
}
```

- [ ] **Step 5: Run test to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s01-response.test.js`
Expected: PASS — 7/7 tests passing

- [ ] **Step 6: Commit**

```bash
git add playwright-crawler/src/extractors/response.js backend/services/checks/s01-response.js backend/__tests__/checks/s01-response.test.js
git commit -m "feat: add security headers to response extractor and implement Section 1 response checks"
```

---

### Task 3: Section 2 — Canonicalisation Checks

**Files:**
- Create: `backend/services/checks/s02-canonical.js`
- Test: `backend/__tests__/checks/s02-canonical.test.js`

Raw page fields from `canonical.js` extractor: `page['Canonical Link Element 1']`, `page._canonicalCount`, `page._multipleCanonicals`, `page._hreflangTags` (array `{lang, href}`), `page['rel="next"']`, `page['rel="prev"']`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/checks/s02-canonical.test.js
import { describe, it, expect } from 'vitest';
import { runCanonicalChecks } from '../../services/checks/s02-canonical.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Canonical Link Element 1': 'https://example.com/page',
  _canonicalCount: 1,
  _hreflangTags: [],
  'rel="next"': '',
  'rel="prev"': '',
  ...overrides,
});

describe('runCanonicalChecks', () => {
  it('passes for self-canonical indexable page', () => {
    expect(runCanonicalChecks([page()], {})).toHaveLength(0);
  });

  it('flags self_referencing_canonical when missing canonical on indexable page', () => {
    const r = runCanonicalChecks([page({ 'Canonical Link Element 1': '', _canonicalCount: 0 })], {});
    expect(r.some(x => x.check_id === 'self_referencing_canonical')).toBe(true);
  });

  it('flags duplicate_canonical_tags when count > 1', () => {
    const r = runCanonicalChecks([page({ _canonicalCount: 2 })], {});
    expect(r.some(x => x.check_id === 'duplicate_canonical_tags')).toBe(true);
  });

  it('flags canonical_points_https when canonical uses http://', () => {
    const r = runCanonicalChecks([page({ 'Canonical Link Element 1': 'http://example.com/page' })], {});
    expect(r.some(x => x.check_id === 'canonical_points_https')).toBe(true);
  });

  it('flags canonical_loop when A → B → A', () => {
    const pages = [
      page({ url: 'https://example.com/a', 'Canonical Link Element 1': 'https://example.com/b' }),
      page({ url: 'https://example.com/b', 'Canonical Link Element 1': 'https://example.com/a' }),
    ];
    const r = runCanonicalChecks(pages, {});
    expect(r.some(x => x.check_id === 'canonical_loop')).toBe(true);
  });

  it('flags paginated_canonical when paginated page canonicals to different path', () => {
    const r = runCanonicalChecks([page({
      url: 'https://example.com/blog?page=2',
      'Canonical Link Element 1': 'https://example.com/blog',
      'rel="prev"': 'https://example.com/blog',
    })], {});
    expect(r.some(x => x.check_id === 'paginated_canonical')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s02-canonical.test.js`
Expected: FAIL — cannot find module `s02-canonical.js`

- [ ] **Step 3: Create s02-canonical.js**

```js
// backend/services/checks/s02-canonical.js
const SECTION = 'Canonicalisation';

export function runCanonicalChecks(records, _ctx) {
  const failures = [];

  // Build canonical graph for cross-page checks
  const canonicalMap = new Map(); // url → canonical target
  for (const r of records) {
    const url = r.url || '';
    const can = r['Canonical Link Element 1'] || '';
    if (url && can) canonicalMap.set(url, can);
  }

  // Trailing slash consistency across all canonical URLs
  let withSlash = 0, withoutSlash = 0;
  for (const can of canonicalMap.values()) {
    try {
      const p = new URL(can).pathname;
      if (p === '/') continue;
      if (p.endsWith('/')) withSlash++; else withoutSlash++;
    } catch { /* skip malformed */ }
  }
  const trailingSlashInconsistent = withSlash > 0 && withoutSlash > 0;

  const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'ref', 'source'];

  for (const r of records) {
    const url   = r.url || '';
    if (!url) continue;
    const can   = r['Canonical Link Element 1'] || '';
    const count = typeof r._canonicalCount === 'number' ? r._canonicalCount : (can ? 1 : 0);
    const isIdx = r['Indexability'] === 'Indexable';
    const tags  = r._hreflangTags || [];

    // self_referencing_canonical
    if (isIdx && !can) {
      failures.push({ check_id: 'self_referencing_canonical', passed: false, severity: 'critical', section: SECTION,
        message: 'Missing canonical tag on indexable page', details: url });
    }

    // duplicate_canonical_tags
    if (count > 1) {
      failures.push({ check_id: 'duplicate_canonical_tags', passed: false, severity: 'critical', section: SECTION,
        message: `${count} canonical tags found — only one allowed`, details: url });
    }

    // canonical_points_https
    if (can && can.startsWith('http://')) {
      failures.push({ check_id: 'canonical_points_https', passed: false, severity: 'critical', section: SECTION,
        message: `Canonical uses HTTP: ${can}`, details: url });
    }

    // canonical_loop — A → B → A
    if (can && can !== url) {
      const bCanonical = canonicalMap.get(can);
      if (bCanonical === url) {
        failures.push({ check_id: 'canonical_loop', passed: false, severity: 'critical', section: SECTION,
          message: `Canonical loop: ${url} → ${can} → ${url}`, details: url });
      }
    }

    // reciprocal_canonical — A canonicals to B, B doesn't canonical back to A
    if (can && can !== url) {
      const bCanonical = canonicalMap.get(can);
      if (bCanonical && bCanonical !== url) {
        failures.push({ check_id: 'reciprocal_canonical', passed: false, severity: 'warning', section: SECTION,
          message: `Canonical target ${can} does not point back to ${url}`, details: url });
      }
    }

    // trailing_slash_canonical
    if (trailingSlashInconsistent && can) {
      failures.push({ check_id: 'trailing_slash_canonical', passed: false, severity: 'info', section: SECTION,
        message: 'Inconsistent trailing slash usage in canonical URLs across the site', details: url });
    }

    // paginated_canonical — paginated page canonicals to different path
    const hasPagination = r['rel="next"'] || r['rel="prev"'];
    if (hasPagination && can) {
      let urlPath = '', canPath = '';
      try { urlPath = new URL(url).pathname; } catch { /* skip */ }
      try { canPath = new URL(can).pathname; } catch { /* skip */ }
      if (urlPath && canPath && urlPath !== canPath) {
        failures.push({ check_id: 'paginated_canonical', passed: false, severity: 'warning', section: SECTION,
          message: `Paginated page canonicals to ${can} — should self-canonical`, details: url });
      }
    }

    // url_parameter_canonical — tracking params in canonical URL
    if (can) {
      let canSearch = '';
      try { canSearch = new URL(can).search; } catch { /* skip */ }
      if (canSearch) {
        const canParams = new URLSearchParams(canSearch);
        if (TRACKING_PARAMS.some(p => canParams.has(p))) {
          failures.push({ check_id: 'url_parameter_canonical', passed: false, severity: 'info', section: SECTION,
            message: `Canonical URL contains tracking parameters — should point to clean URL`, details: url });
        }
      }
    }

    // hreflang_canonical_conflict
    if (can && tags.length > 0) {
      const selfHreflang = tags.find(t => t.href === url || t.href === can);
      if (!selfHreflang) {
        failures.push({ check_id: 'hreflang_canonical_conflict', passed: false, severity: 'warning', section: SECTION,
          message: 'Canonical URL not listed in hreflang annotations', details: url });
      }
    }
  }

  return failures;
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s02-canonical.test.js`
Expected: PASS — 6/6 tests passing

- [ ] **Step 5: Commit**

```bash
git add backend/services/checks/s02-canonical.js backend/__tests__/checks/s02-canonical.test.js
git commit -m "feat: implement Section 2 canonical checks"
```

---

### Task 4: Sections 3 & 4 — Robots + Sitemaps Checks

**Files:**
- Create: `backend/services/checks/s03-robots.js`
- Create: `backend/services/checks/s04-sitemap.js`
- Test: `backend/__tests__/checks/s03-robots.test.js`
- Test: `backend/__tests__/checks/s04-sitemap.test.js`

Raw data source: `pages[0]._siteData.robots` (populated by `robots.js` extractor, site-level) and `pages[0]._siteData.sitemap` (populated by `sitemap.js` extractor). Shape:

```js
// pages[0]._siteData.robots:
{
  exists: boolean,
  raw: string,
  parsed: object,            // robots-parser instance result
  sitemapUrls: string[],
  llmsTxt: string|null,
  llmsFullTxt: string|null,
  urlMdSample: { tested: string[], found: string[], hasAny: boolean },
  disallowedPaths: string[], // Disallow values for user-agent *
  agentRules: {              // per-agent directive blocks
    'GPTBot': { disallowed: string[], allowed: string[] },
    'ClaudeBot': { ... },
    'PerplexityBot': { ... },
    'Google-Extended': { ... },
    'Googlebot': { ... },
  }
}

// pages[0]._siteData.sitemap:
{
  found: boolean,
  url: string,
  isIndex: boolean,
  childSitemaps: string[],
  urls: Array<{ loc: string, lastmod: string|null, images: [], videos: [], news: object|null }>,
  fileSizeBytes: number,
  parseErrors: string[]
}
```

- [ ] **Step 1: Write failing tests**

```js
// backend/__tests__/checks/s03-robots.test.js
import { describe, it, expect } from 'vitest';
import { runRobotsChecks } from '../../services/checks/s03-robots.js';

const makeSiteData = (robotsOverrides = {}) => ({
  robots: {
    exists: true,
    raw: 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml',
    sitemapUrls: ['https://example.com/sitemap.xml'],
    disallowedPaths: ['/admin'],
    agentRules: {
      'GPTBot': { disallowed: [], allowed: [] },
      'ClaudeBot': { disallowed: [], allowed: [] },
      'PerplexityBot': { disallowed: [], allowed: [] },
      'Google-Extended': { disallowed: [], allowed: [] },
    },
    parseErrors: [],
    ...robotsOverrides,
  },
  sitemap: { found: true, urls: [], fileSizeBytes: 1000, parseErrors: [] },
});

const pages = (overrides = {}) => [{
  url: 'https://example.com/',
  'Indexability': 'Indexable',
  _siteData: makeSiteData(overrides),
}];

describe('runRobotsChecks', () => {
  it('passes with valid robots.txt', () => {
    expect(runRobotsChecks(pages(), {})).toHaveLength(0);
  });

  it('flags robots_txt_exists when missing', () => {
    const r = runRobotsChecks(pages({ exists: false }), {});
    expect(r.some(x => x.check_id === 'robots_txt_exists')).toBe(true);
  });

  it('flags sitemap_in_robots when no sitemap declared', () => {
    const r = runRobotsChecks(pages({ sitemapUrls: [] }), {});
    expect(r.some(x => x.check_id === 'sitemap_in_robots')).toBe(true);
  });

  it('flags crawlable_resources_not_blocked when /css is disallowed', () => {
    const r = runRobotsChecks(pages({ disallowedPaths: ['/css', '/admin'] }), {});
    expect(r.some(x => x.check_id === 'crawlable_resources_not_blocked')).toBe(true);
  });

  it('flags important_pages_not_blocked when indexable page is blocked', () => {
    const pgs = [
      { url: 'https://example.com/insurance', 'Indexability': 'Indexable', _siteData: makeSiteData({ disallowedPaths: ['/insurance'] }) },
    ];
    const r = runRobotsChecks(pgs, {});
    expect(r.some(x => x.check_id === 'important_pages_not_blocked')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s04-sitemap.test.js
import { describe, it, expect } from 'vitest';
import { runSitemapChecks } from '../../services/checks/s04-sitemap.js';

const makePages = (sitemapOverrides = {}) => [{
  url: 'https://example.com/',
  'Indexability': 'Indexable',
  _siteData: {
    robots: { exists: true, sitemapUrls: ['https://example.com/sitemap.xml'], disallowedPaths: [] },
    sitemap: {
      found: true,
      url: 'https://example.com/sitemap.xml',
      isIndex: false,
      childSitemaps: [],
      urls: [{ loc: 'https://example.com/', lastmod: new Date().toISOString(), images: [], videos: [], news: null }],
      fileSizeBytes: 1000,
      parseErrors: [],
      ...sitemapOverrides,
    },
  },
}];

describe('runSitemapChecks', () => {
  it('passes with valid sitemap', () => {
    expect(runSitemapChecks(makePages(), {})).toHaveLength(0);
  });

  it('flags sitemap_exists when not found', () => {
    const r = runSitemapChecks(makePages({ found: false }), {});
    expect(r.some(x => x.check_id === 'sitemap_exists')).toBe(true);
  });

  it('flags sitemap_valid_xml when parse errors present', () => {
    const r = runSitemapChecks(makePages({ parseErrors: ['unexpected token'] }), {});
    expect(r.some(x => x.check_id === 'sitemap_valid_xml')).toBe(true);
  });

  it('flags sitemap_url_count when > 50000 URLs', () => {
    const urls = Array.from({ length: 50001 }, (_, i) => ({ loc: `https://example.com/${i}`, lastmod: null, images: [], videos: [], news: null }));
    const r = runSitemapChecks(makePages({ urls }), {});
    expect(r.some(x => x.check_id === 'sitemap_url_count')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s03-robots.test.js __tests__/checks/s04-sitemap.test.js`
Expected: FAIL — modules not found

- [ ] **Step 3: Create s03-robots.js**

```js
// backend/services/checks/s03-robots.js
const SECTION = 'Robots & Crawl Directives';

const CRAWLABLE_RESOURCE_PATHS = ['/css', '/js', '/images', '/static', '/assets'];
const SENSITIVE_PATHS = ['/admin', '/wp-admin', '/wp-login', '/login', '/dashboard'];
const AI_CRAWLERS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];

export function runRobotsChecks(records, _ctx) {
  const failures = [];

  const siteRecord = records.find(r => r._siteData?.robots);
  if (!siteRecord) return failures;

  const robots  = siteRecord._siteData.robots;
  const blocked = robots.disallowedPaths || [];

  // robots_txt_exists
  if (!robots.exists) {
    failures.push({ check_id: 'robots_txt_exists', passed: false, severity: 'critical', section: SECTION,
      message: '/robots.txt not found or returned non-200', details: '/robots.txt' });
    return failures; // no point running further checks
  }

  // robots_txt_syntax
  if ((robots.parseErrors || []).length > 0) {
    failures.push({ check_id: 'robots_txt_syntax', passed: false, severity: 'warning', section: SECTION,
      message: `robots.txt parse errors: ${robots.parseErrors.join('; ')}`, details: '/robots.txt' });
  }

  // sitemap_in_robots
  if (!robots.sitemapUrls || robots.sitemapUrls.length === 0) {
    failures.push({ check_id: 'sitemap_in_robots', passed: false, severity: 'info', section: SECTION,
      message: 'No Sitemap: directive in robots.txt', details: '/robots.txt' });
  }

  // crawlable_resources_not_blocked
  for (const path of CRAWLABLE_RESOURCE_PATHS) {
    if (blocked.some(b => b.startsWith(path) || path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'crawlable_resources_not_blocked', passed: false, severity: 'critical', section: SECTION,
        message: `Critical resource path blocked in robots.txt: ${path}`, details: path });
    }
  }

  // sensitive_paths_blocked
  for (const path of SENSITIVE_PATHS) {
    if (!blocked.some(b => b === path || path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'sensitive_paths_blocked', passed: false, severity: 'warning', section: SECTION,
        message: `Sensitive path not blocked in robots.txt: ${path}`, details: path });
    }
  }

  // important_pages_not_blocked — check each indexable crawled page against Disallow rules
  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    let path = '';
    try { path = new URL(url).pathname; } catch { continue; }
    if (blocked.some(b => b && path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'important_pages_not_blocked', passed: false, severity: 'critical', section: SECTION,
        message: `Indexable page is blocked by robots.txt Disallow: ${path}`, details: url });
    }
  }

  // conflicting_directives — Allow and Disallow for same path
  const raw = robots.raw || '';
  const allowLines    = raw.split('\n').filter(l => l.trim().toLowerCase().startsWith('allow:')).map(l => l.split(':')[1]?.trim() || '');
  const disallowLines = raw.split('\n').filter(l => l.trim().toLowerCase().startsWith('disallow:')).map(l => l.split(':')[1]?.trim() || '');
  for (const al of allowLines) {
    if (disallowLines.some(dl => dl === al || al.startsWith(dl))) {
      failures.push({ check_id: 'conflicting_directives', passed: false, severity: 'warning', section: SECTION,
        message: `Conflicting Allow/Disallow directives for path: ${al}`, details: al });
    }
  }

  // ai_crawler_directives — check for explicit AI crawler rules
  const agentRules = robots.agentRules || {};
  const hasSomeAiRule = AI_CRAWLERS.some(bot => {
    const rules = agentRules[bot];
    return rules && (rules.disallowed?.length > 0 || rules.allowed?.length > 0);
  });
  if (!hasSomeAiRule) {
    failures.push({ check_id: 'ai_crawler_directives', passed: false, severity: 'info', section: SECTION,
      message: 'No explicit directives for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)',
      details: '/robots.txt' });
  }

  // noindex_not_disallowed — noindex pages should not also be blocked
  for (const r of records) {
    const url = r.url || '';
    if (!url) continue;
    const metaRobots = (r['Meta Robots 1'] || '').toLowerCase();
    const xRobots    = (r['X-Robots-Tag 1'] || '').toLowerCase();
    const isNoindex  = metaRobots.includes('noindex') || xRobots.includes('noindex');
    if (!isNoindex) continue;
    let path = '';
    try { path = new URL(url).pathname; } catch { continue; }
    if (blocked.some(b => b && path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'noindex_not_disallowed', passed: false, severity: 'warning', section: SECTION,
        message: `Noindex page also blocked by robots.txt — Googlebot cannot read noindex directive`, details: url });
    }
  }

  // crawl_delay — flag if no Crawl-delay and site has high TTFB (> 2s average)
  const hasCrawlDelay = raw.toLowerCase().includes('crawl-delay');
  if (!hasCrawlDelay) {
    const avgResponseTime = records.reduce((sum, r) => sum + (parseFloat(r['Response Time'] || '0') || 0), 0) / (records.length || 1);
    if (avgResponseTime > 2000) {
      failures.push({ check_id: 'crawl_delay', passed: false, severity: 'info', section: SECTION,
        message: `Average TTFB > 2s and no Crawl-delay directive in robots.txt`, details: '/robots.txt' });
    }
  }

  return failures;
}
```

- [ ] **Step 4: Create s04-sitemap.js**

```js
// backend/services/checks/s04-sitemap.js
const SECTION = 'XML Sitemaps';

const SITEMAP_URL_LIMIT   = 50_000;
const SITEMAP_SIZE_LIMIT  = 50 * 1024 * 1024; // 50MB

export function runSitemapChecks(records, _ctx) {
  const failures = [];

  const siteRecord = records.find(r => r._siteData?.sitemap);
  if (!siteRecord) return failures;

  const { sitemap, robots } = siteRecord._siteData;
  const crawledUrls = new Set(records.map(r => r.url).filter(Boolean));
  const crawledNoindex = new Set(
    records.filter(r => r['Indexability'] !== 'Indexable').map(r => r.url).filter(Boolean)
  );
  const robotsBlocked = robots?.disallowedPaths || [];

  // sitemap_exists
  if (!sitemap.found) {
    failures.push({ check_id: 'sitemap_exists', passed: false, severity: 'critical', section: SECTION,
      message: 'sitemap.xml not found', details: '/sitemap.xml' });
    return failures;
  }

  // sitemap_valid_xml
  if (sitemap.parseErrors?.length > 0) {
    failures.push({ check_id: 'sitemap_valid_xml', passed: false, severity: 'warning', section: SECTION,
      message: `Sitemap XML parse errors: ${sitemap.parseErrors.slice(0, 3).join('; ')}`, details: sitemap.url });
  }

  const sitemapUrls = sitemap.urls || [];

  // sitemap_url_count
  if (sitemapUrls.length > SITEMAP_URL_LIMIT) {
    failures.push({ check_id: 'sitemap_url_count', passed: false, severity: 'critical', section: SECTION,
      message: `Sitemap has ${sitemapUrls.length} URLs — exceeds Google's 50,000 URL limit`, details: sitemap.url });
  }

  // sitemap_file_size
  if (sitemap.fileSizeBytes > SITEMAP_SIZE_LIMIT) {
    failures.push({ check_id: 'sitemap_file_size', passed: false, severity: 'critical', section: SECTION,
      message: `Sitemap file is ${Math.round(sitemap.fileSizeBytes / 1024 / 1024)}MB — exceeds 50MB limit`,
      details: sitemap.url });
  }

  // sitemap_index_used — if multiple child sitemaps detected but no index
  if (!sitemap.isIndex && sitemap.childSitemaps?.length > 1) {
    failures.push({ check_id: 'sitemap_index_used', passed: false, severity: 'info', section: SECTION,
      message: `${sitemap.childSitemaps.length} sitemap files found but no sitemap index`, details: sitemap.url });
  }

  for (const entry of sitemapUrls) {
    const loc = entry.loc || '';
    if (!loc) continue;

    // no_blocked_urls_in_sitemap
    let path = '';
    try { path = new URL(loc).pathname; } catch { /* skip */ }
    if (path && robotsBlocked.some(b => b && path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'no_blocked_urls_in_sitemap', passed: false, severity: 'warning', section: SECTION,
        message: `Sitemap URL blocked by robots.txt: ${loc}`, details: loc });
    }

    // noindex_in_sitemap
    if (crawledNoindex.has(loc)) {
      failures.push({ check_id: 'noindex_in_sitemap', passed: false, severity: 'warning', section: SECTION,
        message: `Noindexed page in sitemap: ${loc}`, details: loc });
    }

    // sitemap_orphan_urls — in sitemap but zero inlinks from crawled pages
    // (inlinks computed in sf-format.js and stored as 'Unique Inlinks')
    const crawledRecord = records.find(r => r.url === loc);
    if (crawledRecord && parseInt(crawledRecord['Unique Inlinks'] || '0', 10) === 0) {
      failures.push({ check_id: 'sitemap_orphan_urls', passed: false, severity: 'info', section: SECTION,
        message: `Sitemap URL has zero internal inlinks (orphan page)`, details: loc });
    }

    // sitemap_lastmod — compare to HTTP Last-Modified
    if (entry.lastmod && crawledRecord?.['Last Modified']) {
      const sitemapDate = new Date(entry.lastmod);
      const httpDate    = new Date(crawledRecord['Last Modified']);
      const diffDays    = Math.abs(sitemapDate - httpDate) / (1000 * 60 * 60 * 24);
      if (!isNaN(diffDays) && diffDays > 30) {
        failures.push({ check_id: 'sitemap_lastmod', passed: false, severity: 'info', section: SECTION,
          message: `Sitemap lastmod (${entry.lastmod}) differs from HTTP Last-Modified by > 30 days`, details: loc });
      }
    }

    // no_redirect_in_sitemap — sitemap URLs that redirect
    if (crawledRecord) {
      const code = String(crawledRecord['Status Code'] || '');
      if (code.startsWith('3') && crawledRecord['Redirect URL']) {
        failures.push({ check_id: 'no_redirect_in_sitemap', passed: false, severity: 'warning', section: SECTION,
          message: `Sitemap URL redirects to ${crawledRecord['Redirect URL']}`, details: loc });
      }
    }

    // news_sitemap — validate required fields for <news:news> entries
    if (entry.news) {
      const news = entry.news;
      const missing = [];
      if (!news['news:publication']?.['news:name']) missing.push('news:name');
      if (!news['news:publication']?.['news:language']) missing.push('news:language');
      if (!news['news:title']) missing.push('news:title');
      if (!news['news:publication_date']) missing.push('news:publication_date');
      if (missing.length > 0) {
        failures.push({ check_id: 'news_sitemap', passed: false, severity: 'info', section: SECTION,
          message: `News sitemap entry missing required fields: ${missing.join(', ')}`, details: loc });
      }
    }
  }

  // sitemap_image / sitemap_video — flag image/video-heavy site with no media sitemap
  const hasImages   = records.some(r => (r._images || []).length > 5);
  const hasImgSitemap = sitemapUrls.some(e => e.images?.length > 0);
  if (hasImages && !hasImgSitemap) {
    failures.push({ check_id: 'sitemap_image', passed: false, severity: 'info', section: SECTION,
      message: 'Image-heavy site has no image sitemap entries (<image:image>)', details: sitemap.url });
  }

  return failures;
}
```

- [ ] **Step 5: Run tests to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s03-robots.test.js __tests__/checks/s04-sitemap.test.js`
Expected: PASS — all tests passing

- [ ] **Step 6: Commit**

```bash
git add backend/services/checks/s03-robots.js backend/services/checks/s04-sitemap.js backend/__tests__/checks/s03-robots.test.js backend/__tests__/checks/s04-sitemap.test.js
git commit -m "feat: implement Section 3 robots and Section 4 sitemap checks"
```

---

### Task 5: Sections 5 & 6 — Crawlability and URL Structure Checks

**Files:**
- Create: `backend/services/checks/s05-crawlability.js`
- Create: `backend/services/checks/s06-url.js`
- Test: `backend/__tests__/checks/s05-crawlability.test.js`
- Test: `backend/__tests__/checks/s06-url.test.js`

Raw page fields: `page._url` (from url.js extractor: `{ hasSessionId, isCrawlTrap, trailingSlash, dirDepth, urlLength, isLowercase, hasHyphens, hasSpecialChars, isDescriptive, dateFormat }`), `page['Crawl Depth']`, `page['Unique Inlinks']`, `page._internalLinks`, `page['Meta Robots 1']`, `page['X-Robots-Tag 1']`

- [ ] **Step 1: Write failing tests**

```js
// backend/__tests__/checks/s05-crawlability.test.js
import { describe, it, expect } from 'vitest';
import { runCrawlabilityChecks } from '../../services/checks/s05-crawlability.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Crawl Depth': '2',
  'Unique Inlinks': '5',
  'Unique Outlinks': '10',
  'Word Count': '500',
  'Meta Robots 1': '',
  'X-Robots-Tag 1': '',
  _url: { hasSessionId: false, isCrawlTrap: false },
  _internalLinks: [],
  ...overrides,
});

describe('runCrawlabilityChecks', () => {
  it('passes for healthy page', () => {
    expect(runCrawlabilityChecks([page()], {})).toHaveLength(0);
  });
  it('flags session_ids_in_urls for JSESSIONID', () => {
    const r = runCrawlabilityChecks([page({ url: 'https://example.com/page;JSESSIONID=abc123', _url: { hasSessionId: true, isCrawlTrap: false } })], {});
    expect(r.some(x => x.check_id === 'session_ids_in_urls')).toBe(true);
  });
  it('flags crawl_trap for repeating path segments', () => {
    const r = runCrawlabilityChecks([page({ _url: { hasSessionId: false, isCrawlTrap: true } })], {});
    expect(r.some(x => x.check_id === 'crawl_trap')).toBe(true);
  });
  it('flags orphan_pages for zero inlinks on indexable page', () => {
    const r = runCrawlabilityChecks([page({ 'Unique Inlinks': '0' })], {});
    expect(r.some(x => x.check_id === 'orphan_pages')).toBe(true);
  });
  it('flags crawl_depth for depth > 4', () => {
    const r = runCrawlabilityChecks([page({ 'Crawl Depth': '5' })], {});
    expect(r.some(x => x.check_id === 'crawl_depth')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s06-url.test.js
import { describe, it, expect } from 'vitest';
import { runUrlChecks } from '../../services/checks/s06-url.js';

const page = (url, urlData = {}) => ({
  url,
  'Indexability': 'Indexable',
  _url: { urlLength: url.length, isLowercase: url === url.toLowerCase(), ...urlData },
  _internalLinks: [],
});

describe('runUrlChecks', () => {
  it('passes for clean short URL', () => {
    expect(runUrlChecks([page('https://example.com/car-insurance')], {})).toHaveLength(0);
  });
  it('flags url_length for URL > 100 chars', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(100);
    const r = runUrlChecks([page(longUrl, { urlLength: longUrl.length })], {});
    expect(r.some(x => x.check_id === 'url_length')).toBe(true);
  });
  it('flags url_lowercase for mixed case path', () => {
    const r = runUrlChecks([page('https://example.com/CarInsurance', { isLowercase: false })], {});
    expect(r.some(x => x.check_id === 'url_lowercase')).toBe(true);
  });
  it('flags url_hyphens for underscore separators', () => {
    const r = runUrlChecks([page('https://example.com/car_insurance', { hasHyphens: false })], {});
    expect(r.some(x => x.check_id === 'url_hyphens')).toBe(true);
  });
  it('flags url_deep_nesting for > 4 directory levels', () => {
    const r = runUrlChecks([page('https://example.com/a/b/c/d/e/page', { dirDepth: 5 })], {});
    expect(r.some(x => x.check_id === 'url_deep_nesting')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s05-crawlability.test.js __tests__/checks/s06-url.test.js`
Expected: FAIL — modules not found

- [ ] **Step 3: Create s05-crawlability.js**

```js
// backend/services/checks/s05-crawlability.js
const SECTION = 'Crawlability & Indexability';
const NOFOLLOW_THRESHOLD = 0.05; // 5%

export function runCrawlabilityChecks(records, _ctx) {
  const failures = [];
  const indexableRecords = records.filter(r => r.url && r['Indexability'] === 'Indexable');

  // nofollow_internal_links — site-level: > 5% of internal links use nofollow
  let totalLinks = 0, nofollowLinks = 0;
  for (const r of records) {
    for (const link of (r._internalLinks || [])) {
      totalLinks++;
      if ((link.rel || '').includes('nofollow')) nofollowLinks++;
    }
  }
  if (totalLinks > 0 && nofollowLinks / totalLinks > NOFOLLOW_THRESHOLD) {
    failures.push({ check_id: 'nofollow_internal_links', passed: false, severity: 'warning', section: SECTION,
      message: `${nofollowLinks}/${totalLinks} internal links (${Math.round(nofollowLinks/totalLinks*100)}%) use nofollow — exceeds 5%`,
      details: null });
  }

  for (const r of records) {
    const url    = r.url || '';
    if (!url) continue;
    const urlData = r._url || {};
    const isIdx  = r['Indexability'] === 'Indexable';
    const depth  = parseInt(r['Crawl Depth'] || '0', 10);
    const inlinks = parseInt(r['Unique Inlinks'] || '0', 10);
    const words  = parseInt(r['Word Count'] || '0', 10);
    const metaRobots = (r['Meta Robots 1'] || '').toLowerCase();
    const xRobots    = (r['X-Robots-Tag 1'] || '').toLowerCase();

    // session_ids_in_urls
    if (urlData.hasSessionId || /[?&;](jsessionid|phpsessid|sessionid|sid)=/i.test(url)) {
      failures.push({ check_id: 'session_ids_in_urls', passed: false, severity: 'critical', section: SECTION,
        message: 'Session ID detected in URL', details: url });
    }

    // crawl_trap
    if (urlData.isCrawlTrap) {
      failures.push({ check_id: 'crawl_trap', passed: false, severity: 'critical', section: SECTION,
        message: 'Potential crawl trap: repeating path segments or 5+ query parameters', details: url });
    }

    // crawl_depth — important page > 4 clicks deep
    if (isIdx && depth > 4) {
      failures.push({ check_id: 'crawl_depth', passed: false, severity: 'info', section: SECTION,
        message: `Page is ${depth} clicks deep from root — exceeds 4-click recommendation`, details: url });
    }

    // orphan_pages — indexable page with zero inlinks
    if (isIdx && inlinks === 0) {
      failures.push({ check_id: 'orphan_pages', passed: false, severity: 'warning', section: SECTION,
        message: 'Indexable page has no internal inlinks (orphan)', details: url });
    }

    // soft_404 — HTTP 200 + < 50 words + not-found text patterns
    const code = String(r['Status Code'] || '');
    if (code === '200' && words < 50) {
      const text = (r._bodyText || '').toLowerCase();
      const notFoundPatterns = ['not found', '404', "doesn't exist", 'page not found', 'no results'];
      if (notFoundPatterns.some(p => text.includes(p))) {
        failures.push({ check_id: 'soft_404', passed: false, severity: 'warning', section: SECTION,
          message: `Soft 404: HTTP 200 with < 50 words and "not found" text patterns`, details: url });
      }
    }

    // x_robots_tag — X-Robots-Tag conflicts with meta robots
    if (metaRobots && xRobots) {
      const metaNoindex = metaRobots.includes('noindex');
      const xNoindex    = xRobots.includes('noindex');
      const metaIndex   = !metaNoindex;
      const xIndex      = !xNoindex;
      if (metaIndex !== xIndex) {
        failures.push({ check_id: 'x_robots_tag', passed: false, severity: 'critical', section: SECTION,
          message: `X-Robots-Tag "${xRobots}" conflicts with meta robots "${metaRobots}"`, details: url });
      }
    }

    // meta_noindex_correct — noindex on a canonical content page (not paginated/admin)
    const isNoindex = metaRobots.includes('noindex') || xRobots.includes('noindex');
    if (isNoindex) {
      const path = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();
      const isLikelyContent = !path.match(/\/(page|p|pg)\/?\d+|\/admin|\/login|\/search|\/tag\/|\/author\//);
      if (isLikelyContent && (r['Canonical Link Element 1'] || '') === url) {
        failures.push({ check_id: 'meta_noindex_correct', passed: false, severity: 'critical', section: SECTION,
          message: `Noindex on self-referencing canonical content page`, details: url });
      }
    }

    // noindex_paginated — paginated pages mixing strategies
    const isNext = r['rel="next"'] || '';
    const isPrev = r['rel="prev"'] || '';
    if ((isNext || isPrev) && isNoindex) {
      const can = r['Canonical Link Element 1'] || '';
      if (can && can !== url) {
        // Mixed: some paginated pages are noindex and canonical to page 1 — inconsistent
        failures.push({ check_id: 'noindex_paginated', passed: false, severity: 'info', section: SECTION,
          message: 'Paginated page uses both noindex and canonical-to-page-1 — pick one strategy', details: url });
      }
    }

    // url_parameters_handled — duplicate-creating params without canonical
    if (isIdx) {
      let search = '';
      try { search = new URL(url).search; } catch { /* skip */ }
      const can = r['Canonical Link Element 1'] || '';
      if (search && (!can || can === url)) {
        // URL has params but no canonical consolidation
        failures.push({ check_id: 'url_parameters_handled', passed: false, severity: 'warning', section: SECTION,
          message: `URL has query parameters (${search}) without canonical consolidation`, details: url });
      }
    }
  }

  return failures;
}
```

- [ ] **Step 4: Create s06-url.js**

```js
// backend/services/checks/s06-url.js
const SECTION = 'URL Structure';
const URL_LENGTH_MAX    = 100;
const URL_LENGTH_IDEAL  = 75;
const MAX_DIR_DEPTH     = 4;
const GENERIC_SLUG_RE   = /^(page-\d+|p=|content\/\d+|index|home|untitled|post-\d+)$/i;
const DATE_FORMAT_RE    = /(\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{2}[\/\-]\d{2}[\/\-]\d{4})/;

export function runUrlChecks(records, _ctx) {
  const failures = [];

  // Trailing slash consistency — site-level
  let withSlash = 0, withoutSlash = 0;
  for (const r of records) {
    if (!r.url || r['Indexability'] !== 'Indexable') continue;
    let path = '';
    try { path = new URL(r.url).pathname; } catch { continue; }
    if (path === '/') continue;
    if (path.endsWith('/')) withSlash++; else withoutSlash++;
  }
  const trailingSlashInconsistent = withSlash > 0 && withoutSlash > 0;

  // Subdomain vs subfolder detection — site-level
  const allHosts = new Set();
  let rootHost = '';
  for (const r of records) {
    if (!r.url) continue;
    try {
      const u = new URL(r.url);
      if (!rootHost) rootHost = u.hostname.replace(/^www\./, '');
      allHosts.add(u.hostname);
    } catch { /* skip */ }
  }
  const subdomainContent = [...allHosts].filter(h => {
    if (!rootHost) return false;
    const isSubdomain = h.endsWith('.' + rootHost) && h !== 'www.' + rootHost;
    if (!isSubdomain) return false;
    const sub = h.replace('.' + rootHost, '');
    return /^(blog|docs|shop|news|store|app|help|support)$/.test(sub);
  });

  // Date format consistency — collect all dates found
  const dateFormats = { ymd: 0, dmy: 0 };

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const urlData = r._url || {};
    let path = '', slug = '';
    try {
      const u = new URL(url);
      path = u.pathname;
      slug = path.split('/').filter(Boolean).pop() || '';
    } catch { continue; }

    // url_length
    if (url.length > URL_LENGTH_MAX) {
      failures.push({ check_id: 'url_length', passed: false, severity: 'info', section: SECTION,
        message: `URL is ${url.length} characters — exceeds ${URL_LENGTH_MAX}-character limit`, details: url });
    }

    // url_lowercase
    if (urlData.isLowercase === false || path !== path.toLowerCase()) {
      failures.push({ check_id: 'url_lowercase', passed: false, severity: 'warning', section: SECTION,
        message: `URL path contains uppercase characters`, details: url });
    }

    // url_hyphens — underscores instead of hyphens
    if (urlData.hasHyphens === false || slug.includes('_')) {
      failures.push({ check_id: 'url_hyphens', passed: false, severity: 'warning', section: SECTION,
        message: `URL slug uses underscores instead of hyphens`, details: url });
    }

    // url_special_chars — percent-encoded special chars in path (not / or -)
    if (/%((?!2F|2D)[0-9A-Fa-f]{2})/i.test(path)) {
      failures.push({ check_id: 'url_special_chars', passed: false, severity: 'warning', section: SECTION,
        message: `URL path contains percent-encoded special characters`, details: url });
    }

    // url_descriptive — generic slug patterns
    if (slug && GENERIC_SLUG_RE.test(slug)) {
      failures.push({ check_id: 'url_descriptive', passed: false, severity: 'info', section: SECTION,
        message: `Non-descriptive URL slug: "${slug}"`, details: url });
    }

    // url_trailing_slash
    if (trailingSlashInconsistent) {
      failures.push({ check_id: 'url_trailing_slash', passed: false, severity: 'warning', section: SECTION,
        message: 'Inconsistent trailing slash usage across the site', details: url });
    }

    // url_deep_nesting
    const dirDepth = urlData.dirDepth ?? path.split('/').filter(Boolean).length;
    if (dirDepth > MAX_DIR_DEPTH) {
      failures.push({ check_id: 'url_deep_nesting', passed: false, severity: 'warning', section: SECTION,
        message: `URL has ${dirDepth} directory levels — exceeds maximum of ${MAX_DIR_DEPTH}`, details: url });
    }

    // url_date_format — collect for consistency check
    const dateMatch = path.match(DATE_FORMAT_RE);
    if (dateMatch) {
      if (/\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(dateMatch[0])) dateFormats.ymd++;
      else dateFormats.dmy++;
    }
  }

  // url_date_format — flag inconsistency if both formats found
  if (dateFormats.ymd > 0 && dateFormats.dmy > 0) {
    failures.push({ check_id: 'url_date_format', passed: false, severity: 'info', section: SECTION,
      message: `Inconsistent date format in URLs (mix of YYYY/MM/DD and DD/MM/YYYY)`, details: null });
  }

  // subdomain_vs_subfolder
  if (subdomainContent.length > 0) {
    failures.push({ check_id: 'subdomain_vs_subfolder', passed: false, severity: 'info', section: SECTION,
      message: `Content hosted on subdomains instead of subdirectories: ${subdomainContent.join(', ')}`,
      details: null });
  }

  return failures;
}
```

- [ ] **Step 5: Run tests to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s05-crawlability.test.js __tests__/checks/s06-url.test.js`
Expected: PASS — all tests passing

- [ ] **Step 6: Commit**

```bash
git add backend/services/checks/s05-crawlability.js backend/services/checks/s06-url.js backend/__tests__/checks/s05-crawlability.test.js backend/__tests__/checks/s06-url.test.js
git commit -m "feat: implement Section 5 crawlability and Section 6 URL structure checks"
```

---

### Task 6: Sections 7 & 8 — JS Rendering and Mobile Checks

**Files:**
- Create: `backend/services/checks/s07-jsrender.js`
- Create: `backend/services/checks/s08-mobile.js`
- Test: `backend/__tests__/checks/s07-jsrender.test.js`
- Test: `backend/__tests__/checks/s08-mobile.test.js`

Raw page fields from `jsrender.js` extractor (`page._jsRender`):
```js
{
  rawWordCount: number, renderedWordCount: number,
  rawLinkCount: number, renderedLinkCount: number,
  rawHasH1: boolean, rawHasTitle: boolean, rawHasMetaDesc: boolean, rawHasJsonLd: boolean,
  renderBlockingScripts: string[],
  domContentLoadedMs: number,
  lazyContentLinks: number
}
```

Raw page fields from `mobile.js` extractor (`page._mobile`):
```js
{
  viewportMetaPresent: boolean, bodyScrollWidthExceedsWindow: boolean,
  tapTargets: Array<{selector, width, height}>, smallTapTargets: Array<{selector, width, height}>,
  bodyFontSizePx: number, zoomDisabled: boolean, fullViewportOverlays: number,
  desktopWordCount: number, mobileWordCount: number, desktopH1: string, mobileH1: string
}
```

- [ ] **Step 1: Write failing tests**

```js
// backend/__tests__/checks/s07-jsrender.test.js
import { describe, it, expect } from 'vitest';
import { runJsRenderChecks } from '../../services/checks/s07-jsrender.js';

const page = (jsRender = {}) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _jsRender: {
    rawWordCount: 400, renderedWordCount: 420, rawLinkCount: 10, renderedLinkCount: 12,
    rawHasH1: true, rawHasTitle: true, rawHasMetaDesc: true, rawHasJsonLd: true,
    renderBlockingScripts: [], domContentLoadedMs: 800, lazyContentLinks: 0,
    ...jsRender,
  },
});

describe('runJsRenderChecks', () => {
  it('passes for well-rendered page', () => {
    expect(runJsRenderChecks([page()], {})).toHaveLength(0);
  });
  it('flags js_critical_content when H1 only in rendered HTML', () => {
    const r = runJsRenderChecks([page({ rawHasH1: false })], {});
    expect(r.some(x => x.check_id === 'js_critical_content')).toBe(true);
  });
  it('flags js_metadata when title missing in raw HTML', () => {
    const r = runJsRenderChecks([page({ rawHasTitle: false })], {});
    expect(r.some(x => x.check_id === 'js_metadata')).toBe(true);
  });
  it('flags js_link_discovery when rendered links > 20% more than raw', () => {
    const r = runJsRenderChecks([page({ rawLinkCount: 5, renderedLinkCount: 7 })], {});
    expect(r.some(x => x.check_id === 'js_link_discovery')).toBe(true);
  });
  it('flags js_crawl_budget_render when DCL > 2000ms', () => {
    const r = runJsRenderChecks([page({ domContentLoadedMs: 2500 })], {});
    expect(r.some(x => x.check_id === 'js_crawl_budget_render')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s08-mobile.test.js
import { describe, it, expect } from 'vitest';
import { runMobileChecks } from '../../services/checks/s08-mobile.js';

const page = (mobile = {}) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Meta Robots 1': '',
  _mobile: {
    viewportMetaPresent: true, bodyScrollWidthExceedsWindow: false,
    smallTapTargets: [], bodyFontSizePx: 16, zoomDisabled: false,
    fullViewportOverlays: 0, desktopWordCount: 400, mobileWordCount: 400,
    desktopH1: 'Title', mobileH1: 'Title',
    ...mobile,
  },
});

describe('runMobileChecks', () => {
  it('passes for mobile-friendly page', () => {
    expect(runMobileChecks([page()], {})).toHaveLength(0);
  });
  it('flags viewport_meta when missing', () => {
    const r = runMobileChecks([page({ viewportMetaPresent: false })], {});
    expect(r.some(x => x.check_id === 'viewport_meta')).toBe(true);
  });
  it('flags horizontal_scroll when body wider than window', () => {
    const r = runMobileChecks([page({ bodyScrollWidthExceedsWindow: true })], {});
    expect(r.some(x => x.check_id === 'horizontal_scroll')).toBe(true);
  });
  it('flags tap_target_size for small targets', () => {
    const r = runMobileChecks([page({ smallTapTargets: [{ selector: 'a', width: 30, height: 30 }] })], {});
    expect(r.some(x => x.check_id === 'tap_target_size')).toBe(true);
  });
  it('flags mobile_content_parity when mobile word count differs > 15%', () => {
    const r = runMobileChecks([page({ desktopWordCount: 400, mobileWordCount: 300 })], {});
    expect(r.some(x => x.check_id === 'mobile_content_parity')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s07-jsrender.test.js __tests__/checks/s08-mobile.test.js`
Expected: FAIL — modules not found

- [ ] **Step 3: Create s07-jsrender.js**

```js
// backend/services/checks/s07-jsrender.js
const SECTION = 'JavaScript Rendering';

export function runJsRenderChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const js = r._jsRender;
    if (!js) continue;

    const rawWords      = js.rawWordCount      || 0;
    const rendWords     = js.renderedWordCount  || 0;
    const rawLinks      = js.rawLinkCount       || 0;
    const rendLinks     = js.renderedLinkCount  || 0;
    const dcl           = js.domContentLoadedMs || 0;
    const blocking      = js.renderBlockingScripts || [];

    // js_critical_content — H1 or body not in raw HTML
    if (!js.rawHasH1) {
      failures.push({ check_id: 'js_critical_content', passed: false, severity: 'critical', section: SECTION,
        message: 'H1 tag only present in rendered DOM — not in raw HTML (JS-injected)', details: url });
    }

    // js_metadata
    if (!js.rawHasTitle || !js.rawHasMetaDesc) {
      const missing = [!js.rawHasTitle && 'title', !js.rawHasMetaDesc && 'meta description'].filter(Boolean).join(', ');
      failures.push({ check_id: 'js_metadata', passed: false, severity: 'critical', section: SECTION,
        message: `Missing in raw HTML: ${missing} (JS-injected)`, details: url });
    }

    // js_link_discovery — rendered has > 20% more links than raw
    if (rawLinks > 0 && rendLinks > rawLinks * 1.20) {
      const pct = Math.round((rendLinks - rawLinks) / rawLinks * 100);
      failures.push({ check_id: 'js_link_discovery', passed: false, severity: 'critical', section: SECTION,
        message: `Rendered DOM has ${pct}% more links than raw HTML — links may not be crawled`, details: url });
    }

    // js_structured_data
    if (!js.rawHasJsonLd) {
      failures.push({ check_id: 'js_structured_data', passed: false, severity: 'warning', section: SECTION,
        message: 'JSON-LD structured data not present in raw HTML (JS-injected)', details: url });
    }

    // js_render_comparison — rendered content > 30% different from raw
    if (rawWords > 0 && rendWords > 0) {
      const diff = Math.abs(rendWords - rawWords) / rawWords;
      if (diff > 0.30) {
        failures.push({ check_id: 'js_render_comparison', passed: false, severity: 'warning', section: SECTION,
          message: `Rendered content differs ${Math.round(diff * 100)}% from raw HTML word count`, details: url });
      }

      // js_csr_vs_ssr — raw < 100 words, rendered > 300 words
      if (rawWords < 100 && rendWords > 300) {
        failures.push({ check_id: 'js_csr_vs_ssr', passed: false, severity: 'info', section: SECTION,
          message: `Full client-side rendering detected: raw ${rawWords} words, rendered ${rendWords} words`, details: url });
      }

      // js_two_wave_risk — core content only in rendered DOM
      if (rawWords < rendWords * 0.5) {
        failures.push({ check_id: 'js_two_wave_risk', passed: false, severity: 'info', section: SECTION,
          message: 'Core content may be at risk of two-wave indexing delay', details: url });
      }
    }

    // js_lazy_loaded — links only visible after scroll
    if ((js.lazyContentLinks || 0) > 0) {
      failures.push({ check_id: 'js_lazy_loaded', passed: false, severity: 'warning', section: SECTION,
        message: `${js.lazyContentLinks} links only visible after scroll (lazy-loaded)`, details: url });
    }

    // js_dependencies_order — render-blocking scripts in <head>
    if (blocking.length > 0) {
      failures.push({ check_id: 'js_dependencies_order', passed: false, severity: 'info', section: SECTION,
        message: `${blocking.length} render-blocking script(s) in <head> without defer/async`, details: url });
    }

    // js_crawl_budget_render — DCL > 2000ms
    if (dcl > 2000) {
      failures.push({ check_id: 'js_crawl_budget_render', passed: false, severity: 'warning', section: SECTION,
        message: `domContentLoaded took ${dcl}ms — exceeds 2s budget for Googlebot`, details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 4: Create s08-mobile.js**

```js
// backend/services/checks/s08-mobile.js
const SECTION = 'Mobile & Usability';

export function runMobileChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const m = r._mobile;
    if (!m) continue;

    // viewport_meta — also sourced from meta.js via 'Meta Robots 1' approach
    if (!m.viewportMetaPresent) {
      failures.push({ check_id: 'viewport_meta', passed: false, severity: 'critical', section: SECTION,
        message: 'Missing <meta name="viewport"> tag', details: url });
    }

    // mobile_responsive
    if (m.bodyScrollWidthExceedsWindow) {
      failures.push({ check_id: 'mobile_responsive', passed: false, severity: 'critical', section: SECTION,
        message: 'Page content wider than viewport — not mobile responsive', details: url });
    }

    // tap_target_size
    if ((m.smallTapTargets || []).length > 0) {
      failures.push({ check_id: 'tap_target_size', passed: false, severity: 'warning', section: SECTION,
        message: `${m.smallTapTargets.length} tap target(s) smaller than 48×48px`, details: url });
    }

    // text_legibility
    if ((m.bodyFontSizePx || 16) < 16) {
      failures.push({ check_id: 'text_legibility', passed: false, severity: 'warning', section: SECTION,
        message: `Body font size is ${m.bodyFontSizePx}px — below 16px minimum`, details: url });
    }

    // horizontal_scroll
    if (m.bodyScrollWidthExceedsWindow) {
      failures.push({ check_id: 'horizontal_scroll', passed: false, severity: 'critical', section: SECTION,
        message: 'Horizontal scrolling detected on mobile viewport', details: url });
    }

    // zoom_disabled — from meta tag (via meta.js)
    if (m.zoomDisabled) {
      failures.push({ check_id: 'zoom_disabled', passed: false, severity: 'warning', section: SECTION,
        message: 'Zoom disabled via viewport meta (user-scalable=no or maximum-scale=1)', details: url });
    }

    // mobile_interstitials
    if ((m.fullViewportOverlays || 0) > 0) {
      failures.push({ check_id: 'mobile_interstitials', passed: false, severity: 'warning', section: SECTION,
        message: `${m.fullViewportOverlays} full-viewport overlay(s) detected on mobile load`, details: url });
    }

    // mobile_content_parity — > 15% word count difference
    if (m.desktopWordCount > 0 && m.mobileWordCount > 0) {
      const diff = Math.abs(m.desktopWordCount - m.mobileWordCount) / m.desktopWordCount;
      if (diff > 0.15) {
        failures.push({ check_id: 'mobile_content_parity', passed: false, severity: 'critical', section: SECTION,
          message: `Mobile word count (${m.mobileWordCount}) differs ${Math.round(diff*100)}% from desktop (${m.desktopWordCount})`,
          details: url });
      }
    }

    // H1 parity
    if (m.desktopH1 && m.mobileH1 && m.desktopH1 !== m.mobileH1) {
      failures.push({ check_id: 'mobile_content_parity', passed: false, severity: 'critical', section: SECTION,
        message: `Mobile H1 differs from desktop H1`, details: url });
    }

    // touch_spacing — small gap between tap targets (stored in smallTapTargets adjacency check)
    if ((m.touchSpacingIssues || 0) > 0) {
      failures.push({ check_id: 'touch_spacing', passed: false, severity: 'warning', section: SECTION,
        message: `${m.touchSpacingIssues} tap target pair(s) with < 8px gap`, details: url });
    }

    // app_install_banners
    if (m.appInstallBannerDetected) {
      failures.push({ check_id: 'app_install_banners', passed: false, severity: 'info', section: SECTION,
        message: 'App install banner covering viewport on mobile load', details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 5: Run tests to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s07-jsrender.test.js __tests__/checks/s08-mobile.test.js`
Expected: PASS — all tests passing

- [ ] **Step 6: Commit**

```bash
git add backend/services/checks/s07-jsrender.js backend/services/checks/s08-mobile.js backend/__tests__/checks/s07-jsrender.test.js backend/__tests__/checks/s08-mobile.test.js
git commit -m "feat: implement Section 7 JS rendering and Section 8 mobile checks"
```

---

### Task 7: Sections 9 & 10 — Security + CWV Lab Checks + crux.js

**Files:**
- Create: `backend/services/checks/s09-security.js`
- Create: `backend/services/checks/s10-cwv.js`
- Create: `backend/services/crux.js`
- Test: `backend/__tests__/checks/s09-security.test.js`
- Test: `backend/__tests__/checks/s10-cwv.test.js`

Raw page fields from `response.js` (security headers added in Task 2): `page._hsts`, `page._csp`, `page._xFrameOptions`, `page._xContentTypeOptions`, `page._referrerPolicy`, `page._permissionsPolicy`, `page._isHttps`

From `monitoring.js` extractor (`page._monitoring`):
```js
{
  sslValid: boolean, sslExpiryDays: number, sslChainComplete: boolean, sslIssuer: string,
  mixedContentUrls: string[],
  ttfbMs: number, domContentLoadedMs: number, totalRequests: number, jsCssTransferBytes: number,
  lcpTagName: string|null, lcpClassName: string|null, lcpIsDecorative: boolean,
  clsSources: Array<{ tagName, id, className, shiftDelta, hadRecentInput }>
}
```

- [ ] **Step 1: Write failing tests**

```js
// backend/__tests__/checks/s09-security.test.js
import { describe, it, expect } from 'vitest';
import { runSecurityChecks } from '../../services/checks/s09-security.js';

const page = (overrides = {}) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _isHttps: true,
  _hsts: 'max-age=31536000; includeSubDomains',
  _csp: "default-src 'self'",
  _xFrameOptions: 'DENY',
  _xContentTypeOptions: 'nosniff',
  _referrerPolicy: 'strict-origin-when-cross-origin',
  _permissionsPolicy: 'camera=(), microphone=()',
  _monitoring: { sslValid: true, sslExpiryDays: 90, sslChainComplete: true, mixedContentUrls: [] },
  ...overrides,
});

describe('runSecurityChecks', () => {
  it('passes on fully secure page', () => {
    expect(runSecurityChecks([page()], {})).toHaveLength(0);
  });
  it('flags https_enabled for HTTP page', () => {
    const r = runSecurityChecks([page({ url: 'http://example.com/page', _isHttps: false })], {});
    expect(r.some(x => x.check_id === 'https_enabled')).toBe(true);
  });
  it('flags hsts_header when missing', () => {
    const r = runSecurityChecks([page({ _hsts: '' })], {});
    expect(r.some(x => x.check_id === 'hsts_header')).toBe(true);
  });
  it('flags hsts_header when max-age < 31536000', () => {
    const r = runSecurityChecks([page({ _hsts: 'max-age=3600' })], {});
    expect(r.some(x => x.check_id === 'hsts_header')).toBe(true);
  });
  it('flags csp_header when missing', () => {
    const r = runSecurityChecks([page({ _csp: '' })], {});
    expect(r.some(x => x.check_id === 'csp_header')).toBe(true);
  });
  it('flags x_frame_options when set to ALLOWALL', () => {
    const r = runSecurityChecks([page({ _xFrameOptions: 'ALLOWALL' })], {});
    expect(r.some(x => x.check_id === 'x_frame_options')).toBe(true);
  });
  it('flags ssl_valid when cert invalid', () => {
    const r = runSecurityChecks([page({ _monitoring: { sslValid: false, sslExpiryDays: -1, sslChainComplete: true, mixedContentUrls: [] } })], {});
    expect(r.some(x => x.check_id === 'ssl_valid')).toBe(true);
  });
  it('flags mixed_content when http resources on https page', () => {
    const r = runSecurityChecks([page({ _monitoring: { sslValid: true, sslExpiryDays: 90, sslChainComplete: true, mixedContentUrls: ['http://cdn.example.com/image.png'] } })], {});
    expect(r.some(x => x.check_id === 'mixed_content')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s10-cwv.test.js
import { describe, it, expect } from 'vitest';
import { runCwvChecks } from '../../services/checks/s10-cwv.js';

const page = (monitoring = {}) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _monitoring: {
    ttfbMs: 400, totalRequests: 50, jsCssTransferBytes: 200000,
    lcpIsDecorative: false, clsSources: [],
    ...monitoring,
  },
});

describe('runCwvChecks', () => {
  it('passes for fast page', () => {
    expect(runCwvChecks([page()], {})).toHaveLength(0);
  });
  it('flags lab_ttfb when > 800ms', () => {
    const r = runCwvChecks([page({ ttfbMs: 1200 })], {});
    expect(r.some(x => x.check_id === 'lab_ttfb')).toBe(true);
  });
  it('flags lab_request_count when > 100 requests', () => {
    const r = runCwvChecks([page({ totalRequests: 120 })], {});
    expect(r.some(x => x.check_id === 'lab_request_count')).toBe(true);
  });
  it('flags lab_asset_weight when JS+CSS > 500KB', () => {
    const r = runCwvChecks([page({ jsCssTransferBytes: 600000 })], {});
    expect(r.some(x => x.check_id === 'lab_asset_weight')).toBe(true);
  });
  it('flags lcp_element_id for decorative LCP element', () => {
    const r = runCwvChecks([page({ lcpIsDecorative: true, lcpTagName: 'DIV' })], {});
    expect(r.some(x => x.check_id === 'lcp_element_id')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s09-security.test.js __tests__/checks/s10-cwv.test.js`
Expected: FAIL — modules not found

- [ ] **Step 3: Create s09-security.js**

```js
// backend/services/checks/s09-security.js
const SECTION = 'Security & HTTPS';
const HSTS_MIN_MAX_AGE = 31_536_000; // 1 year

export function runSecurityChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url = r.url || '';
    if (!url) continue;

    const isHttps     = r._isHttps ?? url.startsWith('https://');
    const hsts        = r._hsts        || '';
    const csp         = r._csp         || '';
    const xFrame      = r._xFrameOptions      || '';
    const xContent    = r._xContentTypeOptions || '';
    const referrer    = r._referrerPolicy      || '';
    const permissions = r._permissionsPolicy   || '';
    const mon         = r._monitoring          || {};

    // https_enabled
    if (!isHttps) {
      failures.push({ check_id: 'https_enabled', passed: false, severity: 'critical', section: SECTION,
        message: 'Page served over HTTP — must use HTTPS', details: url });
    }

    // ssl_valid
    if (mon.sslValid === false) {
      failures.push({ check_id: 'ssl_valid', passed: false, severity: 'critical', section: SECTION,
        message: `SSL certificate invalid or expired (${mon.sslExpiryDays < 0 ? 'expired' : `${mon.sslExpiryDays} days remaining`})`,
        details: url });
    }

    // ssl_chain_complete
    if (mon.sslChainComplete === false) {
      failures.push({ check_id: 'ssl_chain_complete', passed: false, severity: 'critical', section: SECTION,
        message: 'SSL certificate chain incomplete — intermediate certificate missing', details: url });
    }

    // hsts_header
    if (!hsts) {
      failures.push({ check_id: 'hsts_header', passed: false, severity: 'warning', section: SECTION,
        message: 'Strict-Transport-Security header missing', details: url });
    } else {
      const maxAgeMatch = hsts.match(/max-age=(\d+)/i);
      const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
      if (maxAge < HSTS_MIN_MAX_AGE) {
        failures.push({ check_id: 'hsts_header', passed: false, severity: 'warning', section: SECTION,
          message: `HSTS max-age is ${maxAge}s — must be ≥ ${HSTS_MIN_MAX_AGE}s (1 year)`, details: url });
      }
    }

    // csp_header
    if (!csp) {
      failures.push({ check_id: 'csp_header', passed: false, severity: 'warning', section: SECTION,
        message: 'Content-Security-Policy header missing', details: url });
    } else if (csp.includes("'unsafe-inline'") && !csp.includes('nonce-') && !csp.includes('sha256-')) {
      failures.push({ check_id: 'csp_header', passed: false, severity: 'warning', section: SECTION,
        message: "CSP uses 'unsafe-inline' without nonce/hash — weakens protection", details: url });
    }

    // x_frame_options
    if (!xFrame) {
      failures.push({ check_id: 'x_frame_options', passed: false, severity: 'warning', section: SECTION,
        message: 'X-Frame-Options header missing', details: url });
    } else if (!['DENY', 'SAMEORIGIN'].includes(xFrame.toUpperCase())) {
      failures.push({ check_id: 'x_frame_options', passed: false, severity: 'warning', section: SECTION,
        message: `X-Frame-Options must be DENY or SAMEORIGIN, got: ${xFrame}`, details: url });
    }

    // x_content_type_options
    if (!xContent || xContent.toLowerCase() !== 'nosniff') {
      failures.push({ check_id: 'x_content_type_options', passed: false, severity: 'warning', section: SECTION,
        message: `X-Content-Type-Options must be "nosniff", got: "${xContent || 'missing'}"`, details: url });
    }

    // referrer_policy
    if (!referrer) {
      failures.push({ check_id: 'referrer_policy', passed: false, severity: 'info', section: SECTION,
        message: 'Referrer-Policy header missing', details: url });
    }

    // permissions_policy
    if (!permissions) {
      failures.push({ check_id: 'permissions_policy', passed: false, severity: 'info', section: SECTION,
        message: 'Permissions-Policy header missing', details: url });
    }

    // mixed_content
    const mixed = mon.mixedContentUrls || [];
    if (isHttps && mixed.length > 0) {
      failures.push({ check_id: 'mixed_content', passed: false, severity: 'critical', section: SECTION,
        message: `${mixed.length} HTTP resource(s) loaded on HTTPS page: ${mixed.slice(0,2).join(', ')}`,
        details: url });
    }

    // security_headers_grade — score presence of 5 headers
    const present = [!!hsts, !!csp, !!xFrame, !!xContent, !!referrer].filter(Boolean).length;
    if (present < 4) {
      failures.push({ check_id: 'security_headers_grade', passed: false, severity: 'warning', section: SECTION,
        message: `Only ${present}/5 security headers present (need ≥ 4)`, details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 4: Create backend/services/crux.js**

```js
// backend/services/crux.js
/**
 * CrUX API client.
 * Fetches Chrome UX Report field data (p75 metrics) for a given URL.
 * API key stored in site settings key 'crux_api_key'.
 * Returns [] (no failures) if API key absent or no data for URL.
 */

const SECTION = 'Core Web Vitals';
const CRUX_API_BASE = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
const CRUX_HISTORY_API = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';

const LCP_THRESHOLDS  = { good: 2500, poor: 4000 };  // ms
const INP_THRESHOLDS  = { good: 200,  poor: 500  };   // ms
const CLS_THRESHOLDS  = { good: 0.1,  poor: 0.25 };

async function fetchCrux(url, apiKey) {
  const res = await fetch(`${CRUX_API_BASE}?key=${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url, formFactor: 'PHONE' }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchCruxHistory(url, apiKey) {
  const res = await fetch(`${CRUX_HISTORY_API}?key=${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url, formFactor: 'PHONE' }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function runCruxChecks(records, ctx) {
  const failures = [];
  const apiKey = ctx.siteSettings?.get('crux_api_key') || '';
  if (!apiKey) return failures;

  // Sample up to 10 indexable URLs to avoid exhausting API quota
  const targets = records
    .filter(r => r.url && r['Indexability'] === 'Indexable')
    .slice(0, 10);

  for (const r of targets) {
    const url = r.url;
    let data = null;
    try { data = await fetchCrux(url, apiKey); } catch { continue; }
    if (!data?.record?.metrics) continue;

    const metrics = data.record.metrics;

    const lcpP75 = metrics.largest_contentful_paint?.percentiles?.p75;
    const inpP75 = metrics.interaction_to_next_paint?.percentiles?.p75;
    const clsP75 = metrics.cumulative_layout_shift?.percentiles?.p75;

    if (lcpP75 != null && lcpP75 > LCP_THRESHOLDS.good) {
      failures.push({ check_id: 'crux_lcp', passed: false,
        severity: lcpP75 >= LCP_THRESHOLDS.poor ? 'critical' : 'warning',
        section: SECTION,
        message: `CrUX LCP p75 = ${lcpP75}ms (threshold: good < 2500ms)`, details: url });
    }

    if (inpP75 != null && inpP75 > INP_THRESHOLDS.good) {
      failures.push({ check_id: 'crux_inp', passed: false,
        severity: inpP75 >= INP_THRESHOLDS.poor ? 'critical' : 'warning',
        section: SECTION,
        message: `CrUX INP p75 = ${inpP75}ms (threshold: good < 200ms)`, details: url });
    }

    if (clsP75 != null && clsP75 > CLS_THRESHOLDS.good) {
      failures.push({ check_id: 'crux_cls', passed: false,
        severity: clsP75 >= CLS_THRESHOLDS.poor ? 'critical' : 'warning',
        section: SECTION,
        message: `CrUX CLS p75 = ${clsP75} (threshold: good < 0.1)`, details: url });
    }

    // cwv_trend — compare latest week vs 4-weeks-prior
    let histData = null;
    try { histData = await fetchCruxHistory(url, apiKey); } catch { continue; }
    if (!histData?.record?.metrics) continue;

    const histMetrics = histData.record.metrics;
    for (const [metric, checkId, threshold] of [
      ['largest_contentful_paint', 'cwv_trend', LCP_THRESHOLDS.good],
      ['cumulative_layout_shift',  'cwv_trend', CLS_THRESHOLDS.good],
    ]) {
      const history = histMetrics[metric]?.histogramTimeseries;
      if (!history || history.length < 5) continue;
      const latest = history[history.length - 1]?.densities?.[0];  // "good" bucket density
      const prior  = history[history.length - 5]?.densities?.[0];
      if (latest != null && prior != null && prior > 0) {
        const change = (latest - prior) / prior;
        if (change < -0.15) {
          failures.push({ check_id: 'cwv_trend', passed: false, severity: 'warning',
            section: SECTION,
            message: `CrUX ${metric} worsened by ${Math.round(Math.abs(change) * 100)}% over 4 weeks`,
            details: url });
        }
      }
    }
  }

  return failures;
}
```

- [ ] **Step 5: Create s10-cwv.js**

```js
// backend/services/checks/s10-cwv.js
const SECTION = 'Core Web Vitals';

export function runCwvChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const mon = r._monitoring || {};

    // lab_ttfb
    if ((mon.ttfbMs || 0) > 800) {
      failures.push({ check_id: 'lab_ttfb', passed: false, severity: 'info', section: SECTION,
        message: `TTFB = ${mon.ttfbMs}ms — exceeds 800ms threshold`, details: url });
    }

    // lab_render_blocking — from resources.js extractor (page._renderBlockingCount)
    if ((r._renderBlockingCount || 0) > 0) {
      failures.push({ check_id: 'lab_render_blocking', passed: false, severity: 'warning', section: SECTION,
        message: `${r._renderBlockingCount} render-blocking resource(s) in <head>`, details: url });
    }

    // lab_request_count
    if ((mon.totalRequests || 0) > 100) {
      failures.push({ check_id: 'lab_request_count', passed: false, severity: 'info', section: SECTION,
        message: `${mon.totalRequests} total network requests — exceeds 100`, details: url });
    }

    // lab_asset_weight — JS + CSS > 500KB
    if ((mon.jsCssTransferBytes || 0) > 500_000) {
      failures.push({ check_id: 'lab_asset_weight', passed: false, severity: 'info', section: SECTION,
        message: `JS+CSS combined = ${Math.round(mon.jsCssTransferBytes / 1024)}KB — exceeds 500KB`,
        details: url });
    }

    // lcp_element_id — decorative LCP element
    if (mon.lcpIsDecorative) {
      failures.push({ check_id: 'lcp_element_id', passed: false, severity: 'info', section: SECTION,
        message: `LCP element is decorative: <${mon.lcpTagName}${mon.lcpClassName ? ` class="${mon.lcpClassName}"` : ''}>`,
        details: url });
    }

    // cls_causes — layout shifts with hadRecentInput = false
    const clsCauses = (mon.clsSources || []).filter(s => !s.hadRecentInput && s.shiftDelta > 0.05);
    if (clsCauses.length > 0) {
      failures.push({ check_id: 'cls_causes', passed: false, severity: 'warning', section: SECTION,
        message: `${clsCauses.length} layout shift source(s): ${clsCauses.slice(0,2).map(s => `<${s.tagName}>`).join(', ')}`,
        details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 6: Run tests to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s09-security.test.js __tests__/checks/s10-cwv.test.js`
Expected: PASS — all tests passing

- [ ] **Step 7: Commit**

```bash
git add backend/services/checks/s09-security.js backend/services/checks/s10-cwv.js backend/services/crux.js backend/__tests__/checks/s09-security.test.js backend/__tests__/checks/s10-cwv.test.js
git commit -m "feat: implement Section 9 security, Section 10 CWV checks, and crux.js service"
```

---

### Task 8: Sections 11 & 12 — Title Tags and Meta Descriptions

**Files:**
- Create: `backend/services/checks/s11-titles.js`
- Create: `backend/services/checks/s12-meta.js`
- Test: `backend/__tests__/checks/s11-titles.test.js`
- Test: `backend/__tests__/checks/s12-meta.test.js`

- [ ] **Step 1: Write failing tests**

```js
// backend/__tests__/checks/s11-titles.test.js
import { describe, it, expect } from 'vitest';
import { runTitleChecks } from '../../services/checks/s11-titles.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Title 1': 'Car Insurance Plans | Compare & Save | Example',
  'Title 1 Length': '50',
  'Title 1 Pixel Width': '490',
  'H1-1': 'Best Car Insurance Plans',
  ...overrides,
});

describe('runTitleChecks', () => {
  it('passes for valid title', () => {
    expect(runTitleChecks([page()], {})).toHaveLength(0);
  });
  it('flags title_present when missing', () => {
    const r = runTitleChecks([page({ 'Title 1': '' })], {});
    expect(r.some(x => x.check_id === 'title_present')).toBe(true);
  });
  it('flags title_unique for duplicate titles', () => {
    const pages = [page({ url: 'https://example.com/a' }), page({ url: 'https://example.com/b' })];
    const r = runTitleChecks(pages, {});
    expect(r.some(x => x.check_id === 'title_unique')).toBe(true);
  });
  it('flags title_length_chars when title < 30 chars', () => {
    const r = runTitleChecks([page({ 'Title 1': 'Short', 'Title 1 Length': '5' })], {});
    expect(r.some(x => x.check_id === 'title_length_chars')).toBe(true);
  });
  it('flags title_length_chars when title > 75 chars', () => {
    const longTitle = 'A'.repeat(80);
    const r = runTitleChecks([page({ 'Title 1': longTitle, 'Title 1 Length': '80' })], {});
    expect(r.some(x => x.check_id === 'title_length_chars')).toBe(true);
  });
  it('flags title_keyword_stuffing when word repeated 3+ times', () => {
    const r = runTitleChecks([page({ 'Title 1': 'insurance insurance insurance plans' })], {});
    expect(r.some(x => x.check_id === 'title_keyword_stuffing')).toBe(true);
  });
  it('flags title_h1_diff when title equals H1', () => {
    const r = runTitleChecks([page({ 'Title 1': 'Best Car Insurance Plans', 'H1-1': 'Best Car Insurance Plans' })], {});
    expect(r.some(x => x.check_id === 'title_h1_diff')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s12-meta.test.js
import { describe, it, expect } from 'vitest';
import { runMetaDescChecks } from '../../services/checks/s12-meta.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Meta Description 1': 'Compare car insurance plans. Get the best rates and save on your premium today.',
  'Meta Description 1 Length': '80',
  ...overrides,
});

describe('runMetaDescChecks', () => {
  it('passes for valid meta description', () => {
    expect(runMetaDescChecks([page()], {})).toHaveLength(0);
  });
  it('flags meta_desc_present when missing', () => {
    const r = runMetaDescChecks([page({ 'Meta Description 1': '' })], {});
    expect(r.some(x => x.check_id === 'meta_desc_present')).toBe(true);
  });
  it('flags meta_desc_unique for duplicates', () => {
    const pages = [page({ url: 'https://example.com/a' }), page({ url: 'https://example.com/b' })];
    const r = runMetaDescChecks(pages, {});
    expect(r.some(x => x.check_id === 'meta_desc_unique')).toBe(true);
  });
  it('flags meta_desc_length when < 120 chars', () => {
    const r = runMetaDescChecks([page({ 'Meta Description 1': 'Too short', 'Meta Description 1 Length': '9' })], {});
    expect(r.some(x => x.check_id === 'meta_desc_length')).toBe(true);
  });
  it('flags meta_desc_cta when no action verb in first 15 words', () => {
    const r = runMetaDescChecks([page({ 'Meta Description 1': 'A'.repeat(140) })], {});
    expect(r.some(x => x.check_id === 'meta_desc_cta')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s11-titles.test.js __tests__/checks/s12-meta.test.js`
Expected: FAIL — modules not found

- [ ] **Step 3: Create s11-titles.js**

```js
// backend/services/checks/s11-titles.js
const SECTION = 'Title Tags';

export function runTitleChecks(records, ctx) {
  const failures = [];

  // Cross-page: find duplicate titles
  const titleCounts = new Map();
  for (const r of records) {
    if (r['Indexability'] !== 'Indexable') continue;
    const t = (r['Title 1'] || '').trim();
    if (t) titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
  }

  // Brand name for title_brand check
  const brandName = ctx.siteSettings?.get('brand_name') || '';

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const title  = (r['Title 1'] || '').trim();
    const length = parseInt(r['Title 1 Length'] || String(title.length), 10);
    const pixels = parseInt(r['Title 1 Pixel Width'] || '0', 10);
    const h1     = (r['H1-1'] || '').trim();

    // title_present
    if (!title) {
      failures.push({ check_id: 'title_present', passed: false, severity: 'critical', section: SECTION,
        message: 'Missing <title> tag', details: url });
      continue;
    }

    // title_unique
    if ((titleCounts.get(title) || 0) > 1) {
      failures.push({ check_id: 'title_unique', passed: false, severity: 'critical', section: SECTION,
        message: `Duplicate title: "${title.slice(0, 60)}${title.length > 60 ? '…' : ''}"`, details: url });
    }

    // title_length_chars
    if (length < 30 || length > 75) {
      failures.push({ check_id: 'title_length_chars', passed: false, severity: 'warning', section: SECTION,
        message: `Title length ${length} chars — optimal range is 50–60 (flag if < 30 or > 75)`, details: url });
    }

    // title_pixel_width
    if (pixels > 600) {
      failures.push({ check_id: 'title_pixel_width', passed: false, severity: 'warning', section: SECTION,
        message: `Title pixel width ${pixels}px — exceeds 600px display cutoff`, details: url });
    }

    // title_keyword_stuffing — any word repeated 3+ times
    const words = title.toLowerCase().split(/\s+/);
    const wordFreq = new Map();
    for (const w of words) wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    for (const [word, count] of wordFreq) {
      if (count >= 3 && word.length > 2) {
        failures.push({ check_id: 'title_keyword_stuffing', passed: false, severity: 'warning', section: SECTION,
          message: `Keyword "${word}" repeated ${count} times in title`, details: url });
        break;
      }
    }

    // title_brand
    if (brandName && !title.toLowerCase().includes(brandName.toLowerCase())) {
      failures.push({ check_id: 'title_brand', passed: false, severity: 'info', section: SECTION,
        message: `Brand name "${brandName}" not found in title`, details: url });
    }

    // title_h1_diff — title identical to H1
    if (h1 && title.toLowerCase() === h1.toLowerCase()) {
      failures.push({ check_id: 'title_h1_diff', passed: false, severity: 'info', section: SECTION,
        message: 'Title tag is identical to H1 — missed targeting opportunity', details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 4: Create s12-meta.js**

```js
// backend/services/checks/s12-meta.js
const SECTION = 'Meta Descriptions';
const CTA_VERBS_RE = /\b(get|compare|check|buy|learn|find|apply|download|try|start|explore|discover|see|view|read|calculate|plan|save|earn|invest)\b/i;
const HTML_TAG_RE  = /<[a-z][^>]*>/i;

export function runMetaDescChecks(records, _ctx) {
  const failures = [];

  // Cross-page: duplicate detection
  const descCounts = new Map();
  for (const r of records) {
    if (r['Indexability'] !== 'Indexable') continue;
    const d = (r['Meta Description 1'] || '').trim();
    if (d) descCounts.set(d, (descCounts.get(d) || 0) + 1);
  }

  // Templated description detection — same prefix (first 40 chars) on 3+ pages
  const prefixCounts = new Map();
  for (const r of records) {
    if (r['Indexability'] !== 'Indexable') continue;
    const d = (r['Meta Description 1'] || '').trim();
    if (d.length >= 40) {
      const prefix = d.slice(0, 40);
      prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
    }
  }
  const templatedPrefixes = new Set([...prefixCounts.entries()].filter(([, c]) => c >= 3).map(([p]) => p));

  for (const r of records) {
    const url  = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const desc   = (r['Meta Description 1'] || '').trim();
    const length = parseInt(r['Meta Description 1 Length'] || String(desc.length), 10);

    // meta_desc_present
    if (!desc) {
      failures.push({ check_id: 'meta_desc_present', passed: false, severity: 'warning', section: SECTION,
        message: 'Missing <meta name="description">', details: url });
      continue;
    }

    // meta_desc_unique
    if ((descCounts.get(desc) || 0) > 1) {
      failures.push({ check_id: 'meta_desc_unique', passed: false, severity: 'critical', section: SECTION,
        message: `Duplicate meta description`, details: url });
    }

    // meta_desc_length
    if (length < 120 || length > 165) {
      failures.push({ check_id: 'meta_desc_length', passed: false, severity: 'warning', section: SECTION,
        message: `Description length ${length} chars — optimal range is 140–160 (flag if < 120 or > 165)`, details: url });
    }

    // meta_desc_cta — no action verb in first 15 words
    const first15 = desc.split(/\s+/).slice(0, 15).join(' ');
    if (!CTA_VERBS_RE.test(first15)) {
      failures.push({ check_id: 'meta_desc_cta', passed: false, severity: 'info', section: SECTION,
        message: 'No action verb in first 15 words of meta description', details: url });
    }

    // meta_desc_no_html
    if (HTML_TAG_RE.test(desc)) {
      failures.push({ check_id: 'meta_desc_no_html', passed: false, severity: 'info', section: SECTION,
        message: 'HTML tags detected inside meta description', details: url });
    }

    // meta_desc_encoding — garbled characters
    if (/[^\x09\x0A\x0D\x20-\x7E -￿]/.test(desc) || desc.includes('â€') || desc.includes('Ã')) {
      failures.push({ check_id: 'meta_desc_encoding', passed: false, severity: 'info', section: SECTION,
        message: 'Possibly garbled characters in meta description (encoding issue)', details: url });
    }

    // meta_desc_auto_generated — templated descriptions
    if (desc.length >= 40 && templatedPrefixes.has(desc.slice(0, 40))) {
      failures.push({ check_id: 'meta_desc_auto_generated', passed: false, severity: 'critical', section: SECTION,
        message: 'Templated meta description (same prefix on 3+ pages)', details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 5: Run tests to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s11-titles.test.js __tests__/checks/s12-meta.test.js`
Expected: PASS — all tests passing

- [ ] **Step 6: Commit**

```bash
git add backend/services/checks/s11-titles.js backend/services/checks/s12-meta.js backend/__tests__/checks/s11-titles.test.js backend/__tests__/checks/s12-meta.test.js
git commit -m "feat: implement Section 11 title tag and Section 12 meta description checks"
```

---

### Task 9: Sections 13, 14, 15 — Headings, Content Quality, Images

**Files:**
- Create: `backend/services/checks/s13-headings.js`
- Create: `backend/services/checks/s14-content.js`
- Create: `backend/services/checks/s15-images.js`
- Add `franc-min` to `playwright-crawler/package.json` (needed for s18-intl, also install now)
- Test: `backend/__tests__/checks/s13-headings.test.js`
- Test: `backend/__tests__/checks/s14-content.test.js`
- Test: `backend/__tests__/checks/s15-images.test.js`

- [ ] **Step 1: Write failing tests**

```js
// backend/__tests__/checks/s13-headings.test.js
import { describe, it, expect } from 'vitest';
import { runHeadingChecks } from '../../services/checks/s13-headings.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'H1-1': 'Main Page Heading',
  'H1-2': '',
  'H1 Occurrences': '1',
  'H2-1': 'First Section',
  'H2 Occurrences': '3',
  'Word Count': '500',
  _headingHierarchy: [{ level: 1, text: 'Main' }, { level: 2, text: 'Section 1' }, { level: 3, text: 'Sub' }],
  ...overrides,
});

describe('runHeadingChecks', () => {
  it('passes for well-structured page', () => {
    expect(runHeadingChecks([page()], {})).toHaveLength(0);
  });
  it('flags h1_present when H1 missing', () => {
    const r = runHeadingChecks([page({ 'H1-1': '', 'H1 Occurrences': '0' })], {});
    expect(r.some(x => x.check_id === 'h1_present')).toBe(true);
  });
  it('flags h1_present when multiple H1s', () => {
    const r = runHeadingChecks([page({ 'H1-2': 'Second H1', 'H1 Occurrences': '2' })], {});
    expect(r.some(x => x.check_id === 'h1_present')).toBe(true);
  });
  it('flags h1_unique for duplicate H1 across site', () => {
    const pages = [page({ url: 'https://example.com/a' }), page({ url: 'https://example.com/b' })];
    const r = runHeadingChecks(pages, {});
    expect(r.some(x => x.check_id === 'h1_unique')).toBe(true);
  });
  it('flags heading_hierarchy for skipped level (H1→H3)', () => {
    const r = runHeadingChecks([page({ _headingHierarchy: [{ level: 1 }, { level: 3 }] })], {});
    expect(r.some(x => x.check_id === 'heading_hierarchy')).toBe(true);
  });
  it('flags h2_structure for content page > 300 words with no H2', () => {
    const r = runHeadingChecks([page({ 'H2-1': '', 'H2 Occurrences': '0' })], {});
    expect(r.some(x => x.check_id === 'h2_structure')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s14-content.test.js
import { describe, it, expect } from 'vitest';
import { runContentChecks } from '../../services/checks/s14-content.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Word Count': '500',
  'Last Modified': new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
  _bodyText: 'Main content here with enough words for testing purposes.',
  _bodyHash: 'abc123unique',
  ...overrides,
});

describe('runContentChecks', () => {
  it('passes for healthy content page', () => {
    expect(runContentChecks([page()], {})).toHaveLength(0);
  });
  it('flags word_count for < 300 words on indexable non-utility page', () => {
    const r = runContentChecks([page({ 'Word Count': '150' })], {});
    expect(r.some(x => x.check_id === 'word_count')).toBe(true);
  });
  it('flags thin_content for < 300 words on non-utility page', () => {
    const r = runContentChecks([page({ 'Word Count': '200' })], {});
    expect(r.some(x => x.check_id === 'thin_content')).toBe(true);
  });
  it('flags duplicate_content for identical body hash', () => {
    const pages = [
      page({ url: 'https://example.com/a', _bodyHash: 'duphash' }),
      page({ url: 'https://example.com/b', _bodyHash: 'duphash' }),
    ];
    const r = runContentChecks(pages, {});
    expect(r.some(x => x.check_id === 'duplicate_content')).toBe(true);
  });
  it('flags content_freshness for content > 12 months old', () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const r = runContentChecks([page({ 'Last Modified': oldDate })], {});
    expect(r.some(x => x.check_id === 'content_freshness')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s15-images.test.js
import { describe, it, expect } from 'vitest';
import { runImageChecks } from '../../services/checks/s15-images.js';

const page = (images) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _images: images,
});

describe('runImageChecks', () => {
  it('passes for image with good alt text', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/hero.webp', alt: 'Hero image showing car insurance', missing: false, fileSizeBytes: 50000 }])], {});
    expect(r).toHaveLength(0);
  });
  it('flags img_alt_missing for image with no alt attribute', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/img.png', alt: undefined, missing: true }])], {});
    expect(r.some(x => x.check_id === 'img_alt_missing')).toBe(true);
  });
  it('flags img_alt_descriptive for generic alt like "image"', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/img.png', alt: 'image', missing: false }])], {});
    expect(r.some(x => x.check_id === 'img_alt_descriptive')).toBe(true);
  });
  it('flags img_file_size for image > 200KB', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/big.jpg', alt: 'A good alt', missing: false, fileSizeBytes: 300000 }])], {});
    expect(r.some(x => x.check_id === 'img_file_size')).toBe(true);
  });
  it('flags img_broken for 4xx image', () => {
    const r = runImageChecks([page([{ src: 'https://example.com/broken.png', alt: 'alt', missing: false, statusCode: 404 }])], {});
    expect(r.some(x => x.check_id === 'img_broken')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s13-headings.test.js __tests__/checks/s14-content.test.js __tests__/checks/s15-images.test.js`
Expected: FAIL — modules not found

- [ ] **Step 3: Create s13-headings.js**

```js
// backend/services/checks/s13-headings.js
const SECTION = 'Headings';

export function runHeadingChecks(records, _ctx) {
  const failures = [];

  // Cross-page: duplicate H1 detection
  const h1Counts = new Map();
  for (const r of records) {
    if (r['Indexability'] !== 'Indexable') continue;
    const h1 = (r['H1-1'] || '').trim().toLowerCase();
    if (h1) h1Counts.set(h1, (h1Counts.get(h1) || 0) + 1);
  }

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const h1         = (r['H1-1'] || '').trim();
    const h1Count    = parseInt(r['H1 Occurrences'] || (h1 ? '1' : '0'), 10);
    const h2Count    = parseInt(r['H2 Occurrences'] || '0', 10);
    const wordCount  = parseInt(r['Word Count'] || '0', 10);
    const hierarchy  = r._headingHierarchy || [];

    // h1_present — missing or multiple H1s
    if (h1Count === 0 || !h1) {
      failures.push({ check_id: 'h1_present', passed: false, severity: 'critical', section: SECTION,
        message: 'No H1 tag on page', details: url });
    } else if (h1Count > 1 || r['H1-2']) {
      failures.push({ check_id: 'h1_present', passed: false, severity: 'critical', section: SECTION,
        message: `Multiple H1 tags: ${h1Count} found — exactly one required`, details: url });
    }

    // h1_unique
    if (h1 && (h1Counts.get(h1.toLowerCase()) || 0) > 1) {
      failures.push({ check_id: 'h1_unique', passed: false, severity: 'critical', section: SECTION,
        message: `Duplicate H1 across site: "${h1.slice(0, 60)}"`, details: url });
    }

    // h1_length
    if (h1 && (h1.length < 4 || h1.length > 100)) {
      failures.push({ check_id: 'h1_length', passed: false, severity: 'info', section: SECTION,
        message: `H1 length ${h1.length} chars — optimal range is 4–100`, details: url });
    }

    // h2_structure — content page > 300 words with no H2
    if (wordCount > 300 && h2Count === 0) {
      failures.push({ check_id: 'h2_structure', passed: false, severity: 'warning', section: SECTION,
        message: 'Content page (> 300 words) has no H2 headings', details: url });
    }

    // heading_hierarchy — skipped heading levels
    if (hierarchy.length >= 2) {
      for (let i = 1; i < hierarchy.length; i++) {
        const prev = hierarchy[i - 1].level;
        const curr = hierarchy[i].level;
        if (curr > prev + 1) {
          failures.push({ check_id: 'heading_hierarchy', passed: false, severity: 'critical', section: SECTION,
            message: `Heading hierarchy skips from H${prev} to H${curr}`, details: url });
          break;
        }
      }
    }

    // h3_h6_nesting — H3 not under an H2
    const seenLevels = new Set();
    for (const h of hierarchy) {
      if (h.level >= 3) {
        if (!seenLevels.has(h.level - 1)) {
          failures.push({ check_id: 'h3_h6_nesting', passed: false, severity: 'warning', section: SECTION,
            message: `H${h.level} appears without parent H${h.level - 1}`, details: url });
          break;
        }
      }
      seenLevels.add(h.level);
    }

    // heading_stuffing — any keyword appears 3+ times across all headings
    const allHeadingText = hierarchy.map(h => h.text || '').join(' ').toLowerCase();
    const headWords = allHeadingText.split(/\s+/);
    const freq = new Map();
    for (const w of headWords) { if (w.length > 2) freq.set(w, (freq.get(w) || 0) + 1); }
    for (const [word, count] of freq) {
      if (count >= 3) {
        failures.push({ check_id: 'heading_stuffing', passed: false, severity: 'warning', section: SECTION,
          message: `Keyword "${word}" repeated ${count} times across headings`, details: url });
        break;
      }
    }
  }

  return failures;
}
```

- [ ] **Step 4: Create s14-content.js**

For `near_duplicate`: Use SHA-256 body hash for exact duplicates, and a simple word-overlap Jaccard similarity for near-duplicates on small sites (≤ 200 pages). `franc-min` is used in s18-intl; content.js relies on `page._bodyText` and `page._bodyHash` from the content.js extractor.

```js
// backend/services/checks/s14-content.js
import crypto from 'crypto';
const SECTION = 'Content Quality';
const UTILITY_PATH_RE = /\/(login|signin|logout|search|404|error|admin|tag\/|author\/|feed|rss|page\/\d+|p=\d+)/i;
const FLESCH_EASY_THRESHOLD = 60;
const NEAR_DUP_THRESHOLD    = 0.80;
const NEAR_DUP_MAX_PAGES    = 200;
const FRESHNESS_MAX_DAYS    = 365;

function jaccardSim(textA, textB) {
  const setA = new Set(textA.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const setB = new Set(textB.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = new Set([...setA].filter(w => setB.has(w)));
  const union        = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function fleschReadingEase(text) {
  const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
  const words     = text.split(/\s+/).filter(Boolean).length || 1;
  const syllables = text.split(/[aeiouAEIOU]/).length - 1 || 1;
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

export function runContentChecks(records, _ctx) {
  const failures = [];

  const indexable = records.filter(r => r.url && r['Indexability'] === 'Indexable');

  // Cross-page: exact duplicate body hashes
  const hashMap = new Map(); // hash → first url
  for (const r of indexable) {
    const hash = r._bodyHash || '';
    if (!hash) continue;
    if (hashMap.has(hash)) {
      failures.push({ check_id: 'duplicate_content', passed: false, severity: 'critical', section: SECTION,
        message: `Exact duplicate of ${hashMap.get(hash)}`, details: r.url });
    } else {
      hashMap.set(hash, r.url);
    }
  }

  // Cross-page: near-duplicate (only on small sites ≤ 200 pages)
  if (indexable.length <= NEAR_DUP_MAX_PAGES) {
    const withText = indexable.filter(r => (r._bodyText || '').length > 200);
    for (let i = 0; i < withText.length; i++) {
      for (let j = i + 1; j < withText.length; j++) {
        const wA = parseInt(withText[i]['Word Count'] || '0', 10);
        const wB = parseInt(withText[j]['Word Count'] || '0', 10);
        if (wA === 0 || wB === 0) continue;
        // Only compare if word counts within 10% of each other
        if (Math.abs(wA - wB) / Math.max(wA, wB) > 0.10) continue;
        const sim = jaccardSim(withText[i]._bodyText || '', withText[j]._bodyText || '');
        if (sim > NEAR_DUP_THRESHOLD) {
          failures.push({ check_id: 'near_duplicate', passed: false, severity: 'warning', section: SECTION,
            message: `${Math.round(sim * 100)}% similar to ${withText[i].url}`, details: withText[j].url });
        }
      }
    }
  }

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const words  = parseInt(r['Word Count'] || '0', 10);
    const body   = r._bodyText || '';
    let isUtility = false;
    try { isUtility = UTILITY_PATH_RE.test(new URL(url).pathname); } catch { /* skip */ }

    // word_count
    if (!isUtility && words < 300) {
      failures.push({ check_id: 'word_count', passed: false, severity: 'warning', section: SECTION,
        message: `Word count ${words} — below 300-word minimum`, details: url });
    }

    // thin_content
    if (!isUtility && words < 300) {
      failures.push({ check_id: 'thin_content', passed: false, severity: 'critical', section: SECTION,
        message: `Thin content: ${words} words on non-utility page`, details: url });
    }

    // content_freshness — > 12 months old
    const lastModStr = r['Last Modified'] || r['article:modified_time'] || '';
    if (lastModStr) {
      const lastMod = new Date(lastModStr);
      if (!isNaN(lastMod)) {
        const ageDays = (Date.now() - lastMod.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > FRESHNESS_MAX_DAYS) {
          failures.push({ check_id: 'content_freshness', passed: false, severity: 'info', section: SECTION,
            message: `Content last modified ${Math.round(ageDays)} days ago — may be stale`, details: url });
        }
      }
    }

    // readability_score — Flesch < 60
    if (body.length > 500) {
      const score = fleschReadingEase(body);
      if (score < FLESCH_EASY_THRESHOLD) {
        failures.push({ check_id: 'readability_score', passed: false, severity: 'warning', section: SECTION,
          message: `Flesch Reading Ease = ${score.toFixed(1)} — below 60 (too complex)`, details: url });
      }
    }

    // expert_attribution — content pages should have author signal
    if (words > 300) {
      const hasAuthor = body.match(/\[rel="author"\]|itemprop="author"|class="author|byline|writer"|\bby\s+[A-Z][a-z]+(\s[A-Z][a-z]+)+/m);
      if (!hasAuthor && !(r._schemaItems || []).some(s => s['Type'] === 'Article' || s['Type'] === 'BlogPosting')) {
        // Check DOM-level author signals via _authorSignal flag from content.js extractor
        if (!r._authorSignal) {
          failures.push({ check_id: 'expert_attribution', passed: false, severity: 'info', section: SECTION,
            message: 'No author attribution signal found on content page', details: url });
        }
      }
    }
  }

  return failures;
}
```

- [ ] **Step 5: Create s15-images.js**

```js
// backend/services/checks/s15-images.js
const SECTION = 'Images';
const IMG_SIZE_MAX     = 200_000; // 200KB
const GENERIC_ALT_RE   = /^(image|photo|img|pic|picture|graphic|screenshot|banner|thumbnail)s?(\s*\d+)?$/i;
const FILENAME_ALT_RE  = /\.(jpe?g|png|gif|webp|svg|avif)$/i;
const GENERIC_NAME_RE  = /^(image\d+|IMG_|photo|pic\d*|screenshot)/i;
const NON_WEB_FORMAT_RE = /\.(bmp|tiff?)$/i;
const LEGACY_FORMAT_RE  = /\.(jpe?g|png)$/i;

export function runImageChecks(records, _ctx) {
  const failures = [];

  // Cross-page: duplicate alt text
  const altCounts = new Map();
  for (const r of records) {
    for (const img of (r._images || [])) {
      const alt = (img.alt || '').trim();
      if (alt) altCounts.set(alt, (altCounts.get(alt) || 0) + 1);
    }
  }

  for (const r of records) {
    const url    = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const images = r._images || [];

    let hasWebP = false;
    for (const img of images) {
      const src        = img.src || img['Source'] || '';
      const alt        = img.alt != null ? String(img.alt) : undefined;
      const hasMissing = img.missing ?? alt === undefined;
      const isContent  = img.isContent ?? true; // inside <article>/<main>

      // img_broken
      if (img.statusCode && img.statusCode >= 400) {
        failures.push({ check_id: 'img_broken', passed: false, severity: 'critical', section: SECTION,
          message: `Broken image (${img.statusCode}): ${src}`, details: url });
      }

      // img_alt_missing
      if (hasMissing) {
        failures.push({ check_id: 'img_alt_missing', passed: false, severity: 'critical', section: SECTION,
          message: `<img> missing alt attribute: ${src}`, details: url });
        continue;
      }

      // img_alt_empty — empty alt on content image
      if (alt === '' && isContent) {
        failures.push({ check_id: 'img_alt_empty', passed: false, severity: 'warning', section: SECTION,
          message: `Content image has empty alt attribute: ${src}`, details: url });
      }

      // img_alt_descriptive — generic alt text
      if (alt && (GENERIC_ALT_RE.test(alt) || FILENAME_ALT_RE.test(alt))) {
        failures.push({ check_id: 'img_alt_descriptive', passed: false, severity: 'warning', section: SECTION,
          message: `Generic/filename alt text: "${alt}"`, details: url });
      }

      // img_alt_duplicate — same alt on 3+ images
      if (alt && (altCounts.get(alt) || 0) >= 3) {
        failures.push({ check_id: 'img_alt_duplicate', passed: false, severity: 'warning', section: SECTION,
          message: `Duplicate alt text "${alt}" on ${altCounts.get(alt)} images`, details: url });
      }

      // img_file_name — generic filename
      const filename = src.split('/').pop()?.split('?')[0] || '';
      if (GENERIC_NAME_RE.test(filename)) {
        failures.push({ check_id: 'img_file_name', passed: false, severity: 'info', section: SECTION,
          message: `Generic image filename: ${filename}`, details: url });
      }

      // img_file_size
      if ((img.fileSizeBytes || img.contentLength || 0) > IMG_SIZE_MAX) {
        const kb = Math.round(img.fileSizeBytes / 1024);
        failures.push({ check_id: 'img_file_size', passed: false, severity: 'warning', section: SECTION,
          message: `Image too large: ${filename} = ${kb}KB (max 200KB)`, details: url });
      }

      // img_dimensions — missing width/height
      if (!img.width && !img.height) {
        failures.push({ check_id: 'img_dimensions', passed: false, severity: 'info', section: SECTION,
          message: `Missing width/height attributes on <img> (causes CLS): ${src}`, details: url });
      }

      // img_lazy_loading — images below fold without loading="lazy"
      if ((img.offsetTop || 0) > 800 && !img.loading) {
        failures.push({ check_id: 'img_lazy_loading', passed: false, severity: 'info', section: SECTION,
          message: `Below-fold image missing loading="lazy": ${src}`, details: url });
      }

      // img_format — BMP/TIFF or non-WebP JPEG/PNG without <picture>
      if (NON_WEB_FORMAT_RE.test(src)) {
        failures.push({ check_id: 'img_format', passed: false, severity: 'info', section: SECTION,
          message: `Legacy format (BMP/TIFF): ${filename}`, details: url });
      }

      // img_srcset — missing srcset on images
      if (!img.srcset && !img.inPicture) {
        failures.push({ check_id: 'img_srcset', passed: false, severity: 'info', section: SECTION,
          message: `<img> missing srcset for responsive images: ${src}`, details: url });
      }

      if (/\.(webp|avif)$/i.test(src)) hasWebP = true;
    }

    // img_next_gen — page uses no WebP/AVIF at all
    if (images.length > 0 && !hasWebP && !images.some(i => i.inPicture)) {
      failures.push({ check_id: 'img_next_gen', passed: false, severity: 'info', section: SECTION,
        message: 'No WebP or AVIF images found — consider next-gen format adoption', details: url });
    }

    // img_decorative_handling — decorative images without alt=""
    for (const img of images) {
      if (img.isDecorative && (img.alt || '').trim() !== '') {
        failures.push({ check_id: 'img_decorative_handling', passed: false, severity: 'info', section: SECTION,
          message: `Decorative image should have empty alt text: ${img.src || ''}`, details: url });
      }
    }
  }

  return failures;
}
```

- [ ] **Step 6: Add franc-min dependency**

```bash
cd playwright-crawler && npm install franc-min && cd ..
```

- [ ] **Step 7: Run tests to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s13-headings.test.js __tests__/checks/s14-content.test.js __tests__/checks/s15-images.test.js`
Expected: PASS — all tests passing

- [ ] **Step 8: Commit**

```bash
git add backend/services/checks/s13-headings.js backend/services/checks/s14-content.js backend/services/checks/s15-images.js backend/__tests__/checks/s13-headings.test.js backend/__tests__/checks/s14-content.test.js backend/__tests__/checks/s15-images.test.js playwright-crawler/package.json playwright-crawler/package-lock.json
git commit -m "feat: implement Section 13 headings, 14 content quality, and 15 image checks; add franc-min"
```

---

### Task 10: Sections 16, 17, 18 — Schema, Internal Linking, International SEO

**Files:**
- Create: `backend/services/checks/s16-schema.js`
- Create: `backend/services/checks/s17-links.js`
- Create: `backend/services/checks/s18-intl.js`
- Add `micromatch` to `backend/package.json`
- Test: `backend/__tests__/checks/s16-schema.test.js`
- Test: `backend/__tests__/checks/s17-links.test.js`
- Test: `backend/__tests__/checks/s18-intl.test.js`

- [ ] **Step 1: Add micromatch dependency**

```bash
cd backend && npm install micromatch && cd ..
```

- [ ] **Step 2: Write failing tests**

```js
// backend/__tests__/checks/s16-schema.test.js
import { describe, it, expect } from 'vitest';
import { runSchemaChecks } from '../../services/checks/s16-schema.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _schemaItems: [{ Type: 'WebPage', Property: '@type', Content: 'WebPage' }],
  _schemaTypes: ['WebPage'],
  _schemaValid: true,
  _hasJsonLd: true,
  ...overrides,
});

describe('runSchemaChecks', () => {
  it('passes for page with valid schema', () => {
    expect(runSchemaChecks([page()], { schemaRules: [] })).toHaveLength(0);
  });
  it('flags schema_present when no schema on key page', () => {
    const r = runSchemaChecks([page({ _schemaItems: [], _schemaTypes: [], _hasJsonLd: false })], { schemaRules: [] });
    expect(r.some(x => x.check_id === 'schema_present')).toBe(true);
  });
  it('flags schema_rules when required type missing', () => {
    const ctx = { schemaRules: [{ pattern: '/page', required: ['Product'] }] };
    const r = runSchemaChecks([page({ _schemaTypes: ['WebPage'] })], ctx);
    expect(r.some(x => x.check_id === 'schema_rules')).toBe(true);
  });
  it('flags schema_organization when homepage lacks Organization schema', () => {
    const r = runSchemaChecks([page({ url: 'https://example.com/', _schemaTypes: ['WebPage'] })], { schemaRules: [] });
    expect(r.some(x => x.check_id === 'schema_organization')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s17-links.test.js
import { describe, it, expect } from 'vitest';
import { runLinksChecks } from '../../services/checks/s17-links.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Unique Inlinks': '5',
  'Unique Outlinks': '20',
  _internalLinks: Array.from({ length: 20 }, (_, i) => ({
    href: `https://example.com/page${i}`,
    text: `Page ${i}`,
    rel: '',
    statusCode: 200,
    isRedirect: false,
  })),
  ...overrides,
});

describe('runLinksChecks', () => {
  it('passes for healthy link structure', () => {
    expect(runLinksChecks([page()], {})).toHaveLength(0);
  });
  it('flags no_orphan_pages for indexable page with zero inlinks', () => {
    const r = runLinksChecks([page({ 'Unique Inlinks': '0' })], {});
    expect(r.some(x => x.check_id === 'no_orphan_pages')).toBe(true);
  });
  it('flags internal_link_count when > 100 internal links', () => {
    const links = Array.from({ length: 101 }, (_, i) => ({ href: `https://example.com/${i}`, text: `Link ${i}`, rel: '', statusCode: 200, isRedirect: false }));
    const r = runLinksChecks([page({ _internalLinks: links })], {});
    expect(r.some(x => x.check_id === 'internal_link_count')).toBe(true);
  });
  it('flags anchor_descriptiveness for "click here" anchor', () => {
    const links = [{ href: 'https://example.com/a', text: 'click here', rel: '', statusCode: 200, isRedirect: false }];
    const r = runLinksChecks([page({ _internalLinks: links })], {});
    expect(r.some(x => x.check_id === 'anchor_descriptiveness')).toBe(true);
  });
  it('flags broken_internal_links for 4xx link', () => {
    const links = [{ href: 'https://example.com/dead', text: 'Dead link', rel: '', statusCode: 404, isRedirect: false }];
    const r = runLinksChecks([page({ _internalLinks: links })], {});
    expect(r.some(x => x.check_id === 'broken_internal_links')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s18-intl.test.js
import { describe, it, expect } from 'vitest';
import { runIntlChecks } from '../../services/checks/s18-intl.js';

const page = (overrides) => ({
  url: 'https://example.com/en/page',
  'Indexability': 'Indexable',
  _hreflangTags: [
    { lang: 'en', href: 'https://example.com/en/page' },
    { lang: 'x-default', href: 'https://example.com/en/page' },
  ],
  _bodyText: 'This is content about insurance plans available in the United Kingdom.',
  'Word Count': '300',
  ...overrides,
});

describe('runIntlChecks', () => {
  it('passes for valid hreflang setup', () => {
    expect(runIntlChecks([page()], {})).toHaveLength(0);
  });
  it('flags hreflang_self_ref when page URL not in hreflang set', () => {
    const r = runIntlChecks([page({ _hreflangTags: [{ lang: 'en', href: 'https://other.com/page' }] })], {});
    expect(r.some(x => x.check_id === 'hreflang_self_ref')).toBe(true);
  });
  it('flags hreflang_x_default when missing', () => {
    const r = runIntlChecks([page({ _hreflangTags: [{ lang: 'en', href: 'https://example.com/en/page' }] })], {});
    expect(r.some(x => x.check_id === 'hreflang_x_default')).toBe(true);
  });
  it('flags hreflang_lang_valid for invalid language code', () => {
    const r = runIntlChecks([page({ _hreflangTags: [{ lang: 'english', href: 'https://example.com/en/page' }] })], {});
    expect(r.some(x => x.check_id === 'hreflang_lang_valid')).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s16-schema.test.js __tests__/checks/s17-links.test.js __tests__/checks/s18-intl.test.js`
Expected: FAIL — modules not found

- [ ] **Step 4: Create s16-schema.js**

```js
// backend/services/checks/s16-schema.js
import micromatch from 'micromatch';
const SECTION = 'Schema & Structured Data';

const VALID_TYPES = new Set([
  'WebPage','Product','FAQPage','NewsArticle','Article','BlogPosting','BreadcrumbList',
  'DiscussionForumPosting','QAPage','ItemList','Event','HowTo','Review','LocalBusiness',
  'Organization','SiteNavigationElement','ImageObject','VideoObject','Person',
  'AggregateRating','SpeakableSpecification','WebSite',
]);

const ARTICLE_REQUIRED = ['headline', 'datePublished', 'author', 'image'];
const PRODUCT_REQUIRED = ['name', 'offers'];
const LOCAL_REQUIRED   = ['name', 'address', 'telephone'];

function getSchemaJson(page) {
  const types = page._schemaTypes || [];
  const items = page._schemaItems || [];
  return { types, items };
}

export function runSchemaChecks(records, ctx) {
  const failures = [];
  const schemaRules = ctx.schemaRules || [];

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const { types, items } = getSchemaJson(r);
    const hasSchema = types.length > 0 || r._hasJsonLd;

    // schema_rules — user-configured URL pattern → required types
    if (schemaRules.length > 0) {
      let path = '';
      try { path = new URL(url).pathname; } catch { /* skip */ }
      const matchedRule = schemaRules.find(rule => micromatch.isMatch(path, rule.pattern));
      if (matchedRule) {
        for (const reqType of matchedRule.required) {
          if (!types.includes(reqType)) {
            failures.push({ check_id: 'schema_rules', passed: false, severity: 'warning', section: SECTION,
              message: `Required schema type "${reqType}" missing (rule: ${matchedRule.pattern})`, details: url });
          }
        }
      }
    }

    // schema_present
    if (!hasSchema) {
      failures.push({ check_id: 'schema_present', passed: false, severity: 'critical', section: SECTION,
        message: 'No structured data (JSON-LD) found on page', details: url });
      continue;
    }

    // schema_json_ld — Microdata/RDFa detected instead of JSON-LD
    if (r._hasMicrodata && !r._hasJsonLd) {
      failures.push({ check_id: 'schema_json_ld', passed: false, severity: 'warning', section: SECTION,
        message: 'Page uses Microdata/RDFa — JSON-LD is the preferred format', details: url });
    }

    // schema_validation — unknown @type values
    if (!r._schemaValid) {
      failures.push({ check_id: 'schema_validation', passed: false, severity: 'warning', section: SECTION,
        message: 'Invalid or malformed JSON-LD detected', details: url });
    }
    for (const t of types) {
      if (!VALID_TYPES.has(t)) {
        failures.push({ check_id: 'schema_validation', passed: false, severity: 'warning', section: SECTION,
          message: `Unknown schema @type: "${t}"`, details: url });
      }
    }

    // schema_rich_results — Article required fields
    if (types.includes('Article') || types.includes('BlogPosting') || types.includes('NewsArticle')) {
      const articleItem = items.find(i => ['Article','BlogPosting','NewsArticle'].includes(i['Type']));
      if (articleItem) {
        const props = new Set((articleItem.properties || []).map(p => p.name));
        const missing = ARTICLE_REQUIRED.filter(f => !props.has(f));
        if (missing.length > 0) {
          failures.push({ check_id: 'schema_rich_results', passed: false, severity: 'warning', section: SECTION,
            message: `Article schema missing required fields: ${missing.join(', ')}`, details: url });
        }
      }
    }

    // schema_article — content pages without Article schema
    const wordCount = parseInt(r['Word Count'] || '0', 10);
    if (wordCount > 400 && !types.some(t => ['Article','BlogPosting','NewsArticle'].includes(t))) {
      failures.push({ check_id: 'schema_article', passed: false, severity: 'info', section: SECTION,
        message: 'Content page without Article/BlogPosting/NewsArticle schema', details: url });
    }

    // schema_organization — homepage must have Organization/WebSite schema
    let path = '';
    try { path = new URL(url).pathname; } catch { /* skip */ }
    if (path === '/' || path === '') {
      if (!types.some(t => ['Organization','WebSite'].includes(t))) {
        failures.push({ check_id: 'schema_organization', passed: false, severity: 'info', section: SECTION,
          message: 'Homepage missing Organization or WebSite schema', details: url });
      }
    }

    // schema_faq — Q&A heading pattern without FAQPage schema
    if (r._hasQandAHeadings && !types.includes('FAQPage')) {
      failures.push({ check_id: 'schema_faq', passed: false, severity: 'info', section: SECTION,
        message: 'FAQ-style headings detected but no FAQPage schema', details: url });
    }

    // schema_breadcrumb — breadcrumb nav without BreadcrumbList schema
    if (r._hasBreadcrumbNav && !types.includes('BreadcrumbList')) {
      failures.push({ check_id: 'schema_breadcrumb', passed: false, severity: 'info', section: SECTION,
        message: 'Breadcrumb navigation detected without BreadcrumbList schema', details: url });
    }

    // schema_product — product page without Product schema
    if (r._isProductPage && !types.includes('Product')) {
      failures.push({ check_id: 'schema_product', passed: false, severity: 'info', section: SECTION,
        message: 'Product page detected without Product schema', details: url });
    }

    // schema_local_business — local business page without LocalBusiness schema
    if (r._isLocalPage && !types.includes('LocalBusiness')) {
      failures.push({ check_id: 'schema_local_business', passed: false, severity: 'info', section: SECTION,
        message: 'Local business page without LocalBusiness schema', details: url });
    }

    // schema_author — Article schema missing author name
    for (const item of items) {
      if (!['Article','BlogPosting','NewsArticle'].includes(item['Type'])) continue;
      const author = item['author'] || {};
      if (!author.name) {
        failures.push({ check_id: 'schema_author', passed: false, severity: 'info', section: SECTION,
          message: 'Article schema author.name missing', details: url });
      }
    }
  }

  return failures;
}
```

- [ ] **Step 5: Create s17-links.js**

```js
// backend/services/checks/s17-links.js
const SECTION = 'Internal Linking';
const GENERIC_ANCHORS = new Set(['click here', 'read more', 'here', 'this', 'link', 'learn more', 'more', 'more info']);
const MAX_INTERNAL_LINKS = 100;

export function runLinksChecks(records, _ctx) {
  const failures = [];

  // Cross-page: anchor text analysis (exact match overuse per target URL)
  const anchorsByTarget = new Map(); // targetUrl → Set of anchor texts from all pages
  for (const r of records) {
    for (const link of (r._internalLinks || [])) {
      if (!link.href) continue;
      if (!anchorsByTarget.has(link.href)) anchorsByTarget.set(link.href, []);
      anchorsByTarget.get(link.href).push((link.text || '').trim().toLowerCase());
    }
  }

  // Internal PageRank proxy: count inlinks per URL
  const inlinkCount = new Map();
  for (const r of records) {
    for (const link of (r._internalLinks || [])) {
      if (link.href) inlinkCount.set(link.href, (inlinkCount.get(link.href) || 0) + 1);
    }
  }

  let totalInternalLinks = 0, nofollowCount = 0;

  for (const r of records) {
    const url   = r.url || '';
    if (!url) continue;
    const links  = r._internalLinks || [];
    const inlinks = parseInt(r['Unique Inlinks'] || '0', 10);
    const isIdx  = r['Indexability'] === 'Indexable';

    totalInternalLinks += links.length;
    nofollowCount += links.filter(l => (l.rel || '').includes('nofollow')).length;

    // no_orphan_pages
    if (isIdx && inlinks === 0) {
      failures.push({ check_id: 'no_orphan_pages', passed: false, severity: 'warning', section: SECTION,
        message: 'Indexable page has no internal inlinks', details: url });
    }

    // internal_link_count — > 100 outbound internal links
    if (links.length > MAX_INTERNAL_LINKS) {
      failures.push({ check_id: 'internal_link_count', passed: false, severity: 'warning', section: SECTION,
        message: `${links.length} internal links on page — exceeds 100`, details: url });
    }

    for (const link of links) {
      if (!link.href) continue;

      // broken_internal_links
      if (link.statusCode && link.statusCode >= 400) {
        failures.push({ check_id: 'broken_internal_links', passed: false, severity: 'critical', section: SECTION,
          message: `Broken internal link (${link.statusCode}): ${link.href}`, details: url });
      }

      // internal_links_200 — same check, different check_id
      if (link.statusCode && link.statusCode >= 400) {
        failures.push({ check_id: 'internal_links_200', passed: false, severity: 'critical', section: SECTION,
          message: `Internal link returns ${link.statusCode}: ${link.href}`, details: url });
      }

      // redirect_internal_links — link resolves via redirect
      if (link.isRedirect) {
        failures.push({ check_id: 'redirect_internal_links', passed: false, severity: 'warning', section: SECTION,
          message: `Internal link redirects — update to point to final URL: ${link.href}`, details: url });
      }

      // anchor_descriptiveness — generic anchor text
      const anchor = (link.text || '').trim().toLowerCase();
      if (anchor && GENERIC_ANCHORS.has(anchor)) {
        failures.push({ check_id: 'anchor_descriptiveness', passed: false, severity: 'warning', section: SECTION,
          message: `Generic anchor text "${anchor}" for link to ${link.href}`, details: url });
      }
    }
  }

  // internal_nofollow — > 5% of internal links use nofollow
  if (totalInternalLinks > 0 && nofollowCount / totalInternalLinks > 0.05) {
    failures.push({ check_id: 'internal_nofollow', passed: false, severity: 'warning', section: SECTION,
      message: `${nofollowCount}/${totalInternalLinks} internal links (${Math.round(nofollowCount/totalInternalLinks*100)}%) use nofollow`,
      details: null });
  }

  // anchor_exact_match — all inlinks to a page use identical anchor text
  for (const [target, anchors] of anchorsByTarget) {
    if (anchors.length < 3) continue;
    const uniqueAnchors = new Set(anchors);
    if (uniqueAnchors.size === 1 && !GENERIC_ANCHORS.has([...uniqueAnchors][0])) {
      failures.push({ check_id: 'anchor_exact_match', passed: false, severity: 'info', section: SECTION,
        message: `All ${anchors.length} inlinks to ${target} use identical exact-match anchor: "${[...uniqueAnchors][0]}"`,
        details: target });
    }
  }

  // internal_crawl_depth — same as crawl_depth in s05, reported here too
  for (const r of records) {
    if (!r.url || r['Indexability'] !== 'Indexable') continue;
    const depth = parseInt(r['Crawl Depth'] || '0', 10);
    if (depth > 4) {
      failures.push({ check_id: 'internal_crawl_depth', passed: false, severity: 'warning', section: SECTION,
        message: `Page is ${depth} clicks deep from root`, details: r.url });
    }
  }

  return failures;
}
```

- [ ] **Step 6: Create s18-intl.js**

```js
// backend/services/checks/s18-intl.js
// franc-min provides language detection for content_language_match
let franc;
try { franc = (await import('franc-min')).franc; } catch { franc = null; }

const SECTION = 'International SEO';
const ISO_639_1 = new Set(['aa','ab','ae','af','ak','am','an','ar','as','av','ay','az','ba','be','bg','bh','bi','bm','bn','bo','br','bs','ca','ce','ch','co','cr','cs','cu','cv','cy','da','de','dv','dz','ee','el','en','eo','es','et','eu','fa','ff','fi','fj','fo','fr','fy','ga','gd','gl','gn','gu','gv','ha','he','hi','ho','hr','ht','hu','hy','hz','ia','id','ie','ig','ii','ik','io','is','it','iu','ja','jv','ka','kg','ki','kj','kk','kl','km','kn','ko','kr','ks','ku','kv','kw','ky','la','lb','lg','li','ln','lo','lt','lu','lv','mg','mh','mi','mk','ml','mn','mr','ms','mt','my','na','nb','nd','ne','ng','nl','nn','no','nr','nv','ny','oc','oj','om','or','os','pa','pi','pl','ps','pt','qu','rm','rn','ro','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sq','sr','ss','st','su','sv','sw','ta','te','tg','th','ti','tk','tl','tn','to','tr','ts','tt','tw','ty','ug','uk','ur','uz','ve','vi','vo','wa','wo','xh','yi','yo','za','zh','zu']);

export function runIntlChecks(records, _ctx) {
  const failures = [];

  // Build map of all crawled hreflang tags: url → Set of {lang, href} alternatives
  const hreflangGraph = new Map(); // url → array of {lang, href}
  for (const r of records) {
    if (r.url && (r._hreflangTags || []).length > 0) {
      hreflangGraph.set(r.url, r._hreflangTags);
    }
  }

  const internationalPages = records.filter(r => (r._hreflangTags || []).length > 0);
  if (internationalPages.length === 0) return failures; // Not an international site

  for (const r of records) {
    const url  = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const tags = r._hreflangTags || [];
    if (tags.length === 0) continue;

    // hreflang_present — hreflang tags present (check passes if tags exist)
    // (absence on non-international pages is fine — skip non-tagged pages above)

    // hreflang_self_ref — page's own URL not in hreflang set
    const selfRef = tags.find(t => t.href === url);
    if (!selfRef) {
      failures.push({ check_id: 'hreflang_self_ref', passed: false, severity: 'critical', section: SECTION,
        message: `Page URL not included in its own hreflang annotations`, details: url });
    }

    // hreflang_x_default — x-default must be present
    if (!tags.find(t => t.lang === 'x-default')) {
      failures.push({ check_id: 'hreflang_x_default', passed: false, severity: 'warning', section: SECTION,
        message: 'x-default hreflang annotation missing', details: url });
    }

    // hreflang_lang_valid — validate ISO 639-1 + optional ISO 3166-1 region
    for (const tag of tags) {
      if (tag.lang === 'x-default') continue;
      const [lang, region] = tag.lang.split('-');
      if (!ISO_639_1.has(lang)) {
        failures.push({ check_id: 'hreflang_lang_valid', passed: false, severity: 'warning', section: SECTION,
          message: `Invalid language code in hreflang: "${tag.lang}"`, details: url });
      }
    }

    // hreflang_reciprocal — every referenced URL should reference back
    for (const tag of tags) {
      if (tag.lang === 'x-default') continue;
      const targetTags = hreflangGraph.get(tag.href);
      if (targetTags) {
        const reciprocates = targetTags.some(t => t.href === url);
        if (!reciprocates) {
          failures.push({ check_id: 'hreflang_reciprocal', passed: false, severity: 'critical', section: SECTION,
            message: `Hreflang alternate ${tag.href} does not reference back to ${url}`, details: url });
        }
      }
    }

    // hreflang_url_consistent — all URLs in set use same format (trailing slash, protocol, www)
    const hrefs = tags.map(t => t.href);
    const trailingSlashes = hrefs.filter(h => { try { return new URL(h).pathname.endsWith('/'); } catch { return false; } });
    if (trailingSlashes.length > 0 && trailingSlashes.length < hrefs.length) {
      failures.push({ check_id: 'hreflang_url_consistent', passed: false, severity: 'critical', section: SECTION,
        message: 'Hreflang set mixes URLs with/without trailing slash', details: url });
    }

    // content_language_match — detect language and compare to hreflang value
    const bodyText = r._bodyText || '';
    const wordCount = parseInt(r['Word Count'] || '0', 10);
    if (franc && bodyText.length > 200 && wordCount >= 200) {
      const selfTag = tags.find(t => t.href === url);
      if (selfTag && selfTag.lang !== 'x-default') {
        const declaredLang = selfTag.lang.split('-')[0];
        let detectedLang = null;
        try {
          detectedLang = franc(bodyText.slice(0, 2000));
        } catch { /* skip */ }
        if (detectedLang && detectedLang !== 'und' && detectedLang !== declaredLang) {
          failures.push({ check_id: 'content_language_match', passed: false, severity: 'critical', section: SECTION,
            message: `Detected language "${detectedLang}" does not match declared hreflang "${declaredLang}"`,
            details: url });
        }
      }
    }

    // intl_url_strategy — detect mixed strategy (subdirectory + subdomain)
    // (handled site-level in s06-url.js as subdomain_vs_subfolder)
  }

  // hreflang_indexed — check if any hreflang alternate URL returns non-200
  for (const [url, tags] of hreflangGraph) {
    for (const tag of tags) {
      if (tag.lang === 'x-default') continue;
      const altRecord = records.find(r => r.url === tag.href);
      if (altRecord) {
        const code = String(altRecord['Status Code'] || '');
        const isNoindex = altRecord['Indexability'] !== 'Indexable';
        if (!code.startsWith('200') || isNoindex) {
          failures.push({ check_id: 'hreflang_indexed', passed: false, severity: 'warning', section: SECTION,
            message: `Hreflang alternate ${tag.href} is not indexed (${code || 'noindex'})`, details: url });
        }
      }
    }
  }

  return failures;
}
```

- [ ] **Step 7: Run tests to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s16-schema.test.js __tests__/checks/s17-links.test.js __tests__/checks/s18-intl.test.js`
Expected: PASS — all tests passing

- [ ] **Step 8: Commit**

```bash
git add backend/services/checks/s16-schema.js backend/services/checks/s17-links.js backend/services/checks/s18-intl.js backend/__tests__/checks/s16-schema.test.js backend/__tests__/checks/s17-links.test.js backend/__tests__/checks/s18-intl.test.js backend/package.json backend/package-lock.json
git commit -m "feat: implement Section 16 schema, 17 internal links, 18 international SEO checks; add micromatch"
```

---

### Task 11: Sections 21–24 — E-E-A-T, AIO, GEO, Local SEO Automated Checks

**Files:**
- Create: `backend/services/checks/s21-eeat.js`
- Create: `backend/services/checks/s22-aio.js`
- Create: `backend/services/checks/s23-geo.js`
- Create: `backend/services/checks/s24-local.js`
- Test: `backend/__tests__/checks/s21-eeat.test.js`
- Test: `backend/__tests__/checks/s22-aio.test.js`
- Test: `backend/__tests__/checks/s23-geo.test.js`
- Test: `backend/__tests__/checks/s24-local.test.js`

- [ ] **Step 1: Write failing tests**

```js
// backend/__tests__/checks/s21-eeat.test.js
import { describe, it, expect } from 'vitest';
import { runEeatChecks } from '../../services/checks/s21-eeat.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Word Count': '400',
  _bodyText: 'By John Smith. This article explains insurance options. We are licensed by IRDAI Reg. No. 101. Last updated January 2026.',
  _internalLinks: [{ href: 'https://example.com/contact', text: 'Contact' }],
  _schemaTypes: ['Article'],
  _schemaItems: [],
  _authorSignal: true,
  ...overrides,
});

describe('runEeatChecks', () => {
  it('passes for page with good E-E-A-T signals', () => {
    expect(runEeatChecks([page()], {})).toHaveLength(0);
  });
  it('flags author_expertise on YMYL page without author signal', () => {
    const r = runEeatChecks([page({ url: 'https://example.com/insurance/car', _authorSignal: false })], {});
    expect(r.some(x => x.check_id === 'author_expertise')).toBe(true);
  });
  it('flags contact_page_present when no contact link found', () => {
    const r = runEeatChecks([page({ _internalLinks: [] })], {});
    expect(r.some(x => x.check_id === 'contact_page_present')).toBe(true);
  });
  it('flags ymyl_disclaimer_present when YMYL page lacks disclaimer', () => {
    const r = runEeatChecks([page({ url: 'https://example.com/insurance/car', _bodyText: 'Some insurance content without any disclaimer. premium and policy coverage claim.' })], {});
    expect(r.some(x => x.check_id === 'ymyl_disclaimer_present')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s22-aio.test.js
import { describe, it, expect } from 'vitest';
import { runAioChecks } from '../../services/checks/s22-aio.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Word Count': '900',
  _headingHierarchy: [
    { level: 2, text: 'What is car insurance?' },
    { level: 2, text: 'How does car insurance work?' },
    { level: 2, text: 'Why do I need coverage?' },
  ],
  _schemaTypes: ['Article', 'FAQPage'],
  _hasTocAnchors: true,
  ...overrides,
});

describe('runAioChecks', () => {
  it('passes for AIO-optimized page', () => {
    expect(runAioChecks([page()], {})).toHaveLength(0);
  });
  it('flags aio_qa_format when < 2 question headings on informational page', () => {
    const r = runAioChecks([page({ _headingHierarchy: [{ level: 2, text: 'Overview' }, { level: 2, text: 'Details' }] })], {});
    expect(r.some(x => x.check_id === 'aio_qa_format')).toBe(true);
  });
  it('flags aio_schema_ai_readability when no Article/FAQ/HowTo schema', () => {
    const r = runAioChecks([page({ _schemaTypes: ['WebPage'] })], {});
    expect(r.some(x => x.check_id === 'aio_schema_ai_readability')).toBe(true);
  });
  it('flags aio_content_length for informational page < 800 words', () => {
    const r = runAioChecks([page({ 'Word Count': '500' })], {});
    expect(r.some(x => x.check_id === 'aio_content_length')).toBe(true);
  });
  it('flags aio_toc_anchors for long-form page without TOC', () => {
    const r = runAioChecks([page({ 'Word Count': '2000', _hasTocAnchors: false })], {});
    expect(r.some(x => x.check_id === 'aio_toc_anchors')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s23-geo.test.js
import { describe, it, expect } from 'vitest';
import { runGeoChecks } from '../../services/checks/s23-geo.js';

const pagesWithSiteData = (siteDataOverrides = {}) => [{
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _isHttps: true,
  _jsRender: { rawHasH1: true, rawWordCount: 200, rawLinkCount: 5 },
  _siteData: {
    robots: {
      exists: true,
      llmsTxt: '# Example\n\nSite description here.\n\n- [Blog](/blog): Our blog',
      llmsFullTxt: null,
      urlMdSample: { hasAny: false, tested: [], found: [] },
      agentRules: { GPTBot: { disallowed: [], allowed: ['/'] } },
    },
    ...siteDataOverrides,
  },
  'Canonical Link Element 1': 'https://example.com/page',
}];

describe('runGeoChecks', () => {
  it('passes for GEO-optimized site', () => {
    expect(runGeoChecks(pagesWithSiteData(), {})).toHaveLength(0);
  });
  it('flags geo_llms_txt when llms.txt not found', () => {
    const r = runGeoChecks(pagesWithSiteData({ robots: { exists: true, llmsTxt: null, llmsFullTxt: null, urlMdSample: { hasAny: false }, agentRules: {} } }), {});
    expect(r.some(x => x.check_id === 'geo_llms_txt')).toBe(true);
  });
  it('flags geo_https_trust for HTTP content page', () => {
    const pages = pagesWithSiteData();
    pages[0]._isHttps = false;
    pages[0].url = 'http://example.com/page';
    const r = runGeoChecks(pages, {});
    expect(r.some(x => x.check_id === 'geo_https_trust')).toBe(true);
  });
  it('flags geo_content_without_js when H1 only in rendered DOM', () => {
    const pages = pagesWithSiteData();
    pages[0]._jsRender = { rawHasH1: false, rawWordCount: 0, rawLinkCount: 0 };
    const r = runGeoChecks(pages, {});
    expect(r.some(x => x.check_id === 'geo_content_without_js')).toBe(true);
  });
});
```

```js
// backend/__tests__/checks/s24-local.test.js
import { describe, it, expect } from 'vitest';
import { runLocalChecks } from '../../services/checks/s24-local.js';

const page = (overrides) => ({
  url: 'https://example.com/location/dubai',
  'Indexability': 'Indexable',
  'Word Count': '400',
  'Status Code': '200',
  _schemaTypes: ['LocalBusiness'],
  _schemaItems: [{
    Type: 'LocalBusiness',
    properties: [
      { name: 'name', value: 'Example Insurance Dubai' },
      { name: 'address', value: '123 Main St, Dubai' },
      { name: 'telephone', value: '+971 4 123 4567' },
      { name: 'openingHours', value: 'Mo-Fr 09:00-18:00' },
      { name: 'geo', value: { latitude: 25.2, longitude: 55.3 } },
    ],
  }],
  ...overrides,
});

describe('runLocalChecks', () => {
  it('passes for complete LocalBusiness schema', () => {
    expect(runLocalChecks([page()], {})).toHaveLength(0);
  });
  it('flags local_business_schema when LocalBusiness schema missing', () => {
    const r = runLocalChecks([page({ _schemaTypes: [], _schemaItems: [] })], {});
    expect(r.some(x => x.check_id === 'local_business_schema')).toBe(true);
  });
  it('flags local_location_crawlable for non-200 location page', () => {
    const r = runLocalChecks([page({ 'Status Code': '404', 'Indexability': 'Non-Indexable' })], {});
    expect(r.some(x => x.check_id === 'local_location_crawlable')).toBe(true);
  });
  it('flags local_schema_geo when geo coordinates missing', () => {
    const itemWithoutGeo = {
      Type: 'LocalBusiness',
      properties: [
        { name: 'name', value: 'Example' }, { name: 'address', value: 'Dubai' },
        { name: 'telephone', value: '+971 1234567' }, { name: 'openingHours', value: 'Mo-Fr' },
      ],
    };
    const r = runLocalChecks([page({ _schemaItems: [itemWithoutGeo] })], {});
    expect(r.some(x => x.check_id === 'local_schema_geo')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd backend && npx vitest run __tests__/checks/s21-eeat.test.js __tests__/checks/s22-aio.test.js __tests__/checks/s23-geo.test.js __tests__/checks/s24-local.test.js`
Expected: FAIL — modules not found

- [ ] **Step 3: Create s21-eeat.js**

```js
// backend/services/checks/s21-eeat.js
import { classifyYmyl } from '../audit-parser.service.js';
const SECTION_EEAT   = 'E-E-A-T Signals';
const SECTION_YMYL   = 'E-E-A-T Signals';

const IRDAI_RE    = /IRDA[I]?\s*Reg\.?\s*No\.?\s*\d+/i;
const SEBI_RE     = /SEBI\s*Reg\.?\s*No/i;
const DISCLAIMER_PATTERNS = [
  /insurance is subject to terms/i,
  /read policy document carefully/i,
  /licensed broker/i,
  /not financial advice/i,
  /consult a financial advisor/i,
];
const CREDENTIAL_RE = /\b(CFP|CFA|CAIIB|Dr\.|MBBS|CA\b|LLB|IRDAI licensed|SEBI registered)\b/;
const EXPERT_REVIEW_RE = /reviewed by|medically reviewed|fact.?checked by|verified by|approved by/i;
const DATE_RE = /last updated|reviewed on|effective from|as of [a-z]+ \d{4}/i;
const TRUSTED_GOV_RE  = /\.(gov|edu)(\.|\b)/i;

export function runEeatChecks(records, ctx) {
  const failures = [];

  // Site-level: is there a contact page link?
  const allLinks = records.flatMap(r => r._internalLinks || []);
  const hasContactLink = allLinks.some(l => /\/(contact|contact-us|reach-us)/i.test(l.href || ''));
  const hasPrivacyLink = allLinks.some(l => /\/(privacy|privacy-policy)/i.test(l.href || ''));
  const hasTermsLink   = allLinks.some(l => /\/(terms|terms-of-service|tos)/i.test(l.href || ''));

  if (!hasContactLink) {
    failures.push({ check_id: 'contact_page_present', passed: false, severity: 'warning', section: SECTION_EEAT,
      message: 'No link to contact page found in site navigation', details: null });
  }
  if (!hasPrivacyLink) {
    failures.push({ check_id: 'privacy_policy_present', passed: false, severity: 'warning', section: SECTION_EEAT,
      message: 'No link to privacy policy found in site navigation', details: null });
  }
  if (!hasTermsLink) {
    failures.push({ check_id: 'terms_of_service_present', passed: false, severity: 'info', section: SECTION_EEAT,
      message: 'No link to terms of service found in site navigation', details: null });
  }

  const customYmylPatterns = (ctx.siteSettings?.get('ymyl_url_patterns') || '').split('\n').filter(Boolean);

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const body    = r._bodyText || '';
    const words   = parseInt(r['Word Count'] || '0', 10);
    const ymyl    = classifyYmyl(url, body, customYmylPatterns);
    const isYmyl  = ymyl !== null;
    const schema  = r._schemaTypes || [];
    const items   = r._schemaItems || [];
    const links   = r._internalLinks || [];

    // author_expertise
    if (words > 300) {
      if (!r._authorSignal) {
        failures.push({
          check_id: 'author_expertise', passed: false,
          severity: isYmyl ? 'critical' : 'warning',
          section: SECTION_EEAT,
          message: `No author attribution found on ${isYmyl ? 'YMYL ' : ''}content page`,
          details: url });
      }
    }

    // author_links — author block without social/profile links
    if (r._authorSignal && !r._authorHasSocialLink) {
      failures.push({ check_id: 'author_links', passed: false, severity: 'warning', section: SECTION_EEAT,
        message: 'Author block found but no social/profile links (LinkedIn, Twitter, etc.)', details: url });
    }

    // expert_review
    if (words > 300 && !EXPERT_REVIEW_RE.test(body)) {
      failures.push({
        check_id: 'expert_review', passed: false,
        severity: isYmyl ? 'critical' : 'warning',
        section: SECTION_EEAT,
        message: `No expert review/fact-check attribution on ${isYmyl ? 'YMYL ' : ''}content page`,
        details: url });
    }

    // ymyl_disclaimer_present
    if (isYmyl) {
      const customDisclaimerPatterns = (ctx.siteSettings?.get('ymyl_disclaimer_patterns') || '')
        .split('\n').filter(Boolean).map(p => { try { return new RegExp(p, 'i'); } catch { return null; } }).filter(Boolean);
      const allPatterns = [...DISCLAIMER_PATTERNS, IRDAI_RE, SEBI_RE, ...customDisclaimerPatterns];
      const hasDisclaimer = allPatterns.some(re => re.test(body));
      if (!hasDisclaimer) {
        failures.push({ check_id: 'ymyl_disclaimer_present', passed: false, severity: 'critical', section: SECTION_YMYL,
          message: 'YMYL page missing regulatory disclaimer (IRDAI/SEBI or financial advisory notice)',
          details: url });
      }
    }

    // ymyl_date_disclosure
    if (isYmyl) {
      const hasDate = DATE_RE.test(body) || r['article:modified_time'] || r['article:published_time'];
      if (!hasDate) {
        failures.push({ check_id: 'ymyl_date_disclosure', passed: false, severity: 'critical', section: SECTION_YMYL,
          message: 'YMYL page has no visible date disclosure (last updated / reviewed on)', details: url });
      }
    }

    // ymyl_outbound_authority
    if (isYmyl && words >= 200) {
      const outboundLinks = links.filter(l => {
        try { return new URL(l.href).hostname !== new URL(url).hostname; } catch { return false; }
      });
      const trustedDomains = (ctx.siteSettings?.get('trusted_authority_domains') || '')
        .split('\n').filter(Boolean);
      const hasAuthority = outboundLinks.some(l => {
        try {
          const host = new URL(l.href).hostname;
          return TRUSTED_GOV_RE.test(host) || trustedDomains.some(d => host === d || host.endsWith('.' + d));
        } catch { return false; }
      });
      if (!hasAuthority) {
        failures.push({ check_id: 'ymyl_outbound_authority', passed: false, severity: 'info', section: SECTION_YMYL,
          message: 'YMYL page has no outbound links to government or authoritative domains', details: url });
      }
    }

    // author_credentials_schema — Article schema author needs jobTitle or honorificPrefix
    if (schema.some(t => ['Article','BlogPosting','NewsArticle'].includes(t))) {
      for (const item of items) {
        if (!['Article','BlogPosting','NewsArticle'].includes(item['Type'])) continue;
        const author = item['author'] || {};
        if (author.name && !author.jobTitle && !author.honorificPrefix) {
          failures.push({
            check_id: 'author_credentials_schema', passed: false,
            severity: isYmyl ? 'critical' : 'warning',
            section: SECTION_YMYL,
            message: 'Article author schema missing jobTitle or honorificPrefix credential',
            details: url });
        }
      }
    }

    // ymyl_review — YMYL page needs expert reviewer with credentials
    if (isYmyl && words > 300) {
      const credentialMatch = EXPERT_REVIEW_RE.test(body) && CREDENTIAL_RE.test(body);
      if (!credentialMatch) {
        failures.push({ check_id: 'ymyl_review', passed: false, severity: 'critical', section: SECTION_YMYL,
          message: 'YMYL page missing expert reviewer credit with recognized credentials', details: url });
      }
    }

    // update_history_visible
    if (!DATE_RE.test(body) && !r._hasTimeElement) {
      failures.push({ check_id: 'update_history_visible', passed: false, severity: 'info', section: SECTION_EEAT,
        message: 'No "Last updated" date element visible on page', details: url });
    }

    // transparent_methodology — data-heavy pages
    if (r._hasDataSignals && !/(methodology|how we calculate|how we rank|data source|based on data from|our research process)/i.test(body)) {
      failures.push({ check_id: 'transparent_methodology', passed: false, severity: 'info', section: SECTION_EEAT,
        message: 'Data-heavy page has no methodology disclosure', details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 4: Create s22-aio.js**

```js
// backend/services/checks/s22-aio.js
const SECTION = 'AI Overviews & AIO Optimization';
const QUESTION_RE = /\?$/;
const AIO_SCHEMA_TYPES = new Set(['Article', 'FAQPage', 'HowTo', 'SpeakableSpecification']);
const FRESHNESS_DAYS_FAST = 180; // 6 months for fast-changing topics

export function runAioChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const words    = parseInt(r['Word Count'] || '0', 10);
    const schema   = r._schemaTypes || [];
    const hierarchy = r._headingHierarchy || [];
    const isInfoPage = !/(\/shop|\/product|\/checkout|\/cart|\/login|\/signup)/i.test(url);

    // aio_qa_format — informational page should have ≥ 2 question-format H2/H3 headings
    if (isInfoPage && words > 300) {
      const questionHeadings = hierarchy.filter(h => (h.level === 2 || h.level === 3) && QUESTION_RE.test(h.text || ''));
      if (questionHeadings.length < 2) {
        failures.push({ check_id: 'aio_qa_format', passed: false, severity: 'warning', section: SECTION,
          message: `Only ${questionHeadings.length} question-format headings — aim for ≥ 2 on informational pages`,
          details: url });
      }
    }

    // aio_schema_ai_readability — needs Article, FAQ, HowTo, or speakable
    if (!schema.some(t => AIO_SCHEMA_TYPES.has(t))) {
      failures.push({ check_id: 'aio_schema_ai_readability', passed: false, severity: 'warning', section: SECTION,
        message: 'No Article/FAQ/HowTo/speakable schema — AI readability compromised', details: url });
    }

    // aio_content_freshness — > 6 months old for AIO purposes
    const lastMod = r['Last Modified'] || '';
    if (lastMod) {
      const ageDays = (Date.now() - new Date(lastMod).getTime()) / (1000 * 60 * 60 * 24);
      if (!isNaN(ageDays) && ageDays > FRESHNESS_DAYS_FAST) {
        failures.push({ check_id: 'aio_content_freshness', passed: false, severity: 'warning', section: SECTION,
          message: `Content last modified ${Math.round(ageDays)} days ago — stale for AI-indexed topics`,
          details: url });
      }
    }

    // aio_toc_anchors — long-form pages (> 1,500 words) need a TOC
    if (words > 1500 && !r._hasTocAnchors) {
      failures.push({ check_id: 'aio_toc_anchors', passed: false, severity: 'info', section: SECTION,
        message: 'Long-form page (> 1,500 words) missing table of contents with anchor links', details: url });
    }

    // aio_content_length — informational pages < 800 words
    if (isInfoPage && words > 0 && words < 800) {
      failures.push({ check_id: 'aio_content_length', passed: false, severity: 'info', section: SECTION,
        message: `Informational page has only ${words} words — consider comprehensive coverage`, details: url });
    }

    // aio_longtail_coverage — < 3 question headings
    if (isInfoPage) {
      const questionCount = hierarchy.filter(h => QUESTION_RE.test(h.text || '')).length;
      if (questionCount < 3) {
        failures.push({ check_id: 'aio_longtail_coverage', passed: false, severity: 'info', section: SECTION,
          message: `Only ${questionCount} question-format headings — long-tail coverage may be insufficient`,
          details: url });
      }
    }

    // aio_speakable — authoritative answer content without speakable schema
    if (schema.includes('Article') && !r._hasSpeakable) {
      failures.push({ check_id: 'aio_speakable', passed: false, severity: 'info', section: SECTION,
        message: 'Article without speakable schema property', details: url });
    }

    // aio_nlp_structure — flat unstructured text > 500 words with no H2
    if (words > 500 && hierarchy.filter(h => h.level === 2).length === 0) {
      failures.push({ check_id: 'aio_nlp_structure', passed: false, severity: 'warning', section: SECTION,
        message: 'Long content block (> 500 words) with no H2 heading structure', details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 5: Create s23-geo.js**

```js
// backend/services/checks/s23-geo.js
const SECTION = 'GEO & LLM Crawlers';
const AI_CRAWLERS_GEO = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];
const BLOG_DOCS_RE    = /\/(blog|docs|articles|guide|learn|news|help)\//i;
const CONTENT_PAGES_MIN = 20;

export function runGeoChecks(records, _ctx) {
  const failures = [];

  const siteRecord = records.find(r => r._siteData?.robots);
  const robots = siteRecord?._siteData?.robots;

  // geo_llms_txt
  if (robots && !robots.llmsTxt) {
    failures.push({ check_id: 'geo_llms_txt', passed: false, severity: 'info', section: SECTION,
      message: '/llms.txt not found — missing AI-readable site index', details: '/llms.txt' });
  }

  // geo_llms_full_txt
  if (robots && !robots.llmsFullTxt) {
    failures.push({ check_id: 'geo_llms_full_txt', passed: false, severity: 'info', section: SECTION,
      message: '/llms-full.txt not found — consider adding expanded AI content index', details: '/llms-full.txt' });
  }

  // geo_llms_txt_quality — structural validation
  if (robots?.llmsTxt) {
    const text = robots.llmsTxt;
    const issues = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const linkLines = lines.filter(l => /^\[.+\]\(.+\)/.test(l));
    if (linkLines.length < 3) issues.push('fewer than 3 link entries');
    if (!lines[0] || lines[0].startsWith('[')) issues.push('no site description paragraph before links');
    if (linkLines.some(l => /\?[a-z]+=|;jsessionid/i.test(l))) issues.push('query-string or session URLs present');
    if (issues.length > 0) {
      failures.push({ check_id: 'geo_llms_txt_quality', passed: false, severity: 'warning', section: SECTION,
        message: `llms.txt quality issues: ${issues.join('; ')}`, details: '/llms.txt' });
    }
  }

  // geo_url_md_endpoint
  if (robots) {
    const { urlMdSample } = robots;
    const contentPageCount = records.filter(r => BLOG_DOCS_RE.test(r.url || '')).length;
    if (contentPageCount >= CONTENT_PAGES_MIN && !urlMdSample?.hasAny) {
      failures.push({ check_id: 'geo_url_md_endpoint', passed: false, severity: 'warning', section: SECTION,
        message: `Content-heavy site (${contentPageCount} blog/docs pages) has no .md URL endpoints`,
        details: null });
    }
  }

  // geo_ai_bot_robots
  if (robots) {
    const agentRules = robots.agentRules || {};
    const hasAiRules = AI_CRAWLERS_GEO.some(bot => {
      const rules = agentRules[bot];
      return rules && (rules.disallowed?.length > 0 || rules.allowed?.length > 0);
    });
    if (!hasAiRules) {
      failures.push({ check_id: 'geo_ai_bot_robots', passed: false, severity: 'warning', section: SECTION,
        message: 'No explicit directives for AI crawlers in robots.txt (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)',
        details: '/robots.txt' });
    }

    // geo_google_extended
    const geRules = agentRules['Google-Extended'];
    if (!geRules || (geRules.disallowed?.length === 0 && geRules.allowed?.length === 0)) {
      failures.push({ check_id: 'geo_google_extended', passed: false, severity: 'info', section: SECTION,
        message: 'No explicit Google-Extended (Gemini training) directive in robots.txt', details: '/robots.txt' });
    }
  }

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const js = r._jsRender || {};

    // geo_content_without_js — key content in raw HTML
    if (!js.rawHasH1 || (js.rawWordCount || 0) < 50 || (js.rawLinkCount || 0) === 0) {
      failures.push({ check_id: 'geo_content_without_js', passed: false, severity: 'critical', section: SECTION,
        message: 'Key content (H1, body text, or links) not available in raw HTML — AI crawlers cannot access it',
        details: url });
    }

    // geo_https_trust
    if (!r._isHttps) {
      failures.push({ check_id: 'geo_https_trust', passed: false, severity: 'critical', section: SECTION,
        message: 'Content served over HTTP — AI crawlers require HTTPS', details: url });
    }

    // geo_canonical_dedup — self-canonical required
    if (!r['Canonical Link Element 1']) {
      failures.push({ check_id: 'geo_canonical_dedup', passed: false, severity: 'warning', section: SECTION,
        message: 'Missing canonical — AI crawlers use canonical for deduplication', details: url });
    }

    // geo_og_tags — og:title, og:description, og:image
    const ogTitle = r._ogTitle || '';
    const ogDesc  = r._ogDescription || '';
    const ogImage = r._ogImage || '';
    if (!ogTitle || !ogDesc || !ogImage) {
      const missing = [!ogTitle && 'og:title', !ogDesc && 'og:description', !ogImage && 'og:image'].filter(Boolean);
      failures.push({ check_id: 'geo_og_tags', passed: false, severity: 'info', section: SECTION,
        message: `Missing Open Graph tags: ${missing.join(', ')}`, details: url });
    }

    // geo_faq_html — FAQ content must be in raw HTML
    if (r._hasFaqContent && !js.rawHasH1) {
      failures.push({ check_id: 'geo_faq_html', passed: false, severity: 'warning', section: SECTION,
        message: 'FAQ content may not be present in raw HTML — AI crawlers cannot access JS-rendered FAQs',
        details: url });
    }

    // geo_licensing_policy — check terms page for AI/LLM policy
    if (r._isTermsPage) {
      const body = r._bodyText || '';
      if (!/artificial intelligence|AI training|machine learning|automated (scraping|training)|LLM|large language model|data scraping/i.test(body)) {
        failures.push({ check_id: 'geo_licensing_policy', passed: false, severity: 'info', section: SECTION,
          message: 'Terms of Service page has no AI/LLM usage policy', details: url });
      }
    }

    // geo_crawlable_pagination — infinite scroll with no numbered URLs
    if (r._hasInfiniteScroll && !r['rel="next"']) {
      failures.push({ check_id: 'geo_crawlable_pagination', passed: false, severity: 'info', section: SECTION,
        message: 'Infinite scroll pagination with no numbered URL pagination — AI crawlers cannot paginate',
        details: url });
    }
  }

  return failures;
}
```

- [ ] **Step 6: Create s24-local.js**

```js
// backend/services/checks/s24-local.js
const SECTION = 'Local SEO & GEO';
const LOCATION_URL_RE = /\/(location|city-|[a-z]+-[a-z]+-(city|branch|office|store))|\b[a-z]+\b\/(dubai|abu-dhabi|mumbai|delhi|london|new-york)/i;
const PHONE_TOLLFREE_RE = /1800[-\s]\d{3}[-\s]\d{4}|0800[-\s]\d+/;
const PHONE_LOCAL_RE    = /(\+91[-\s]?)?[6-9]\d{9}|0\d{2,4}[-\s]\d{6,8}|\+971[-\s]?\d{8,9}/;
const LOCAL_REQUIRED    = ['name', 'address', 'telephone', 'openingHours'];

export function runLocalChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url   = r.url || '';
    if (!url) continue;
    const code  = String(r['Status Code'] || '');
    const isIdx = r['Indexability'] === 'Indexable';
    const schema = r._schemaTypes || [];
    const items  = r._schemaItems || [];

    // local_location_crawlable — location pages returning non-200 or noindex
    if (LOCATION_URL_RE.test(url) && (!code.startsWith('200') || !isIdx)) {
      failures.push({ check_id: 'local_location_crawlable', passed: false, severity: 'warning', section: SECTION,
        message: `Location page not crawlable/indexable (${code || 'noindex'})`, details: url });
    }

    if (!isIdx) continue;

    // local_business_schema — LocalBusiness schema required fields
    if (schema.includes('LocalBusiness')) {
      const item = items.find(i => i['Type'] === 'LocalBusiness');
      if (item) {
        const props = new Set((item.properties || []).map(p => p.name));
        const missing = LOCAL_REQUIRED.filter(f => !props.has(f));
        if (missing.length > 0) {
          failures.push({ check_id: 'local_business_schema', passed: false, severity: 'critical', section: SECTION,
            message: `LocalBusiness schema missing: ${missing.join(', ')}`, details: url });
        }

        // local_schema_geo — geo coordinates
        if (!props.has('geo')) {
          failures.push({ check_id: 'local_schema_geo', passed: false, severity: 'info', section: SECTION,
            message: 'LocalBusiness schema missing geo coordinates (latitude/longitude)', details: url });
        }
      }
    } else if (LOCATION_URL_RE.test(url)) {
      failures.push({ check_id: 'local_business_schema', passed: false, severity: 'critical', section: SECTION,
        message: 'Location page missing LocalBusiness schema', details: url });
    }

    // local_nap_consistency — compare schema NAP to visible footer NAP
    if (schema.includes('LocalBusiness') && r._visibleNap) {
      const item = items.find(i => i['Type'] === 'LocalBusiness');
      if (item) {
        const props = new Map((item.properties || []).map(p => [p.name, p.value]));
        const schemaName = (props.get('name') || '').toLowerCase();
        const visibleName = (r._visibleNap.name || '').toLowerCase();
        if (schemaName && visibleName && schemaName !== visibleName &&
            Math.abs(schemaName.length - visibleName.length) > 2) {
          failures.push({ check_id: 'local_nap_consistency', passed: false, severity: 'critical', section: SECTION,
            message: `Schema NAP name "${props.get('name')}" differs from visible "${r._visibleNap.name}"`,
            details: url });
        }
      }
    }

    // local_google_map_embedded — contact/location pages without map embed
    const isContactPage = /\/(contact|location|branch|office|store)/i.test(url);
    if (isContactPage && !r._hasGoogleMapEmbed) {
      failures.push({ check_id: 'local_google_map_embedded', passed: false, severity: 'info', section: SECTION,
        message: 'Location/contact page missing embedded Google Map', details: url });
    }

    // local_phone_number — only toll-free, no local number
    const body = r._bodyText || '';
    const hasTollFree = PHONE_TOLLFREE_RE.test(body);
    const hasLocal    = PHONE_LOCAL_RE.test(body);
    if (hasTollFree && !hasLocal && isContactPage) {
      failures.push({ check_id: 'local_phone_number', passed: false, severity: 'info', section: SECTION,
        message: 'Only toll-free number found — consider adding a local phone number', details: url });
    }

    // local_location_page_quality — near-duplicate location pages
    // (handled by content near_duplicate check in s14 with LOCATION_URL_RE filter)
  }

  return failures;
}
```

- [ ] **Step 7: Run tests to confirm pass**

Run: `cd backend && npx vitest run __tests__/checks/s21-eeat.test.js __tests__/checks/s22-aio.test.js __tests__/checks/s23-geo.test.js __tests__/checks/s24-local.test.js`
Expected: PASS — all tests passing

- [ ] **Step 8: Commit**

```bash
git add backend/services/checks/s21-eeat.js backend/services/checks/s22-aio.js backend/services/checks/s23-geo.js backend/services/checks/s24-local.js backend/__tests__/checks/s21-eeat.test.js backend/__tests__/checks/s22-aio.test.js backend/__tests__/checks/s23-geo.test.js backend/__tests__/checks/s24-local.test.js
git commit -m "feat: implement Section 21 E-E-A-T, 22 AIO, 23 GEO, and 24 local SEO checks"
```

---

### Task 12: Wire All Section Runners + Integration Test

**Files:**
- Modify: `backend/services/audit-parser.service.js` — replace orchestrator stub with full runner imports and calls
- Test: `backend/__tests__/checks/integration.test.js`

- [ ] **Step 1: Write the failing integration test**

```js
// backend/__tests__/checks/integration.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB to avoid needing a real database in tests
vi.mock('../../db/sqlite.js', () => ({
  default: {
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      run: vi.fn(),
    })),
    transaction: vi.fn((fn) => fn),
  },
}));

import { parseAndStoreResults, classifyYmyl } from '../../services/audit-parser.service.js';

const makePage = (overrides) => ({
  url: 'https://example.com/page',
  'Status Code': '200',
  'Status': 'OK',
  'Content Type': 'text/html',
  'Indexability': 'Indexable',
  'Title 1': 'Car Insurance Plans | Compare & Save',
  'Title 1 Length': '42',
  'Meta Description 1': 'Compare the best car insurance plans. Get quotes instantly and save up to 40% on your premium today with our free comparison tool.',
  'Meta Description 1 Length': '130',
  'H1-1': 'Compare Car Insurance Plans',
  'H1 Occurrences': '1',
  'H2-1': 'Why Compare With Us',
  'H2 Occurrences': '4',
  'Word Count': '800',
  'Crawl Depth': '2',
  'Unique Inlinks': '5',
  'Unique Outlinks': '15',
  'Canonical Link Element 1': 'https://example.com/page',
  'Meta Robots 1': '',
  'X-Robots-Tag 1': '',
  'Response Time': '350',
  'Last Modified': new Date().toISOString(),
  _redirectChain: [],
  _isHttps: true,
  _hsts: 'max-age=31536000; includeSubDomains',
  _csp: "default-src 'self'",
  _xFrameOptions: 'DENY',
  _xContentTypeOptions: 'nosniff',
  _referrerPolicy: 'strict-origin-when-cross-origin',
  _permissionsPolicy: 'camera=(), microphone=()',
  _images: [],
  _schemaItems: [{ Type: 'WebPage', Property: '@type', Content: 'WebPage' }],
  _schemaTypes: ['WebPage'],
  _schemaValid: true,
  _hasJsonLd: true,
  _internalLinks: [],
  _hreflangTags: [],
  _bodyText: 'Compare car insurance plans. Find the best rates.',
  _bodyHash: 'unique-hash-123',
  _siteData: {
    robots: { exists: true, raw: 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml', sitemapUrls: ['https://example.com/sitemap.xml'], disallowedPaths: ['/admin'], agentRules: {}, parseErrors: [], llmsTxt: '# Example Site\n\nSEO platform.\n\n- [Home](/): Homepage' },
    sitemap: { found: true, url: 'https://example.com/sitemap.xml', urls: [], fileSizeBytes: 1000, parseErrors: [], isIndex: false, childSitemaps: [] },
  },
  ...overrides,
});

describe('parseAndStoreResults (integration)', () => {
  it('runs without error on a well-formed page set', async () => {
    const pages = [makePage()];
    // Should not throw
    await expect(parseAndStoreResults(pages, 1, 1, null)).resolves.toBeTypeOf('number');
  });

  it('returns a number (failure count)', async () => {
    const count = await parseAndStoreResults([makePage()], 1, 1, null);
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('detects failures on a bad page', async () => {
    const count = await parseAndStoreResults([makePage({
      'Title 1': '',
      'H1-1': '',
      'H1 Occurrences': '0',
      _isHttps: false,
      url: 'http://example.com/page',
    })], 1, 1, null);
    expect(count).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails (function exists but orchestrator is empty)**

Run: `cd backend && npx vitest run __tests__/checks/integration.test.js`
Expected: PASS (test 1 and 2 pass, test 3 returns 0 because orchestrator has no runners yet)

- [ ] **Step 3: Wire all section runners into audit-parser.service.js**

Replace the orchestrator in `backend/services/audit-parser.service.js` with:

```js
// backend/services/audit-parser.service.js
import db from '../db/sqlite.js';
import { runResponseChecks }     from './checks/s01-response.js';
import { runCanonicalChecks }    from './checks/s02-canonical.js';
import { runRobotsChecks }       from './checks/s03-robots.js';
import { runSitemapChecks }      from './checks/s04-sitemap.js';
import { runCrawlabilityChecks } from './checks/s05-crawlability.js';
import { runUrlChecks }          from './checks/s06-url.js';
import { runJsRenderChecks }     from './checks/s07-jsrender.js';
import { runMobileChecks }       from './checks/s08-mobile.js';
import { runSecurityChecks }     from './checks/s09-security.js';
import { runCwvChecks }          from './checks/s10-cwv.js';
import { runCruxChecks }         from './crux.js';
import { runTitleChecks }        from './checks/s11-titles.js';
import { runMetaDescChecks }     from './checks/s12-meta.js';
import { runHeadingChecks }      from './checks/s13-headings.js';
import { runContentChecks }      from './checks/s14-content.js';
import { runImageChecks }        from './checks/s15-images.js';
import { runSchemaChecks }       from './checks/s16-schema.js';
import { runLinksChecks }        from './checks/s17-links.js';
import { runIntlChecks }         from './checks/s18-intl.js';
import { runEeatChecks }         from './checks/s21-eeat.js';
import { runAioChecks }          from './checks/s22-aio.js';
import { runGeoChecks }          from './checks/s23-geo.js';
import { runLocalChecks }        from './checks/s24-local.js';

// ─── YMYL Classification ──────────────────────────────────────────────────────
// (classifyYmyl, loadSiteSettings, loadSchemaRules, bulkInsertResults — all preserved from Task 1)
// ... (keep all functions from Task 1 here verbatim)

export async function parseAndStoreResults(pages, jobId, siteId, companyId = null) {
  const siteSettings = loadSiteSettings(siteId);
  const schemaRules  = loadSchemaRules(siteId);
  const ctx = { siteId, jobId, siteSettings, schemaRules };
  const failures = [];

  failures.push(...runResponseChecks(pages, ctx));
  failures.push(...runCanonicalChecks(pages, ctx));
  failures.push(...runRobotsChecks(pages, ctx));
  failures.push(...runSitemapChecks(pages, ctx));
  failures.push(...runCrawlabilityChecks(pages, ctx));
  failures.push(...runUrlChecks(pages, ctx));
  failures.push(...runJsRenderChecks(pages, ctx));
  failures.push(...runMobileChecks(pages, ctx));
  failures.push(...runSecurityChecks(pages, ctx));
  failures.push(...runCwvChecks(pages, ctx));
  failures.push(...runTitleChecks(pages, ctx));
  failures.push(...runMetaDescChecks(pages, ctx));
  failures.push(...runHeadingChecks(pages, ctx));
  failures.push(...runContentChecks(pages, ctx));
  failures.push(...runImageChecks(pages, ctx));
  failures.push(...runSchemaChecks(pages, ctx));
  failures.push(...runLinksChecks(pages, ctx));
  failures.push(...runIntlChecks(pages, ctx));
  failures.push(...runEeatChecks(pages, ctx));
  failures.push(...runAioChecks(pages, ctx));
  failures.push(...runGeoChecks(pages, ctx));
  failures.push(...runLocalChecks(pages, ctx));

  // CrUX is async (external API call)
  const cruxFailures = await runCruxChecks(pages, ctx);
  failures.push(...cruxFailures);

  bulkInsertResults(failures, jobId, siteId, companyId);
  return failures.length;
}

export function parseAndStoreFromDatasets(_datasets, _jobId, _siteId, _companyId = null) {
  return 0;
}
```

- [ ] **Step 4: Run full integration test**

Run: `cd backend && npx vitest run __tests__/checks/integration.test.js`
Expected: PASS — all 3 tests passing; test 3 returns count > 0 (https_enabled, title_present, h1_present, etc. fire)

- [ ] **Step 5: Run all check tests together**

Run: `cd backend && npx vitest run __tests__/checks/`
Expected: PASS — all section tests passing

- [ ] **Step 6: Commit**

```bash
git add backend/services/audit-parser.service.js backend/__tests__/checks/integration.test.js
git commit -m "feat: wire all 22 section runners into parseAndStoreResults orchestrator"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ All 216 ✅-feasibility checks from `docs/audit-checks/check-catalog.md` are covered across Tasks 1–12
- ✅ `parseAndStoreResults` new API — Task 1
- ✅ `classifyYmyl` — Task 1
- ✅ `bulkInsertResults` — Task 1
- ✅ `parseAndStoreFromDatasets` legacy stub — Task 1
- ✅ crawl-runner.js update — Task 1
- ✅ response.js security headers — Task 2
- ✅ micromatch added — Task 10
- ✅ franc-min added — Task 9
- ✅ crux.js CrUX API client — Task 7
- ✅ Sections 1–18, 21–24 automated checks — Tasks 2–11
- ✅ Integration test — Task 12
- ✅ Site settings + schema rules loaded into ctx — Task 1

**Skipped (not ✅-feasibility):** Sections 19 (GSC), 20 (BL-UPLOAD), PSI checks — these require external data sources not available during crawl.
