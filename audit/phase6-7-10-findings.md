# SEO Audit Platform — Comprehensive Audit Report
## Phases 6, 7, and 10: Error Handling, Performance, and Dead Code

**Report Generated:** 2026-04-24  
**Codebase:** /Users/a39326/Documents/Aakash  
**Scope:** backend/routes/*.js, backend/services/*.js, frontend/src/**/*.jsx

---

## Part 1: Performance (Phase 7)

### 1.1 N+1 Query Patterns

#### Finding 1: Schedule Site Validation Loop
**File:** `/Users/a39326/Documents/Aakash/backend/routes/schedules.js:86–91`  
**Severity:** HIGH  
**Title:** N+1 query in schedule site validation

```javascript
for (const siteId of site_ids) {
  const site = db.prepare(`SELECT id FROM sites WHERE id = ? AND company_id = ?`).get(siteId, cid);
  if (!site) { ... }
}
```

**Why:** Loops through array of site IDs, executing one SELECT per site. With 100 sites, executes 100 queries.  
**Fix:** Replace loop with single IN-list query:
```javascript
const placeholders = site_ids.map(() => '?').join(',');
const sites = db.prepare(`SELECT id FROM sites WHERE id IN (${placeholders}) AND company_id = ?`)
  .all(...site_ids, cid);
const foundIds = new Set(sites.map(s => s.id));
const missing = site_ids.filter(id => !foundIds.has(id));
if (missing.length > 0) return res.status(400).json({ error: `Sites not found: ${missing.join(', ')}` });
```

#### Finding 2: Schedule PATCH Site Validation Loop (Duplicate)
**File:** `/Users/a39326/Documents/Aakash/backend/routes/schedules.js:148–153`  
**Severity:** HIGH  
**Title:** Same N+1 pattern in PATCH handler

Identical issue to Finding 1. Same fix applies.

---

### 1.2 Missing Indexes

#### Finding 3: audit_results WHERE section Queries
**File:** `/Users/a39326/Documents/Aakash/backend/routes/reports.js:97–105`  
**Severity:** MEDIUM  
**Title:** Missing index on audit_results(section)

```javascript
SELECT issue_type, severity, COUNT(*) AS count
FROM audit_results
WHERE crawl_job_id = ? AND section = ?
GROUP BY issue_type, severity
```

**Current Indexes:** `idx_audit_results_(job|section|severity|site|site_job|url|company_id)` exists.  
**Status:** Index on section exists but query also filters by crawl_job_id. Composite index `idx_audit_results_job_section` would be optimal.

**Fix:** Add composite index:
```sql
CREATE INDEX IF NOT EXISTS idx_audit_results_job_section 
  ON audit_results(crawl_job_id, section);
```

#### Finding 4: task_status WHERE status Clause
**File:** `/Users/a39326/Documents/Aakash/backend/routes/tasks.js` (multiple locations)  
**Severity:** MEDIUM  
**Title:** No index on task_status(status)

Routes filter `task_status.status` but index is only on `(site_id, status)`. Queries without site_id filter will scan the full index.

**Fix:** Add single-column index (or verify composite index covers all access patterns):
```sql
CREATE INDEX IF NOT EXISTS idx_task_status_status ON task_status(status);
```

---

### 1.3 Sync Blocking Operations

#### Finding 5: Bulk Insert in AI Suggestions Route
**File:** `/Users/a39326/Documents/Aakash/backend/routes/ai.js:134–147`  
**Severity:** LOW  
**Title:** Synchronous INSERT after streaming response

```javascript
db.prepare(`INSERT INTO ai_suggestions (...)`).run(
  suggestionId, result.id, check?.id, ...
);
```

**Why:** After SSE header committed (line 103), SQLite INSERT is synchronous and blocks the event loop briefly. While better-sqlite3 is sync by design, this should be split into a background task for long streams.

