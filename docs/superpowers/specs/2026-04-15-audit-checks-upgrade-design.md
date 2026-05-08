# Design Spec: Audit Checks Upgrade (CSV → Platform)

**Date:** 2026-04-15  
**Author:** Claude (brainstorming session)  
**Status:** Approved — pending implementation  

---

## 1. Overview

Replace the current 204-check flat seed with a fully restructured 291-check registry sourced from the authoritative `AI Soft - Rule - Sheet4.csv`. The upgrade adds two new DB columns, introduces a three-value automation type, aligns category names with the CSV's two-level taxonomy, and updates the audit parser and frontend route map to stay consistent.

---

## 2. Goals

- Expand check coverage from 204 → 291 checks across 19 categories
- Store `subsection`, `implementation_rule`, and `automation_type` per check
- Replace `is_automated INTEGER` with `automation_type TEXT` (keep old column for backward compat)
- Align all category names to Title Case matching the CSV section names
- Update PRD and README before any code changes
- Leave existing `audit_results` data intact (no data migration)

---

## 3. Non-Goals

- No changes to crawl runner, Playwright crawler, or SF parser
- No migration of existing `audit_results.section` values in the live DB
- No new audit detail pages (new sections fall back to `/audit/custom`)
- No automated detection logic for the 130+ newly catalogued checks (catalog only)

---

## 4. Database Schema Changes

**Migration file:** `backend/db/migrations/010_audit_checks_v2.js`

```sql
ALTER TABLE audit_checks ADD COLUMN subsection         TEXT;
ALTER TABLE audit_checks ADD COLUMN implementation_rule TEXT;
ALTER TABLE audit_checks ADD COLUMN automation_type    TEXT DEFAULT 'automated';
-- automation_type values: 'automated' | 'manual' | 'hybrid'
```

- `is_automated INTEGER` column remains — not dropped. Seed populates both:
  - `automated` → `is_automated = 1`
  - `manual` → `is_automated = 0`
  - `hybrid` → `is_automated = 0`
- No foreign key changes. No index changes needed.

---

## 5. Seed File Rewrite

**File:** `backend/db/seed/audit-checks.js`

Complete replacement. 291 checks sourced from CSV.

### 5.1 Field Mapping

| CSV Column | Seed Field | Mapping |
|---|---|---|
| Section | `category` | Title Case (e.g. "Response Codes") |
| Subsection | `subsection` | Title Case (e.g. "HTTP Status Codes") |
| Issue | `name` | Verbatim from CSV |
| Automated/Manual/Hybrid | `automation_type` | Lowercase verbatim |
| Automated/Manual/Hybrid | `is_automated` | automated=1, else 0 |
| Priority Critical/High | `severity_default` | `critical` / `warning` |
| Priority Medium | `severity_default` | `warning` |
| Priority Low | `severity_default` | `info` |
| Description | `description` | Verbatim from CSV |
| Implementation Rule | `implementation_rule` | Verbatim from CSV |

### 5.2 Category Taxonomy (19 categories, 291 checks)

| Category (new) | Subsections | Count |
|---|---|---|
| Response Codes | HTTP Status Codes · Redirects · HTTPS & SSL | 30 |
| Canonical | Canonical Tags | 20 |
| Robots / Indexability | robots.txt · Crawlability · Indexing & Coverage | 14 |
| Sitemap | XML Sitemap | 10 |
| URL Structure | URL Structure | 8 |
| Title Tags | Title Tags | 6 |
| Meta Description | Meta Description | 5 |
| Headings | Heading Tags | 5 |
| Internal Linking | Internal Linking | 17 |
| Images | Image Optimization | 15 |
| Schema / Structured Data | Structured Data | 20 |
| Content | Keyword Optimization · Content Quality · Thin & Duplicate Content | 42 |
| Speed & Performance | Core Web Vitals · Page Speed | 24 |
| Mobile SEO | Mobile Optimization | 13 |
| JavaScript Rendering | JavaScript SEO | 10 |
| International SEO | Hreflang / International | 7 |
| Rankings & Traffic Drops | Ranking Drops Investigation | 13 |
| Monitoring & Operations | Analytics · Log File · Backlinks · Brand Signals · Local SEO | 24 |
| LLM / AI Crawlers | Bot Rules · Governance | 8 |
| **Total** | | **291** |

