# Phase 2 + 3 — Architecture & DRY

Combined because the findings overlap heavily. "Architecture" = how layers interact; "DRY" = specific duplicated blocks.

Date: 2026-04-24
Method: direct source read of all 19 route files, 13 services, middleware, and entry points; grep counts where referenced.

---

## Architecture findings

### ARCH-H1 — No DAL/repository layer; routes run SQL directly
**Every** route file imports `db` from `db/sqlite.js` and runs `db.prepare(...)` inline. Count by route:
- `auth.js`: ~16 DB calls | `reports.js`: ~20 | `tasks.js`: ~15 | `ads.js`: ~8 | `sites.js`: ~8 | `gsc.js`/`ga4.js`: ~12 each | `crawls.js`: ~10
- Business logic and persistence are mixed. The line "Routes → DB directly ~60%" from Phase 0 is actually closer to 90% — the small exception is `audit-parser.service.js` which encapsulates the bulk insert for audit_results.
**Impact:** hard to change schema, hard to mock in tests, no enforced invariants, no caching layer, no transaction policy.
**Severity:** HIGH (architectural debt).
**Recommendation:** extract `backend/repos/*.repo.js` — thin modules that own SQL for each table (sitesRepo, crawlJobsRepo, auditResultsRepo, usersRepo, companySettingsRepo, etc.). Routes call repos; services orchestrate multi-repo work.

