# Phase 5 + 8 — Config & Test Coverage

Source: Explore subagent run 2026-04-24. All file:line citations verified against live repo.

---

## PART 1 — Test coverage (Phase 8)

### Coverage by test file (backend/__tests__/, 17 files)

| Test file | What it covers | Routes / functions touched | Critical paths covered? |
|---|---|---|---|
| ads-crypto.test.js | Token encrypt/decrypt | `ads.crypto.js` | ✅ Round-trip + tampering + random IV |
| ads-dates.test.js | Date ranges | `ads.service.js::getDateRange` | ✅ IST timezone + all 3 ranges |
| ads-routes.test.js | Ads OAuth guards | `/api/ads/{connections,connect/google,callback/*}` | ⚠️ Auth only, no data flow |
| ai-suggest.test.js | AI suggestion endpoints | `/api/ai/suggest`, `/suggest/:id/feedback` | ⚠️ Cache + error cases, no streaming |
| audit-checks-seed.test.js | Seed checks data model | `db/seed/audit-checks.js` | ✅ Schema + idempotence + all categories |
| auth-guards.test.js | Role-based access | GET `/api/sites /companies /errors /audit-log` + roles | ✅ Hierarchy + public routes |
| compare.test.js | Crawl comparison | `/api/compare/{jobs,}` | ✅ Validation + delta arithmetic |
| crawl-lifecycle.test.js | Crawl job lifecycle | GET/POST `/api/crawls` | ⚠️ Validation only, no actual crawl |
| dashboard.test.js | Admin dashboard | `/api/dashboard/admin` | ⚠️ Role check only |
| exports.test.js | Export routes | `/api/exports/*` | ⚠️ Auth + 404 only, no data gen |
| ga4-data.test.js | GA4 endpoints | `/api/ga4/:siteId/{summary,pages}` | ⚠️ 404 + access checks only |
| gsc-data.test.js | GSC endpoints | `/api/gsc/:siteId/{summary,queries,pages}` | ⚠️ 404 + access checks only |
| input-validation.test.js | Zod schema validation | `/auth/{login,invite/accept,change-password}`, `/errors` | ✅ Enum + length + type |
| multi-tenancy.test.js | Company isolation | `/api/sites`, `/auth/users?company_id=` | ✅ Isolation + superadmin bypass |
| reports-drill-down.test.js | Report details | `/api/reports/:siteId/{category,issues,results,developer-summary}` | ⚠️ Validation + 404 only |
| reports-export.test.js | Export data | `/api/reports/:siteId/{category,issues/export}` | ⚠️ covered:false state only |
| tasks.test.js | Task CRUD + kanban | `/api/tasks` all routes | ⚠️ 404 + validation only |

### Routes with NO corresponding test
**High-priority gaps:**
- `POST /api/auth/login` (only schema validated, not actual login)
- `POST /api/auth/setup`, `/invite`, `/users/create`, `DELETE /users/:id`, `/logout`
- Sites `POST`, `PATCH`, `DELETE`
- `/api/reports/:siteId/summary`, `/trend`
- `/api/psi/analyze`
- Schedules entire router (`/api/schedules` *)
- Notifications entire router
- Settings entire router
- AI streaming happy path
- `/api/crawls/:id/cancel`, `DELETE /api/crawls/:id`

**Medium-priority:**
- Ads `POST /disconnect`, metrics-fetch, all platform-specific token refresh
- Google OAuth token refresh paths
- Logout + forgot-password flows (if they exist)

### Services with NO corresponding test
- `crawl-runner.js` (core crawler orchestrator — zero coverage)
- `schedule.service.js` (cron + crawl trigger)
- `slack.service.js` (webhook notifications)
- `linear.service.js` (issue creation)
- `sitemap-fetcher.js` (XML parsing + URL extraction — SSRF surface, SEC-C5)
- `audit-parser.service.js` (516 LOC, core of audit pipeline)
- `sheets.service.js` (Google Sheets)
- `ads.google.js`, `ads.meta.js`, `ads.linkedin.js` (each has complex platform logic)

