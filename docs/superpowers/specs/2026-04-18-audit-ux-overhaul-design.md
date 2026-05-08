# Audit Section UX Overhaul — Design Spec
**Date:** 2026-04-18  
**Author:** Aakash Srivastava  
**Phase:** 1 of 2 (UI/UX fixes — no new check implementations)

---

## Background

The audit section currently has several critical UX and navigation problems discovered through a full codebase audit:

- **94 of 291 checks (32%)** are actually working end-to-end. The remaining 197 are registry stubs with no parser or data.
- **13 of 20 audit categories** always show "No issues found" — not because the site is clean, but because those categories have never been implemented. This creates false confidence.
- **`/audit/compare`** is fully built (job pickers, delta cards, diff table, filters) but has zero entry points in the navigation. Unreachable unless you know the URL.
- **Sidebar "Audit Categories"** hardlinks to `/audit/response-codes` — jumping straight into one specific category rather than showing a picker for all 20.
- **AuditCategory page** has no way to export URLs per issue type — users must go through the full Exports flow.
- **IssueDetail prev/next** fails silently when sibling fetch errors.
- **Sidebar active state** breaks when navigating to any audit category other than response-codes.

**Phase 2** (separate spec) will implement all 13 missing categories, fully populating the empty shells. Phase 1 fixes the navigation and UX layer so Phase 2's data lands in a well-designed home.

---

## Scope — Phase 1

| # | Change | Files affected |
|---|--------|---------------|
| 1 | Add Compare Crawls to sidebar | `Sidebar.jsx` |
| 2 | Fix Audit Categories sidebar link → picker page | `Sidebar.jsx` |
| 3 | New `/audit/categories` picker page | `AuditCategories.jsx` (new), `router.jsx` |
| 4 | CSV export per issue type on AuditCategory | `AuditCategory.jsx`, new backend endpoint |
| 5 | IssueDetail prev/next silent failure fix | `IssueDetail.jsx` |
| 6 | Sidebar active state fix for all audit routes | `Sidebar.jsx` |
| 7 | Empty category copy fix ("not audited" vs "no issues") | `AuditCategory.jsx` |

**Out of scope for Phase 1:**
- Health score formula change (resolves naturally in Phase 2)
- Implementing any new parser checks
- Any changes to AuditHealth.jsx accordion
- Sort/filter/search on AuditCategory URL list

---

## Change 1 & 2 — Sidebar navigation

**File:** `frontend/src/components/Sidebar.jsx`

**Current PLATFORM audit entries:**
```js
{ label: 'Audit Health',     icon: Heart,       path: '/audit'                   },
{ label: 'Audit Categories', icon: FolderKanban, path: '/audit/response-codes'   }, // ← wrong
{ label: 'Core Web Vitals',  icon: Gauge,        path: '/audit/cwv'              },
{ label: 'Custom Extraction',icon: FileCode2,    path: '/audit/custom-extraction' },
{ label: 'Log File Intel.',  icon: FileText,     path: '/audit/log-file'          },
```

**After:**
```js
{ label: 'Audit Health',     icon: Heart,          path: '/audit'                   },
{ label: 'Audit Categories', icon: FolderKanban,   path: '/audit/categories'        }, // ← new picker page
{ label: 'Compare Crawls',   icon: GitCompareArrows, path: '/audit/compare'         }, // ← new entry
{ label: 'Core Web Vitals',  icon: Gauge,          path: '/audit/cwv'               },
{ label: 'Custom Extraction',icon: FileCode2,      path: '/audit/custom-extraction' },
{ label: 'Log File Intel.',  icon: FileText,       path: '/audit/log-file'          },
```

`GitCompareArrows` is already imported in `CompareView.jsx` — import it into Sidebar.

**Active state fix:** The sidebar uses exact path matching for active highlight. Update the active match for the "Audit Categories" entry to use a prefix match: highlight when `location.pathname` starts with `/audit/` AND is not one of the other explicitly listed audit paths (`/audit`, `/audit/compare`, `/audit/cwv`, `/audit/custom-extraction`, `/audit/log-file`, `/audit/issue/`).

---

## Change 3 — New `/audit/categories` page

**New file:** `frontend/src/pages/AuditCategories.jsx`  
**New route in `router.jsx`:** `{ path: '/audit/categories', element: <AuditCategories /> }`  
Add to the same `RequireCompany` group as the other audit routes.

### Data

Calls `GET /reports/:siteId/summary` — the same endpoint used by `AuditHealth.jsx`. No new backend work.

From the response, derives per-category state:
- `summary.sections` — object keyed by category name, values `{ critical, warning, info }`
- `summary.coveredSections` — array of section names that have any audit_results row
- `summary.completedAt` — for subtitle

### Sorting order

Categories are sorted in this priority:
1. Has `critical > 0` — sorted by critical count desc
2. Has `warning > 0` (no critical) — sorted by warning count desc
3. Covered, zero issues (pass) — alphabetical
4. Not covered (not audited) — alphabetical, non-clickable

### Row anatomy

```
[left-border color] [Category name]   [worst-severity badge]   [crit] [warn] [info]   [→]
```

| State | Left border | Badge | Clickable |
|-------|------------|-------|-----------|
| Critical issues | `--severity-critical` | `CRITICAL` red pill | Yes |
| Warning only | `--severity-warning` | `WARNING` amber pill | Yes |
| Info only | `--severity-info` | `INFO` blue pill | Yes |
| Covered, 0 issues | `--severity-pass` | `✓ PASS` green pill | Yes |
| Not covered | `--border-subtle` (grey) | `NOT AUDITED` grey pill | No — greyed out, no arrow |

