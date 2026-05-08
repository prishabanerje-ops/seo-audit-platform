# Compare View Design

## Overview

A dedicated `/audit/compare` page that lets users compare two completed crawl jobs side by side — same site across dates, or two different sites (e.g. mobile vs desktop). Shows a delta-first summary and an issue-type-level diff table with filters.

---

## Architecture

### Backend

New file: `backend/routes/compare.js` — mounted at `/api/compare` in `server.js`.

#### Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/compare/jobs` | List all completed crawl jobs across all accessible sites |
| `GET` | `/api/compare?jobA=x&jobB=y` | Run the comparison and return summary + diff rows |

**Auth:** Both endpoints require valid JWT (`authMiddleware`). Company scoping enforced — users can only compare jobs for their company's sites. Superadmins can compare any jobs.

#### GET /api/compare/jobs

- No query params required
- For regular users: returns all completed crawl jobs for their `company_id`
- For superadmins: returns all completed jobs (or optionally scoped by `?company_id=`)
- Joins `crawl_jobs` with `sites` to get `siteLabel`
- Returns:
  ```json
  {
    "jobs": [
      {
        "id": "uuid",
        "siteId": "uuid",
        "siteLabel": "Cars24",
        "startedAt": "2026-04-15T10:00:00Z",
        "totalUrls": 1243,
        "healthScore": 81
      }
    ]
  }
  ```
- Ordered by `started_at DESC`
- Only `status = 'completed'` jobs included

#### GET /api/compare?jobA=x&jobB=y

- Query params: `jobA` (required), `jobB` (required)
- Returns 400 if either param is missing or if `jobA === jobB`
- Validates both jobs belong to the caller's company via `crawl_jobs JOIN sites` (or superadmin bypass)
- Returns 403 if either job is inaccessible
- For each job: fetches metadata from `crawl_jobs JOIN sites`
- Runs one aggregation per job:
  ```sql
  SELECT section, issue_type, severity, COUNT(*) AS count
  FROM audit_results
  WHERE crawl_job_id = ?
  GROUP BY section, issue_type, severity
  ```
- Merges both result sets in Node: builds a union of all `(section, issue_type, severity)` keys; `delta = countB - countA`
- Computes summary deltas from `crawl_jobs` fields:
  - `scoreDelta = healthScore_B - healthScore_A`
  - `criticalDelta`, `warningDelta`, `infoDelta` — from summing the aggregated counts per severity
  - `urlsDelta = totalUrls_B - totalUrls_A`
- Returns:
  ```json
  {
    "jobA": { "id", "siteLabel", "startedAt", "totalUrls", "healthScore" },
    "jobB": { "id", "siteLabel", "startedAt", "totalUrls", "healthScore" },
    "summary": {
      "scoreDelta": 7,
      "criticalDelta": -53,
      "warningDelta": 17,
      "infoDelta": 0,
      "urlsDelta": 42
    },
    "rows": [
      {
        "section": "Title Tags",
        "issue_type": "Missing title tag",
        "severity": "critical",
        "countA": 45,
        "countB": 23,
        "delta": -22
      }
    ]
  }
  ```
- Rows ordered by `ABS(delta) DESC` from the backend (frontend may re-sort)

---

## Frontend

### Page: `frontend/src/pages/CompareView.jsx`

Replaces the stub export in `frontend/src/pages/stubs.jsx`. Route `/audit/compare` is already wired in `router.jsx`.

#### Layout (top to bottom)

**1. Page header**
- Title: "Compare Crawls"
- Subtitle: "Select two completed crawl jobs to compare issue counts."

**2. Job pickers**
Two dropdowns side by side in a surface card:
- Label "Baseline (A)" and "Comparison (B)"
- Both populated from `GET /api/compare/jobs` on mount
- Each option displays: `"Site Label · Apr 15, 2026 · 1,243 URLs · Score 81"`
- Default: both empty (`"Select a job…"`)
- Selecting the same job in both is blocked: the option already selected in picker A is disabled in picker B and vice versa
- If fewer than 2 completed jobs exist: show inline empty state below the pickers — "You need at least 2 completed crawls to compare. Run more crawls first."

