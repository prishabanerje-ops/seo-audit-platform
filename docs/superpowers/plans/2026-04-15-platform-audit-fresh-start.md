# Platform Audit & Fresh Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reset all operational data and execute a full security → feature → quality → performance audit-and-fix pass, leaving the platform clean and production-ready.

**Architecture:** Five sequential phases (data reset → security → features → code quality → performance). Each issue is fixed inline as discovered. Every phase commits before the next begins. No new features — only fixes and hardening.

**Tech Stack:** Node.js 20+, Express, better-sqlite3 (synchronous), React 18, Vite, Vitest, SQLite WAL mode.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/db/reset.js` | Create | One-shot data reset script |
| `backend/routes/auth.js` | Modify | Add explicit ALLOWED_USER_PATCH_FIELDS whitelist to PATCH handler |
| `backend/db/migrations/011_performance_indexes.js` | Create | Add company_id indexes on sites, crawl_jobs, audit_results |
| `backend/db/sqlite.js` | Modify | Register migration 011 in MIGRATIONS array |

---

## Task 1: Data Reset

**Files:**
- Create: `backend/db/reset.js`

- [ ] **Step 1: Kill the running server**

```bash
pkill -f "node.*server" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1
echo "Server stopped"
```

- [ ] **Step 2: Create the reset script**

Create `backend/db/reset.js`:

```js
/**
 * One-shot operational data reset (Option A).
 * Keeps: superadmin user, Cars24 company, audit_checks (291), migrations.
 * Deletes: all sites, crawl jobs, audit results, error logs, stale OAuth tokens.
 * Deletes: admin@c24.com (migration artifact with known default password).
 *
 * Run once: node backend/db/reset.js
 */
import db from './sqlite.js';

const reset = db.transaction(() => {
  db.prepare('DELETE FROM audit_results').run();
  db.prepare('DELETE FROM crawl_jobs').run();
  db.prepare('DELETE FROM sites').run();
  db.prepare('DELETE FROM error_log').run();
  db.prepare('DELETE FROM ad_oauth_state').run();
  db.prepare('DELETE FROM audit_log').run();
  db.prepare("DELETE FROM users WHERE email != 'aakash.srivastava@cars24.com'").run();
});

reset();

// Verify
const checks = [
  { table: 'audit_results', expected: 0 },
  { table: 'crawl_jobs',    expected: 0 },
  { table: 'sites',         expected: 0 },
  { table: 'users',         expected: 1 },
  { table: 'audit_checks',  expected: 291 },
];

let allOk = true;
for (const { table, expected } of checks) {
  const { cnt } = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get();
  const ok = cnt === expected;
  console.log(`${ok ? '✓' : '✗'} ${table}: ${cnt} rows (expected ${expected})`);
  if (!ok) allOk = false;
}

if (!allOk) {
  console.error('\nReset incomplete — check above failures.');
  process.exit(1);
}

console.log('\nReset complete. Platform is clean.');
db.close();
```

- [ ] **Step 3: Run the reset**

```bash
cd /Users/a39326/Documents/Aakash/backend && node db/reset.js
```

Expected output:
```
✓ audit_results: 0 rows (expected 0)
✓ crawl_jobs: 0 rows (expected 0)
✓ sites: 0 rows (expected 0)
✓ users: 1 rows (expected 1)
✓ audit_checks: 291 rows (expected 291)

Reset complete. Platform is clean.
```

- [ ] **Step 4: Verify the surviving user is the superadmin**

```bash
cd /Users/a39326/Documents/Aakash/backend && node --input-type=module -e "
import db from './db/sqlite.js';
const u = db.prepare('SELECT email, role FROM users').all();
console.log(JSON.stringify(u, null, 2));
"
```

Expected:
```json
[{ "email": "aakash.srivastava@cars24.com", "role": "superadmin" }]
```

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/db/reset.js
git commit -m "chore: add data reset script and clear all operational data (Option A)"
```

---

## Task 2: Security — PATCH /api/auth/users Field Whitelist

**Files:**
- Modify: `backend/routes/auth.js:332-378`

**Context:** The PATCH handler (line 355) builds its `SET` clause by iterating `Object.entries(req.body)`. Zod strips unknown fields, so the column names are constrained to `role`, `status`, `name` — but the code doesn't make this explicit. The pattern is inconsistent with `sites.js` which uses an explicit `ALLOWED_PATCH_FIELDS` whitelist. Add the same defensive pattern here.

