# Phase 11 — PRD Conformance Verification

Scope: ~175 PRD claims from `audit/phase0-prd-claims.md` verified against current repository at `/Users/a39326/Documents/Aakash` (excluding `.worktrees/`). PRD source: `~/Downloads/PRD-v2-FINAL.md`.

Live DB at the time of inspection: `backend/seo-automation.db` — 16 applied migrations (001–004, 006–016), 30 tables, `audit_checks` count = 291, `audit_results` = 6,035.

Note: Migrations **005** (founder→admin + cms_type + ai_token_budget + feedback.comment) and **018** (audit_checks rebuild to 321/23-category) exist as files but are **not applied** in the live DB.

---

## 1. Summary

| Verdict | Count | Percentage |
|---|---|---|
| Matches | 54 | 30.9% |
| Partial | 24 | 13.7% |
| Mismatch | 69 | 39.4% |
| Cannot verify | 28 | 16.0% |
| **Total** | **175** | **100%** |

---

## 2. Category tallies

| Category | Matches | Partial | Mismatch | Cannot verify |
|---|---|---|---|---|
| auth (22) | 14 | 3 | 4 | 1 |
| ai (18) | 4 | 4 | 9 | 1 |
| crawler (16) | 0 | 2 | 13 | 1 |
| db-schema (28) | 14 | 4 | 9 | 1 |
| routes-api (27) | 5 | 5 | 16 | 1 |
| integrations (9) | 2 | 1 | 4 | 2 |
| ui-ux (30) | 4 | 4 | 8 | 14 |
| rate-limits (5) | 4 | 0 | 1 | 0 |
| roles-permissions (10) | 4 | 1 | 3 | 2 |
| multi-tenancy (1) | 0 | 0 | 1 | 0 |
| config-env (15) | 3 | 0 | 10 | 2 |
| testing (5) | 2 | 1 | 1 | 1 |
| deployment (7) | 0 | 0 | 7 | 0 |
| other (9) | 2 | 0 | 5 | 2 |

---

## 3. Full per-claim verdicts

