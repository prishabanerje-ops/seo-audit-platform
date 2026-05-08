# Exports Feature Design

## Overview

A dedicated `/exports` page that lets users export audit results (CSV download or Google Sheets push) for any completed crawl job. Accessible as a standalone page (with site picker) or pre-loaded with a site from the audit view via `?siteId=xxx` query param.

---

## Architecture

### Backend

New file: `backend/routes/exports.js` — mounted at `/api/exports` in `server.js`.

New service: `backend/services/sheets.service.js` — Google Sheets write logic.

#### Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/exports/jobs?siteId=x` | List completed crawl jobs for a site |
| `GET` | `/api/exports/sections?jobId=x` | Return distinct sections present in a job's results |
| `GET` | `/api/exports/csv?jobId=x&severity=a,b&sections=s1,s2` | Stream CSV response |
| `POST` | `/api/exports/sheets` | Push filtered rows to Google Sheets |

**Auth:** All endpoints require valid JWT (`authMiddleware`). Company scoping enforced — users can only export jobs for their company's sites. Superadmins can export any site.

#### GET /api/exports/jobs

- Query param: `siteId` (required)
- Verifies site belongs to caller's company (or superadmin)
- Returns: `{ jobs: [{ id, started_at, completed_at, total_urls, health_score }] }` — completed jobs only, ordered by `started_at DESC`

#### GET /api/exports/csv

- Query params: `jobId` (required), `severity` (comma-separated, default all), `sections` (comma-separated, default all)
- Verifies job belongs to caller's company via site → company_id chain
- Streams CSV using `res.write()` — no in-memory accumulation
- Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="audit-<siteLabel>-<YYYY-MM-DD>.csv"`
- CSV columns: `URL`, `Section`, `Issue Type`, `Severity`, `Details`
- `Details` = `data` field JSON-stringified (single value, not expanded)
- Empty result (filters match nothing): still writes header row, returns valid empty CSV

#### POST /api/exports/sheets

- Body: `{ jobId: string, severity: string[], sections: string[] }`
- Validates `jobId` ownership
- Resolves `sheets_tab_name` from `sites` table — returns 400 if not set
- Returns 503 if `GOOGLE_APPLICATION_CREDENTIALS` env var is missing
- Calls `pushToSheets(jobId, filteredRows, site)` in sheets service
- On Google API 403: surfaces "Sheets access denied — share the spreadsheet with your service account email"
- Returns: `{ success: true, rowsWritten: N }`

### Sheets Service (`backend/services/sheets.service.js`)

- Uses `googleapis` package (already installed)
- Reads `GOOGLE_APPLICATION_CREDENTIALS` from `process.env`
- Gets spreadsheet ID from `sites.sheets_spreadsheet_id` OR derives tab from `sheets_tab_name`
- **Overwrite behavior:** clears the tab content, then writes header row + data rows
- Columns match CSV: `URL`, `Section`, `Issue Type`, `Severity`, `Details`

> **Note:** The `sites` table has `sheets_tab_name` but not `sheets_spreadsheet_id`. The sheets service will require a spreadsheet ID. If not already in the schema, a migration will add `sheets_spreadsheet_id TEXT` to the `sites` table. The Settings/Site edit UI will need a field for this. The Settings page already has a Sheets tab — this field will be added there.

---

## Frontend

### Page: `frontend/src/pages/Exports.jsx`

Replaces the stub export in `frontend/src/pages/stubs.jsx`.

#### Entry Points

1. `/exports` — standalone, shows site picker
2. `/exports?siteId=xxx` — site pre-selected, skips site picker step

#### UI Flow (four progressive steps)

**Step 1 — Site picker** (hidden/pre-filled when `?siteId` present)
- Dropdown from `/api/sites`
- On select: loads crawl jobs for chosen site

**Step 2 — Crawl job picker**
- Dropdown populated from `GET /api/exports/jobs?siteId=x`
- Each option shows: `Started Apr 15 2026 · 1,243 URLs · Score 74`
- Empty state: "No completed crawls yet for this site"
- Disabled until a site is selected

**Step 3 — Filters** (optional; default = all)
- Severity: three checkboxes — Critical, Warning, Info (all checked by default)
- Section: "All sections" toggle; when unchecked, reveals individual section checkboxes
- Sections list fetched lazily on job select via `GET /api/exports/sections?jobId=x` — shows only sections that have results in that job

**Step 4 — Export actions**
- **Download CSV** button — `GET /api/exports/csv?jobId=x&severity=...&sections=...`, triggers browser file download via `<a download>` or window.location
- **Push to Sheets** button — `POST /api/exports/sheets`, success/error toast
  - Disabled (with tooltip) if site has no `sheets_tab_name` configured
  - Shows row count on success: "Pushed 342 rows to Sheets"

#### Audit View Entry Point

An `Export` button (download icon + label) in the site audit header/toolbar. Links to `/exports?siteId=xxx`. No modal — full navigation.

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| No completed jobs for site | Inline message under job picker: "No completed crawls yet" |
| Filters match zero rows | CSV: header-only file. Sheets: writes header only + warning toast "No rows matched filters" |
| `sheets_tab_name` not set | Push button disabled, tooltip: "Configure a Sheets tab name in Site Settings first" |
| `GOOGLE_APPLICATION_CREDENTIALS` missing | Backend 503: "Google Sheets not configured — set GOOGLE_APPLICATION_CREDENTIALS in .env" |
| Sheets API 403 | Backend surfaces: "Sheets access denied — share the spreadsheet with your service account email" |
| Large export | CSV streamed via `res.write()` — no in-memory array buildup |

---

## Data Shape

### audit_results columns used

- `url` → CSV `URL`
- `section` → CSV `Section`
- `issue_type` → CSV `Issue Type`
- `severity` → CSV `Severity`
- `data` (TEXT, JSON) → CSV `Details` (stringified)

### Filter query

```sql
SELECT url, section, issue_type, severity, data
FROM audit_results
WHERE crawl_job_id = ?
  AND (? OR severity IN (...))
  AND (? OR section IN (...))
ORDER BY section, severity, url
```

---

## Schema Change

`sheets_spreadsheet_id` is not currently on the `sites` table (confirmed from migration 001). A new migration is required:

```sql
ALTER TABLE sites ADD COLUMN sheets_spreadsheet_id TEXT;
```

Migration file: `backend/db/migrations/016_sheets_spreadsheet_id.js`

The Site Settings UI (site edit form) must also get a "Spreadsheet ID" field alongside the existing "Sheets Tab Name" field.

---

## Out of Scope

- PDF export (stub description mentions PDF — not in this implementation)
- Scheduled/automated exports
- Email delivery of exports
- Per-check-type column expansion in CSV (the `data` JSON field is kept as a single stringified column)
