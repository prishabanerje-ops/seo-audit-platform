# Phase 4c — Frontend Category Taxonomy Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the frontend category taxonomy with the canonical 23-category DB registry by fixing `auditCategories.js` and replacing the stale `CATEGORY_ROUTES` map in `AuditHealth.jsx` with a derived `SECTION_TO_SLUG` lookup.

**Architecture:** Two targeted file edits. `auditCategories.js` is the single source of truth for all category→slug mappings. `AuditHealth.jsx` imports `SECTION_TO_SLUG` from it instead of maintaining its own hardcoded map. No backend changes, no migrations.

**Tech Stack:** React 18, Vite, React Router — frontend only

**Spec:** `docs/superpowers/specs/2026-04-27-frontend-category-sync-design.md`

---

## Files Touched

| File | Change |
|------|--------|
| `frontend/src/lib/auditCategories.js` | Fix `Local SEO & GEO` → `Local SEO`; remove `Backlinks & Authority`; remove Off-Page & Authority group |
| `frontend/src/pages/AuditHealth.jsx` | Remove `CATEGORY_ROUTES`; import + use `SECTION_TO_SLUG` |

---

### Task 1: Fix `auditCategories.js` — align with 23-category canonical taxonomy

**Files:**
- Modify: `frontend/src/lib/auditCategories.js`

No automated frontend test suite exists. Verification is by inspection (grep) and manual browser check.

- [ ] **Step 1: Verify the stale values exist before editing**

```bash
grep -n "Local SEO & GEO\|Backlinks & Authority\|Off-Page" frontend/src/lib/auditCategories.js
```

Expected: 4 lines — line 47, line 37 (Backlinks in SLUG_TO_SECTION has no entry, but check SECTION_TO_SLUG line ~37 and group lines).

Actually run from project root:
```bash
grep -n "Local SEO & GEO\|Backlinks\|Off-Page" frontend/src/lib/auditCategories.js
```

Expected output (approximate line numbers):
```
37:  'Backlinks & Authority':           'backlinks',
47:  'local-seo':         'Local SEO & GEO',
89:  'GEO & LLM Crawlers':              'geo-llm',
90:  'Local SEO & GEO':                 'local-seo',
131:    groupLabel: 'Off-Page & Authority',
132:    categories: ['Backlinks & Authority'],
143:    groupLabel: 'Local SEO',
144:    categories: ['Local SEO & GEO'],
```

- [ ] **Step 2: Fix `SLUG_TO_SECTION` — `local-seo` mapping**

In `frontend/src/lib/auditCategories.js`, find:

```js
  'local-seo':         'Local SEO & GEO',
```

Replace with:

```js
  'local-seo':         'Local SEO',
```

- [ ] **Step 3: Fix `SECTION_TO_SLUG` — remove Backlinks, rename Local SEO key**

In `frontend/src/lib/auditCategories.js`, find:

```js
  'Backlinks & Authority':           'backlinks',
  'E-E-A-T Signals':                 'eeat',
```

Replace with:

```js
  'E-E-A-T Signals':                 'eeat',
```

Then find:

```js
  'Local SEO & GEO':                 'local-seo',
```

Replace with:

```js
  'Local SEO':                       'local-seo',
```

- [ ] **Step 4: Fix `AUDIT_CATEGORY_GROUPS` — remove Off-Page group, fix Local SEO entry**

Find and remove the entire Off-Page & Authority group:

```js
  {
    groupLabel: 'Off-Page & Authority',
    categories: ['Backlinks & Authority'],
  },
```

Replace with nothing (delete the block entirely).

Then find:

```js
    categories: ['Local SEO & GEO'],
```

Replace with:

```js
    categories: ['Local SEO'],
```

- [ ] **Step 5: Verify the result**

```bash
grep -n "Local SEO & GEO\|Backlinks\|Off-Page" frontend/src/lib/auditCategories.js
```

Expected: **no output** (all stale references gone).

Also verify the final entry count:

```bash
grep -c "':'" frontend/src/lib/auditCategories.js
```