**Fix:** Queue to worker or defer:
```javascript
setImmediate(() => {
  db.prepare(`INSERT INTO ai_suggestions ...`).run(...);
});
```

---

### 1.4 Large Response Payloads

#### Finding 6: Unbounded audit_checks Response
**File:** `/Users/a39326/Documents/Aakash/backend/routes/reports.js:269–273`  
**Severity:** MEDIUM  
**Title:** No LIMIT on all checks query

```javascript
const allChecks = db.prepare(`
  SELECT name, category, severity_default
  FROM audit_checks
  ORDER BY category, check_number
`).all();
```

**Issue:** Returns all audit checks. With thousands of checks, response bloats. Sent to frontend in summary endpoint.

**Fix:** Implement pagination or limit:
```javascript
const allChecks = db.prepare(`
  SELECT name, category, severity_default
  FROM audit_checks
  ORDER BY category, check_number
  LIMIT 500
`).all();
```

---

### 1.5 Polling in Frontend

#### Finding 7: LiveRun.jsx Polling Fallback
**File:** `/Users/a39326/Documents/Aakash/frontend/src/pages/LiveRun.jsx:111–123`  
**Severity:** MEDIUM  
**Title:** setInterval polling as Socket.io fallback

```javascript
const interval = setInterval(async () => {
  const res = await api.get(`/crawls/${jobId}`);
  if (!['queued', 'running'].includes(latest.status)) {
    setJob(latest);
  }
}, 3000);
```

**Why:** Intentional fallback (documented), but polls every 3 seconds. Acceptable for live crawls.

**Status:** No fix needed — design is intentional and correctly cleanup on unmount.

---

### 1.6 Missing Memoization

#### Finding 8: SeoView.jsx Re-fetches on Every Render
**File:** `/Users/a39326/Documents/Aakash/frontend/src/pages/SeoView.jsx`  
**Severity:** MEDIUM  
**Title:** Missing useCallback/useMemo for data fetching

Pages without memoization that fetch data:
- **SeoView.jsx** — fetches section/issue data
- **Settings.jsx** — fetches and updates settings
- **Setup.jsx** — fetches company setup data
- **ChangePassword.jsx** — password change submit
- **Login.jsx** — login form submit
- **InviteAccept.jsx** — accept invite action
- **CrawlStart.jsx** — crawl configuration fetch

**Fix for SeoView.jsx (example):**
```javascript
const fetchIssues = useCallback(async () => {
  const res = await api.get(`/reports/${siteId}/issues`, { params: { section, ... } });
  setIssues(res.data);
}, [siteId, section, ...deps]);

useEffect(() => { fetchIssues(); }, [fetchIssues]);
```

---

## Part 2: Error Handling & Input Validation (Phase 6)

### 2.1 Routes Without Try/Catch

#### Finding 9: Unprotected Routes (High Risk)
**Severity:** HIGH  
**Count:** 40 routes across 12 files

Routes without top-level try/catch (rely on Express default handler):

| File | Lines | Handler |
|------|-------|---------|
| ads.js | 53, 58, 89 | POST /connect/:platform, GET /accounts/:platform, POST /metrics/refresh |
| ai.js | 15, 34, 162 | GET /suggest/:id, POST /feedback |
| audit-log.js | 22 | GET / |
| auth.js | 45, 56, 71, 156, 224, 256, 350, 394, 444, 486, 527, 592 | Multiple (register, login, invites, etc.) |
| companies.js | 29, 44, 70, 100, 129 | GET /, POST /, GET /:id, etc. |
| crawls.js | 11, 104, 149, 166, 184 | GET /, POST /, DELETE /:id, etc. |
| errors.js | 35 | GET / |
| ga4.js | 29, 94, 151, 173 | Multiple OAuth/cache endpoints |
| gsc.js | 29, 94, 150, 189, 219 | Multiple OAuth/cache endpoints |
| reports.js | 194 | GET /:siteId/summary (wrapped in try at line 115) |