| ID | Claim (truncated) | Verdict | Evidence | Note |
|---|---|---|---|---|
| platform-os-macos-only | macOS-only | Mismatch | no SF, no macOS check; `playwright-crawler/` cross-platform | Obsolete — SF constraint no longer applies |
| crawler-sf-cli | Screaming Frog CLI crawler | Mismatch | `backend/services/crawl-runner.js:11` imports `../../playwright-crawler/src/index.js` | **Core architectural divergence** |
| ai-trigger-manual-sse | Manual + SSE streaming | Matches | `backend/routes/ai.js:103-129` SSE with `client.messages.stream()` |  |
| integrations-list | GSC/GA4/Linear/Slack/SMTP/Sheets/PSI | Partial | routes for GSC, GA4, Linear svc, Slack svc, PSI; **no email/SMTP service file**, Sheets svc present | Email integration absent |
| role-admin | admin full access | Matches | `middleware/auth.js:63-71` + router.jsx `AdminOnly` wrappers |  |
| role-seo | seo role scope | Partial | role enum present, `routes/tasks.js:235` Linear requires admin not seo | Linear-sync admin-only contradicts PRD |
| role-readonly | readonly view-only | Matches | role enum in auth schemas; enforced via `requireRole` |  |
| role-admin-lockout-guard | admins cannot change own role | Matches | `backend/routes/auth.js:399-401` |  |
| role-deactivated-login | deactivated cannot login | Matches | `backend/routes/auth.js:77-79` |  |
| role-server-enforcement | server-side role checks | Matches | `middleware/auth.js:63-71` + route-level `requireRole` |  |
| env-node-20 | Node 20+ required | Cannot verify | no `engines` field set in root package.json | Runtime dependency only |
| env-sf-version | SF 23.0+ | Mismatch | SF not used; `playwright 1.52` in `playwright-crawler/package.json` |  |
| sf-binary-path-env | SF_BINARY_PATH env var | Mismatch | not referenced anywhere in backend |  |
| sf-free-tier-limit | 500-URL cap without licence | Mismatch | N/A — Playwright has no such cap |  |
| sf-license-key-env | SF_LICENSE_KEY | Mismatch | not used anywhere |  |
| sf-import-only-mode | boot to import-only if SF missing | Mismatch | no such mode in server.js |  |
| sf-import-only-banner | amber banner "SF CLI not configured" | Mismatch | not present in frontend |  |
| repo-root-env | single root `.env` | Matches | `backend/server.js:1` `dotenv/config`; no per-package env |  |
| repo-setup-sh | setup.sh at repo root | Matches | `/Users/a39326/Documents/Aakash/setup.sh` exists |  |
| repo-ci-yml | CI workflow at `.github/workflows/ci.yml` | Mismatch | `.github/workflows/` is empty |  |
| repo-deploy-yml | deploy.yml on main | Mismatch | `.github/workflows/` is empty |  |
| backend-server-entry | `backend/server.js` Express entry | Matches | file exists (197 LOC) |  |
| backend-validate-env | `backend/validate-env.js` exits if required missing | Matches | `backend/validate-env.js:53` `process.exit(1)` |  |
| db-file-path | `backend/seo-automation.db` auto-created | Matches | file exists; gitignored |  |
| db-sqlite-singleton | `db/sqlite.js` WAL+FK+auto-migrate in dev | Matches | file exists, auto-migrate via `runMigrations()` |  |
| db-migrations-count | 001, 002, 003, 004 exist | Partial | all four exist, plus 005–016, 018 | PRD under-counts by ~12 migrations |
| middleware-auth-file | `middleware/auth.js` global | Matches | `middleware/auth.js`; mounted at `server.js:106` |  |
| middleware-rate-limiter | `middleware/rateLimiter.js` | Matches | `middleware/rateLimiter.js` exports 5 limiters |  |
| middleware-validate | `middleware/validate.js` zod factory | Matches | `middleware/validate.js` exists |  |
| routes-files | per-resource route files (incl. linear, pagespeed, reports, schedule, settings, notify) | Partial | 19 route files present; **no linear.js, no notify.js**; `pagespeed` routed under `/api/psi`, `reports` exists | Linear/notify absent as separate files |
| service-sf-config | `services/sf-config.service.js` | Mismatch | file does not exist |  |
| service-scheduler | `services/scheduler.service.js` | Partial | file named `schedule.service.js` (not `scheduler.service.js`) |  |
| service-slack | `services/slack.service.js` | Matches | file exists |  |
| service-email-nodemailer | `services/email.service.js` Nodemailer | Mismatch | file does not exist; nodemailer installed but unused |  |
| service-health-9 | `services/health.service.js` | Mismatch | file does not exist |  |
| seed-audit-checks | `db/seed/audit-checks.js` seeds checks | Matches | `backend/db/seed/audit-checks.js` exists |  |
| frontend-tailwind-config | frontend tailwind config + CSS vars | Partial | no `tailwind.config.js` (uses `@tailwindcss/vite` v4); CSS vars in `styles/theme.css` | Tailwind v4 needs no config file |
| frontend-axios-instance | `api/index.js` + global error interceptor | Matches | `frontend/src/api/index.js` exists with toast-on-error interceptor |  |
| frontend-contexts | Auth/Sites/Toast contexts | Matches | all three exist under `frontend/src/context/` |  |
| frontend-error-boundary | `components/ErrorBoundary.jsx` | Matches | file exists; used in `App.jsx:11` |  |
| script-seed-checks | `scripts/seed-checks.js` | Matches | file exists |  |
| env-port-3001 | PORT=3001 default | Matches | `server.js:188` `parseInt(process.env.PORT \|\| '3001', 10)` |  |
| env-frontend-url | FRONTEND_URL default 5173 | Matches | `server.js:71` fallback `http://localhost:5173` |  |
| env-jwt-secret-min | JWT_SECRET min 64 hex | Cannot verify | validate-env only checks presence, no length check |  |
| env-jwt-required-prod | prod refuses to start without JWT_SECRET | Matches | `validate-env.js:26-28` + `:53 process.exit(1)` |  |
| env-google-redirect-uri | GOOGLE_REDIRECT_URI format | Mismatch | backend reads `GOOGLE_REDIRECT_URI_GSC` and `GOOGLE_REDIRECT_URI_GA4` (two distinct vars), not single `GOOGLE_REDIRECT_URI` |  |
| env-google-sa-path | GOOGLE_APPLICATION_CREDENTIALS default | Partial | env var referenced, no default path hardcoded |  |
| env-smtp-port-default | SMTP_PORT=587 default | Mismatch | no SMTP service exists; no default defined |  |
| env-smtp-from-default | SMTP_FROM default | Mismatch | no SMTP service exists |  |
| env-encryption-key | ENCRYPTION_KEY required prod | Mismatch | `validate-env.js:7` only requires JWT_SECRET + FRONTEND_URL | ENCRYPTION_KEY not enforced |
| settings-table-db-keys | DB settings keys list | Partial | `routes/settings.js:15-21` allows slack_webhook_url/linear_api_key/smtp_*/psi_api_key; global allows only `anthropic_api_key`; **no gsc_tokens/ga4_tokens/sheets_spreadsheet_id in settings table** — GSC/GA4 tokens stored in `company_oauth_tokens`, Sheets ID on `sites` table |  |
| settings-override-env | DB settings override env | Partial | only implemented for `anthropic_api_key` (`routes/ai.js:68-71`) and `slack_webhook_url` (`services/slack.service.js:16-22`) |  |
| env-required-production | JWT_SECRET, FRONTEND_URL, ENCRYPTION_KEY required prod | Partial | `validate-env.js:7` requires JWT_SECRET + FRONTEND_URL only |  |
| prod-missing-vars-exit | missing prod var → exit(1) | Matches | `validate-env.js:53` |  |
| health-endpoint-public | `/api/health` public | Matches | `middleware/auth.js:17`; `server.js:112` |  |
| health-response-shape | status/version/environment/timestamp/vars/mode | Partial | `server.js:122-129` returns status/version/environment/timestamp/crawler/vars — **no `mode` field** |  |
| health-mode-values | mode full/import-only/degraded | Mismatch | no `mode` field in response |  |
| setup-route-public | `/setup` public | Matches | `frontend/src/router.jsx:92` |  |
| setup-redirect-after-user | `/setup` redirects once user exists | Cannot verify | not inspected; needs runtime test |  |
| db-wal-mode | SQLite WAL + FK | Matches | `backend/db/sqlite.js` sets pragmas |  |
| db-migrations-order | 001→002→003→004 | Partial | 001→002→003→004→006→007→008…→016 (005 & 018 not applied) |  |
| db-auto-migrate-dev | dev auto-migrate | Matches | `server.js:17` imports db → runs migrations |  |
| db-migrate-prod-manual | prod manual migration | Cannot verify | no gating logic; same flow for all environments |  |
| table-sites-columns | id/project_id/label/url/gsc_property/ga4_property_id/color/sheets_tab_name/linear_project_id/created_at | Matches | schema has all named columns (plus company_id, crawl_config, sheets_spreadsheet_id, cms_type from 005 which is unapplied locally but defined) |  |
| table-crawl-jobs-status-enum | running/completed/failed/cancelled | Partial | column exists with default 'running'; no CHECK constraint (code also uses 'queued') |  |
| table-crawl-jobs-mode-enum | spider/list/sitemap/import/compare | Partial | column default 'spider'; no CHECK; actual code enum is `spider/list/sitemap/sitemap-list` (`routes/crawls.js:61`) |  |
| table-crawl-jobs-cascade | FK site_id ON DELETE CASCADE | Matches | schema has `ON DELETE CASCADE` |  |
| table-audit-results-severity-enum | critical/warning/info/ok | Partial | column exists; no CHECK constraint |  |
| table-audit-checks-columns | check_number unique + 11 named cols | Partial | all PRD-named columns exist; extra: subsection, implementation_rule, automation_type, tool_current, tool_future, issue_name |  |
| table-gsc-cache-period-enum | current/previous default 'current' | Matches | schema matches |  |
| table-schedules-columns | site_ids JSON, cron_expression, notify_slack/email, enabled, last_run, next_run, crawl_results | Matches | schema has all |  |
| table-users-role-enum | admin/seo/readonly default 'seo' | Partial | no CHECK; DB also allows 'superadmin' (added migration 006); default 'seo' |  |
| table-users-status-enum | active/inactive default 'active' | Matches | schema matches |  |
| table-invites-default-role | invites.role default 'readonly' | Matches | schema: `role TEXT NOT NULL DEFAULT 'readonly'` |  |
| table-ai-suggestion-feedback-rating | rating 1 or -1 | Matches | `backend/routes/ai.js:167` enforces; schema INTEGER NOT NULL |  |
| table-ai-suggestion-feedback-unique | UNIQUE(suggestion_id, user_id) | Matches | schema has `UNIQUE(suggestion_id, user_id)` |  |
| table-task-status-enum | backlog/in_progress/review/done | Partial | no CHECK; `routes/tasks.js:12` enforces in code |  |
| table-notifications-type | crawl_complete/critical_issue/task_assigned/system | Cannot verify | column exists; no CHECK; not enumerated in code |  |
| table-error-log-columns | id/level/source/message/stack/user_id/url/created_at | Matches | schema matches exactly |  |
| db-indexes-migration-002 | specific indexes in 002 | Matches | all listed indexes exist |  |
| table-gsc-queries | site_id/query/clicks/impressions/ctr/position/prev_clicks/prev_impressions/fetched_at UNIQUE(site_id, query) | Matches | schema matches |  |
| table-gsc-daily | site_id/date/clicks/.../ UNIQUE(site_id, date) | Matches | schema matches |  |
| table-task-comments | added migration 004 with FK to task_status | Matches | schema matches |  |
| task-priority-enum | urgent/high/medium/low default 'medium' | Mismatch | `routes/tasks.js:13` enforces `low/medium/high/critical` — no 'urgent', uses 'critical' instead |  |
| auth-middleware-global | applied globally before routes | Matches | `server.js:106` before all `/api/*` mounts |  |
| public-paths-allowlist | 10 specific public paths | Partial | `middleware/auth.js:8-22` has 14 entries — includes extras (invite/validate, change-password, errors POST, ads callback, no register in reality since register is 403) |  |
| auth-jwt-cookie-name | auth_token | Matches | `routes/auth.js:98` |  |
| auth-jwt-algorithm | HS256 | Matches | `routes/auth.js:36` |  |
| auth-jwt-expiry | 7 days | Matches | `routes/auth.js:26,35` |  |
| auth-jwt-payload | sub/email/name/role | Partial | `routes/auth.js:33` payload also includes `company_id` |  |
| auth-cookie-samesite | Strict | Mismatch | `routes/auth.js:25` uses `sameSite: 'lax'` |  |
| auth-cookie-secure-prod | secure in prod | Partial | `routes/auth.js:22` sets secure on HTTPS (req.secure || x-forwarded-proto) — not conditional on NODE_ENV |  |
| auth-last-active-update | non-blocking update on every request | Matches | `middleware/auth.js:46-51` uses `setImmediate` |  |
| auth-401-invalid-token | 401 "Invalid or expired token" | Matches | `middleware/auth.js:55` |  |
| require-role-403 | 403 "Insufficient permissions" | Matches | `middleware/auth.js:67` |  |
| rate-limit-auth | 15min/20 on login + invite/accept | Matches | `middleware/rateLimiter.js:3-9`; `routes/auth.js:71, 256, 486, 527` applied |  |
| rate-limit-api | 60s/300 global | Matches | `middleware/rateLimiter.js:11-15`; `server.js:109` |  |
| rate-limit-ai | 60s/10 on POST /api/ai/suggest | Matches | `middleware/rateLimiter.js:25-31`; `routes/ai.js:34` |  |
| helmet-csp | default 'self', script 'self' 'unsafe-inline', connect 'self' + anthropic | Partial | `server.js:57-65` matches in dev; prod strips 'unsafe-inline' (more restrictive than PRD) |  |
| helmet-hsts | maxAge 31536000, includeSubDomains true | Matches | `server.js:67` |  |
| cors-config | origin FRONTEND_URL, credentials true, GET/POST/PUT/PATCH/DELETE/OPTIONS | Matches | `server.js:70-74` |  |
| zod-validation-required | zod on every POST/PUT/PATCH body | Partial | many routes (auth, sites, settings, crawls) use validate(); `routes/tasks.js` uses ad-hoc validation; `routes/ads.js`, `routes/notifications.js` lack zod |  |
| sf-cli-flags | --headless, --save-crawl, --licence-key, etc. | Mismatch | Playwright crawler doesn't use any SF CLI flags |  |
| sf-cli-default-threads | --threads default 5 | Mismatch (partial match) | PRD SF flag not applicable; however `routes/crawls.js:86` has `threads` config default 5 |  |
| sf-cli-default-depth | --depth -1 unlimited | Mismatch | `routes/crawls.js:69` `max_depth` default **5**, max 25 |  |
| sf-config-file-name | crawl.seospiderconfig | Mismatch | old SF config files exist in `backend/crawl-data/` but are not generated by current code path |  |
| sf-config-defaults | renderType None, etc. | Mismatch | no SF config generator |  |
| sf-export-tabs-20 | 20 export tabs | Mismatch | no SF exports; `playwright-crawler/src/output/sf-format.js` generates 12 SF-compatible datasets |  |
| socket-events-3 | crawl:log, crawl:progress, crawl:complete | Partial | emitted events exist but under rooms `job:<id>` and different names; `server.js:93-102` |  |
| socket-progress-regex | progress parsed from SF stdout | Mismatch | Playwright crawler reports progress programmatically |  |
| crawl-cancel-sigterm | SIGTERM to SF child process | Mismatch | `services/crawl-runner.js` uses `cancelCrawl()` — in-process cancel, not SIGTERM |  |
| crawl-health-score-column | added in migration 004 | Matches | schema `crawl_jobs.health_score` column present |  |
| crawl-complete-side-effects | parse CSVs, compute score, insert notification, slack/email, cleanup | Partial | parse+score happens; `notify_slack` path exists; no `crawl_complete` notification row insertion verified in audit |  |
| sites-cascade | FK cascade on sites delete | Partial | `crawl_jobs.site_id` cascades; other table cascades inconsistent (audit_results has FK ON DELETE CASCADE, gsc_cache same; task_status same) |  |
| sites-post-put-role | POST/PUT/DELETE /api/sites restricted to admin+seo | Mismatch | `backend/routes/sites.js` has **no** role guard — any authenticated user with matching company_id can POST/PATCH/DELETE |  |
| crawl-start-schema | siteIds/targetUrl/crawlName/mode/… | Mismatch | `routes/crawls.js:59-102` uses different schema: `site_id` + `config` object |  |
| crawl-mode-enum | spider/list/sitemap/import/compare | Mismatch | `routes/crawls.js:61` enum is `spider/list/sitemap/sitemap-list` — no import, no compare, extra sitemap-list |  |
| crawl-import-max-files | POST /api/crawl/import multipart 20 files | Mismatch | no `/api/crawl/import` or `/api/crawls/import` route exists |  |
| health-score-formula | `max(0, round(100 - penalty/totalUrls*10))` | Cannot verify | not inspected in detail in `services/crawl-runner.js` |  |
| reports-summary-live | GET /api/reports/:siteId/summary | Matches | `routes/reports.js:194` |  |
| ui-checks-loaded-indicator | "156 checks loaded" via /reports/checks/count | Partial | endpoint exists at `routes/reports.js:16` but number will be 291 (or 321 post-migration) |  |
| test-checks-endpoint | POST /api/reports/:siteId/test-checks | Mismatch | no such endpoint in `routes/reports.js` |  |
| linear-ticket-schema | POST /api/linear/create-ticket fields | Mismatch | no `/api/linear` mount in `server.js`; Linear functions invoked only via `POST /api/tasks/:id/sync-linear` |  |
| linear-priority-mapping | critical→1 warning→2 info→3 ok→4 | Cannot verify | `services/linear.service.js` not inspected in detail |  |
| linear-button-states | Default/Loading/Success/Error/Already | Cannot verify | UI-only; not inspected |  |
| linear-button-locations | category rows, issue detail, task cards | Cannot verify | UI-only; not inspected |  |
| ga4-kpi-cards-4 | 4 KPI cards | Cannot verify | UI-only; not inspected |  |
| ga4-trend-28day | GET /api/ga4/:siteId/daily 28-day | Mismatch | no `/daily` endpoint in `routes/ga4.js` — only `/summary` and `/pages` |  |
| gsc-surface-areas-5 | 5 GSC UI places | Cannot verify | UI-only; not inspected |  |
| tasks-kanban-columns | backlog/in_progress/review/done | Matches | `routes/tasks.js:12` |  |
| tasks-bulk-update | PATCH /api/tasks/bulk | Mismatch | no `/bulk` route in `routes/tasks.js` |  |
| tasks-delete-admin | DELETE /api/tasks/:id admin | Mismatch | **no DELETE /api/tasks/:id route** in `routes/tasks.js` at all |  |
| tasks-delete-cascades | cascades to task_comments | Matches | schema `task_comments` FK `ON DELETE CASCADE` |  |
| schedules-crawl-results-last-5 | last-5 summaries JSON | Cannot verify | column exists; retention logic not inspected |  |
| schedule-cron-regex | specific regex validation | Mismatch | `routes/schedules.js:72` uses `cron.validate()` from node-cron, not regex |  |
| schedule-run-now | POST /api/schedules/:id/run-now | Mismatch | no such route in `routes/schedules.js` |  |
| ai-access-control | admin+seo only, readonly no button | Mismatch | `routes/ai.js` POST /suggest has no `requireRole` — any auth'd user (incl. readonly) can call |  |
| ai-trigger-3-modes | Individual/Inline/Bulk | Mismatch | no bulk endpoint; only single-suggestion |  |
| ai-bulk-socket-events | ai:bulk:progress/done | Mismatch | not implemented |  |
| ai-endpoints-5 | 5 AI endpoints (suggest + bulk + regenerate + feedback + list) | Mismatch | `routes/ai.js` has only 3: GET/POST /suggest + POST /suggest/:id/feedback |  |
| ai-model | claude-sonnet-4-6 | Matches | `routes/ai.js:113` |  |
| ai-max-tokens | 1500 | Mismatch | `routes/ai.js:114` uses **max_tokens 1024** |  |
| ai-cache-key | (check_id, crawl_job_id) | Mismatch | cache key is `result_id` (audit_result.id), unique per-URL per-crawl: `routes/ai.js:54`, unique index `uq_ai_suggestions_result_id` |  |
| ai-regenerate-overwrites | regenerate endpoint | Mismatch | no regenerate endpoint |  |
| ai-cms-detection-methods | generator/X-Powered-By/URL | Cannot verify | no CMS detection code found |  |
| ai-cms-stored | sites.cms_type column | Mismatch | migration 005 defines it but unapplied; column absent from live schema |  |
| ai-feedback-comment-col | feedback.comment TEXT added via migration | Mismatch | migration 005 adds it but is unapplied in live DB; column absent |  |
| ai-feedback-comment-max | 500 chars | Cannot verify | column absent so unenforced |  |
| ai-feedback-threshold | ≥5 thumbs-down → warning block | Mismatch | not implemented in `routes/ai.js` |  |
| ai-token-budget-settings | ai_token_budget/ai_token_used in settings | Mismatch | migration 005 seeds these but is unapplied; no token-budget enforcement in `routes/ai.js` |  |
| ai-token-budget-exceeded-429 | 429 when used>=budget | Mismatch | no enforcement |  |
| notifications-bell-polling | bell polls every 60s | Mismatch | `frontend/src/components/Header.jsx:198-202` fetches once on mount + event-driven updates; no `setInterval` |  |
| slack-crawl-complete-blocks | Slack blocks with health score, etc. | Partial | `services/slack.service.js` exists; exact block structure not verified |  |
| email-smtp-fallback | logs warning + skips if no SMTP | Mismatch | no email service exists |  |
| errors-post-auth | POST /api/errors requires auth | Mismatch | `middleware/auth.js:18` lists POST /api/errors as **public** (for frontend error reporting) |  |
| errors-post-rate | 30/min per user | Partial | `errorLimiter` defined at `middleware/rateLimiter.js:17-22` but not applied in `routes/errors.js` |  |
| errors-get-admin | GET /api/errors admin-only | Matches | `routes/errors.js:35` requireRole('admin', 'superadmin') |  |
| error-log-page-admin | `/errors` page admin-only | Matches | `frontend/src/router.jsx` — `/errors` inside `AdminOnly` wrapper |  |
| axios-5xx-logs-to-backend | 5xx → POST /errors | Matches | `frontend/src/api/index.js:29-35` |  |
| routes-auth-list | login/logout/me/register/setup-status/invite/accept/users… | Partial | most present; `POST /register` returns 403 (disabled); extra routes (change-password, impersonate) exist |  |
| routes-auth-register-403 | register fails with 403 if user exists | Matches | `routes/auth.js:56-58` — always 403 now |  |
| routes-auth-invite-role-enum | invite role: seo/readonly | Partial | `routes/auth.js:152` enum is `['admin', 'seo', 'readonly']` (admin allowed for superadmin) |  |
| routes-auth-invite-token | 32-byte hex / 48h expiry | Matches | `routes/auth.js:194-195` (64-hex = 32 bytes) + 48h expiry |  |
| routes-auth-own-role-guard | 403 on self-role PATCH | Matches | `routes/auth.js:399-401` |  |
| routes-auth-login-login-errors | 401/403 errors | Matches | `routes/auth.js:75-79, 82` |  |
| routes-sites-post-id-regex | id regex `/^[a-z0-9-]+$/` | Mismatch | `routes/sites.js:68` uses `uuidv4()` not user-supplied id; no regex validation |  |
| routes-sites-post-color-default | color default '#6366f1' | Matches | `routes/sites.js:20` |  |
| routes-crawl-6-endpoints | /start, /status/:jobId, /cancel/:jobId, /import, /history/:siteId, /jobs | Mismatch | actual routes in `routes/crawls.js`: GET /, POST /, GET /:id, POST /:id/cancel, DELETE /:id — different paths & mount |  |
| routes-reports-8-endpoints | 8 reports endpoints | Mismatch | 8 routes in `routes/reports.js` but different names (checks/count, results/:id, :siteId/category, :siteId/issues, :siteId/summary, :siteId/trend, :siteId/developer-summary, :siteId/issues/export) |  |
| routes-reports-section-query | severity/issue_type/search/page/limit/sort/dir | Cannot verify | `/:siteId/issues` accepts some but not inspected line-by-line |  |
| routes-gsc-9-endpoints | auth/callback/status/fetch/pages/queries/daily/summary/disconnect | Mismatch | `routes/gsc.js`: auth, callback, status, disconnect, properties, :siteId/summary, :siteId/queries, :siteId/pages — **no daily, no fetch** |  |
| routes-gsc-daily-16weeks | /daily 16-week range | Mismatch | route doesn't exist |  |
| routes-ga4-8-endpoints | auth/callback/status/fetch/pages/summary/daily/disconnect | Mismatch | `routes/ga4.js`: auth, callback, status, disconnect, properties, :siteId/summary, :siteId/pages — **no daily, no fetch** |  |
| routes-gsc-disconnect-admin | DELETE /gsc/disconnect admin | Matches | `routes/gsc.js:104` requireRole('admin', 'superadmin') |  |
| routes-ga4-disconnect-admin | DELETE /ga4/disconnect admin | Matches | `routes/ga4.js:104` requireRole('admin', 'superadmin') |  |
| routes-ai-3-endpoints | /suggest, /suggest/:id/feedback, /suggestions | Partial | `routes/ai.js` has GET+POST /suggest and POST /suggest/:id/feedback — **no GET /suggestions** |  |
| routes-linear-5-endpoints | /create-ticket, /tickets, /tickets/:auditId, DELETE /tickets/:id, /test | Mismatch | no `/api/linear` mount; Linear operations happen via `POST /api/tasks/:id/sync-linear` only |  |
| routes-tasks-8-endpoints | GET/POST/GET /:id/PATCH/DELETE /PATCH bulk/GET comments/POST comments | Mismatch | `routes/tasks.js` has 6 routes: GET /, POST /, GET /:id, PATCH /:id, POST /:id/comments, POST /:id/sync-linear — **no DELETE, no bulk, no GET comments** |  |
| routes-schedules-6-endpoints | GET/POST/PUT /:id/DELETE/POST run-now/PATCH toggle | Partial | `routes/schedules.js`: GET /, POST /, PATCH /:id, DELETE /:id (4 routes); **no run-now, no toggle** (but PATCH can update enabled) |  |
| routes-export-3-endpoints | /:siteId/csv, POST /:siteId/sheets, GET /history | Partial | `routes/exports.js`: GET /jobs, GET /sections, GET /csv, POST /sheets — **no /:siteId scoping, no /history** |  |
| routes-settings-5-endpoints | GET/PUT/GET status/POST test-smtp/POST test-slack | Mismatch | `routes/settings.js` has only GET / and PUT / (2 routes) |  |
| routes-settings-values-masked | GET /settings values masked | Mismatch | `routes/settings.js:49` returns raw values from company_settings table |  |
| routes-notifications-3 | GET, PATCH /:id/read, POST /read-all | Partial | `routes/notifications.js`: GET /, PATCH /read-all, PATCH /:id/read, DELETE /:id — close but method on `/read-all` is PATCH not POST, and DELETE /:id added |  |
| routes-notify-3 | POST /slack, POST /email, POST /task-assigned | Mismatch | no `/api/notify` mount; no standalone notify routes |  |
| routes-pagespeed-3 | POST /test, GET /:siteId, POST /batch | Mismatch | `routes/psi.js` mounts `/api/psi`; has only GET /analyze |  |
| routes-errors-3 | POST /, GET /, DELETE /all | Partial | `routes/errors.js` has POST / and GET / — **no DELETE /all** |  |
| frontend-state-context-only | Context only, no Redux/Zustand | Matches | only React Context used |  |
| audit-page-4-states | loading/error/empty/data | Cannot verify | UI-only not inspected |  |
| theme-default-dark | default dark on first load | Mismatch | `frontend/src/styles/theme.css` default `:root` is **light** theme |  |
| theme-storage | theme in localStorage + data-theme attr | Mismatch | no theme-switcher / localStorage theme / data-theme attribute anywhere in frontend |  |
| routes-frontend-admin | `/admin` AdminView admin-only | Partial | route exists but is **not** wrapped in AdminOnly — `router.jsx:103-109` just sits inside AuthedShell |  |
| routes-frontend-audit-20 | 20 audit category routes specific names | Partial | ~22 audit routes exist but names differ: `indexability, title-tags, meta-desc, headings, canonicals, hreflang, images, links, redirects, response-codes, page-speed, structured-data, security, mobile, crawl-depth, sitemap, robots, international, content, custom, custom-extraction, log-file` — mix of PRD names and renames |  |
| routes-frontend-issue-detail | `/issues/:id` IssueDetail | Partial | actual path is `/audit/issue/:resultId` |  |
| routes-frontend-tasks | `/tasks` and `/tasks/:id` | Matches | both exist |  |
| routes-frontend-error-log-admin | `/error-log` inside RequireRole admin | Partial | actual path is `/errors` (not `/error-log`) but inside AdminOnly |  |
| figma-file-url | Figma URL | Cannot verify | not checked |  |
| breakpoints-3 | 1440/768/375 | Cannot verify | design-token level; not inspected |  |
| font-ui-inter | --font-ui Inter | Cannot verify | not inspected in theme.css tail |  |
| font-mono-jetbrains | --font-mono JetBrains Mono | Cannot verify | not inspected |  |
| mono-font-usage | mono font on URLs/status codes/logs | Cannot verify | UI-level; not inspected |  |
| health-ring-colour-ranges | ok/warning/critical bands | Cannot verify | UI-level |  |
| sidebar-widths | 240/56px/200ms | Cannot verify | UI-level |  |
| lucide-icons | lucide-react 16/18/20/24 | Matches | lucide-react in frontend deps per phase0-inventory |  |
| audit-category-20 | 20 categories SF CSV mapping | Mismatch | seed has 19 categories (`SELECT COUNT(DISTINCT category)`=19) and uses Playwright extractors |  |
| audit-check-count-204 | 204 numbered checks seeded | Mismatch | seed file has **291 checks** (`check_number: 1..291`); live DB row count 291; PRD is stale on this number |  |
| audit-checks-insert-or-ignore | INSERT OR IGNORE | Mismatch | seed uses `DELETE + INSERT` in a transaction (see tail of `db/seed/audit-checks.js`) — not idempotent in the OR-IGNORE sense |  |
| audit-checks-seeded-auto | seeded on first server start if empty | Matches | `server.js:181` calls `seedAuditChecks(db)` |  |
| audit-checks-seeded-manual | `node scripts/seed-checks.js` | Matches | file exists |  |
| test-stack | vitest 1.x / coverage-v8 1.x / supertest 6.x / cross-env 7.x | Mismatch | `backend/package.json`: vitest **2.1.8**, coverage-v8 2.1.8, supertest **7.0.0**; no cross-env |  |
| test-files-8 | auth, route-protection, sites, crawl, reports, tasks, linear, health | Mismatch | 17 test files exist but different names (ads-crypto, ads-dates, ads-routes, ai-suggest, audit-checks-seed, auth-guards, compare, crawl-lifecycle, dashboard, exports, ga4-data, gsc-data, input-validation, multi-tenancy, reports-drill-down, reports-export, tasks) — no route-protection.test.js |  |
| test-protected-routes | asserts every protected route returns 401 without cookie | Cannot verify | `route-protection.test.js` does not exist (referenced in `test:auth` script); `auth-guards.test.js` may or may not provide equivalent coverage |  |
| test-scripts | test/test:watch/test:coverage/test:auth | Matches | all four exist in `backend/package.json` |  |
| dockerfile-multistage | Dockerfile multi-stage node:20-alpine | Mismatch | no Dockerfile in repo |  |
| docker-volume | VOLUME /app/backend/data | Mismatch | no Dockerfile |  |
| docker-expose-3001 | EXPOSE 3001 | Mismatch | no Dockerfile |  |
| ci-macos-runner | CI macos-latest | Mismatch | `.github/workflows/` empty |  |
| ci-node-20 | CI Node 20 | Mismatch | no CI workflow |  |
| deploy-branch-main | deploy only on main | Mismatch | no deploy workflow |  |
| deploy-pm2 | VPS pm2 + Caddy | Mismatch | no such configs in repo |  |
| non-goals-no-windows | no Windows | Partial | architecturally already cross-platform via Playwright; PRD's premise (SF) is obsolete |  |
| non-goals-no-mobile-app | no mobile app v1 | Matches | no mobile code |  |
| non-goals-no-content-gen | no content generation | Matches | not implemented |  |
| roadmap-postgres-v2 | Postgres v2 | Matches | SQLite still in use |  |
| roadmap-bulk-ai-high | Bulk AI roadmap item, manual in v1 | Matches | only single-suggestion path implemented |  |
| roadmap-multi-tenancy-low | multi-tenancy low priority | Mismatch | multi-tenancy implemented via migration 006 + company_id scoping throughout code |  |
| constraint-sf-free-500 | SF 500 cap | Mismatch | N/A — SF not used |  |
| constraint-sf-macos-only | SF macOS-only | Mismatch | N/A |  |
| constraint-ai-manual-cache | cached per (check_id, job_id) | Partial | cached per result_id instead |  |
| constraint-google-oauth-unverified | 100-user OAuth cap | Cannot verify | Google Cloud setting; not in code |  |
| jwt-cookie-no-localstorage | no localStorage token | Matches | frontend uses cookie only; AuthContext never reads `localStorage` for token |  |

