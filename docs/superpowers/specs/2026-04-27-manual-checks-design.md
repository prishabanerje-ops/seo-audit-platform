# Phase 4d — Manual Checks Workflow

**Date:** 2026-04-27
**Status:** Approved
**Scope:** DB migration, backend route, new frontend page, AuditHealth integration

---

## Problem

38 canonical checks have `automation_type = 'manual'` and `impl_status = n-a` — they require human judgment and cannot be evaluated by the crawler. Currently the platform has no way for an analyst to record pass/fail findings for these checks or see their status alongside automated results.

Categories affected: Local SEO (9), AI Overviews & AIO Optimization (10), E-E-A-T Signals (5), Rankings & Traffic (5), Content Quality (3), GEO & LLM Crawlers (2), Core Web Vitals (2), International SEO (1), JavaScript Rendering (1).

---

## Approach

New `manual_check_results` table (per-site, timestamped). New backend route. New frontend page at `/audit/manual-checks/:siteId`. Minimal AuditHealth integration via a summary pill on affected category rows. No changes to the automated audit pipeline.

---

## Section 1: Data Model

**Migration:** `backend/db/migrations/019_manual_check_results.js`

```sql
CREATE TABLE IF NOT EXISTS manual_check_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  check_number  INTEGER NOT NULL,
  status        TEXT CHECK(status IN ('pass', 'fail', 'needs_review')),
  notes         TEXT,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, check_number)
)
```

- `check_number` joins to `audit_checks.check_number`
- `status = NULL` means not yet reviewed
- `updated_at` is set on every upsert — used to show staleness
- No pre-seeded rows — analyst fills in over time
- `ON DELETE CASCADE` — removing a site cleans up its manual results

---

## Section 2: Backend API

**New file:** `backend/routes/manual-checks.js`
**Mounted in:** `backend/server.js` as `app.use('/api/sites', manualChecksRouter)`

### `GET /api/sites/:siteId/manual-checks`

Returns all manual checks for the site.

Query: `audit_checks WHERE automation_type = 'manual'` LEFT JOINed with `manual_check_results WHERE site_id = :siteId`.

Response shape (array, sorted by category then check_number):
```json
[
  {
    "check_number": 75,
    "name": "Crawl Budget vs Rendering Time",
    "category": "JavaScript Rendering",
    "severity_default": "warning",
    "implementation_rule": "...",
    "status": null,
    "notes": null,
    "updated_at": null
  }
]
```

- Requires auth (`authMiddleware`)
- Validates `:siteId` belongs to a real site (404 if not found)

### `PUT /api/sites/:siteId/manual-checks/:checkNumber`

Upserts one check result.

Request body: `{ status, notes }` — both optional. `status` must be `"pass"`, `"fail"`, `"needs_review"`, or `null` (to un-set).

Uses `INSERT OR REPLACE` (better-sqlite3 synchronous). Sets `updated_at = CURRENT_TIMESTAMP` on every write.

Returns the updated row in the same shape as the GET item.

- Requires auth
- Validates `status` value — 400 if invalid
- Validates `:checkNumber` exists in `audit_checks` as a manual check — 404 if not

**No service file** — logic lives directly in the route (two simple DB queries).

---

## Section 3: Frontend — Manual Checks Page

**New file:** `frontend/src/pages/ManualChecks.jsx`
**Route:** `/audit/manual-checks/:siteId`

### Data

Fetches `GET /api/sites/:siteId/manual-checks` on mount. Groups results by category using `AUDIT_CATEGORY_GROUPS` from `auditCategories.js` — same grouping used everywhere else. Only groups that have at least one manual check are rendered.

### Layout

**Header:** `"Manual Checks — <site name>"` + progress summary: `"X of 38 reviewed · Y flagged"`.

**Filter bar:** `All | Unreviewed | Flagged` tabs with per-tab counts.

**Category sections:** collapsible. Each section header shows the category name and `X / Y reviewed` count.

**Check row:**
- Severity badge (critical / warning / info) + check name
- Three-way status toggle: **Pass** | **Needs Review** | **Fail** — clicking fires `PUT` immediately (optimistic update, no save button)
- Staleness label: `"Last reviewed X days ago"` when `updated_at` is set; `"Not reviewed"` (grey) when null
- Expandable notes section (chevron toggle): textarea with `onBlur` → `PUT` to save

### Behaviour

- Optimistic update on status toggle: update local state immediately, fire PUT in background, revert on error
- Notes save on textarea blur only (not on every keystroke)
- `?category=<name>` query param scrolls to and opens that category section — used by AuditHealth deep-link

### Components used

Reuses existing `Button`, severity badge pattern (same as other pages). No new shared components.

---

## Section 4: AuditHealth Integration

Minimal — no changes to `AccordionRow` internals beyond one new optional prop.

### Data

`AuditHealth.jsx` makes a second parallel fetch: `GET /api/sites/:siteId/manual-checks`. Derives a `manualSummary` map:

```js
// { [category]: { total, flagged, unreviewed } }
const manualSummary = groupBy(manualChecks, c => c.category, checks => ({
  total:      checks.length,
  flagged:    checks.filter(c => c.status === 'fail' || c.status === 'needs_review').length,
  unreviewed: checks.filter(c => c.status === null).length,
}));
```

### AccordionRow prop

`AccordionRow` receives one new optional prop: `manualSummary` (`{ total, flagged, unreviewed }`). When absent or `total === 0`, renders nothing.

### Pill display (in AccordionRow header)

- `flagged > 0` → red pill: **"N manual flagged"** — links to `/audit/manual-checks/:siteId?category=<category>`
- `flagged === 0 && unreviewed > 0` → grey pill: **"N unreviewed"** — same link
- `flagged === 0 && unreviewed === 0` → nothing (all passing, no noise)

The pill is rendered after the existing counts display, before the chevron.

---

## What Is NOT Changing

- Automated audit pipeline — no changes
- `audit_checks` table — no new columns
- `AccordionRow` expand behaviour and check-detail display — unchanged
- Any existing routes or migrations

---

## Testing

- Unit: migration creates table with correct schema; UNIQUE constraint prevents duplicates; CASCADE deletes work
- API: GET returns 38 rows for a site with no results (all nulls); PUT upserts correctly; second PUT updates `updated_at`; invalid status returns 400
- UI: status toggle fires PUT; notes save on blur; filter tabs show correct counts; `?category=` param scrolls correctly
- AuditHealth: pill appears for categories with flagged/unreviewed manual checks; pill absent for all-pass categories; missing `manualSummary` prop renders nothing