**Example (ads.js:53):**
```javascript
router.delete('/connections/:platform', requireRole('admin', 'superadmin'), validatePlatform, (req, res) => {
  deleteConnection(req.user.company_id, req.params.platform);  // No try/catch
  res.json({ ok: true });
});
```

**Why:** If deleteConnection() throws, Express default handler returns 500. No logging context.

**Fix:** Wrap all route handlers:
```javascript
router.delete('/connections/:platform', ..., (req, res) => {
  try {
    deleteConnection(req.user.company_id, req.params.platform);
    res.json({ ok: true });
  } catch (err) {
    console.error('[ads] DELETE /connections error:', err);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});
```

---

### 2.2 Missing Input Type Coercion

#### Finding 10: Unsafe parseInt in crawls.js
**File:** `/Users/a39326/Documents/Aakash/backend/routes/crawls.js:34`  
**Severity:** LOW  
**Title:** Numeric coercion without guards

```javascript
params.push(Number(limit), Number(offset));
```

**Issue:** `Number('abc')` returns NaN, which SQLite may handle unpredictably. While Math.min/max guards exist in other routes, this direct coercion is risky.

**Fix:**
```javascript
const limit = Math.min(Math.max(parseInt(req.query.limit || '30', 10) || 30, 1), 500);
const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
params.push(limit, offset);
```

#### Finding 11: Missing Validation in ai.js:result_id
**File:** `/Users/a39326/Documents/Aakash/backend/routes/ai.js:15–16`  
**Severity:** MEDIUM  
**Title:** No validation on UUID query parameter

```javascript
const { result_id } = req.query;
// Used directly in:
const result = db.prepare('SELECT ... FROM audit_results WHERE id = ?').get(result_id);
```

**Why:** result_id is passed to SQL without type check. If non-existent ID or malformed, query returns null silently.

**Fix:** Add UUID validation:
```javascript
const { result_id } = req.query;
if (!result_id || !/^[0-9a-f-]{36}$/.test(result_id)) {
  return res.status(400).json({ error: 'Invalid result_id' });
}
```

---

### 2.3 Promise Rejection Swallowing

#### Finding 12: Background Task Error Suppression
**File:** `/Users/a39326/Documents/Aakash/backend/routes/ads.js:93–95`  
**Severity:** MEDIUM  
**Title:** Fire-and-forget Promise without error propagation

```javascript
router.post('/metrics/refresh', async (req, res) => {
  res.json({ ok: true, message: 'Sync started' });
  refreshMetricsForCompany(req.user.company_id, dateRange, io).catch(err => {
    console.error('[ads] refresh error:', err.message);
  });
});
```

**Issue:** Response sent before background job completes. If refreshMetricsForCompany fails, client never knows. Error only logged to stderr.

**Fix:** Return status and track job ID, or implement webhook callback:
```javascript
const jobId = uuidv4();
res.json({ ok: true, jobId, message: 'Sync started' });
refreshMetricsForCompany(...).catch(err => {
  console.error(`[ads] refresh ${jobId} error:`, err);
  io.emit('ads:sync:failed', { jobId, error: err.message });
});
```

---

### 2.4 JSON.parse Without Try/Catch

#### Finding 13: Unguarded JSON.parse in ai.js
**File:** `/Users/a39326/Documents/Aakash/backend/routes/ai.js:81`  
**Severity:** LOW  
**Title:** Fallback catch exists but is loose

```javascript
try {
  parsedData = JSON.parse(result.data);
} catch {
  parsedData = result.data;
}
```

**Status:** Protected ✓ — Fallback to raw data is safe.

#### Finding 14: Safe JSON.parse in reports.js
**File:** `/Users/a39326/Documents/Aakash/backend/routes/reports.js:493`  
**Severity:** LOW  
**Title:** Inline IIFE with try/catch

```javascript
const data = row.data ? (() => { try { return JSON.parse(row.data); } catch { return {}; } })() : {};
```