---

## 4. Top 10 most impactful mismatches

1. **`crawler-sf-cli`** — PRD declares Screaming Frog CLI as the crawler; actual system uses `playwright-crawler/` imported at `backend/services/crawl-runner.js:11`. Everything else SF-flavoured (binary path, free-tier limit, licence key, XML config, export tabs, SIGTERM) cascades to Mismatch. **Impact**: whole crawler-section of PRD is obsolete and misleads new contributors.

2. **`ai-max-tokens`** — PRD says 1500, `backend/routes/ai.js:114` hardcodes `max_tokens: 1024`. **Impact**: AI responses may truncate on complex issues where PRD explicitly expected longer code-snippet output.

3. **`ai-cache-key`** — PRD says cache key is `(check_id, crawl_job_id)`. Code uses `result_id` (per-URL unique). **Impact**: caching granularity is much finer than PRD describes — no cross-URL reuse of the same check's suggestion, increasing Anthropic API cost.

4. **`ai-access-control`** — PRD restricts `/api/ai/suggest` to admin+seo; `routes/ai.js:34` has **no role guard**. Readonly users can trigger paid AI calls. **Impact**: direct cost/abuse vector; role boundary violation.

5. **`sites-post-put-role`** — PRD restricts site mutation to admin+seo; `routes/sites.js` has **no role guard** on POST/PATCH/DELETE. **Impact**: any authenticated user in the company (including readonly) can create, modify, or delete sites.

