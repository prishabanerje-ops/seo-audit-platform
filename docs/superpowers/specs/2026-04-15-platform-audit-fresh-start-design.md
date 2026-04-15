# Design Spec: Platform Audit & Fresh Start

**Date:** 2026-04-15
**Author:** Claude (brainstorming session)
**Status:** Approved — pending implementation

---

## 1. Overview

Reset all operational data (Option A — keep superadmin account) and execute a full platform audit-and-fix pass in risk-priority order: security first, then broken features, then code quality, then performance. Issues are fixed inline as discovered — no separate review gate between audit and fix.

---

## 2. Approach

**Approach C — Risk priority:**

1. Data Reset
2. Security audit + fix
3. Feature completeness audit + fix
4. Code quality audit + fix
5. Performance audit + fix

Each phase completes fully before the next begins. Every fix is committed immediately after it is made.

---

## 3. Phase 1 — Data Reset

Run as a single SQLite transaction. No DB file deletion. Server restarts after to re-seed audit_checks.

### 3.1 Tables to Clear

| Table | Action | Reason |
|---|---|---|
| `audit_results` | DELETE all rows | 131,816 old crawl findings |
| `crawl_jobs` | DELETE all rows | 101 historical jobs |
| `sites` | DELETE all rows | 6 sites — fresh start |
| `error_log` | DELETE all rows | 24 stale error records |
| `ad_oauth_state` | DELETE all rows | 6 stale OAuth tokens |
| `audit_log` | DELETE all rows | 2 old action log entries |

### 3.2 Users

| User | Action | Reason |
|---|---|---|
| `admin@c24.com` | DELETE | Migration artifact with hardcoded known password |
| `aakash.srivastava@cars24.com` | KEEP | Real superadmin account |

### 3.3 Tables to Keep Untouched

| Table | Reason |
|---|---|
| `audit_checks` (291 rows) | Seeded registry — not user data |
| `companies` (1 row) | Cars24 company record |
| `_migrations` (9 rows) | Migration execution history |
| All empty tables | Already clean (GSC, GA4, ads, tasks, notifications, settings) |

### 3.4 Verification

After reset, confirm via inline query that:
- `audit_results` = 0 rows
- `crawl_jobs` = 0 rows
- `sites` = 0 rows
- `users` = 1 row (superadmin only)
- `audit_checks` = 291 rows

---

## 4. Phase 2 — Security Audit + Fix

Scan the full backend. Fix all issues found before moving to Phase 3.

### 4.1 Auth Guards

**Check:** Every route in `backend/routes/` applies the correct access level.

Expected coverage:
- All routes protected by global `authMiddleware` (already in `server.js`)
- Admin-only routes use `requireRole('admin')`
- Superadmin-only routes use `requireRole('superadmin')`
- PUBLIC_PATHS in `auth.js` contains only genuinely public endpoints

**Fix:** Add missing guards. Tighten PUBLIC_PATHS if any route is accidentally public.

### 4.2 Input Validation

**Check:** Every POST, PUT, and PATCH route validates `req.body` with the `validate()` Zod middleware before using it.

**Fix:** Add `validate(schema)` middleware to any route missing it. Define minimal Zod schema (required fields, types, max lengths).

### 4.3 Rate Limiting

**Check:** `apiLimiter` (300 req/min) applied to `/api`. AI route has its own stricter limit. Verify no critical route bypasses rate limiting.

**Fix:** Apply limits where missing.

### 4.4 Cookie Security

**Check:** `auth_token` cookie set with:
- `httpOnly: true`
- `sameSite: 'strict'`
- `secure: true` in production
- Reasonable `maxAge`

**Fix:** Correct cookie options in `setAuthCookie` in `backend/middleware/auth.js`.

### 4.5 SQL Injection

**Check:** Every DB query uses `db.prepare()` with bound parameters. No string interpolation into SQL. SQLite multi-statement DDL calls used only in migrations, not in routes or services.

**Fix:** Convert any raw SQL string construction to parameterized queries.

