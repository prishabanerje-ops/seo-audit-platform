# Audit Action Plan — Prioritised

Each item: **ID** · description · effort · risk-if-skipped.

Effort scale: S = <2h, M = 2–8h, L = 1–3d, XL = 3+d.

---

## Sprint 0 — Bleeding stop (must ship before next external demo)

| # | ID | Action | Effort | Risk if skipped |
|---|---|---|---|---|
| 1 | SEC-C6 | Add `requireRole('admin','seo','superadmin')` to `POST /api/ai/suggest` ([backend/routes/ai.js:34](backend/routes/ai.js#L34)) | S | readonly users can burn your Anthropic budget |
| 2 | SEC-C7 | Add `requireRole('admin','superadmin')` to sites POST/PATCH/DELETE ([backend/routes/sites.js:62,91,113](backend/routes/sites.js#L62)) | S | any tenant user can delete sites |
| 3 | SEC-H8 / ARCH-H2 | Authenticate Socket.io via `io.use`; validate `join:company`/`join:job` | M | cross-tenant real-time data leak |
| 4 | DEP-H1 / DEAD-2 | Remove `nodemailer` from `backend/package.json` (unused + HIGH CVE) | S | 1 high + 1 moderate CVE open |
| 5 | DEAD-1 | Remove `multer` from `backend/package.json` (unused, no upload endpoints) | S | unnecessary attack surface |
| 6 | SEC-H1 | Switch `PUBLIC_PATHS` match to exact (or regex) in [backend/middleware/auth.js:33–35](backend/middleware/auth.js#L33-L35) | S | future route mistake = auth bypass |
| 7 | SEC-H6 | Apply `errorLimiter` to `POST /api/errors` ([backend/routes/errors.js:18](backend/routes/errors.js#L18)) | S | log-flooding DoS vector |
| 8 | SEC-H2 | Enforce `JWT_SECRET.length >= 64` in [backend/validate-env.js](backend/validate-env.js) | S | weak secret = token forgery |
| 9 | CONFIG-1 | Replace hardcoded `'http://localhost:3001'` in [frontend/src/pages/AdsDashboard.jsx:561](frontend/src/pages/AdsDashboard.jsx#L561) with `import.meta.env.VITE_SOCKET_URL` | S | feature broken in every non-local deploy |
| 10 | PERF-H1 | Fix N+1 in schedule validation (batch IN-list query in [backend/routes/schedules.js](backend/routes/schedules.js)) | M | slow admin UI under realistic load |

**Total effort:** ~1.5 engineer-days.

---

## Sprint 1 — Secrets & OAuth hardening

| # | ID | Action | Effort | Risk |
|---|---|---|---|---|
| 1 | SEC-C1 | Encrypt GSC + GA4 OAuth tokens at rest using `ads.crypto` — add migration to re-encrypt existing rows | L | DB leak = Google account compromise |
| 2 | SEC-C2 | Same for Linear API key, Slack webhook URL, PSI key, Anthropic key (wherever stored in `company_settings`/`settings`). Introduce `services/secret-store.js` | L | DB leak = external-account compromise |
| 3 | SEC-C3 | Server-bind OAuth state for GSC/GA4 (copy `ad_oauth_state` pattern from `backend/services/ads.service.js:39–53`) | M | OAuth replay/forgery |
| 4 | SEC-C4 / SEC-C5 | SSRF guard: private-IP + DNS-pin helper; apply in [backend/services/crawl-runner.js](backend/services/crawl-runner.js) and [backend/services/sitemap-fetcher.js](backend/services/sitemap-fetcher.js); tighten `sitemap_url` Zod validation | M | internal-network/cloud-metadata scan |
| 5 | SEC-H3 | Block admin→admin promotion in [backend/routes/auth.js:394](backend/routes/auth.js#L394) PATCH | S | admin privilege proliferation |
| 6 | SEC-H4 | Add `users.password_version`; include in JWT claim; reject on change-password | M | stolen token survives password reset |
| 7 | SEC-H5 | Refuse to seed admin/superadmin without explicit `SEED_*_PASSWORD` env; random-generate otherwise | S | known default creds in public repo |

**Total effort:** ~4 engineer-days.

---

## Sprint 2 — Architecture cleanups with quick wins

| # | ID | Action | Effort | Value |
|---|---|---|---|---|
| 1 | DRY-H1 | `requireSiteAccess(req, res, next)` middleware — replaces 16 inlined blocks | M | reduces reports.js LOC ~15%; one place to fix authz |
| 2 | DRY-H2 | `getLatestCompletedJob(siteId)` helper — replaces 6 copies in reports.js | S | correctness: all endpoints agree on "latest" |
| 3 | DRY-H3 | `getEnrichedTaskById(id)` helper — replaces 5 copies in tasks.js | S | simplifies tasks.js |
| 4 | ARCH-H4 | `ApiError` class + `res.apiError(code, status)` helper — unify error envelope | M | consistent frontend error handling |
| 5 | ARCH-M3 | Wrap `sync-linear`, `invite/accept`, `users/create` multi-step writes in `db.transaction()` | S | data-integrity guarantees |
| 6 | CONFIG-6 | Create `backend/config/index.js` using the skeleton in `phase5-8-findings.md`; migrate callers | L | configurable rate limits / model / defaults without code edits |
| 7 | CONFIG-2 | Add `frontend/src/config.js` (wraps `import.meta.env`); audit all `localhost` references | S | no-surprise prod builds |

**Total effort:** ~3 engineer-days.

---

## Sprint 3 — File-size refactors (staged)

Not a single PR — tackle in order of gain. See `phase4-filesize-refactor.md` for exact split plans.

| Batch | Files | Effort | Why this order |
|---|---|---|---|
| 3a | `components/CrawlConfigPanel.jsx` (687) + `backend/routes/auth.js` (629) | L | Unblocks DRY-M4 (shared crawl defaults); auth is read most often |
| 3b | `frontend/src/pages/IssueDetail.jsx` (893) + `AdsDashboard.jsx` (798) | L | Biggest single files; `useAiStream` hook will be reused |
| 3c | `frontend/src/pages/ScheduledCrawls.jsx` (704) + `Companies.jsx` (577) + `AuditHealth.jsx` (556) + `AuditCategory.jsx` (541) | XL | Makes reports workflow maintainable |
| 3d | `backend/routes/reports.js` + `services/audit-parser.service.js` | L | Extracts `health-score.js` and per-section parsers |
| 3e | Remaining 18 frontend files 250–500 LOC | XL | Long tail; one per day |

**Total effort:** 6–10 engineer-days over 2–3 weeks.

---

## Sprint 4 — Test coverage + dependency maintenance

| # | ID | Action | Effort |
|---|---|---|---|
| 1 | TEST-M1 / SEC-M9 | Move tests off the production DB — use `DB_PATH=:memory:` or per-test `test-*.db` | M |
| 2 | TEST-H2 | Add integration tests for `crawl-runner`, `audit-parser`, `sitemap-fetcher`, `linear.service`, `slack.service` | L |
| 3 | TEST-M3 | Add Socket.io room-isolation test (authenticated client can/can't join foreign room) | S |
| 4 | TEST-H1 | Add vitest + testing-library to `frontend/`; first test: `Auth` + `Sites` context happy paths | M |
| 5 | DEP-M1 | Upgrade backend `vitest` to 4.x (semver major) — closes vitest/vite/esbuild CVEs | M |
| 6 | DEP-M2 / DEP-M3 | `npm audit fix` in frontend + crawler; validate build still works | S |
| 7 | DEP-L1 | Consolidate crawler tests onto vitest (remove jest dependency) | S |

**Total effort:** ~4 engineer-days.

---

## Sprint 5+ — Longer-term

| Theme | Description | Effort |
|---|---|---|
| Repository layer | `backend/repos/*` per table; routes call repos, not `db.prepare` directly | XL (2–3 sprints) |
| Dependency majors | React 18 → 19, Vite 6 → 8, Express 4 → 5, bcryptjs 2 → 3 — each is its own migration PR | XL (one per sprint) |
| PRD reconciliation | Update `~/Downloads/PRD-v2-FINAL.md` — remove SF chapter, fix max_tokens, fix claims about dark theme default, CI, promised services | M |
| Unapplied migrations | Decide on 005 + 018. Apply or delete | S |
| Lint + typecheck | Add ESLint config + `tsc --noEmit` to CI (enables future auto-fix runs) | M |
| Frontend env | Ship `.env.example`, document `VITE_API_BASE` / `VITE_SOCKET_URL` | S |
| ads-dashboard/ | Decide: integrate into main frontend or delete. Currently unreferenced standalone app with mock data only | M |
| `.worktrees/audit-phase2/` | Review — is the worktree active work or abandoned? | S |

---

## Items explicitly deferred (acknowledged low-ROI)

- SEC-L1..L10: no CSRF exposure today, SameSite+CORS+httpOnly already in place; small items are optional polish.
- PRD-M10 (321 vs 291 checks): informational only; reconcile once migrations 005/018 are resolved.
- Mixed Indian-locale formatters in `ads-dashboard/`: fine for a domestic product; re-evaluate if you ever internationalise.

---

## One-page cheat sheet

```
CRITICAL NOW (< 2 days total):
  ai.js:34     add requireRole
  sites.js     add requireRole to mutations
  server.js:92 auth the socket.io connection
  package.json remove nodemailer + multer
  auth.js:33   exact match PUBLIC_PATHS
  errors.js:18 apply errorLimiter
  env          JWT_SECRET length >= 64
  AdsDashboard use VITE_SOCKET_URL
  schedules    fix N+1

THEN:
  encrypt GSC/GA4/Linear/Slack at rest
  server-bind OAuth state (GSC/GA4)
  SSRF helper (crawler + sitemap)
  requireSiteAccess middleware

THEN:
  file size refactors (4 big files first)
  backend/config/index.js
  frontend env wrapper

THEN:
  test isolation, core service tests
  dep upgrades (vitest first)
```