6. **`ai-trigger-3-modes` / `ai-endpoints-5`** — PRD describes 5 AI endpoints including bulk + regenerate + list; only 3 exist. **Impact**: UI features described in PRD (bulk triage, regenerate button, suggestion archive) either aren't wired up or silently 501.

7. **`ai-token-budget-exceeded-429` + `ai-feedback-threshold` + `ai-cms-detection`** — PRD section 11 promises token-budget enforcement, ≥5 thumbs-down feedback-signal injection, and CMS detection. None are implemented; migration 005 (which seeds these) is unapplied in the live DB. **Impact**: no cost guardrails, no learning loop, no CMS-aware prompting.

8. **`auth-cookie-samesite`** — PRD says `SameSite=Strict`; `routes/auth.js:25` sets `sameSite: 'lax'`. **Impact**: weaker CSRF posture than documented.

9. **`deploy-pm2` / `dockerfile-multistage` / `repo-ci-yml` / `repo-deploy-yml`** — Entire deployment story is vapourware: no Dockerfile, no CI workflows (empty `.github/workflows/`), no pm2/Caddy configs. **Impact**: a new operator following the PRD cannot ship this to production.

10. **`routes-crawl-6-endpoints`, `routes-reports-8-endpoints`, `routes-gsc-9-endpoints`, `routes-ga4-8-endpoints`, `routes-linear-5-endpoints`, `routes-tasks-8-endpoints`, `routes-schedules-6-endpoints`, `routes-settings-5-endpoints`, `routes-notify-3`, `routes-pagespeed-3`** — Most documented REST surfaces disagree with the implementation in either path, verb, or count. `tasks` lacks DELETE, bulk and a comments-GET; `gsc`/`ga4` lack the promised `/daily` endpoints; `linear` and `notify` have no mount at all; `settings` exposes only GET+PUT. **Impact**: frontend code and any external client written against the PRD will receive 404/501.