Clicking a row navigates to `/audit/{slug}` using the existing `CATEGORY_SLUG_MAP`. Extract this map from `AuditCategory.jsx` into a new shared file `frontend/src/lib/auditCategories.js` and import it in both `AuditCategory.jsx` and `AuditCategories.jsx`.

### States

- **Loading:** `<LoadingSkeleton type="table" rows={8} cols={4} />`
- **Error:** existing `EmptyState` with retry button
- **No crawl yet:** `EmptyState` message "Run a crawl to see category breakdown" + "Start Crawl" CTA → `/crawl`
- **Loaded:** the sorted list

---

## Change 4 — CSV export per issue type

### Backend — new endpoint

**File:** `backend/routes/reports.js`  
**Endpoint:** `GET /api/reports/:siteId/issues/export`

Query params:
- `section` (required) — e.g. `"Response Codes"`
- `issue_type` (required) — e.g. `"3xx Redirects"`

Auth: standard `authMiddleware` — same as all other report routes.

Query logic:
```sql
SELECT url, data
FROM audit_results
WHERE site_id = :siteId
  AND crawl_job_id = :latestJobId
  AND section = :section
  AND issue_type = :issue_type
ORDER BY url ASC
-- no limit — export all rows
```

Response:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="{section-slug}-{issue-type-slug}.csv"`
- CSV rows: parse each `data` JSON blob, union all unique keys across all rows to form dynamic columns. Columns: `url` first, then all unique keys from `data` sorted alphabetically.

Filename slugification: lowercase, replace spaces and `/` with `-`, strip special chars.

**Example output for "3xx Redirects":**
```csv
url,redirectType,redirectUrl,statusCode
/cars/bmw-3-series,301,https://www.example.com/cars/bmw-3-series-review,301
/cars/honda-city,302,https://www.example.com/cars/honda-city-2024,302
```

### Frontend — AuditCategory.jsx

Add a `⬇ CSV` button to the `GroupAccordion` header row, to the right of the count badge.

Button behaviour:
- Constructs the export URL: `/api/reports/${siteId}/issues/export?section=${encodeURIComponent(sectionName)}&issue_type=${encodeURIComponent(group.issue_type)}`
- Renders as `<a href={exportUrl} download>` — browser handles the file download natively, no React state change needed
- Always visible on the accordion header (not only when expanded)
- No loading spinner needed — it's a direct file download

---

## Change 5 — IssueDetail prev/next silent failure fix

**File:** `frontend/src/pages/IssueDetail.jsx`

Current behaviour: sibling fetch (up to 200 IDs for prev/next) fails silently — buttons appear but navigating does nothing.

Fix:
- Add an `siblingError` state boolean, set to `true` in the sibling fetch catch block
- When `siblingError` is true: render prev/next buttons as `disabled` with `title="Navigation unavailable"` tooltip
- No visible error message needed — disabled buttons communicate the state without alarming the user

---

## Change 6 — Empty category copy fix

**File:** `frontend/src/pages/AuditCategory.jsx`

Current empty state when `groups.length === 0`:
```
"No {sectionName} issues found"
CTA: Start a Crawl → /crawl
```

This is misleading for unimplemented categories — implies we checked and found nothing.

Fix: check `coveredSections` to distinguish the two cases.

The `loadGroups` function already receives `jobId` from the API response. Add a `covered` boolean to the API response (`GET /reports/:siteId/category`) — or derive it on the frontend by checking whether any `groups` were returned AND whether `jobId` exists.

**Simpler approach (no backend change):** The endpoint returns `jobId` and `groups`. If `jobId` is non-null and `groups` is empty, it means the crawl ran but this section produced no results — which could be either "all good" or "not implemented." 

To distinguish without a backend change: add `coveredSections` to the `GET /reports/:siteId/category` response (a single extra field — already computed in the summary endpoint). Then:

- `groups.length === 0` AND section is in `coveredSections` → `"No {sectionName} issues found"` (site is clean for this category)
- `groups.length === 0` AND section NOT in `coveredSections` → `"No data collected for {sectionName} yet"` with subtitle `"This category will be populated automatically once the crawler supports it."` — no CTA button

**Backend change required:** Add `covered: boolean` to the `GET /reports/:siteId/category` response. One extra DB query: `SELECT 1 FROM audit_results WHERE crawl_job_id = ? AND section = ? LIMIT 1`.

---

## File change summary

| File | Type | Change |
|------|------|--------|
| `frontend/src/components/Sidebar.jsx` | Edit | Add Compare entry, fix Categories path, fix active state logic |
| `frontend/src/router.jsx` | Edit | Add `/audit/categories` route |
| `frontend/src/pages/AuditCategories.jsx` | New | Full new page — category picker |
| `frontend/src/pages/AuditCategory.jsx` | Edit | Add CSV export button, fix empty state copy |
| `frontend/src/pages/IssueDetail.jsx` | Edit | Fix silent prev/next failure |
| `backend/routes/reports.js` | Edit | Add export endpoint + `covered` field to category endpoint |

---

## Phase 2 preview (separate spec)

Phase 2 will implement the 13 missing audit categories by:
1. Adding extractors to `playwright-crawler/src/extractors/` for Images, Internal Linking, Robots/Indexability, Sitemap, Content, Speed & Performance, Mobile SEO, Monitoring & Operations, Rankings & Traffic Drops, JavaScript Rendering, LLM/AI Crawlers, International SEO
2. Adding check functions to `backend/services/audit-parser.service.js` for each
3. Wiring the new datasets through `playwright-crawler/src/output/sf-format.js`

No UI changes needed for Phase 2 — Phase 1's navigation and page designs are built to accommodate all 20 categories.

---

## Non-goals (explicitly excluded)

- Health score formula change
- Sort/filter/search on AuditCategory URL list
- Bulk fix actions
- Crawl diff view
- Custom check definitions
- Any changes to AuditHealth.jsx