**3. Summary delta cards** (render only when both jobs are selected)

Four cards in a single row:

| Card | Value | Color logic |
|------|-------|-------------|
| Health Score | `+7` / `−3` | Green if positive, red if negative |
| Critical Issues | `−53` / `+16` | Green if negative (fewer = better), red if positive |
| Warnings | delta | Same as critical |
| Info | delta | Same as critical |

Cards use colored background tints:
- Improvement: `var(--severity-pass-bg)` background, `var(--severity-pass)` text
- Regression: `var(--severity-critical-bg)` background, `var(--severity-critical)` text
- Neutral (delta = 0): `var(--bg-surface)` background, `var(--text-muted)` text

**4. Diff table** (render only when both jobs are selected)

Filter bar above the table:
- **Section** dropdown — default `"All sections"`, populated from the union of sections in the response rows
- **Severity** dropdown — default `"All"`, options: Critical / Warning / Info
- **"Changed only"** checkbox — checked by default; when checked, hides rows where `delta === 0`

Table columns:

| Column | Notes |
|--------|-------|
| Issue Type | `issue_type` string |
| Section | `section` string |
| Severity | Small colored pill — matches existing severity badge style (`critical` → red, `warning` → amber, `info` → blue) |
| Before | `countA` — right-aligned |
| After | `countB` — right-aligned |
| Δ | `delta` formatted as `↓22` (green) for improvement, `↑16` (red) for regression, `—` for zero |

Rows sorted by `Math.abs(delta)` descending by default (biggest changes first). The Δ column header is clickable to toggle between largest-change-first and smallest-change-first (always by absolute value — sort direction does not flip the sign grouping).

Special cases in the Δ column:
- `countA === 0`: issue is new in job B — show delta as `NEW` badge (blue tint)
- `countB === 0`: issue is gone in job B — show delta as `GONE` badge (green tint)
- Otherwise: show `↑N` or `↓N`

#### Empty / loading states

- While `GET /api/compare/jobs` loads: show `<LoadingSkeleton>` in place of the dropdowns
- While `GET /api/compare` loads after both jobs selected: show `<LoadingSkeleton>` in place of summary cards and table
- If comparison returns 0 rows matching filters: inline message "No issues match the current filters"

---

## Error Handling

| Scenario | Handling |
|---|---|
| Fewer than 2 completed jobs across all sites | Inline message below pickers: "You need at least 2 completed crawls to compare." |
| Same job selected in both pickers | Option disabled in the other picker; blocked at UI level |
| `jobA === jobB` sent to backend | Backend returns 400: "Cannot compare a job with itself" |
| Job doesn't belong to caller's company | Backend returns 403; toast via axios interceptor |
| One job has 0 audit results | Valid — all its counts are 0, deltas equal the other job's counts |
| countA = 0 (issue only in job B) | `NEW` badge in Δ column |
| countB = 0 (issue only in job A) | `GONE` badge in Δ column |
| Network error loading jobs list | Toast via interceptor; dropdowns show placeholder text |
| Network error loading comparison | Toast via interceptor; summary + table areas show retry button |

---

## Data Shape

### audit_results columns used

- `section` → diff table Section column
- `issue_type` → diff table Issue Type column
- `severity` → diff table Severity pill
- `crawl_job_id` → WHERE clause

### crawl_jobs columns used

- `id`, `site_id`, `status`, `started_at`, `total_urls`, `health_score`

### sites columns used

- `id`, `label`, `company_id`

---

## Out of Scope

- URL-level diff (which specific URLs changed)
- Exporting the comparison as CSV
- Sharing a comparison via URL (deep-linking jobA+jobB params in the URL is not required)
- Triggering a new crawl from the compare screen
- Comparing more than two jobs at once