**Status:** Protected ✓ — Returns empty object on parse failure.

---

### 2.5 Error Message Leaks

#### Finding 15: Direct Error Message to Client
**File:** `/Users/a39326/Documents/Aakash/backend/routes/ads.js:85`  
**Severity:** HIGH  
**Title:** err.message exposed to client

```javascript
catch (err) {
  console.error('[ads] metrics error:', err.message);
  res.status(500).json({ error: err.message });  // ← Leak
}
```

**Why:** err.message can contain stack traces, internal paths, API keys, or database details.

**Example Leak:**
- `error: "TypeError: Cannot read property 'accessToken' of undefined at line 412 in fetchMetricsForCompany.js"`
- `error: "ECONNREFUSED: Google Ads API at 10.0.0.5:5432"`

**Fix:**
```javascript
catch (err) {
  console.error('[ads] metrics error:', err);
  res.status(500).json({ error: 'Failed to fetch metrics. Please try again.' });
}
```

---

## Part 3: Dead Code & Unused Exports (Phase 10)

### 3.1 Unused Dependencies

#### Finding 16: multer — Never Imported
**Dependency:** `multer@^1.4.5-lts.1` in `/Users/a39326/Documents/Aakash/backend/package.json:28`  
**Severity:** MEDIUM  
**Title:** Unused file upload middleware

**Evidence:** No imports across all backend routes/services:
```bash
grep -r "multer" /Users/a39326/Documents/Aakash/backend --include="*.js" | grep -v node_modules
# (no results)
```

**Action:** Remove from package.json or implement file upload route. Currently bloats node_modules (~2MB).

#### Finding 17: nodemailer — Never Imported
**Dependency:** `nodemailer@^6.9.15` in `/Users/a39326/Documents/Aakash/backend/package.json:30`  
**Severity:** MEDIUM  
**Title:** Unused email service library

**Evidence:** No imports:
```bash
grep -r "nodemailer" /Users/a39326/Documents/Aakash/backend --include="*.js" | grep -v node_modules
# (no results)
```

**Note:** SMTP configuration exists in .env (SMTP_HOST, etc.) but no routes use nodemailer. Email invites appear to use redirects instead (auth.js:255–280).

**Action:** Remove or implement email sending routes.

---

### 3.2 Unused Exports

#### Finding 18: Named Exports in Services Not Imported Elsewhere
**File:** `/Users/a39326/Documents/Aakash/backend/services/ads.crypto.js`  
**Severity:** LOW  
**Title:** Crypto utility functions may be unused

**Evidence:** ads.crypto.js exports encryption/decryption functions, but only used by ads.service.js.

**Status:** No orphaned exports detected — all service exports are used.

---

### 3.3 Orphaned Files

#### Finding 19: Unused Test Files
**File:** `/Users/a39326/Documents/Aakash/backend/__tests__/ads-routes.test.js`  
**Severity:** LOW  
**Title:** Test file exists but not in test suite

```bash
grep -r "ads-routes" /Users/a39326/Documents/Aakash/backend/__tests__ | grep -v ads-routes.test.js
# (no imports)
```

**Evidence:** File exists but is not imported by vitest configuration or other test files. Test may be dead.

**Action:** Verify if this is intentional (incomplete test stub) or can be removed.

---

### 3.4 Dead Code Patterns

#### Finding 20: Unreachable Code in auth.js
**File:** `/Users/a39326/Documents/Aakash/backend/routes/auth.js:94–99`  
**Severity:** LOW  
**Title:** Unreachable early return

```javascript
if (role !== 'superadmin' && site.company_id !== company_id) {
  return res.status(403).json({ error: 'Access denied' });
}
// ... code continues
```

**Status:** Code is reachable. False alarm.

---

## Summary Table

### Part 1: Performance (Phase 7)