### Frontend test coverage
**Zero.** No `__tests__/`, no `vitest.config`, no testing-library dependency, no `npm test` script in `frontend/package.json`. All frontend logic (components, contexts, pages) has no automated verification.

### Tests sharing production DB (confirms SEC-M9)
- `compare.test.js` — writes sites + crawl_jobs to `backend/seo-automation.db`
- `exports.test.js` — inserts test site
- `reports-export.test.js` — inserts test site
- Only `audit-checks-seed.test.js` uses `:memory:` (or re-runnable seed check).

**Remaining tests use the live DB implicitly** by importing `db` from `sqlite.js`, which opens `backend/seo-automation.db`. Any test that writes rows without cleanup pollutes production data.

### Missing test categories
1. Socket.io — no tests for crawl:progress / crawl:complete / crawl:url / ads:sync:progress emission, no room-isolation test.
2. Crawl-runner end-to-end — start → emit → complete happy path.
3. Multi-tenancy cross-company write attempts (only read isolation tested).
4. errorLimiter (30/min) — exporter exists but no test.
5. AI SSE streaming error paths — partial response, upstream timeout, client abort.
6. Settings-table Anthropic-key fallback.
7. Schedule service cron triggering.
8. Slack / Linear notification delivery.

---

## PART 2 — Config vs hardcoded (Phase 5)

### Hardcoded localhost URLs (10+ occurrences)

| File:Line | Value | Severity |
|---|---|---|
| backend/server.js:71 | `'http://localhost:5173'` (FRONTEND_URL fallback) | HIGH |
| backend/server.js:84 | `'http://localhost:5173'` (Socket.io CORS) | HIGH |
| backend/routes/auth.js:210 | `'http://localhost:5173'` (invite URL) | HIGH |
| backend/routes/gsc.js:18, :43 | `'http://localhost:{3001,5173}'` | HIGH |
| backend/routes/ga4.js:18, :43 | `'http://localhost:{3001,5173}'` | HIGH |
| backend/routes/ads.js:103, 145, 189, 251, 178, 240, 286 | mix of `localhost:3001` / `localhost:5173` (7 occurrences) | HIGH |
| frontend/src/pages/AdsDashboard.jsx:561 | `socketIo('http://localhost:3001', …)` | **CRITICAL** — prod build breaks |

### Hardcoded timeouts
- `backend/services/sitemap-fetcher.js:15` — `FETCH_TIMEOUT_MS = 15000` MEDIUM
- `backend/services/crawl-runner.js:164` — `timeoutSecs: 30` MEDIUM
- `frontend/src/api/index.js:7` — axios `timeout: 30000` MEDIUM

