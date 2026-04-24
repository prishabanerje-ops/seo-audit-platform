# Phase 0 — PRD Verifiable Claims

Source: `~/Downloads/PRD-v2-FINAL.md` (3836 lines, Version 2.0, April 2026)

This file extracts every verifiable, testable claim from the PRD. Each row is a statement a reviewer could inspect or grep against the code to confirm or refute.

| ID | Claim | Source | Category |
|---|---|---|---|
| platform-os-macos-only | Platform is macOS only (Screaming Frog CLI macOS constraint) | L47 | config-env |
| crawler-sf-cli | Crawls are performed via Screaming Frog SEO Spider CLI in headless mode | L39 | crawler |
| ai-trigger-manual-sse | AI fix recommendations via Claude use manual trigger with SSE streaming | L41 | ai |
| integrations-list | Integrates with GSC, GA4, Linear, Slack, SMTP, Google Sheets, PageSpeed Insights | L42 | integrations |
| role-admin | `admin` role has full access: sites, users, integrations, all dashboards, settings, danger zone | L68 | roles-permissions |
| role-seo | `seo` role can run crawls, view all audits, create tasks, create Linear tickets, export; cannot manage users or change platform settings | L69 | roles-permissions |
| role-readonly | `readonly` role can view and export audit results only; cannot trigger crawls or create tickets | L70 | roles-permissions |
| role-admin-lockout-guard | Admins cannot change their own role (enforced both backend and frontend) | L73 | roles-permissions |
| role-deactivated-login | Deactivated users cannot log in (status check on every login attempt) | L74 | auth |
| role-server-enforcement | All role checks are enforced server-side; frontend disabling is UX only | L75 | roles-permissions |
| env-node-20 | Node.js 20.0.0 or later required (22 LTS also supported) | L86 | config-env |
| env-sf-version | Screaming Frog SEO Spider 23.0+ required | L88 | config-env |
| sf-binary-path-env | `SF_BINARY_PATH` env var must point to SF CLI binary or wrapper script | L114, L325 | config-env |
| sf-free-tier-limit | Without a licence, SF crawls max 500 URLs | L127 | crawler |
| sf-license-key-env | `SF_LICENSE_KEY` env var is passed to SF on first run via `--licence-key` | L128 | config-env |
| sf-import-only-mode | If SF_BINARY_PATH not set or binary not found at startup, platform boots in import-only mode | L132 | crawler |
| sf-import-only-banner | In import-only mode, persistent amber banner appears in header: "SF CLI not configured — crawls disabled" | L135 | ui-ux |
| repo-root-env | Single `.env` file at project root (never committed) | L155 | config-env |
| repo-setup-sh | `setup.sh` at repo root handles install deps, migrate, seed, validate env | L159 | deployment |
| repo-ci-yml | `.github/workflows/ci.yml` runs lint + test + build on every PR | L170 | deployment |
| repo-deploy-yml | `.github/workflows/deploy.yml` auto-deploys to VPS on merge to main | L171 | deployment |
| backend-server-entry | `backend/server.js` is the Express app entry point | L174 | other |
| backend-validate-env | `backend/validate-env.js` runs startup env validation and exits process if required vars missing | L175 | config-env |
| db-file-path | SQLite DB file at `backend/seo-automation.db`, auto-created, gitignored | L176 | db-schema |
| db-sqlite-singleton | DB singleton at `backend/db/sqlite.js` with WAL mode, FK enabled, auto-migrate on dev | L180 | db-schema |
| db-migrations-count | Migrations 001_initial, 002_v3_additions, 003_gsc_extended, 004_task_detail exist in `backend/db/migrations/` | L182–L185 | db-schema |
| middleware-auth-file | `backend/middleware/auth.js` contains JWT verification + requireRole(), applied globally | L187 | auth |
| middleware-rate-limiter | `backend/middleware/rateLimiter.js` contains express-rate-limit configs per route group | L188 | rate-limits |
| middleware-validate | `backend/middleware/validate.js` is a zod request body validation factory | L189 | routes-api |
| routes-files | Backend route files exist for: ai, auth, crawl, export, ga4, gsc, linear, notify, pagespeed, reports, schedule, settings, sites, tasks, errors | L191–L205 | routes-api |
| service-sf-config | `backend/services/sf-config.service.js` generates .seospiderconfig XML from sfConfig object | L209 | crawler |
| service-scheduler | `backend/services/scheduler.service.js` exists | L210 | other |
| service-slack | `backend/services/slack.service.js` exists | L211 | integrations |
| service-email-nodemailer | `backend/services/email.service.js` uses Nodemailer for task assignment emails and crawl reports | L212 | integrations |
| service-health-9 | `backend/services/health.service.js` performs system health checks for all 9 integrations | L213 | integrations |
| seed-audit-checks | `backend/db/seed/audit-checks.js` seeds all checks from checklist into audit_checks table | L216 | db-schema |
| frontend-tailwind-config | `frontend/tailwind.config.js` exists and uses CSS variables | L221, L2647 | ui-ux |
| frontend-axios-instance | `frontend/src/api/index.js` has Axios instance + global error interceptor → toast | L228 | other |
| frontend-contexts | Frontend contexts: AuthContext, SitesContext, ToastContext | L230–L232 | other |
| frontend-error-boundary | `frontend/src/components/ErrorBoundary.jsx` catches React crashes, shows error page | L239 | ui-ux |
| script-seed-checks | `scripts/seed-checks.js` is the standalone seed runner | L301 | db-schema |
| env-port-3001 | `PORT=3001` is the default backend HTTP port | L317 | config-env |
| env-frontend-url | `FRONTEND_URL=http://localhost:5173` is the frontend origin | L318 | config-env |
| env-jwt-secret-min | `JWT_SECRET` must be min 64 random chars; generate via `openssl rand -hex 64` | L321, L808 | auth |
| env-jwt-required-prod | In production, JWT_SECRET must be set or server refuses to start | L322 | auth |
| env-google-redirect-uri | `GOOGLE_REDIRECT_URI` format: `http://localhost:3001/api/gsc/callback` | L335 | config-env |
| env-google-sa-path | `GOOGLE_APPLICATION_CREDENTIALS=./google-service-account.json` is the default service account path | L338 | config-env |
| env-smtp-port-default | `SMTP_PORT=587` is the default (587 = STARTTLS, 465 = SSL) | L349 | config-env |
| env-smtp-from-default | `SMTP_FROM=noreply@yourplatform.com` is the default From address | L352 | config-env |
| env-encryption-key | `ENCRYPTION_KEY` is required in production; 32-byte hex key for AES-256; generate via `openssl rand -hex 32` | L355–L357 | config-env |
| settings-table-db-keys | Settings table keys stored in DB: anthropic_api_key, psi_api_key, slack_webhook_url, sheets_spreadsheet_id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, gsc_tokens, ga4_tokens | L364–L370 | db-schema |
| settings-override-env | DB settings override `.env` values if set | L362 | config-env |
| env-required-production | REQUIRED_IN_PRODUCTION env vars: JWT_SECRET, FRONTEND_URL, ENCRYPTION_KEY | L382 | config-env |
| prod-missing-vars-exit | In production, missing required vars → log error + `process.exit(1)` | L392 | config-env |
| health-endpoint-public | `GET /api/health` is a public route (no JWT required) | L399, L757, L1997 | routes-api |
| health-response-shape | `/api/health` returns JSON with status, version, environment, timestamp, vars, mode | L402–L417 | routes-api |
| health-mode-values | Health `mode` values: "full", "import-only", "degraded" | L420–L423 | routes-api |
| setup-route-public | `/setup` React route is publicly accessible; shown on first visit if no users exist | L427 | ui-ux |
| setup-redirect-after-user | Once any user exists, `/setup` redirects to `/login` | L434 | ui-ux |
| db-wal-mode | SQLite runs in WAL journal mode with foreign keys enabled | L440 | db-schema |
| db-migrations-order | Migrations run in order: 001 → 002 → 003 → 004 | L442 | db-schema |
| db-auto-migrate-dev | In development, migrations run automatically on every server start (idempotent) | L445 | db-schema |
| db-migrate-prod-manual | In production, migrations do NOT run automatically; run via `npm run migrate` | L446 | db-schema |
| table-sites-columns | `sites` table has columns: id, project_id, label, url, gsc_property, ga4_property_id, color (default '#6366f1'), sheets_tab_name, linear_project_id, created_at | L451–L461 | db-schema |
| table-crawl-jobs-status-enum | `crawl_jobs.status` enum: running|completed|failed|cancelled, default 'running' | L470 | db-schema |
| table-crawl-jobs-mode-enum | `crawl_jobs.mode` enum: spider|list|sitemap|import|compare, default 'spider' | L471 | db-schema |
| table-crawl-jobs-cascade | `crawl_jobs.site_id` FK cascades on delete | L475 | db-schema |
| table-audit-results-severity-enum | `audit_results.severity` enum: critical|warning|info|ok | L485 | db-schema |
| table-audit-checks-columns | `audit_checks` has columns: id, check_number (unique), name, category, description, detection_method, logic_summary, seo_impact, tool_source (default 'screaming-frog'), severity_default (default 'warning'), is_automated (default 1), created_at | L491–L504 | db-schema |
| table-gsc-cache-period-enum | `gsc_cache.period` values: current|previous, default 'current' | L515 | db-schema |
| table-schedules-columns | `schedules` table has site_ids (JSON array), cron_expression, notify_slack, notify_email, enabled, last_run, next_run, crawl_results | L536–L546 | db-schema |
| table-users-role-enum | `users.role` enum: admin|seo|readonly, default 'seo' | L558 | db-schema |
| table-users-status-enum | `users.status` enum: active|inactive, default 'active' | L560 | db-schema |
| table-invites-default-role | `invites.role` default is 'readonly' | L568 | db-schema |
| table-ai-suggestion-feedback-rating | `ai_suggestion_feedback.rating` is INTEGER with values 1 (thumbs up) or -1 (thumbs down) | L611 | db-schema |
| table-ai-suggestion-feedback-unique | `ai_suggestion_feedback` has UNIQUE(suggestion_id, user_id) | L613 | db-schema |
| table-task-status-enum | `task_status.status` enum: backlog|in_progress|review|done, default 'backlog' | L622 | db-schema |
| table-notifications-type | `notifications.type` values: crawl_complete|critical_issue|task_assigned|system | L635 | db-schema |
| table-error-log-columns | `error_log` has columns: id, level (error|warn), source (frontend|backend), message, stack, user_id, url, created_at | L643–L652 | db-schema |
| db-indexes-migration-002 | Migration 002 creates indexes on audit_results (job, section, severity, site, site+job, url), gsc_cache (site+url), ga4_cache (site+url), notifications (user+is_read), task_status (site+status), crawl_jobs (site+started_at), error_log (created_at) | L658–L669 | db-schema |
| table-gsc-queries | `gsc_queries` table has site_id, query, clicks, impressions, ctr, position, prev_clicks, prev_impressions, fetched_at with UNIQUE(site_id, query) | L677–L689 | db-schema |
| table-gsc-daily | `gsc_daily` table has site_id, date, clicks, impressions, ctr, position, fetched_at with UNIQUE(site_id, date) | L691–L701 | db-schema |
| table-task-comments | `task_comments` table added in migration 004 with FK to task_status | L710–L717 | db-schema |
| task-priority-enum | `task_status.priority` enum: urgent|high|medium|low, default 'medium' | L719 | db-schema |
| auth-middleware-global | Auth middleware applied at Express app level BEFORE all route registration | L732 | auth |
| public-paths-allowlist | PUBLIC_PATHS: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, POST /api/auth/register, GET /api/auth/setup-status, POST /api/auth/invite/accept, GET /api/gsc/auth, GET /api/gsc/callback, GET /api/ga4/callback, GET /api/health | L747–L758 | auth |
| auth-jwt-cookie-name | JWT stored in HttpOnly cookie `auth_token` | L772, L806 | auth |
| auth-jwt-algorithm | JWT algorithm is HS256 | L803 | auth |
| auth-jwt-expiry | JWT expiry is 7 days (cookie MaxAge=604800) | L804, L806 | auth |
| auth-jwt-payload | JWT payload: `{ sub: uuid, email, name, role }` | L805 | auth |
| auth-cookie-samesite | Cookie SameSite=Strict | L806 | auth |
| auth-cookie-secure-prod | Production only: Secure flag added to cookie | L807 | auth |
| auth-last-active-update | authMiddleware updates `last_active_at` (non-blocking) on every request | L780 | auth |
| auth-401-invalid-token | Invalid or expired token returns 401 `{ error: 'Invalid or expired token' }` | L785 | auth |
| require-role-403 | `requireRole` returns 403 `{ error: 'Insufficient permissions' }` if role mismatch | L794 | auth |
| rate-limit-auth | authLimiter: 15min window, max 20 attempts — applied to POST /api/auth/login and POST /api/auth/invite/accept | L816–L822, L838 | rate-limits |
| rate-limit-api | apiLimiter: 60s window, max 300 requests/min per IP — applied globally after authMiddleware | L824–L828, L840 | rate-limits |
| rate-limit-ai | aiLimiter: 60s window, max 10 AI requests/min — applied to POST /api/ai/suggest | L830–L834, L839, L1497 | rate-limits |
| helmet-csp | helmet is applied with CSP directives: defaultSrc 'self', scriptSrc 'self' 'unsafe-inline', connectSrc 'self' https://api.anthropic.com | L847–L853 | auth |
| helmet-hsts | helmet HSTS: maxAge 31536000, includeSubDomains true | L855 | auth |
| cors-config | CORS configured with origin = FRONTEND_URL env, credentials: true, methods: GET, POST, PUT, PATCH, DELETE, OPTIONS | L864–L868 | auth |
| zod-validation-required | Zod schemas must be defined for every POST/PUT/PATCH route body | L904 | routes-api |
| sf-cli-flags | Supported SF CLI flags: --headless, --save-crawl, --overwrite, --output-folder, --export-tabs, --crawl, --crawl-sitemap, --crawl-list, --threads, --depth, --user-agent, --robots-file, --licence-key | L914–L928 | crawler |
| sf-cli-default-threads | `--threads` default is 5 | L924 | crawler |
| sf-cli-default-depth | `--depth -1` means unlimited | L925 | crawler |
| sf-config-file-name | XML config written to `crawl.seospiderconfig` | L963 | crawler |
| sf-config-defaults | XML config defaults: maxCrawlDepth -1, maxCrawlUrls 0, maxThreads 5, requestTimeout 30000, renderType 'None', userAgent 'ScreamingFrogSEOSpider' | L983–L988 | crawler |
| sf-export-tabs-20 | EXPORT_TABS array includes 20 tabs: internal_all, response_codes_all, page_titles_all, meta_description_all, h1_all, h2_all, images_all, canonicals_all, structured_data_all, hreflang_all, directives_all, javascript_all, sitemaps_all, spelling_all, page_speed_all, url_list, custom_extraction_all, log_summary_all, amp_all, security_all | L1036–L1057 | crawler |
| socket-events-3 | Socket.io events: `crawl:log:{jobId}`, `crawl:progress:{jobId}`, `crawl:complete:{jobId}` | L1062–L1066 | crawler |
| socket-progress-regex | Progress parsed from SF stdout via `/(\d+)\s+of\s+(\d+)/i` or `/(\d+)\/(\d+)/` | L1068 | crawler |
| crawl-cancel-sigterm | Cancelled job sends SIGTERM to SF process | L1075, L1119 | crawler |
| crawl-health-score-column | `crawl_jobs.health_score` column added in migration 004 | L1080 | db-schema |
| crawl-complete-side-effects | On completion: parse CSVs into audit_results, compute health_score, insert crawl_complete notification, fire Slack if notify_slack=1, fire email if notify_email=1, delete temp files | L1078–L1084 | crawler |
| sites-cascade | Site deletion cascades to crawl_jobs, audit_results, gsc_cache, ga4_cache, task_status via ON DELETE CASCADE | L1096 | db-schema |
| sites-post-put-role | POST/PUT/DELETE on /api/sites restricted to `admin` and `seo` roles | L1094, L1800–L1802 | roles-permissions |
| crawl-start-schema | POST /api/crawl/start accepts zod schema with siteIds, targetUrl, crawlName, mode, urlList, sitemapUrl, jobA, jobB, sfConfig | L1103–L1114 | routes-api |
| crawl-mode-enum | Crawl mode enum: spider, list, sitemap, import, compare | L1108 | routes-api |
| crawl-import-max-files | POST /api/crawl/import accepts multipart/form-data with up to 20 SF CSV files | L1123 | routes-api |
| health-score-formula | Health score: `Math.max(0, Math.round(100 - (penalty / totalUrls) * 10))` with penalty = critical*3 + warning*2 + info*1 | L1180–L1181 | other |
| reports-summary-live | GET /api/reports/:siteId/summary computes all values live from DB (not cached) | L1130 | routes-api |
| ui-checks-loaded-indicator | AuditHealth UI shows "156 checks loaded" from GET /api/reports/checks/count | L1210 | ui-ux |
| test-checks-endpoint | POST /api/reports/:siteId/test-checks re-runs check validations on latest crawl | L1211, L1841 | routes-api |
| linear-ticket-schema | POST /api/linear/create-ticket accepts auditResultId, siteId, title (1–500 chars), description, severity, urls (max 50), totalUrls | L1224–L1232 | integrations |
| linear-priority-mapping | Linear priority mapping: critical→1, warning→2, info→3, ok→4 | L1235–L1239 | integrations |
| linear-button-states | LinearButton has states: Default, Loading, Success (LIN-XXX link), Error toast, Already created | L1247–L1252 | ui-ux |
| linear-button-locations | LinearButton appears on: audit category table rows, Issue Detail page, Task Board cards | L1254–L1257 | ui-ux |
| ga4-kpi-cards-4 | GA4Overlay has 4 KPI cards: Total Sessions, Engaged Sessions, Avg Bounce Rate, Avg Session Duration | L1270 | ui-ux |
| ga4-trend-28day | GA4 trend chart shows 28-day daily data from GET /api/ga4/:siteId/daily | L1273–L1275 | ui-ux |
| gsc-surface-areas-5 | GSC data surfaces in 5 places: GSC Overlay page, Admin View, SEO View Issues tab, Audit Category pages, Issue Detail page | L1294 | ui-ux |
| tasks-kanban-columns | Kanban has 4 columns: backlog, in_progress, review, done | L1347–L1350 | ui-ux |
| tasks-bulk-update | PATCH /api/tasks/bulk accepts `{ ids: [...], status }` | L1383 | routes-api |
| tasks-delete-admin | DELETE /api/tasks/:id requires admin role | L1407, L1927 | roles-permissions |
| tasks-delete-cascades | Deleting a task cascades to task_comments | L1408 | db-schema |
| schedules-crawl-results-last-5 | `schedules.crawl_results` stores last 5 crawl result summaries as JSON array | L1412 | db-schema |
| schedule-cron-regex | Schedule cron_expression validated via regex: `/^[\d\*\/\-,]+ [\d\*\/\-,]+ [\d\*\/\-,]+ [\d\*\/\-,]+ [\d\*\/\-,]+$/` | L1426 | routes-api |
| schedule-run-now | POST /api/schedules/:id/run-now triggers immediate crawl and returns without waiting | L1433–L1437 | routes-api |
| ai-access-control | AI recommendations available to admin and seo roles only; readonly sees no button | L1460–L1461 | ai |
| ai-trigger-3-modes | AI has 3 trigger modes: Individual (Issue Detail), Inline (Issue List drawer), Bulk (sequential) | L1467–L1484 | ai |
| ai-bulk-socket-events | Bulk AI emits `ai:bulk:progress` and `ai:bulk:done` via Socket.io | L1482–L1483 | ai |
| ai-endpoints-5 | AI endpoints: POST /api/ai/suggest (seo+), POST /api/ai/suggest/bulk (seo+), POST /api/ai/suggest/:id/regenerate (seo+), POST /api/ai/suggest/:id/feedback (auth), GET /api/ai/suggestions (auth) | L1489–L1496 | routes-api |
| ai-model | AI model is `claude-sonnet-4-6` | L1555 | ai |
| ai-max-tokens | AI max tokens is 1500 (increased from 1024 to accommodate code snippets) | L1556 | ai |
| ai-cache-key | AI cache key is `(check_id, crawl_job_id)` stored in `ai_suggestions` | L1562 | ai |
| ai-regenerate-overwrites | Regenerate skips cache and overwrites existing ai_suggestions row | L1568–L1571 | ai |
| ai-cms-detection-methods | CMS detection order: meta generator tag → X-Powered-By header → URL patterns | L1585–L1588 | ai |
| ai-cms-stored | CMS type stored in `sites.cms_type` column | L1590 | db-schema |
| ai-feedback-comment-col | `ai_suggestion_feedback` requires `comment TEXT` column added via migration | L1605–L1607 | db-schema |
| ai-feedback-comment-max | AI feedback comment max 500 characters | L1603 | ai |
| ai-feedback-threshold | ≥5 thumbs-down for a check_id triggers feedback signal block in prompt | L1611 | ai |
| ai-token-budget-settings | Token budget stored in settings keys: `ai_token_budget` and `ai_token_used` | L1635–L1637 | ai |
| ai-token-budget-exceeded-429 | If ai_token_used >= ai_token_budget, return 429 with error "Token budget exceeded" | L1626 | ai |
| notifications-bell-polling | Header bell icon unread count refreshed every 60 seconds via polling | L1647 | ui-ux |
| slack-crawl-complete-blocks | Slack crawl complete message includes header, URLs Crawled, Duration, Critical/Warning/Info counts, Health Score, View Report button linking to `${FRONTEND_URL}/audit-health?site=${site.id}` | L1652–L1668 | integrations |
| email-smtp-fallback | If SMTP not configured, email sending logs warning and skips silently | L1676 | integrations |
| errors-post-auth | POST /api/errors requires auth (JWT cookie) | L1683 | routes-api |
| errors-post-rate | POST /api/errors rate limited to 30 req/min per user | L1684 | rate-limits |
| errors-get-admin | GET /api/errors requires admin role | L1687 | roles-permissions |
| error-log-page-admin | `/error-log` frontend route is admin only | L1692, L2174 | ui-ux |
| axios-5xx-logs-to-backend | Axios interceptor logs status >= 500 errors to `/errors` endpoint | L1736–L1742 | other |
| routes-auth-list | Auth routes include login, logout, me, register, setup-status, invite, invite/accept, users (list/patch/delete) | L1760–L1769 | routes-api |
| routes-auth-register-403 | POST /api/auth/register fails with 403 if any user already exists | L1783 | auth |
| routes-auth-invite-role-enum | POST /api/auth/invite role enum: 'seo' or 'readonly' (admin cannot be assigned via invite) | L1789 | roles-permissions |
| routes-auth-invite-token | Invite token is 32-byte hex with 48h expiry | L1792 | auth |
| routes-auth-own-role-guard | PATCH /api/auth/users/:id rejects 403 with "You cannot modify your own role" if target id equals user's sub | L1794 | auth |
| routes-auth-login-login-errors | POST /api/auth/login returns 401 'Invalid email or password' or 403 'Account deactivated' | L1780–L1781 | routes-api |
| routes-sites-post-id-regex | POST /api/sites id must match regex `/^[a-z0-9-]+$/` | L1808 | routes-api |
| routes-sites-post-color-default | POST /api/sites color default '#6366f1' | L1812 | routes-api |
| routes-crawl-6-endpoints | Crawl routes: POST /start, GET /status/:jobId, POST /cancel/:jobId, POST /import, GET /history/:siteId, GET /jobs | L1822–L1828 | routes-api |
| routes-reports-8-endpoints | Reports routes: 8 endpoints incl. summary, section, job, compare, top-issues, checks, checks/count, test-checks | L1834–L1841 | routes-api |
| routes-reports-section-query | GET /api/reports/:siteId/:section supports query params: severity, issue_type, search, page (default 1), limit (default 50, max 200), sort, dir | L1844–L1851 | routes-api |
| routes-gsc-9-endpoints | GSC routes: auth, callback, status, fetch, pages, queries, daily, summary, disconnect | L1878–L1886 | routes-api |
| routes-gsc-daily-16weeks | GET /api/gsc/:siteId/daily returns daily trend for 16 weeks | L1884 | integrations |
| routes-ga4-8-endpoints | GA4 routes: auth, callback, status, fetch, pages, summary, daily, disconnect | L1892–L1899 | routes-api |
| routes-gsc-disconnect-admin | DELETE /api/gsc/disconnect requires admin | L1886 | roles-permissions |
| routes-ga4-disconnect-admin | DELETE /api/ga4/disconnect requires admin | L1899 | roles-permissions |
| routes-ai-3-endpoints | AI routes listed: POST /suggest, POST /suggest/:id/feedback, GET /suggestions | L1905–L1907 | routes-api |
| routes-linear-5-endpoints | Linear routes: POST /create-ticket, GET /tickets, GET /tickets/:auditId, DELETE /tickets/:id, GET /test | L1913–L1917 | routes-api |
| routes-tasks-8-endpoints | Tasks routes: GET /, POST /, GET /:id, PATCH /:id, DELETE /:id, PATCH /bulk, GET /:id/comments, POST /:id/comments | L1923–L1930 | routes-api |
| routes-schedules-6-endpoints | Schedules routes: GET /, POST /, PUT /:id, DELETE /:id, POST /:id/run-now, PATCH /:id/toggle | L1936–L1941 | routes-api |
| routes-export-3-endpoints | Export routes: GET /:siteId/csv, POST /:siteId/sheets, GET /history | L1947–L1949 | routes-api |
| routes-settings-5-endpoints | Settings routes: GET /, PUT /, GET /status, POST /test-smtp, POST /test-slack | L1955–L1959 | routes-api |
| routes-settings-values-masked | GET /api/settings returns all settings with values masked | L1955 | auth |
| routes-notifications-3 | Notifications routes: GET /, PATCH /:id/read, POST /read-all | L1965–L1967 | routes-api |
| routes-notify-3 | Notify config routes: POST /slack (seo+), POST /email (seo+), POST /task-assigned (internal) | L1973–L1975 | routes-api |
| routes-pagespeed-3 | PageSpeed routes: POST /test, GET /:siteId, POST /batch | L1981–L1983 | routes-api |
| routes-errors-3 | Errors routes: POST /, GET /, DELETE /all | L1989–L1991 | routes-api |
| frontend-state-context-only | Frontend state management uses React Context only; no Redux/Zustand | L2006 | other |
| audit-page-4-states | AuditPage.jsx must implement 4 states: loading (skeleton), error (retry), empty (no crawl), data (DataTable) | L2016, L2046–L2067 | ui-ux |
| theme-default-dark | Default theme is dark (set on initial load if no localStorage value) | L2114 | ui-ux |
| theme-storage | Theme persisted in localStorage and applied via `data-theme` attribute on documentElement | L2112, L2437 | ui-ux |
| routes-frontend-admin | `/admin` route renders AdminView, Admin role only | L2131, L2452 | ui-ux |
| routes-frontend-audit-20 | 20 audit category routes exist: response-codes, meta-tags, headings, images, canonicals, internal-links, structured-data, custom-extraction, log-file, core-web-vitals, url-structure, https-security, robots-txt, sitemaps, javascript, hreflang, content-quality, msite-desktop, page-experience, local-seo | L2140–L2159 | ui-ux |
| routes-frontend-issue-detail | `/issues/:id` route renders IssueDetail page | L2160 | ui-ux |
| routes-frontend-tasks | `/tasks` and `/tasks/:id` routes exist (Kanban + Detail) | L2162–L2163 | ui-ux |
| routes-frontend-error-log-admin | `/error-log` uses `<RequireRole role="admin">` wrapper | L2174 | ui-ux |
| figma-file-url | Figma file URL: https://www.figma.com/make/J1sJUWxKyX11FuP7Wg6rOi/Review-Figma-Design-Prompt | L2209 | ui-ux |
| breakpoints-3 | Breakpoints: Desktop 1440px, Tablet 768px, Mobile 375px | L2213 | ui-ux |
| font-ui-inter | `--font-ui` is Inter, system-ui, -apple-system, sans-serif | L2359 | ui-ux |
| font-mono-jetbrains | `--font-mono` is JetBrains Mono, Fira Code, Cascadia Code, monospace | L2360 | ui-ux |
| mono-font-usage | Mono font applied to URL cells, HTTP status codes, crawl log lines, code blocks, custom extraction values, cron expression input | L2362–L2376 | ui-ux |
| health-ring-colour-ranges | Health ring stroke colour: 80–100 ok, 50–79 warning, 0–49 critical, null border-default | L2553–L2558 | ui-ux |
| sidebar-widths | Sidebar expanded 240px, collapsed 56px, transition 200ms ease | L2574–L2576 | ui-ux |
| lucide-icons | Icons come from `lucide-react` package; sizes 16px (small), 18px (nav), 20px (medium), 24px (large) | L2853–L2857 | ui-ux |
| audit-category-20 | 20 audit categories defined with SF CSV mapping | L2919, L2921–L3118 | crawler |
| audit-check-count-204 | Audit check seed data includes 204 numbered checks (check_number 1 through 204) | L3143–L3373 | db-schema |
| audit-checks-insert-or-ignore | audit_checks seed uses INSERT OR IGNORE to be idempotent | L3137 | db-schema |
| audit-checks-seeded-auto | audit_checks seeded automatically on first server start if table empty | L3128 | db-schema |
| audit-checks-seeded-manual | audit_checks manually seeded via `node scripts/seed-checks.js` | L3129 | db-schema |
| test-stack | Test stack: vitest ^1.x, @vitest/coverage-v8 ^1.x, supertest ^6.x, cross-env ^7.x | L3384–L3389 | testing |
| test-files-8 | Backend test files: auth, route-protection, sites, crawl, reports, tasks, linear, health | L3398–L3405 | testing |
| test-protected-routes | route-protection.test.js asserts every protected route returns 401 without cookie | L3410, L3443–L3448 | testing |
| test-scripts | package.json test scripts: test, test:watch, test:coverage, test:auth | L3457–L3460 | testing |
| dockerfile-multistage | Dockerfile is multi-stage: node:20-alpine frontend-build → node:20-alpine production | L3472–L3501 | deployment |
| docker-volume | Docker VOLUME at `/app/backend/data` | L3497 | deployment |
| docker-expose-3001 | Docker EXPOSES port 3001 | L3499 | deployment |
| ci-macos-runner | CI runs on `macos-latest` (required for SF CLI tests) | L3698 | testing |
| ci-node-20 | CI uses Node 20 | L3705 | testing |
| deploy-branch-main | Deploy workflow runs only on push to main (github.ref == 'refs/heads/main') | L3749 | deployment |
| deploy-pm2 | VPS uses pm2 to manage Node.js process; Caddy handles HTTPS | L3776 | deployment |
| non-goals-no-windows | No Windows support (SF CLI macOS-only constraint) | L3814 | other |
| non-goals-no-mobile-app | No mobile app in v1 | L3815 | other |
| non-goals-no-content-gen | No content writing or AI content generation | L3810 | other |
| roadmap-postgres-v2 | PostgreSQL support is v2 roadmap item; SQLite in v1 | L3795 | other |
| roadmap-bulk-ai-high | Bulk AI triage (auto-generate post-crawl) is High priority roadmap item; manual trigger only in v1 | L3794 | ai |
| roadmap-multi-tenancy-low | Multi-tenant / agency mode is Low priority roadmap item | L3802 | multi-tenancy |
| constraint-sf-free-500 | SF free tier: max 500 URLs per crawl; System Health warns if unlicensed crawl exceeds 500 | L3823 | crawler |
| constraint-sf-macos-only | SF CLI is macOS only (no Windows or Linux binary) | L3824 | crawler |
| constraint-ai-manual-cache | AI recommendations cached per (check_id, job_id) indefinitely; manual trigger only | L3826 | ai |
| constraint-google-oauth-unverified | Unverified Google Cloud OAuth app supports up to 100 users | L3828 | integrations |
| jwt-cookie-no-localstorage | JWT stored in HttpOnly cookie only — no `localStorage` token fallback | L3831 | auth |