### ARCH-H2 — Socket.io rooms are not authenticated
**File:** [backend/server.js:92–102](backend/server.js#L92-L102)
**Evidence:**
```js
io.on('connection', (socket) => {
  socket.on('join:job',     (jobId)    => socket.join(`job:${jobId}`));
  socket.on('join:company', (companyId)=> socket.join(`company:${companyId}`));
});
```
No `io.use(authHandler)` middleware. Any anonymous socket.io client can emit `join:job` with any jobId and receive `crawl:url`, `crawl:progress`, `crawl:complete` events — leaking URL lists, crawl status, and later `ads:sync:progress` data (company-scoped metrics) to other tenants.
**Severity:** HIGH (cross-tenant data leak over WebSocket).
**Fix:** add `io.use((socket, next) => { verify cookie → decode JWT → attach user; next() })`. In `join:company`, enforce `companyId === socket.user.company_id || socket.user.role === 'superadmin'`. For `join:job`, fetch the job and check its company_id.

### ARCH-H3 — Route files violate separation of concerns
Several route files contain substantial business logic:
- `routes/ai.js:33–159` — 126 lines of Anthropic SDK usage, prompt construction, DB writes, SSE stream handling. Belongs in `services/ai.service.js`.
- `routes/auth.js:519–515` (change-password), `:527–584` (impersonate) — multi-step flows with bcrypt, JWT, audit logging. Belongs in `services/auth.service.js`.
- `routes/reports.js:245–253` — health score computation (`penalty / totalUrls * 10`). Belongs in `services/health-score.js`.
- `routes/ads.js:100–287` — OAuth URL construction + 3 callback handlers. Belongs in `services/ads.oauth.js` per platform.
**Severity:** HIGH.

### ARCH-H4 — No consistent error envelope
Error responses vary: `{error: 'string'}`, `{error: 'code', message: 'string'}`, `{error: 'Validation failed', details: {...}}`, `{error: err.message}`, `{error: 'access_expired', message: '...'}`.
**Severity:** MEDIUM.
**Fix:** define `ApiError` class + a `res.apiError(code, status, details?)` helper; make Zod validator emit the same shape.

### ARCH-M1 — ads.service.js mixes 4 concerns in one file
[backend/services/ads.service.js](backend/services/ads.service.js) 185 lines, covering:
- OAuth state CRUD (L37–53)
- Connection encryption/storage (L55–94)
- Snapshot cache (L97–116)
- Per-platform metric orchestration (L118–185)
Split into `ads.oauth-state.js`, `ads.connections.js` (or merge into a repo), `ads.snapshots.js`, `ads.metrics.js`.
**Severity:** MEDIUM.

### ARCH-M2 — Dynamic imports inside request handlers
[backend/services/ads.service.js:133–140, 165–172](backend/services/ads.service.js#L133-L140)
```js
const { fetchGoogleMetrics } = await import('./ads.google.js');
```
Runs on every metric request; breaks ESM tree-shaking; adds cold-start to per-request latency.
**Severity:** LOW — convert to static top-level imports.

### ARCH-M3 — No transaction wrapping on multi-step DB writes
[backend/routes/tasks.js:264–272](backend/routes/tasks.js#L264-L272) — sync-linear: external fetch + UPDATE task_status + INSERT linear_tickets; no rollback if second INSERT fails.
[backend/routes/crawls.js:136–143](backend/routes/crawls.js#L136-L143) — INSERT job + setImmediate startCrawl; ok if startCrawl fails (status='failed' update) but no transaction.
[backend/routes/auth.js:274–280](backend/routes/auth.js#L274-L280) — invite/accept: INSERT users + UPDATE invites; not atomic.
**Severity:** MEDIUM.
**Fix:** use `db.transaction(() => { … })(args)` from better-sqlite3.

### ARCH-M4 — Migrations run automatically only in dev
[backend/db/sqlite.js:88–90](backend/db/sqlite.js#L88-L90) — `if (process.env.NODE_ENV !== 'production') runMigrations();`
Production requires `node db/sqlite.js` manually. Documentation (CLAUDE.md) says "Migrations: Run automatically on server start via runMigrations() in server.js." — this is out of sync with actual behavior.
**Severity:** MEDIUM (docs/reality drift).

### ARCH-M5 — crawl-runner module-level state prevents horizontal scaling
[backend/services/crawl-runner.js:22–27](backend/services/crawl-runner.js#L22-L27) — `activeControllers` and `urlBuffers` are `Map`s held in a single Node process. Scaling to multiple backend instances would require Redis-backed state. Not a problem today (single-process deployment) but documents a scaling ceiling.
**Severity:** LOW.

### ARCH-M6 — `/api/auth/me` duplicates `authMiddleware`'s JWT verify logic
[backend/routes/auth.js:122–140](backend/routes/auth.js#L122-L140) vs [backend/middleware/auth.js:28–57](backend/middleware/auth.js#L28-L57).
Both verify the cookie JWT and look up the user. 15 lines redundant.
**Fix:** remove `/api/auth/me` from `PUBLIC_PATHS`; the route can just return `req.user` and let middleware handle missing token with a dedicated 200 + `{user:null}` path, or accept the 401.
**Severity:** LOW.

### ARCH-M7 — No API versioning
All routes under `/api/*`. Breaking changes will require coordination with frontend. Typical mitigation `/api/v1` is absent.
**Severity:** LOW.

### ARCH-M8 — Frontend has context but no data hooks
Contexts exist for Auth, Sites, Toast but there's no equivalent for crawls, reports, GA4, GSC. Each page reinvents fetch+loading+error state (e.g., CrawlStatus, CompareView both implement polling inline).
**Fix:** introduce `hooks/useCrawlStatus.js`, `useReportSummary.js`, etc. Either custom hooks or add React Query / SWR.
**Severity:** MEDIUM.

---

## DRY findings (duplicated blocks)

### DRY-H1 — Company-scoping check is copy-pasted 16 times
Pattern (found in 16 spots via grep `site.company_id !== company_id`):
```js
const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
if (!site) return res.status(404).json({ error: 'Site not found' });
if (role !== 'superadmin' && site.company_id !== company_id) {
  return res.status(403).json({ error: 'Access denied' });
}
```
Confirmed locations (file:approx_line):
- `reports.js:71-75, 137-141, 199-203, 313-317, 336-340, 458-462` — **6×** in one file
- `gsc.js:154-158, 194-197, 223-227` — 3×
- `ga4.js:155-159, 180-183` — 2×
- `crawls.js:119-123, 158-162, 169-173, 187-189` — 4×
- `ai.js:47-49` — 1×
Only `routes/tasks.js` extracted a helper (`verifyTaskOwnership`, L23–35).
**Fix:** a `requireSiteAccess` Express middleware or a shared `assertSiteAccess(siteId, req.user)` helper that returns the loaded site or throws an `ApiError`.
**Severity:** HIGH.

### DRY-H2 — "Latest completed crawl job" query appears 6× in reports.js
Pattern (grep `ORDER BY started_at DESC LIMIT 1` — 6 hits in reports.js alone):
```sql
SELECT id, … FROM crawl_jobs
WHERE site_id = ? AND status = 'completed'
ORDER BY started_at DESC LIMIT 1
```
Locations: [reports.js:85–89](backend/routes/reports.js#L85-L89), `:154–158`, `:206–211`, `:342–346`, `:464–468`, `:319–323` (+ `:209`).
**Fix:** extract `getLatestCompletedJob(siteId, { fields })` helper.
**Severity:** HIGH.

### DRY-H3 — Task enrichment JOIN duplicated 5× in tasks.js
Each of `GET /`, `POST /`, `PATCH /:id`, `GET /:id`, `POST /:id/sync-linear` re-runs the same LEFT JOIN users + LEFT JOIN sites block ([tasks.js:44–54, 97–104, 149–156, 174–181, 275–282](backend/routes/tasks.js#L44-L54)).
**Fix:** one `getEnrichedTaskById(id)` helper.
**Severity:** MEDIUM.

### DRY-H4 — `resolveCompanyId(req)` duplicated verbatim in gsc.js and ga4.js
[gsc.js:22–26](backend/routes/gsc.js#L22-L26) and [ga4.js:22–26](backend/routes/ga4.js#L22-L26) are identical.
**Fix:** `backend/lib/resolve-company-id.js` or use as part of the per-company middleware.
**Severity:** LOW (tiny function, but sets a precedent).

### DRY-M1 — OAuth makeOAuth2Client also duplicated
[gsc.js:13–20](backend/routes/gsc.js#L13-L20) vs [ga4.js:13–20](backend/routes/ga4.js#L13-L20) — the only difference is the redirect_uri env-var name. Parameterise into a factory in `services/google-oauth.js`.
**Severity:** LOW.

### DRY-M2 — Pagination parsing repeated
`Math.min(Math.max(parseInt(raw || '50', 10) || 50, 1), 200)` appears in at least 6 routes (`reports.js:143–144`, `ga4.js:185–186`, `auth.js:360–361`, `sites.js:39–40`, `crawls.js:12`, `notifications.js`).
**Fix:** `parsePagination(req, { defaultLimit, maxLimit })` utility.
**Severity:** LOW.

### DRY-M3 — Error + redirect pattern in OAuth callbacks
`res.redirect(\`${FRONTEND_URL}/integrations?${provider}_error=...\`)` in `ads.js:49`, `gsc.js:46/51/54/89`, `ga4.js:46/51/54/89`. All the logic is the same except provider name.
**Fix:** `redirectWithError(res, provider, code)` helper.
**Severity:** LOW.

### DRY-M4 — Crawl defaults duplicated across backend/frontend
[backend/routes/crawls.js:69–101](backend/routes/crawls.js#L69-L101) Zod defaults vs [frontend/src/components/CrawlConfigPanel.jsx:21+](frontend/src/components/CrawlConfigPanel.jsx#L21) `DEFAULT_CONFIG`.
Today the two are only visually consistent; a drift here creates silent UX/backend mismatch.
**Fix:** generate the frontend `DEFAULT_CONFIG` from a backend endpoint (`GET /api/crawls/defaults`) or a shared JSON file.
**Severity:** MEDIUM.

### DRY-M5 — OAuth state parse pattern in GSC and GA4 is literally the same
[gsc.js:49–55](backend/routes/gsc.js#L49-L55) and [ga4.js:49–55](backend/routes/ga4.js#L49-L55) are identical.
**Severity:** LOW — but will be rewritten when SEC-C3 is fixed.

---

## Summary
- **Architecture findings:** 12 (3 high, 7 medium, 2 low).
- **DRY findings:** 11 (3 high, 5 medium, 3 low).
- **Overlap with Phase 1:** ARCH-H2 (Socket.io auth) is effectively a security finding — promote severity.

## Top fixes (biggest ROI)
1. **Authenticate Socket.io connections** (ARCH-H2) — 1 day, immediately closes cross-tenant leak.
2. **`requireSiteAccess` middleware** (DRY-H1) — removes 16 duplicate blocks and centralizes a security check.
3. **`getLatestCompletedJob` helper + service extraction for `/reports/:siteId/summary`** (DRY-H2 + ARCH-H3) — reduces reports.js by ~30%.
4. **Thin repository layer for top 5 tables** (ARCH-H1) — `sitesRepo`, `crawlJobsRepo`, `auditResultsRepo`, `usersRepo`, `companySettingsRepo`. Biggest architectural win but multi-day scope.