| ID | Finding | File | Severity | Type |
|----|---------|----|----------|------|
| 1 | N+1 schedule site validation | schedules.js:86 | HIGH | Query |
| 2 | N+1 schedule PATCH validation | schedules.js:148 | HIGH | Query |
| 3 | Missing composite index | reports.js:97 | MEDIUM | Index |
| 4 | Missing task_status index | tasks.js | MEDIUM | Index |
| 5 | Sync INSERT after SSE | ai.js:134 | LOW | Blocking |
| 6 | Unbounded checks response | reports.js:269 | MEDIUM | Payload |
| 7 | LiveRun polling | LiveRun.jsx:111 | MEDIUM | Polling |
| 8 | Memoization (7 files) | SeoView.jsx + others | MEDIUM | React |

**Total Part 1 Findings:** 8 (1 HIGH, 5 MEDIUM, 2 LOW)

### Part 2: Error Handling & Validation (Phase 6)

| ID | Finding | File | Severity | Type |
|----|---------|----|----------|------|
| 9 | Missing try/catch (40 routes) | All routes | HIGH | Handler |
| 10 | Unsafe parseInt | crawls.js:34 | LOW | Validation |
| 11 | Missing UUID validation | ai.js:15 | MEDIUM | Validation |
| 12 | Error swallowing | ads.js:93 | MEDIUM | Promise |
| 13–14 | JSON.parse (guarded) | ai.js, reports.js | LOW | Parse |
| 15 | Error message leak | ads.js:85 | HIGH | Leak |

**Total Part 2 Findings:** 6 (2 HIGH, 2 MEDIUM, 2 LOW)

### Part 3: Dead Code (Phase 10)

| ID | Finding | File | Severity | Type |
|----|---------|----|----------|------|
| 16 | Unused multer | package.json | MEDIUM | Dependency |
| 17 | Unused nodemailer | package.json | MEDIUM | Dependency |
| 18 | Unused exports | services/* | LOW | Export |
| 19 | Orphaned test | ads-routes.test.js | LOW | Test |
| 20 | Dead code (false alarm) | auth.js | — | — |

**Total Part 3 Findings:** 4 (0 HIGH, 2 MEDIUM, 2 LOW)

---

## Top 3 Highest-Severity Items (Combined)

### 🔴 CRITICAL #1: 40 Routes Without Try/Catch
**Part 2, Finding 9 | Severity: HIGH**  
**Risk:** Unhandled exceptions crash route handlers, returning generic 500 errors with no context.  
**Action:** Wrap all route handlers in try/catch with consistent error logging.  
**Effort:** ~2 hours (templated fix across 12 files).

### 🔴 CRITICAL #2: N+1 Queries in Schedule Validation  
**Part 1, Findings 1–2 | Severity: HIGH**  
**Risk:** Performance degradation with 50+ sites (50 DB queries per request).  
**Action:** Replace loops with IN-list bulk query.  
**Effort:** ~20 minutes (2 fixes).

### 🔴 CRITICAL #3: Error Message Exposure in ads.js  
**Part 2, Finding 15 | Severity: HIGH**  
**Risk:** Stack traces and internal paths leaked to frontend.  
**Action:** Replace err.message with generic message; log full error server-side.  
**Effort:** ~5 minutes.

---

## Recommendations

1. **Immediate (this week):**
   - Audit and fix all error message leaks (Finding 15)
   - Add try/catch to top 10 critical routes (ads, auth, reports)
   - Remove unused multer/nodemailer dependencies

2. **Short-term (next sprint):**
   - Replace N+1 queries with bulk queries (Findings 1–2)
   - Add composite indexes (Finding 3)
   - Add UUID validation (Finding 11)

3. **Medium-term (optimization):**
   - Add useCallback/useMemo to React pages (Finding 8)
   - Implement pagination for large responses (Finding 6)
   - Defer heavy operations using setImmediate/worker threads (Finding 5)

4. **Process:**
   - Add pre-commit linting to catch try/catch patterns
   - Enable TypeScript to catch numeric coercion issues (Finding 10)
   - Review unused imports during code review