### 4.6 Sensitive Data in Responses

**Check:** No API response includes `password_hash` or other internal fields. Verify `GET /api/auth/me` and user-listing routes strip sensitive columns.

**Fix:** Explicitly select safe columns in queries or delete fields before `res.json()`.

### 4.7 Error Response Sanitization

**Check:** The global error handler in `server.js` returns `{ error: 'Internal server error' }` — not stack traces or DB error messages — in production.

**Fix:** Ensure error handler never leaks `err.message` or `err.stack` to client in production mode.

### 4.8 CORS

**Check:** `origin` pinned to `process.env.FRONTEND_URL`. No wildcard `*` anywhere. `credentials: true` set.

**Fix:** Tighten if too permissive.

---

## 5. Phase 3 — Feature Completeness Audit + Fix

Test every non-stub route and page. Fix broken behaviour immediately.

### 5.1 Backend API Endpoints

| Endpoint | Verified behaviour |
|---|---|
| `GET /api/health` | Returns `{ status: 'ok' }` with env var summary |
| `GET /api/auth/setup-status` | Returns `{ setupComplete: true }` |
| `POST /api/auth/login` | Sets `auth_token` cookie, returns user object without `password_hash` |
| `GET /api/auth/me` | Returns current user; fails with 401 when unauthenticated |
| `GET /api/sites` | Returns empty array after data reset |
| `POST /api/sites` | Creates site, returns it with `id` |
| `PUT /api/sites/:id` | Updates site metadata |
| `DELETE /api/sites/:id` | Removes site |
| `POST /api/crawls` | Creates job with status `pending` |
| `GET /api/crawls` | Lists jobs for the user's company |
| `GET /api/reports/checks/count` | Returns `{ total: 291 }` |
| `GET /api/reports/audit-summary` | Returns per-category breakdown (empty after reset) |
| `GET /api/reports/health-score` | Returns numeric score |
| `POST /api/errors` | Accepts error payload without auth |
| `GET /api/errors` | Admin-only; returns error log |
| `GET /api/companies` | Superadmin-only; returns company list |
| `GET /api/audit-log` | Superadmin-only; returns paginated log |

### 5.2 Frontend Pages

| Page | Core behaviour to verify |
|---|---|
| `/login` | Form submits, JWT set, redirects to `/sites` |
| `/sites` | Empty state renders after reset; create site works |
| `/sites/new` | Wizard steps advance, site saved, redirect back to `/sites` |
| `/crawl` | Config panel renders all tabs; start crawl creates job |
| `/crawl/status` | Empty state after reset; lists jobs once created |
| `/crawl/:jobId/live` | Socket.io connects; real-time URL list renders |
| `/audit` | 19 categories render with 0 counts after reset; health score shows 0 |
| `/ads` | Page renders without JS error; connect buttons visible |
| `/companies` | Accessible only to superadmin; Cars24 row shows |
| `/audit-log` | Accessible only to superadmin; empty after reset |

### 5.3 Fix Approach

- Any endpoint returning unexpected status codes, wrong data shape, or crashing → fix immediately
- Any page throwing a JS error or rendering blank → fix immediately
- Stubs (AdminView, Tasks, Settings, etc.) are intentionally incomplete — skip

---

## 6. Phase 4 — Code Quality Audit + Fix

### 6.1 Large File Review

| File | Lines | Review question |
|---|---|---|
| `AdsDashboard.jsx` | 797 | Extract connection management and metrics display into separate sub-components if they have clearly separate concerns |
| `CrawlConfigPanel.jsx` | 687 | Split tabs (rules, sitemaps, scheduling) into focused child components if coupling is low |
| `auth.js` (route) | 461 | Separate user management endpoints from login/logout/register if they serve different concerns |
| `audit-parser.service.js` | 516 | Verify each check function is clearly isolated; no shared mutable state between checks |

**Rule:** Only split a file if it genuinely has two distinct responsibilities. Size alone is not a reason.

### 6.2 Consistency Checks

