# Phase 0 — Inventory (evidence-only, no findings)

Generated: 2026-04-24
Excluded: `.worktrees/`, `backend/public/assets/`, `node_modules/`, `crawl-data/`, `crawl-configs/`, build artifacts.

## Codebase size
| Subtree | Files | LOC |
|---|---|---|
| backend (.js) | — | 13,275 |
| frontend/src (.js/.jsx) | — | 15,179 |
| playwright-crawler (.js) | — | 3,478 |
| ads-dashboard (.ts/.tsx) | — | 1,414 |
| **Total in scope** | ~160 source files | **~33,000 LOC** |

Full LOC inventory: `audit/file-inventory.txt`

## Dependencies
| Package | Backend | Frontend | Crawler | Ads-Dashboard |
|---|---|---|---|---|
| Node framework | express 4.21.2 | — | — | — |
| UI | — | react 18.3.1 + react-router 7 + recharts + sonner + lucide-react | — | react 18.3.1 (no router) |
| Styling | — | tailwind 4.1.4 (@tailwindcss/vite) | — | tailwind 4.1.3 |
| HTTP | — | axios 1.7.9 | — | — |
| Sockets | socket.io 4.8.1 | socket.io-client 4.8.1 | — | — |
| Auth | bcryptjs 2.4.3 + jsonwebtoken 9.0.2 + cookie-parser | — | — | — |
| DB | better-sqlite3 11.6.0 | — | — | — |
| Security | helmet 8, express-rate-limit 7, cors 2.8.5, zod 3.23.8 | — | — | — |
| AI SDK | @anthropic-ai/sdk 0.89.0 | — | — | — |
| Google | googleapis 171.4.0, google-ads-api 23 | — | — | — |
| Email | nodemailer 6.9.15 (installed, no usage found) | — | — | — |
| Cron | node-cron 4.2.1 | — | — | — |
| File upload | multer 1.4.5-lts.1 | — | — | — |
| UUID | uuid 11.0.3 | — | — | — |
| Crawler | — | — | crawlee 3.13 + playwright 1.52 + cheerio 1.0 + robots-parser 3 + p-limit 6.2 | — |
| Test | vitest 2.1.8 + supertest 7 | — | jest 29.7 (different runner) | — |

## DB schema (30 tables, 17 applied migrations)
Migrations: 001–018 (017 skipped, intentional gap).

Tables: users, sites, crawl_jobs, audit_results, audit_checks, gsc_cache, ga4_cache, gsc_queries, gsc_daily, schedules, settings, invites, projects, linear_tickets, ai_suggestions, ai_suggestion_feedback, task_status, task_comments, notifications, error_log, companies, audit_log, ad_oauth_state, ad_connections, ad_accounts, ad_snapshots, company_settings, company_oauth_tokens, _migrations, sqlite_sequence.

Row counts (current DB):
- users: 2 | sites: 1 | companies: 1 | crawl_jobs: 27 | audit_results: 6,035 | audit_checks: 291 | task_status: 2 | invites: 2 | ai_suggestions: 0 | settings: 0 | notifications: 0 | schedules: 0

## Backend entry — server.js (197 LOC)
- Global middleware order: helmet → cors → express.json(10mb) → urlencoded(10mb) → cookieParser → socket.io → **authMiddleware (global)** → apiLimiter (300/min on `/api`) → routes → 501 catch-all → static SPA fallback (if `backend/public` exists) → global 500 error handler.
- 19 route mounts under `/api/*`.
- Socket.io: rooms `job:<id>` and `company:<id>`; URL event buffer replay on join.
- Startup: validateEnv → resetStuckJobs → seedAuditChecks → initScheduler → listen.
- No graceful shutdown handler.

## Backend routes & services
- 19 route files, ~3,962 LOC. Heaviest: `auth.js` (629), `reports.js` (519), `tasks.js` (347), `ads.js` (312), `gsc.js` (301).
- 13 service files. Heaviest: `audit-parser.service.js` (516), `crawl-runner.js` (272), `schedule.service.js` (211).
- 3 middleware files: `auth.js` (JWT + role guards), `rateLimiter.js` (5 limiters), `validate.js` (Zod factory).
- **`backend/config/` exists but is empty** — no centralized config module.
- 17 tests in `backend/__tests__/` — all hit real SQLite DB (no per-test isolation).

## Frontend structure
- 3 contexts: AuthContext (76), SitesContext (94), ToastContext (31).
- 1 centralized API client: `api/index.js` (42 LOC) — axios + 401 interceptor + 5xx error-reporting.
- 1 taxonomy lib: `lib/auditCategories.js` (146).
- 16 components (~1,911 LOC). Heaviest: CrawlConfigPanel (687), Header (393), Sidebar (215).
- 39 pages (~12,649 LOC). Heaviest: IssueDetail (893), AdsDashboard (798), ScheduledCrawls (704).
- 2 streaming-endpoint exceptions that bypass axios client (by necessity): IssueDetail.jsx uses `fetch()` for SSE; LiveRun.jsx uses `EventSource`.

## playwright-crawler
- Entry: `src/index.js` (71) → `src/crawler.js` (436) with dual-mode (Cheerio + Playwright) via `isJsShell()` heuristic.
- 9 extractors: canonical (178), content (237), headings (159), images (124), links (92), meta (247), resources (324), response (168), schema (252).
- Output: `src/output/sf-format.js` (316) produces 12 SF-compatible datasets.
- Robots parser: `src/parsers/robots-txt.js` (215) — tests 13 bots including GPTBot, ClaudeBot, PerplexityBot.
- 1 test file: `tests/parity.test.js` (363) — uses jest, not vitest.
- Only env var: `LOG_LEVEL` (utils/logger.js:8).
- Hardcoded User-Agent: `'Mozilla/5.0 (compatible; SEOAuditBot/1.0; +https://seo-audit-platform)'` (crawler.js:205) and `'SEOAuditBot/1.0'` (robots-txt.js:51).

## ads-dashboard
- Standalone Vite + React + TS SPA; **not integrated** into main platform.
- 1,414 LOC total. 4 components: AdsTable (390), KPICards (138), TopBar (111), StatusBadge (52).
- `src/data/mockData.ts` (477 LOC) — mock fixture hardcoded into App.tsx.
- **No API calls anywhere**; no env vars; no backend wiring.

## Env vars read (backend, via `process.env.X`)
NODE_ENV, PORT, FRONTEND_URL, JWT_SECRET, ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI_GSC, GOOGLE_REDIRECT_URI_GA4, BACKEND_URL, META_APP_ID, META_APP_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, PSI_API_KEY, SLACK_WEBHOOK_URL, SMTP_HOST, GOOGLE_APPLICATION_CREDENTIALS, SEED_ADMIN_PASSWORD, SEED_SUPERADMIN_PASSWORD, ADS_TOKEN_ENCRYPTION_KEY, LOG_LEVEL (crawler).

## Env vars read (frontend)
None. No `import.meta.env.X` usage anywhere in frontend/.