- [ ] **Step 1: Open `backend/routes/auth.js` and locate the PATCH handler**

Find the block starting at line 338:
```js
router.patch('/users/:id', requireRole('admin', 'superadmin'), validate(patchUserSchema), (req, res) => {
```

- [ ] **Step 2: Add the whitelist constant before the route**

Add this line immediately before `router.patch('/users/:id', ...)` (after the `patchUserSchema` definition):

```js
const ALLOWED_USER_PATCH_FIELDS = ['role', 'status', 'name'];
```

- [ ] **Step 3: Replace the dynamic SQL block**

Find (lines 355-363):
```js
  const fields = [];
  const vals = [];
  for (const [k, v] of Object.entries(req.body)) {
    fields.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
```

Replace with:
```js
  // Use an explicit whitelist (matches pattern in sites.js) to prevent
  // column injection if patchUserSchema is ever extended carelessly.
  const fields = Object.entries(req.body)
    .filter(([k]) => ALLOWED_USER_PATCH_FIELDS.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
  const vals = [...fields.map(([, v]) => v), id];
  db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...vals);
```

- [ ] **Step 4: Run the test suite — confirm no regressions**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test 2>&1 | tail -10
```

Expected:
```
Tests  53 passed (53)
```

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/auth.js
git commit -m "fix: add explicit field whitelist to PATCH /api/auth/users handler"
```

---

## Task 3: Security — Full Route Audit

**Files:**
- Read only (fix inline if gaps found): all files in `backend/routes/`

This is a verification task. Read each route file and confirm every endpoint has correct access control and input validation. Fix any gaps found.

- [ ] **Step 1: Verify auth guard coverage**

Run the following to list all routes and their guard functions:

```bash
grep -n "router\.\(get\|post\|put\|patch\|delete\)" \
  /Users/a39326/Documents/Aakash/backend/routes/auth.js \
  /Users/a39326/Documents/Aakash/backend/routes/sites.js \
  /Users/a39326/Documents/Aakash/backend/routes/crawls.js \
  /Users/a39326/Documents/Aakash/backend/routes/reports.js \
  /Users/a39326/Documents/Aakash/backend/routes/companies.js \
  /Users/a39326/Documents/Aakash/backend/routes/errors.js \
  /Users/a39326/Documents/Aakash/backend/routes/audit-log.js \
  /Users/a39326/Documents/Aakash/backend/routes/ads.js
```

Expected access levels:
```
auth.js:
  GET  /setup-status         → public ✓
  POST /register             → public (returns 403 — disabled) ✓
  POST /login                → public + authLimiter + validate ✓
  POST /logout               → public ✓
  GET  /me                   → public (returns null when no session) ✓
  POST /invite               → requireRole(admin, superadmin) + validate ✓
  GET  /invite/validate      → public ✓
  POST /invite/accept        → public + authLimiter + validate ✓
  GET  /users                → requireRole(admin, superadmin) ✓
  PATCH /users/:id           → requireRole(admin, superadmin) + validate ✓
  DELETE /users/:id          → requireRole(admin, superadmin) ✓
  POST /change-password      → public + authLimiter + validate ✓

sites.js:
  GET  /                     → authMiddleware (global) ✓
  POST /                     → authMiddleware + validate ✓
  GET  /:id                  → authMiddleware ✓
  PATCH /:id                 → authMiddleware + validate ✓
  DELETE /:id                → authMiddleware ✓

crawls.js:
  GET  /                     → authMiddleware ✓
  POST /                     → authMiddleware + validate ✓
  GET  /:id                  → authMiddleware ✓
  POST /:id/cancel           → authMiddleware ✓
  DELETE /:id                → authMiddleware ✓

reports.js:
  GET /checks/count          → authMiddleware ✓
  GET /:siteId/summary       → authMiddleware + company_id scoping ✓
  GET /:siteId/trend         → authMiddleware + company_id scoping ✓

companies.js:
  router.use(requireSuperAdmin) → all routes protected ✓

errors.js:
  POST /                     → public + validate ✓
  GET  /                     → requireRole(admin, superadmin) ✓

audit-log.js:
  Should be superadmin-only — verify
```

- [ ] **Step 2: Read and verify audit-log.js**

```bash
cat /Users/a39326/Documents/Aakash/backend/routes/audit-log.js
```

Confirm: all routes use `requireSuperAdmin` or `requireRole('superadmin')`.

If the file uses `requireRole('admin', 'superadmin')` for the audit log, tighten it to `requireSuperAdmin` — audit logs should never be visible to company admins.