### 5.3 Retired Categories (merged into above)

The following 14 categories from the old seed are dissolved:

`M-Site vs Desktop`, `Page Experience`, `JavaScript`, `Image Optimisation`, `Indexation & Directives`, `Meta Robots`, `robots.txt`, `Backlink & Authority`, `Local SEO`, `Log File / Crawl Intelligence`, `Core Web Vitals`, `404 Errors`, `Redirects`, `HTML Structure`

Existing `audit_results` rows referencing these old section values are **not migrated** — old crawl history will display those rows under the old section name. This is acceptable and not a breaking change.

---

## 6. audit-parser.service.js Update

Only one section string changes in the parser's emitted findings:

```js
// Before          →   After
'Structured Data'  →   'Schema / Structured Data'
```

All other emitted sections already match the new Title Case category names:
- `'Response Codes'` ✓
- `'Title Tags'` ✓
- `'Meta Description'` ✓
- `'Headings'` ✓
- `'Canonical'` ✓
- `'URL Structure'` ✓

---

## 7. Frontend Route Map Update

**File:** `frontend/src/pages/AuditHealth.jsx` — `CATEGORY_ROUTES` constant (lines 28–56)

All new categories added. Categories without a dedicated detail page route to `/audit/custom`.

```js
const CATEGORY_ROUTES = {
  // Existing (kept)
  'Response Codes':           '/audit/response-codes',
  'Title Tags':               '/audit/title-tags',
  'Meta Description':         '/audit/meta-desc',
  'Headings':                 '/audit/headings',
  'Canonical':                '/audit/canonicals',
  'URL Structure':            '/audit/crawl-depth',
  'Sitemap':                  '/audit/sitemap',

  // Renamed entries (category name unchanged, parser string fixed separately)
  'Schema / Structured Data': '/audit/structured-data',  // parser was emitting 'Structured Data' — now fixed
  'Images':                   '/audit/images',            // was 'Image Optimisation'
  'Robots / Indexability':    '/audit/robots',            // was split across 3 keys
  'Speed & Performance':      '/audit/page-speed',        // was 'Core Web Vitals'
  'Mobile SEO':               '/audit/mobile',            // was 'M-Site vs Desktop' + 'Page Experience'
  'JavaScript Rendering':     '/audit/custom',            // was 'JavaScript'
  'Internal Linking':         '/audit/links',

  // New sections (no detail page yet)
  'Content':                  '/audit/content',
  'International SEO':        '/audit/custom',
  'Rankings & Traffic Drops': '/audit/custom',
  'Monitoring & Operations':  '/audit/custom',
  'LLM / AI Crawlers':        '/audit/custom',
};
```

---

## 8. PRD & README Updates

Updated **before** any code changes are made.

**PRD.md:** Add/update section documenting:
- 291-check registry sourced from CSV
- 19-category two-level taxonomy
- `automation_type` field (automated / manual / hybrid)
- `subsection` and `implementation_rule` fields
- Which checks are automated vs catalog-only

**README.md:** Update:
- Database section: note new columns (`subsection`, `implementation_rule`, `automation_type`)
- Check count: 204 → 291
- Category list

---

## 9. Implementation Order

1. Update PRD.md and README.md
2. Write migration `010_audit_checks_v2.js`
3. Rewrite seed file with 291 checks
4. Update `audit-parser.service.js` (one string change)
5. Update `CATEGORY_ROUTES` in `AuditHealth.jsx`
6. Verify: restart server, check `/api/reports/checks/count` returns 291

---

## 10. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Old `audit_results` section names no longer match new categories | Certain for renamed categories | Accepted — old crawl history displays as-is, not broken |
| `seedAuditChecks()` upsert logic needs to handle new columns | Low | Verify upsert SQL includes new columns |
| `check_number` gaps if old checks removed | Low | Renumber sequentially 1–291 |
| Frontend breaks if a category name has no route entry | Low | Default fallback to `/audit/custom` already coded |
