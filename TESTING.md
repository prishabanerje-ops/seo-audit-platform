# SEO Audit Platform — Testing Checklist

> Use this file before every partial release, full release, or UAT session.
> Check off each item. If something fails, note it inline and fix before marking done.
> Never mark a UI item as passed without opening the actual page in the browser.
> For anything async (crawls, background jobs) — follow through to the end result, not just the API response.

---

## How to Start the App

```bash
# From project root — starts both frontend and backend
npm run dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:3002
# Health:   http://localhost:3002/health
```

---

## 1. Pre-Test Setup Checklist

- [ ] Backend is running (`/health` returns `{ status: 'ok' }`)
- [ ] Frontend is running (http://localhost:5173 loads without console errors)
- [ ] No stuck crawl jobs in DB (`status IN ('queued','running')` from a previous run)
- [ ] Browser console is open — watch for errors throughout all tests

---

## 2. Authentication

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.1 | Login with valid credentials | Go to `/login`, enter correct email + password | Redirects to `/admin` or last visited page |
| 2.2 | Login with wrong password | Enter correct email + wrong password | Shows error message, stays on `/login` |
| 2.3 | Login with empty fields | Submit empty form | Inline validation errors shown |
| 2.4 | Protected route redirect | Log out, visit `/sites` directly | Redirected to `/login` |
| 2.5 | Persistent session | Log in, close tab, reopen `localhost:5173` | Still logged in (httpOnly cookie) |
| 2.6 | Logout | Click logout in sidebar/header | Session cleared, redirected to `/login` |
| 2.7 | Setup page blocked | Visit `/setup` when already set up | Shows error or redirects (setup is one-time only) |

---

## 3. Sites

### 3.1 Sites List Page (`/sites`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.1.1 | **Empty state** | Delete all sites, visit `/sites` | Empty state renders with "Add Site" button that navigates to `/sites/new` |
| 3.1.2 | Sites list renders | With sites in DB | Table shows label, URL, last crawl, health ring, actions |
| 3.1.3 | Colour dot | Each site row | Coloured dot matches the site's assigned colour |
| 3.1.4 | External link | Click the URL in a site row | Opens the site URL in a new tab |
| 3.1.5 | Crawl button | Click Crawl icon on a site row | Navigates to `/crawl` with that site pre-selected |
| 3.1.6 | Edit button opens modal | Click pencil icon | Edit modal opens with pre-filled values |
| 3.1.7 | Edit — save changes | Change label/URL/colour, click Save | Modal closes, row updates without page reload |
| 3.1.8 | Edit — validation | Clear required fields, click Save | Inline errors shown, modal stays open |
| 3.1.9 | Delete button opens modal | Click trash icon | Confirmation modal appears with site name |
| 3.1.10 | Delete — confirm | Click Delete in modal | Site removed from list, success toast shown |
| 3.1.11 | Delete — cancel | Click Cancel in modal | Modal closes, site unchanged |

### 3.2 Add New Site Wizard (`/sites/new`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.2.1 | Step 1 — validation | Leave name/URL blank, click Next | Inline errors shown, stays on Step 1 |
| 3.2.2 | Step 1 — invalid URL | Enter `notaurl`, click Next | URL validation error shown |
| 3.2.3 | Step 1 — valid | Fill name + valid URL, pick colour, click Next | Advances to Step 2 |
| 3.2.4 | Step 2 — optional fields | Leave GSC/GA4 blank, click Next | Advances to Step 3 (both are optional) |
| 3.2.5 | Step 3 — crawl config loads | Reach Step 3 | CrawlConfigPanel renders with all 6 tabs |
| 3.2.6 | Step 3 — all tabs clickable | Click each sidebar tab | Spider, Content, Robots & URLs, Speed & Headers, Custom, APIs all render without errors |
| 3.2.7 | Step 3 — toggles work | Flip toggles on Spider tab | Values change visually |
| 3.2.8 | Step 3 — custom extraction | Go to Custom tab, add an extraction | Row appears with label/selector/extract fields |
| 3.2.9 | Step 4 — API info | Reach Step 4 | Shows integration links, no errors |
| 3.2.10 | Step 5 — review | Reach Step 5 | Shows correct summary of entered values |
| 3.2.11 | Back navigation | Click Back on any step | Returns to previous step, values preserved |
| 3.2.12 | Cancel | Click Cancel on Step 1 | Returns to `/sites` |
| 3.2.13 | Create site | Complete all steps, click Create Site | Site appears in `/sites` list, toast shown |

---

## 4. Crawls

### 4.1 Crawl Jobs Page (`/crawl/status`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.1.1 | **Empty state** | Delete all crawl jobs, visit `/crawl/status` | Empty state renders, "Start Crawl" button navigates to `/crawl` |
| 4.1.2 | Jobs list | With jobs in DB | Table shows site, status badge, mode, URLs, started time, duration |
| 4.1.3 | "All sites" toggle | Select a site in nav, visit `/crawl/status` | "This site only" / "All sites" toggle button is visible |
| 4.1.4 | Toggle filter | Click the toggle | List filters to/from site-specific jobs |
| 4.1.5 | New Crawl button | Click "+ New Crawl" | Navigates to `/crawl` |
| 4.1.6 | View Audit button | On a completed job | Navigates to `/audit` |
| 4.1.7 | Delete job | Click trash icon on a completed job | Confirmation modal, then job removed |
| 4.1.8 | Delete blocked on running | Running job's trash icon | Button is disabled |

### 4.2 Start Crawl Page (`/crawl`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.2.1 | No site selected | Submit without selecting a site | Error: "Please select a site" |
| 4.2.2 | Site pre-selected | Navigate here via Sites → Crawl button | The site is pre-selected in the dropdown |
| 4.2.3 | Spider tab — all 6 config tabs | Click each tab | All render without errors |
| 4.2.4 | Spider tab — depth slider | Drag the depth slider | Value badge updates in real time |
| 4.2.5 | Spider tab — JS rendering toggle | Toggle on "Crawl JavaScript" | Toggle state changes |
| 4.2.6 | Spider tab — include/exclude | Type patterns in textareas | No errors |
| 4.2.7 | Content tab | Open | Duplicate detection toggles render |
| 4.2.8 | Robots tab | Open | Robots toggles + param stripping + auth fields render |
| 4.2.9 | Speed tab | Open | Threads + speed sliders, custom headers add/remove works |
| 4.2.10 | Custom tab | Open, add an extraction | Row appears, can be removed |
| 4.2.11 | Import tab | Click "Import CSV" tab | Shows file drop zone |
| 4.2.12 | Import — no file | Click Import CSV without a file | Error: "Please select a CSV file" |
| 4.2.13 | Import — wrong file type | Drop a .txt file | File not accepted |
| 4.2.14 | Import — valid CSV | Drop a valid .csv file | File name + size shown, remove link works |

### 4.3 Live Crawl View (`/crawl/:id/live`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.3.1 | Redirects to job | Start a spider crawl | Auto-navigated to live view |
| 4.3.2 | Progress updates | During crawl | URL count increments, log lines stream |
| 4.3.3 | Cancel crawl | Click Cancel | Crawl stops, status changes to Cancelled |
| 4.3.4 | Completed state | Crawl finishes | Shows completion summary, link to audit |

---

## 5. Audit Health (`/audit`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.1 | No site selected | Visit `/audit` with no active site | Prompt to select a site |
| 5.2 | Site with no crawls | Select a site with no completed crawls | "Run a crawl first" empty state |
| 5.3 | Health score ring | Site with completed crawl | HealthRing shows score (0–100) |
| 5.4 | KPI cards | Same | Critical / Warning / Info counts shown |
| 5.5 | Trend chart | Site with 2+ completed crawls | Line chart renders |
| 5.6 | Trend chart — single crawl | Site with exactly 1 crawl | "Run 2+ crawls to see trend" message |
| 5.7 | Category accordion | Click each category | Expands to show issue count + link |
| 5.8 | "204 checks loaded" badge | Accordion header area | Badge is visible |
| 5.9 | Category links | Click a category's "View" link | Navigates to the correct audit category route |

---

## 6. Shared Components — Edge Cases

| # | Component | Test | Expected |
|---|-----------|------|----------|
| 6.1 | EmptyState | Any page with `action.to` | Button navigates correctly (not a no-op) |
| 6.2 | Modal | Open any modal, press Escape | Modal closes |
| 6.3 | Modal | Open modal, click backdrop | Modal closes |
| 6.4 | Toast | Trigger success/error action | Toast appears and auto-dismisses |
| 6.5 | Button loading state | Submit any form | Button shows spinner, is disabled during request |
| 6.6 | LoadingSkeleton | Any page on first load | Skeleton shows before data arrives |
| 6.7 | HealthRing | Score = 0 | Ring renders without crash |
| 6.8 | HealthRing | Score = 100 | Ring renders fully filled |
| 6.9 | HealthRing | Score = null/undefined | Renders gracefully (no number, greyed out) |

---

## 7. Navigation & Layout

| # | Test | Expected |
|---|------|----------|
| 7.1 | All sidebar links | Each link navigates to the correct route without a 404 |
| 7.2 | Active sidebar item | Current route is highlighted in sidebar |
| 7.3 | Site selector (top nav) | Changing site updates `activeSite` context across pages |
| 7.4 | Unknown route | Visit `/does-not-exist` | 404 / NotFound page shown |
| 7.5 | Admin-only routes | Log in as non-admin, visit `/settings` | Redirected or access denied |
| 7.6 | Browser back/forward | Navigate between pages, use browser back | History works correctly |

---

## 8. API & Backend Checks

| # | Test | Expected |
|---|------|----------|
| 8.1 | Health endpoint | `GET /health` | `{ status: 'ok' }` |
| 8.2 | Auth required | `GET /api/sites` without cookie | `401 Unauthorized` |
| 8.3 | Crawl conflict | Start a second crawl for the same site while one is running | `409 Conflict` error shown in UI |
| 8.4 | Invalid site ID | `GET /api/crawls?site_id=fake` | Returns empty list, no 500 error |
| 8.5 | DB not deleted | `backend/seo-automation.db` exists | Admin account and seed data intact |
| 8.6 | SF binary exists | Run `ls "/Applications/Screaming Frog SEO Spider.app/Contents/MacOS/"` | `ScreamingFrogSEOSpiderLauncher` is present |
| 8.7 | SF binary path in .env | Check `SF_BINARY_PATH` in `.env` | Matches the exact filename from 8.6 |
| 8.8 | Crawl actually runs | Start a spider crawl, watch the live view | Progress lines stream in, URL count increments — confirms binary launched correctly |

---

## 9. Console & Network — Zero Tolerance

Before marking any test session complete:

- [ ] Open DevTools → Console tab — **zero red errors**
- [ ] Open DevTools → Network tab — **zero failed requests (4xx/5xx)** that are not intentional (e.g. testing a 401)
- [ ] No `undefined is not a function` or `Cannot read properties of undefined` errors

---

## 10. UAT Sign-Off Checklist

Run these end-to-end before handing to a tester or moving to the next phase:

- [ ] Can add a new site from scratch (wizard completes, site appears in list)
- [ ] Can edit and delete a site
- [ ] Can start a spider crawl and see it run live
- [ ] Can import a CSV and see the job appear as completed
- [ ] Can view the Audit Health page with real data
- [ ] Empty states on all major pages work (navigation buttons function)
- [ ] No console errors on any visited page
- [ ] Login and logout work correctly

---

## Bug Reporting Format

When you find a bug, note it here:

```
## Bug: <short title>
- Page: /route
- Steps to reproduce:
- Expected:
- Actual:
- Fixed: yes/no
```

---

*Last updated: 2026-04-12*