- [ ] **Step 3: Verify PUBLIC_PATHS in middleware/auth.js**

Read `backend/middleware/auth.js` lines 8–20. Confirm the list matches the expected public routes above. Remove any path that shouldn't be public.

- [ ] **Step 4: Check ads OAuth callback is appropriately scoped**

The entry `{ method: 'GET', path: '/api/ads/callback/' }` uses `startsWith` matching, which would allow any path under `/api/ads/callback/` to bypass auth. Read `backend/routes/ads.js` — confirm the callback route exists only for OAuth flows and does not return sensitive data without verification.

- [ ] **Step 5: Run tests**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test 2>&1 | tail -10
```

Expected: 53 passed.

- [ ] **Step 6: Commit any fixes**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/auth.js backend/routes/audit-log.js backend/middleware/auth.js
git commit -m "fix: security audit — auth guards and PUBLIC_PATHS verification"
```

(Skip commit if no changes were needed.)

---

## Task 4: Security — Response Sanitization and Cookie Audit

**Files:**
- Read: `backend/server.js`, `backend/routes/auth.js`

- [ ] **Step 1: Verify the global error handler strips stack traces**

Read `backend/server.js` lines 148–151. The error handler must look like:

```js
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

If it includes `err.message` or `err.stack` in the response, replace it with the above.

- [ ] **Step 2: Verify password_hash never appears in API responses**

```bash
grep -rn "password_hash" /Users/a39326/Documents/Aakash/backend/routes/
```

Every occurrence must be in a SELECT that explicitly does NOT include `password_hash` in the returned columns. Confirm:
- `GET /api/auth/me` selects: `id, email, name, role, company_id, avatar_url, status` ✓
- `GET /api/auth/users` selects: `id, email, name, role, company_id, avatar_url, status, last_active_at, created_at` ✓
- `POST /api/auth/login` returns: `{ user: { sub, email, name, role, company_id } }` ✓

If any SELECT includes `*` on the users table and the result goes to the client, rewrite it to explicit columns.

- [ ] **Step 3: Verify cookie security settings**

Read `backend/routes/auth.js` lines 21–29 (`getCookieOptions` function).

The function must set:
- `httpOnly: true` ✓
- `sameSite: 'lax'` (acceptable — 'strict' would break OAuth redirects)
- `secure: true` only when the connection is HTTPS (already conditional on `isHttps`)
- `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days)

If any of these are missing, add them.

- [ ] **Step 4: Run tests**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test 2>&1 | tail -10
```

Expected: 53 passed.

- [ ] **Step 5: Commit any fixes**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/server.js backend/routes/auth.js
git commit -m "fix: security audit — response sanitization and cookie settings"
```

(Skip commit if no changes were needed.)

---

## Task 5: Feature Completeness — Backend Endpoints

**Files:**
- No file changes unless endpoint is broken

Start the server first:

```bash
cd /Users/a39326/Documents/Aakash && npm run dev &
sleep 3
```

Login and capture the cookie:

```bash
curl -s -c /tmp/seo.cookies -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"aakash.srivastava@cars24.com","password":"YOUR_PASSWORD"}' | python3 -m json.tool
```

Expected: `{ "user": { "role": "superadmin", ... } }` — no `password_hash` field.

- [ ] **Step 1: Health and setup status**

```bash
curl -s http://localhost:3001/api/health | python3 -m json.tool
curl -s http://localhost:3001/api/auth/setup-status | python3 -m json.tool
```

Expected:
```json
{ "status": "ok", "version": "2.0.0" }
{ "needsSetup": false }
```

- [ ] **Step 2: Auth — /me returns user without password_hash**

```bash
curl -s -b /tmp/seo.cookies http://localhost:3001/api/auth/me | python3 -m json.tool
```

Expected: `{ "user": { "sub": "...", "email": "aakash.srivastava@cars24.com", "role": "superadmin" } }`

Confirm: no `password_hash` key in response.

- [ ] **Step 3: Sites — empty after reset, CRUD works**

```bash
# List (should be empty)
curl -s -b /tmp/seo.cookies http://localhost:3001/api/sites | python3 -m json.tool

# Create
curl -s -c /tmp/seo.cookies -b /tmp/seo.cookies \
  -X POST http://localhost:3001/api/sites \
  -H 'Content-Type: application/json' \
  -d '{"label":"Test Site","url":"https://example.com"}' | python3 -m json.tool

# Capture the id from above and test GET /:id, PATCH /:id, DELETE /:id
```