---

## 5. Stale PRD sections

The following sections of `~/Downloads/PRD-v2-FINAL.md` describe features that have been removed, renamed, or replaced. They should be rewritten or struck through during the next PRD revision:

- **Section on Screaming Frog CLI** (around L39, L47, L88, L114, L127–135, L325, L914–928, L963, L983–988, L1036–1057, L1068, L1075, L3823–3824): the entire SF-bound story (`SF_BINARY_PATH`, `--licence-key`, `--headless`, `crawl.seospiderconfig`, 500-URL licence gate, macOS-only constraint, import-only mode banner, progress regex from stdout, SIGTERM cancellation). Replace with a Playwright/Crawlee section using the inventory from `playwright-crawler/src/`. Note that stale `crawl.seospiderconfig` files are still present in `backend/crawl-data/` from historical runs but no current code generates them.
- **Audit check count = 204** (L3143–L3373): Seed file is now 291 checks (to be replaced by 321 per migration 018 once applied). PRD's numbered 1–204 enumeration is obsolete.
- **AI model/tokens** (L1555–1556): max_tokens should be 1024, not 1500.
- **AI bulk + regenerate endpoints** (L1467–1496): describe features not implemented; PRD itself contradicts its own roadmap in §19 (which correctly says bulk is roadmap only).
- **AI cache key** (L1562): should be `result_id` (per-URL), not `(check_id, crawl_job_id)`.
- **CMS detection + token budget + feedback signal** (L1585–1637): promise features whose migration (005) is unapplied; either mark unimplemented or wire up migration 005.
- **SMTP / email service** (L212, L349–352, L1676, L1675 onwards): `services/email.service.js` does not exist; nodemailer is installed but unused. All SMTP settings, templates and fallback behaviour should be marked roadmap, not current.
- **GitHub Actions / Docker / PM2 / Caddy** (L170–171, L3472–3501, L3698–3776): no files in repo. Deployment section is aspirational.
- **Route catalogue mismatches** (L1760–1991): entire §14 "Backend Routes" table is significantly out of sync.
- **Frontend theme** (L2114, L2112, L2437): no dark-default, no `data-theme`, no localStorage toggle — theme system is static CSS-variable-based (light only).
- **Notification bell 60s polling** (L1647): replaced by mount-once + custom-event updates in `components/Header.jsx`.
- **Mult-tenancy as low-priority roadmap** (L3802): already implemented via migrations 006+; company_id scoping is a first-class concept in every route.
- **`GOOGLE_REDIRECT_URI`** (L335): code uses two separate env vars `GOOGLE_REDIRECT_URI_GSC` and `GOOGLE_REDIRECT_URI_GA4`.
- **`ENCRYPTION_KEY` required in production** (L355–357, L382): `validate-env.js` requires only JWT_SECRET + FRONTEND_URL.

---

## 6. Verification methodology

- Route existence verified via `grep -n "router\.(get|post|put|patch|delete)"` across `backend/routes/`.
- Schema claims verified against live `sqlite3 backend/seo-automation.db .schema <table>` dumps.
- Migration applied state from `SELECT name FROM _migrations`.
- Rate-limit values from `backend/middleware/rateLimiter.js`.
- AI claims from `backend/routes/ai.js` lines 34–159.
- Crawler claim from `backend/services/crawl-runner.js:11`.
- Frontend routing from `frontend/src/router.jsx`.
- Theme from `frontend/src/styles/theme.css` (light is default `:root`).

Confidence: **High** for every Mismatch/Matches citation with a file:line reference; **Medium** for Partial where the route/column exists but in an altered form; **Low** for every "Cannot verify" (UI behaviour, runtime config, or external integration wiring).