### Hardcoded magic numbers
- Crawl defaults: `max_depth: 5`, `max_urls: 0`, `threads: 5` in [backend/routes/crawls.js:69–86](backend/routes/crawls.js#L69-L86) **and** [frontend/src/components/CrawlConfigPanel.jsx:23](frontend/src/components/CrawlConfigPanel.jsx#L23) — duplicated (drift risk) MEDIUM
- `URL_BUFFER_MAX = 500` in [backend/services/crawl-runner.js:27](backend/services/crawl-runner.js#L27) LOW
- `MAX_URLS_PER_SITEMAP = 50_000`, `MAX_DEPTH = 5` in [backend/services/sitemap-fetcher.js:14–16](backend/services/sitemap-fetcher.js#L14-L16) LOW
- Rate-limit windows/maxes in [backend/middleware/rateLimiter.js](backend/middleware/rateLimiter.js) — five separate rate limiters, none env-configurable MEDIUM

### AI model config
- [backend/routes/ai.js:113–114](backend/routes/ai.js#L113-L114) — `model: 'claude-sonnet-4-6'`, `max_tokens: 1024`
- **MEDIUM** — model and token cap should be env-overridable. PRD contradicts itself (CLAUDE.md says 1024, PRD says 1500).

### Already centralised (good examples)
- `frontend/src/lib/auditCategories.js` — 23-category taxonomy map with legacy aliases. Single source of truth.
- `frontend/src/components/CrawlConfigPanel.jsx` — `DEFAULT_CONFIG` constant. But see drift risk above.

### `backend/config/` is an empty directory
Verified in Phase 0. Nothing in it.

### Proposed `backend/config/index.js` (skeleton)

```js
// backend/config/index.js
import 'dotenv/config';

const int = (k, d) => parseInt(process.env[k] ?? String(d), 10);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int('PORT', 3001),

  urls: {
    backend:  process.env.BACKEND_URL  || 'http://localhost:3001',
    frontend: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  security: {
    jwtSecret:      process.env.JWT_SECRET,
    jwtExpiresIn:   process.env.JWT_EXPIRES_IN || '7d',
    cookieSecure:   process.env.COOKIE_SECURE === 'true',
    passwordMinLen: int('PASSWORD_MIN_LEN', 8),
  },

  rateLimits: {
    auth:   { windowMs: int('AUTH_RATE_WIN_MS',  15 * 60 * 1000), max: int('AUTH_RATE_MAX',   20) },
    api:    { windowMs: int('API_RATE_WIN_MS',       60 * 1000), max: int('API_RATE_MAX',    300) },
    errors: { windowMs: int('ERR_RATE_WIN_MS',       60 * 1000), max: int('ERR_RATE_MAX',     30) },
    ai:     { windowMs: int('AI_RATE_WIN_MS',        60 * 1000), max: int('AI_RATE_MAX',      10) },
    psi:    { windowMs: int('PSI_RATE_WIN_MS',       60 * 1000), max: int('PSI_RATE_MAX',     15) },
  },

  ai: {
    model:     process.env.ANTHROPIC_MODEL      || 'claude-sonnet-4-6',
    maxTokens: int('ANTHROPIC_MAX_TOKENS', 1024),
    apiKey:    process.env.ANTHROPIC_API_KEY   || null, // falls back to settings table
  },

  crawl: {
    maxDepth:       int('CRAWL_MAX_DEPTH',        5),
    maxUrls:        int('CRAWL_MAX_URLS',         0),
    threads:        int('CRAWL_THREADS',          5),
    pageTimeoutSec: int('CRAWL_PAGE_TIMEOUT',    30),
    urlBufferSize:  int('CRAWL_URL_BUF',         500),
  },

  sitemap: {
    maxUrls:     int('SITEMAP_MAX_URLS',  50_000),
    maxDepth:    int('SITEMAP_MAX_DEPTH',      5),
    fetchTimeoutMs: int('SITEMAP_FETCH_TIMEOUT_MS', 15_000),
  },

  integrations: {
    google:   { clientId: process.env.GOOGLE_CLIENT_ID,   clientSecret: process.env.GOOGLE_CLIENT_SECRET },
    meta:     { appId:    process.env.META_APP_ID,        appSecret:    process.env.META_APP_SECRET },
    linkedin: { clientId: process.env.LINKEDIN_CLIENT_ID, clientSecret: process.env.LINKEDIN_CLIENT_SECRET },
    psi:      { apiKey:   process.env.PSI_API_KEY }, // also in settings table
    slack:    { webhookUrl: process.env.SLACK_WEBHOOK_URL }, // also in company_settings
  },

  features: {
    ai:      process.env.FEATURE_AI      !== 'false',
    sheets:  process.env.FEATURE_SHEETS  !== 'false',
    slack:   process.env.FEATURE_SLACK   !== 'false',
    linear:  process.env.FEATURE_LINEAR  !== 'false',
  },
};

export default config;
```

### Top 5 config issues to fix
1. `http://localhost:3001` hardcoded in [frontend/src/pages/AdsDashboard.jsx:561](frontend/src/pages/AdsDashboard.jsx#L561) — breaks every deploy; must use `import.meta.env.VITE_SOCKET_URL`. CRITICAL.
2. No `import.meta.env` usage anywhere in frontend — the frontend has no env system at all. Add `VITE_API_BASE`, `VITE_SOCKET_URL`. HIGH.
3. AI model + token budget hardcoded in `routes/ai.js:113–114` — centralize. MEDIUM.
4. Rate-limit values hardcoded in `middleware/rateLimiter.js` — centralize. MEDIUM.
5. Crawl defaults duplicated between backend Zod schema and frontend `DEFAULT_CONFIG` — derive one from the other. MEDIUM.