Expected: list returns `{ "data": [], "total": 0 }`. Create returns 201 with site object including `id`.

- [ ] **Step 4: Reports — checks count returns 291**

```bash
curl -s -b /tmp/seo.cookies http://localhost:3001/api/reports/checks/count | python3 -m json.tool
```

Expected:
```json
{ "total": 291, "seeded": true }
```

- [ ] **Step 5: Crawls — list returns empty**

```bash
curl -s -b /tmp/seo.cookies http://localhost:3001/api/crawls | python3 -m json.tool
```

Expected: `{ "jobs": [], "total": 0 }`

- [ ] **Step 6: Companies — superadmin can list**

```bash
curl -s -b /tmp/seo.cookies http://localhost:3001/api/companies | python3 -m json.tool
```

Expected: `{ "companies": [{ "name": "Cars24", ... }] }`

- [ ] **Step 7: Errors endpoint — POST public, GET admin-only**

```bash
# POST without cookie (should succeed 204)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/errors \
  -H 'Content-Type: application/json' \
  -d '{"message":"test","level":"error","source":"frontend"}'

# GET without cookie (should return 401)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/errors
```

Expected: `204` then `401`.

- [ ] **Step 8: Fix any broken endpoints found**

If any endpoint returns an unexpected status or malformed response:
- Read the relevant route file
- Identify the bug
- Fix it
- Re-run the curl to confirm it passes

- [ ] **Step 9: Commit any fixes**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/
git commit -m "fix: feature audit — backend endpoint corrections"
```

(Skip commit if no changes were needed.)

---

## Task 6: Feature Completeness — Frontend

**Files:**
- Fix inline in any JSX file if a page crashes

- [ ] **Step 1: Build the frontend**

```bash
cd /Users/a39326/Documents/Aakash/frontend && npm run build 2>&1
```

Expected: build succeeds with no errors. Warnings about bundle size are acceptable.

- [ ] **Step 2: Navigate to each non-stub page and verify it loads**

With the dev server running (`http://localhost:5173`), visit each page and confirm no blank screen or unhandled JS error in the browser console:

```
/login                → Login form renders
/sites                → Empty state ("No sites yet") renders
/sites/new            → Wizard step 1 renders
/crawl                → Config panel with tabs renders
/crawl/status         → Empty state renders
/audit                → 19-category accordion with 0 counts renders, health score shows 0 or null
/ads                  → Connection cards render (Google, Meta, LinkedIn)
/companies            → Cars24 row renders
/audit-log            → Empty table renders
```

- [ ] **Step 3: Fix any page that throws a JS error or renders blank**

For each broken page:
- Open browser dev tools → Console
- Read the error
- Identify the component throwing
- Fix the specific crash (null check, missing API field, etc.)
- Reload to confirm fixed

- [ ] **Step 4: Test the site creation flow end-to-end**

1. Navigate to `/sites/new`
2. Complete the wizard (label + URL minimum)
3. Submit
4. Confirm redirect to `/sites` with the new site listed