| Check | Expected pattern |
|---|---|
| API error responses | All routes return `{ error: 'message' }` — never `{ message: '...' }` or plain strings |
| HTTP status codes | 400 validation, 401 auth, 403 role, 404 missing, 500 server — not mixed up |
| DB query style | `.prepare().get()` / `.all()` / `.run()` — multi-statement DDL only in migration files |
| Frontend API calls | All through `src/api/index.js` Axios client — no raw `fetch()` |
| Unused imports | Remove any import not referenced in the file |
| Dead code | Remove commented-out blocks, unreachable code, unused exports |
| Console.log | Remove debug `console.log` from production paths; keep `console.error` in error handlers |
| TODO/FIXME | Resolve or delete — no unresolved markers in committed code |

### 6.3 Route Consistency

**Check:** Every route registered in `server.js` has a corresponding handler. No route file imports a service that does not exist. No service is imported by no route.

---

## 7. Phase 5 — Performance Audit + Fix

### 7.1 Database Indexes

**Check:** Run `PRAGMA index_list(table)` on high-traffic tables.

Required indexes (verify exist, add if missing):

| Table | Column(s) | Query pattern |
|---|---|---|
| `audit_results` | `(crawl_job_id)` | Filter results by job |
| `audit_results` | `(site_id, category)` | Health score and category summary |
| `audit_results` | `(company_id)` | Multi-tenancy scoping |
| `crawl_jobs` | `(site_id, status)` | List jobs per site |
| `sites` | `(company_id)` | List sites per tenant |

**Migration:** Indexes added via a new migration file `011_performance_indexes.js`.

### 7.2 N+1 Query Detection

**Check:** Scan all route handlers for loops that run individual DB queries per row.

**Fix:** Replace with single query using `IN (...)` clause or JOIN.

### 7.3 Audit Results Query Cost

**Check:** Run `EXPLAIN QUERY PLAN` on health-score and category-summary queries in `backend/routes/reports.js`. Confirm index usage — no full table scans.

**Fix:** Add covering index if SCAN appears in the plan.

### 7.4 Frontend Bundle Size

**Check:** Run `npm run build` in frontend. Flag any chunk over 500 KB uncompressed.

**Fix:** Add `React.lazy()` + `Suspense` for the largest page components (AdsDashboard, Companies) if they contribute to the main bundle.

### 7.5 Socket.io URL Buffer Memory

**Check:** In `backend/services/crawl-runner.js`, verify `jobUrlBuffer` Map is cleared when a job completes or fails — not only when the client disconnects.

**Fix:** Add `jobUrlBuffer.delete(jobId)` in the job completion and failure handlers.

### 7.6 Server Startup

**Check:** `seedAuditChecks()` returns early if count is already 291. Migrations skip already-applied IDs. Verify both are true by reading startup logs.

---

## 8. Non-Goals

- No new features
- No changes to crawl logic, Screaming Frog CLI integration, or SF parser
- No stub pages built (Phase 3+ features intentionally deferred)
- No git history rewriting for migration 006 credentials — accepted risk for internal repo

---

## 9. Implementation Order

1. Phase 1: Data reset (single transaction + verify)
2. Phase 2: Security (auth guards → input validation → rate limiting → cookies → SQL → responses → CORS)
3. Phase 3: Feature completeness (backend endpoints → frontend pages)
4. Phase 4: Code quality (large files → consistency → dead code)
5. Phase 5: Performance (indexes via migration → N+1 → query plans → bundle → socket cleanup)

Each phase produces at least one commit. All tests must pass after each phase.

---

## 10. Success Criteria

- DB: 0 operational rows, 291 audit checks, 1 user (superadmin)
- All backend tests pass (53 currently — must not regress)
- No missing auth guards or input validation on any route
- Every non-stub page loads without error
- Every non-stub API endpoint returns correct status and data shape
- No N+1 queries in report endpoints
- All high-traffic DB columns indexed
- Frontend main chunk under 500 KB
- Socket.io URL buffer cleaned up on job completion