---

## Summary

- **Total claims extracted:** 175
- **Source PRD:** `~/Downloads/PRD-v2-FINAL.md` (3836 lines)

### Count per category

| Category | Count |
|---|---|
| auth | 22 |
| ai | 18 |
| crawler | 16 |
| db-schema | 28 |
| routes-api | 27 |
| integrations | 9 |
| ui-ux | 30 |
| rate-limits | 5 |
| roles-permissions | 10 |
| multi-tenancy | 1 |
| config-env | 15 |
| testing | 5 |
| deployment | 7 |
| other | 9 |

(Counts are approximate — some claims span multiple categories but are assigned to the most specific one.)

### Highest-risk claims (most likely to be violated by current code)

Based on the current state (CLAUDE.md says the project uses Playwright/Crawlee crawler, not Screaming Frog CLI; audit rebuild is at 321 checks, not 204; and JWT expires after 7 days with specific cookie flags):

1. **`crawler-sf-cli`** (L39) — "Crawls via Screaming Frog SEO Spider CLI in headless mode". CLAUDE.md states crawler is Playwright/Crawlee (`playwright-crawler/src/crawler.js`). This is a full architectural divergence from PRD.

2. **`audit-check-count-204`** (L3143–L3373) — "Audit checks seed data has 204 numbered checks". Recent commit `ec5ae1e` and `a174c6e` say Phase 2 rebuild is at 321 checks / 23 categories. PRD's 204-check seed is stale.

3. **`ai-max-tokens`** (L1556) — PRD says "max tokens 1500". CLAUDE.md says "max 1024 tokens". These directly conflict.

4. **`ai-model`** (L1555) — PRD specifies `claude-sonnet-4-6`. CLAUDE.md confirms same model, but worth verifying at implementation level (`backend/services/ai.service.js`).

5. **`sf-binary-path-env`** / **`sf-import-only-mode`** / **`constraint-sf-macos-only`** — Entire SF-bound configuration surface (env vars, import-only banner, macOS-only constraint) is obsolete if the system actually uses Playwright. Many downstream claims (SF XML config, EXPORT_TABS, `--licence-key` flag) cascade from this.

6. **`roadmap-bulk-ai-high`** vs **`ai-trigger-3-modes`** — PRD §11.10.2 declares Bulk AI as an implemented mode with Socket.io events, but §19 roadmap says "Bulk AI triage ... Manual trigger only in v1". Internal PRD inconsistency — reviewer must confirm which applies.