- [ ] **Step 5: Commit any fixes**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/
git commit -m "fix: feature audit — frontend page crash corrections"
```

(Skip commit if no changes were needed.)

---

## Task 7: Code Quality — Cleanup

**Files:**
- Modify: `backend/routes/auth.js` (TODO comment)
- Scan: all `backend/routes/*.js`, `backend/services/*.js`, `frontend/src/pages/*.jsx`

- [ ] **Step 1: Scan for debug console.log statements in production code paths**

```bash
grep -rn "console\.log" \
  /Users/a39326/Documents/Aakash/backend/routes/ \
  /Users/a39326/Documents/Aakash/backend/services/ \
  /Users/a39326/Documents/Aakash/frontend/src/
```

Remove any `console.log` that is clearly a debug statement (e.g., logging request params, intermediate values). Keep `console.error`, `console.warn`, and structured `[service-name]` logs in services.

- [ ] **Step 2: Scan for TODO/FIXME comments**

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" \
  /Users/a39326/Documents/Aakash/backend/routes/ \
  /Users/a39326/Documents/Aakash/backend/services/ \
  /Users/a39326/Documents/Aakash/frontend/src/
```

For each result:
- If it's a real future feature (e.g., SMTP in auth.js:212): convert to a proper comment without the TODO prefix: `// Email delivery via SMTP is implemented in Phase 5 when SMTP settings are configured.`
- If it's dead or abandoned: delete it

- [ ] **Step 3: Scan for unused imports**

```bash
# Check for imports in backend routes that are never referenced
grep -n "^import" /Users/a39326/Documents/Aakash/backend/routes/auth.js
grep -n "^import" /Users/a39326/Documents/Aakash/backend/routes/crawls.js
grep -n "^import" /Users/a39326/Documents/Aakash/backend/services/audit-parser.service.js
```

Remove any imported symbol that is never used in the file.

- [ ] **Step 4: Verify API error response format consistency**

```bash
grep -rn "res\.status.*\.json" /Users/a39326/Documents/Aakash/backend/routes/ | grep -v "error:"
```

Every error response must use `{ error: '...' }` — never `{ message: '...' }` alone. Fix any inconsistencies found.

- [ ] **Step 5: Run tests**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test 2>&1 | tail -10
```

Expected: 53 passed.

- [ ] **Step 6: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/ frontend/src/
git commit -m "chore: code quality — remove debug logs, clean TODO comments, fix response format"
```

---

## Task 8: Performance — Missing Indexes (Migration 011)

**Files:**
- Create: `backend/db/migrations/011_performance_indexes.js`
- Modify: `backend/db/sqlite.js`

**Context:** Three high-traffic tables lack `company_id` indexes. Every company-scoped list query (`GET /api/sites`, `GET /api/crawls`) does a full table scan on these tables. At 131K+ audit_results rows historically, this matters.

- [ ] **Step 1: Confirm missing indexes**

```bash
cd /Users/a39326/Documents/Aakash/backend && node --input-type=module -e "
import db from './db/sqlite.js';
for (const t of ['sites','crawl_jobs','audit_results']) {
  const idxs = db.prepare('PRAGMA index_list(' + t + ')').all().map(i => i.name);
  console.log(t + ':', idxs.join(', ') || 'NO INDEXES');
}
"
```

Expected to see NO `company_id` index on `sites` or `crawl_jobs`. Confirm before creating.

- [ ] **Step 2: Create migration 011**

Create `backend/db/migrations/011_performance_indexes.js`:

```js
/**
 * Migration 011 — Performance indexes
 *
 * Adds company_id indexes on sites, crawl_jobs, and audit_results.
 * These tables are always queried with a company_id WHERE clause.
 * Without indexes, every list query does a full table scan.
 */

