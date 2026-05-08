# Phase 4c — Frontend Category Taxonomy Sync

**Date:** 2026-04-27
**Status:** Approved
**Scope:** Two frontend files — taxonomy constants and AuditHealth route map

---

## Problem

After the Phase 2 audit-checks rebuild (migration 018), the frontend has two stale references:

1. `'Local SEO & GEO'` — the DB category is `'Local SEO'` (14 canonical checks). The `& GEO` suffix was a UI invention. The `/audit/local-seo` route currently returns 0 DB results.

2. `'Backlinks & Authority'` — present in `auditCategories.js` and the UI groups but absent from the canonical 23-category taxonomy. Any user who navigates there sees nothing.

3. `AuditHealth.jsx` maintains a separate hardcoded `CATEGORY_ROUTES` map with pre-rebuild category names (`'Response Codes'`, `'LLM / AI Crawlers'`, `'Speed & Performance'`, etc.) that no longer match DB data. This map is a manual duplicate of `SECTION_TO_SLUG` that has drifted.

---

## Approach

Approach 2 (derive from `auditCategories.js`). Replace the `CATEGORY_ROUTES` map in `AuditHealth.jsx` with a `SECTION_TO_SLUG` lookup so `auditCategories.js` is the single source of truth for all category→route mappings.

---

## What Is Changing

### 1. `frontend/src/lib/auditCategories.js`

**`SLUG_TO_SECTION`** (line 47):
```js
// Before:
'local-seo': 'Local SEO & GEO',

// After:
'local-seo': 'Local SEO',
```

**`SECTION_TO_SLUG`** (lines 89–90):
```js
// Before:
'Backlinks & Authority': 'backlinks',
'Local SEO & GEO':       'local-seo',

// After (Backlinks & Authority removed; Local SEO & GEO renamed):
'Local SEO': 'local-seo',
```

**`AUDIT_CATEGORY_GROUPS`** (lines 130–145):
- Remove the `'Off-Page & Authority'` group entirely (its sole entry `'Backlinks & Authority'` no longer exists in the taxonomy)
- In the `'Local SEO'` group, change `'Local SEO & GEO'` → `'Local SEO'`

Result: `SECTION_TO_SLUG` has exactly 23 entries matching the canonical taxonomy.

---

### 2. `frontend/src/pages/AuditHealth.jsx`

**Remove** the entire `CATEGORY_ROUTES` constant (lines 28–55).

**Add** import at top of file:
```js
import { SECTION_TO_SLUG } from '../lib/auditCategories.js';
```

**Replace** the single usage of `CATEGORY_ROUTES` at line 525:
```jsx
// Before:
routePath={CATEGORY_ROUTES[cat] || '/audit/custom'}

// After:
routePath={SECTION_TO_SLUG[cat] ? `/audit/${SECTION_TO_SLUG[cat]}` : null}
```

`AccordionRow` already handles `routePath={null}` safely (line 200: `{routePath && (...)}`) — the "View all" link simply doesn't render for categories with no dedicated page. This is more honest than sending users to `/audit/custom`.

---

## What Is NOT Changing

- No backend changes
- No DB migrations
- No new frontend components
- Legacy URL aliases in `SLUG_TO_SECTION` (e.g. `'redirects'`, `'canonicals'`) are kept as-is — they provide backwards compatibility for any stored links and do no harm

---

## Testing

- Navigate to `/audit/local-seo` — should render the Local SEO category page with 14 checks
- Navigate to the Audit Categories picker — "Off-Page & Authority" group should be gone; "Local SEO" group shows `Local SEO` (not `Local SEO & GEO`)
- Open a site's AuditHealth page — category rows should link correctly using the new slug derivation; categories without a dedicated page show no link (or a disabled state) rather than `/audit/custom`
- Verify no console errors about undefined slugs