`SECTION_TO_SLUG` should now have 23 entries (one per canonical category). Count manually in the file if needed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/auditCategories.js
git commit -m "fix(frontend): align auditCategories.js with 23-category canonical taxonomy"
```

---

### Task 2: Replace `CATEGORY_ROUTES` in `AuditHealth.jsx` with `SECTION_TO_SLUG` lookup

**Files:**
- Modify: `frontend/src/pages/AuditHealth.jsx:1-55,525`

- [ ] **Step 1: Verify current state**

```bash
grep -n "CATEGORY_ROUTES\|SECTION_TO_SLUG" frontend/src/pages/AuditHealth.jsx
```

Expected:
```
28:const CATEGORY_ROUTES = {
525:                routePath={CATEGORY_ROUTES[cat] || '/audit/custom'}
```

- [ ] **Step 2: Add `SECTION_TO_SLUG` import**

In `frontend/src/pages/AuditHealth.jsx`, find the existing import block (the last import line before the first non-import line). The imports currently end around line 26:

```js
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';
import { Button }          from '../components/ui/Button.jsx';
```

Replace with:

```js
import { LoadingSkeleton }  from '../components/LoadingSkeleton.jsx';
import { EmptyState }       from '../components/EmptyState.jsx';
import { Button }           from '../components/ui/Button.jsx';
import { SECTION_TO_SLUG }  from '../lib/auditCategories.js';
```

- [ ] **Step 3: Remove the `CATEGORY_ROUTES` constant**

Find and delete the entire block (lines 27–55):

```js
// ── Category → audit route map ────────────────────────────────────────────────
const CATEGORY_ROUTES = {
  // Core technical
  'Response Codes':           '/audit/response-codes',
  'Canonical':                '/audit/canonicals',
  'Robots / Indexability':    '/audit/robots',
  'Sitemap':                  '/audit/sitemap',
  'URL Structure':            '/audit/crawl-depth',

  // On-page
  'Title Tags':               '/audit/title-tags',
  'Meta Description':         '/audit/meta-desc',
  'Headings':                 '/audit/headings',
  'Internal Linking':         '/audit/links',
  'Images':                   '/audit/images',
  'Schema / Structured Data': '/audit/structured-data',
  'Content':                  '/audit/content',

  // Performance & rendering
  'Speed & Performance':      '/audit/page-speed',
  'Mobile SEO':               '/audit/mobile',
  'JavaScript Rendering':     '/audit/custom',

  // Advanced (no dedicated detail page yet)
  'International SEO':        '/audit/custom',
  'Rankings & Traffic Drops': '/audit/custom',
  'Monitoring & Operations':  '/audit/custom',
  'LLM / AI Crawlers':        '/audit/custom',
};
```

Replace with nothing (delete the whole block).

- [ ] **Step 4: Replace the `CATEGORY_ROUTES` usage**

Find (around line 525 after the deletion shifts line numbers — search by content):

```jsx
                routePath={CATEGORY_ROUTES[cat] || '/audit/custom'}
```

Replace with:

```jsx
                routePath={SECTION_TO_SLUG[cat] ? `/audit/${SECTION_TO_SLUG[cat]}` : null}
```

- [ ] **Step 5: Verify no remaining references to `CATEGORY_ROUTES`**

```bash
grep -n "CATEGORY_ROUTES" frontend/src/pages/AuditHealth.jsx
```

Expected: **no output**.

Also verify the import is present:

```bash
grep -n "SECTION_TO_SLUG" frontend/src/pages/AuditHealth.jsx
```

Expected: 2 lines — one import, one usage.

- [ ] **Step 6: Run the frontend build to confirm no type errors**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors. Warnings about chunk size are acceptable.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/AuditHealth.jsx
git commit -m "refactor(frontend): derive AuditHealth category routes from SECTION_TO_SLUG"
```

---

## Manual Verification (after both tasks)

Start the dev server:
```bash
npm run dev
```

Then verify:

1. **`/audit/local-seo`** — should render the Local SEO category page (14 checks). Previously returned 0 results due to `Local SEO & GEO` mismatch.

2. **Audit Categories picker (`/audit/categories`)** — "Off-Page & Authority" group should be absent. "Local SEO" group should show `Local SEO` (not `Local SEO & GEO`).

3. **AuditHealth page for any crawled site** — category rows for recognised categories (e.g. `Title Tags`, `Response Codes & Redirects`) should have working "View all" links. Categories not yet in `SECTION_TO_SLUG` (if any) should show no link, not `/audit/custom`.

4. **No console errors** — open browser DevTools and verify no undefined-slug or missing-import errors.

---

## Self-Review Checklist

- [x] `SLUG_TO_SECTION` `local-seo` entry fixed
- [x] `SECTION_TO_SLUG` `Local SEO & GEO` key renamed, `Backlinks & Authority` removed
- [x] `AUDIT_CATEGORY_GROUPS` Off-Page group removed, Local SEO entry fixed
- [x] `CATEGORY_ROUTES` fully removed from AuditHealth.jsx
- [x] `SECTION_TO_SLUG` imported in AuditHealth.jsx
- [x] `routePath` prop uses derived slug with `null` fallback
- [x] `AccordionRow` already handles `routePath={null}` (line 200: `{routePath && (...)}`) — no extra work needed
- [x] Build verification step included
- [x] Legacy URL aliases in `SLUG_TO_SECTION` intentionally preserved (backwards compat)
- [x] No placeholders or TBDs