export function up(db) {
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_sites_company_id ON sites(company_id)'
  ).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_crawl_jobs_company_id ON crawl_jobs(company_id)'
  ).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_audit_results_company_id ON audit_results(company_id)'
  ).run();
}
```

- [ ] **Step 3: Register migration 011 in sqlite.js**

In `backend/db/sqlite.js`, add the import after migration010's import:

```js
import { up as migration011 } from './migrations/011_performance_indexes.js';
```

Add to the MIGRATIONS array after `{ id: 10, ... }`:

```js
{ id: 11, fn: migration011, name: '011_performance_indexes' },
```

- [ ] **Step 4: Verify migration runs**

```bash
cd /Users/a39326/Documents/Aakash/backend && node --input-type=module -e "
import db from './db/sqlite.js';
for (const t of ['sites','crawl_jobs','audit_results']) {
  const idxs = db.prepare('PRAGMA index_list(' + t + ')').all().map(i => i.name);
  const hasCompanyIdx = idxs.some(n => n.includes('company'));
  console.log((hasCompanyIdx ? '✓' : '✗') + ' ' + t + ': company_id indexed');
}
"
```

Expected:
```
✓ sites: company_id indexed
✓ crawl_jobs: company_id indexed
✓ audit_results: company_id indexed
```

- [ ] **Step 5: Verify the reports summary query uses indexes (EXPLAIN)**

```bash
cd /Users/a39326/Documents/Aakash/backend && node --input-type=module -e "
import db from './db/sqlite.js';
const plan = db.prepare(\`
  EXPLAIN QUERY PLAN
  SELECT section, severity, COUNT(*) AS count
  FROM audit_results
  WHERE crawl_job_id = 'fake-job-id'
  GROUP BY section, severity
\`).all();
plan.forEach(r => console.log(r.detail));
"
```

Expected output must contain `USING INDEX` — not `SCAN TABLE`.

- [ ] **Step 6: Run full tests**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test 2>&1 | tail -10
```

Expected: 53 passed (or more if migration 011 triggers any seed re-check).

- [ ] **Step 7: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/db/migrations/011_performance_indexes.js backend/db/sqlite.js
git commit -m "perf: add company_id indexes on sites, crawl_jobs, audit_results"
```

---

## Task 9: Performance — Frontend Bundle Size

**Files:**
- Modify: `frontend/src/pages/AdsDashboard.jsx` and/or `frontend/src/App.jsx` if bundle is over 500 KB

- [ ] **Step 1: Build and measure**

```bash
cd /Users/a39326/Documents/Aakash/frontend && npm run build 2>&1 | grep -E "dist|kB|MB"
```

Look at the output for chunks over 500 KB. Example output to look for:
```
dist/assets/index-xxx.js    342.50 kB │ gzip:  98.23 kB
```

If the main bundle is under 500 KB gzip: no action needed. Proceed to Step 4.

- [ ] **Step 2: If over 500 KB gzip — add lazy loading for large pages**

If bundle is over 500 KB, open `frontend/src/App.jsx` (or wherever routes are defined). For the two largest pages (AdsDashboard and Companies), change static imports to lazy imports:

Find:
```js
import AdsDashboard from './pages/AdsDashboard.jsx';
import Companies    from './pages/Companies.jsx';
```

Replace with:
```js
import { lazy, Suspense } from 'react';
const AdsDashboard = lazy(() => import('./pages/AdsDashboard.jsx'));
const Companies    = lazy(() => import('./pages/Companies.jsx'));
```

Then wrap the route elements that use these in a `Suspense`:
```jsx
<Route path="/ads"       element={<Suspense fallback={<div>Loading...</div>}><AdsDashboard /></Suspense>} />
<Route path="/companies" element={<Suspense fallback={<div>Loading...</div>}><Companies /></Suspense>} />
```

- [ ] **Step 3: Rebuild and confirm bundle reduced**

```bash
cd /Users/a39326/Documents/Aakash/frontend && npm run build 2>&1 | grep -E "dist|kB|MB"
```

Main chunk should now be smaller. The split chunks for AdsDashboard and Companies will appear separately — confirm they load on demand when navigating to those pages.

- [ ] **Step 4: Confirm dev server still works**

```bash
cd /Users/a39326/Documents/Aakash/frontend && npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```

Expected: `200`

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/
git commit -m "perf: lazy-load large pages to reduce main bundle size"
```

(Skip commit if bundle was already under 500 KB.)

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| Data reset — 6 tables cleared, admin@c24.com deleted, superadmin kept | Task 1 |
| Security — auth guards on every route | Task 3 |
| Security — input validation completeness | Task 3 (verified via grep) |
| Security — rate limiting | Task 3 (verified via grep) |
| Security — cookie security | Task 4 |
| Security — SQL injection | Task 2 (PATCH whitelist) + Task 4 (grep verification) |
| Security — sensitive data in responses | Task 4 |
| Security — error response sanitization | Task 4 |
| Security — CORS | Task 3 (verified in auth.js) |
| Feature — all backend endpoints | Task 5 |
| Feature — all frontend pages | Task 6 |
| Code quality — large file review | Notes: AdsDashboard/CrawlConfigPanel reviewed in Task 6 and 9; no split required unless clear dual responsibility |
| Code quality — dead code and console.log | Task 7 |
| Code quality — API response consistency | Task 7 |
| Performance — company_id indexes | Task 8 |
| Performance — N+1 and query plans | Task 8 (EXPLAIN QUERY PLAN) |
| Performance — frontend bundle | Task 9 |
| Performance — socket URL buffer | Not a task — already cleaned up in `finally` block via `setTimeout(() => urlBuffers.delete(jobId), 60_000)` in crawl-runner.js:243 |

### Notes for Implementer

1. **Password for curl tests (Task 5):** Replace `YOUR_PASSWORD` with your actual superadmin password. The password is whatever you set when you first registered `aakash.srivastava@cars24.com`. It is NOT stored anywhere in the codebase.

2. **Socket URL buffer:** The spec flagged this as a potential leak, but the code already handles it — `urlBuffers.delete(jobId)` is called in the `finally` block after a 60-second delay. No code change needed.

3. **CrawlConfigPanel (687 lines) and AdsDashboard (797 lines):** These are large files reviewed in the spec. During Task 6 (frontend audit), read the component structure. Only split if there are clearly independent sub-concerns. Do not split just because the file is large.

4. **TODO comment in auth.js:212:** The SMTP comment is a legitimate future roadmap item. Convert to a plain comment in Task 7 — do not delete the logic.

5. **Commit order matters:** Each task produces working software. Do not skip tasks or batch commits across tasks.
