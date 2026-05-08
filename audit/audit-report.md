# SEO Audit Platform — Full Technical Audit Report

**Date:** 2026-04-24
**Scope:** `backend/`, `frontend/src/`, `playwright-crawler/`, `ads-dashboard/`, migrations, configs — ~33,000 LOC across 698 source files.
**Excluded:** `.worktrees/audit-phase2/` (duplicate worktree), `backend/public/assets/` (built bundle), `node_modules/`, `crawl-data/`, `crawl-configs/`.
**Methodology:** 12 phases, deep depth — every source file opened, every route traced, every PRD claim verified.
**Source artifacts:** see `audit/` directory (12 phase-specific files).

---

## Executive summary

The platform is **functional but carries significant architectural and security risk**, largely because it outgrew its original single-tenant design. Multi-tenancy was bolted on (migration 006), but layering never caught up — routes still run SQL directly, company-scoping checks are copy-pasted 16 times, and an anonymous Socket.io client can currently join any tenant's room.

### Headline numbers
| Phase | Findings | Critical | High | Medium | Low/Info |
|---|---|---|---|---|---|
| 1 — Security | 33 | 7 | 7 | 9 | 10 |
| 2+3 — Architecture + DRY | 23 | 0 | 6 | 12 | 5 |
| 4 — File size | 31 | 0 | 4 | 24 | 3 |
| 5 — Config | 6 | 1 | 2 | 3 | 0 |
| 6 — Error handling | 6 | 0 | 2 | 4 | 0 |
| 7 — Performance | 8 | 0 | 1 | 5 | 2 |
| 8 — Tests | 5 | 0 | 2 | 3 | 0 |
| 9 — Dependencies | 7 | 0 | 1 | 5 | 1 |
| 10 — Dead code | 3 | 0 | 0 | 2 | 1 |
| 11 — PRD conformance | 69 mismatches + 24 partial | — | 3 | 6 | — |
| **Total** | **~185 unique findings** | **8** | **28** | **70+** | **20+** |

Machine-readable CSV: `audit/findings.csv` (rolled-up, one row per finding group).

### Top 10 things to fix first (by impact × effort)

1. **[CRITICAL] Remove `POST /api/ai/suggest` abuse surface** — `backend/routes/ai.js:34` has no `requireRole`. Any authenticated user (including `readonly`) can trigger Anthropic calls at your expense. `aiLimiter` (10/min) protects against floods but not against insider abuse. Add `requireRole('admin','seo','superadmin')` next to `aiLimiter`.
2. **[CRITICAL] Role-guard `/api/sites` mutations** — `backend/routes/sites.js` POST/PATCH/DELETE have *no* `requireRole` at all. Any company-scoped user can add, edit, delete sites. Add `requireRole('admin','superadmin')` to mutation routes.
3. **[CRITICAL] Authenticate Socket.io connections** — `backend/server.js:92–102` lets anonymous sockets `join:job` and `join:company` rooms, receiving cross-tenant real-time events. Add `io.use(authHandler)`.
4. **[CRITICAL] Remove `nodemailer` from deps** — unused in source, currently has a HIGH CVE. Deleting the line from `backend/package.json` closes the advisory.
5. **[CRITICAL] Encrypt GSC/GA4 OAuth tokens at rest** — `backend/routes/gsc.js:66–84` and `ga4.js:66–84` save `access_token`/`refresh_token` to `company_oauth_tokens` without encryption. `ads.service.js` already has `ads.crypto.encryptToken`; reuse it.
6. **[CRITICAL] Server-bind OAuth state for GSC/GA4** — current state is client-side JSON round-tripped through Google. Replay/forgery attack possible. Copy the `ad_oauth_state` pattern from `backend/services/ads.service.js:39–53`.
7. **[CRITICAL] SSRF guard on crawler + sitemap fetcher** — `siteSchema` accepts `http://169.254.169.254/…` and the sitemap loop recurses 5 levels deep. Add RFC-1918/link-local/loopback blocklist + DNS pin before every outbound fetch.
8. **[HIGH] Fix `PUBLIC_PATHS` prefix bypass** — `backend/middleware/auth.js:33–35` uses `startsWith`. One mis-placed future route bypasses auth. Switch to exact match.
9. **[HIGH] Fix 3 critical PRD conformance mismatches** — migrations 005 and 018 are on disk but not applied to the live DB (features silently disabled); AI `max_tokens` contradiction between PRD (1500) and code (1024); SF chapter of the PRD is entirely obsolete (crawler is Playwright).
10. **[HIGH] `frontend/src/pages/AdsDashboard.jsx:561`** — `socketIo('http://localhost:3001', …)` breaks every non-local deploy. Ship `import.meta.env.VITE_SOCKET_URL` + a frontend `.env` template.

These 10 items are ~3 engineer-days and close the most acute risk.

---

## Phase-by-phase summary (links to full reports)

- [`phase0-inventory.md`](phase0-inventory.md) — full repo shape, dependencies, DB schema, env vars.
- [`phase0-prd-claims.md`](phase0-prd-claims.md) — 175 verifiable claims extracted from the PRD.
- [`phase1-security.md`](phase1-security.md) — 33 security findings. Headline: GSC/GA4 tokens + Linear/Slack credentials stored plaintext; SSRF; OAuth state not server-bound.
- [`phase2-3-architecture-dry.md`](phase2-3-architecture-dry.md) — no repository layer, Socket.io unauthenticated, company-scoping duplicated 16×.
- [`phase4-filesize-refactor.md`](phase4-filesize-refactor.md) — 31 files over the line cap (1 at 3.6× the frontend limit); per-file refactor plan.
- [`phase5-8-findings.md`](phase5-8-findings.md) — config + test-coverage combined.
- [`phase6-7-10-findings.md`](phase6-7-10-findings.md) — error handling, performance, dead code combined.
- [`phase9-dependency-hygiene.md`](phase9-dependency-hygiene.md) — 1 HIGH + 22 moderate CVEs (nodemailer, vitest/vite stack, @crawlee/*, follow-redirects); 2 unused deps.
- [`phase11-prd-conformance.md`](phase11-prd-conformance.md) — 175 claims checked: 54 ✅ / 24 ⚠️ / 69 ❌ / 28 ❓. PRD is significantly out of sync with code.

---

## Strengths worth preserving

- **SQL parameterisation is ~99% clean.** Only 2 admin/migration files use dynamic table names, both hardcoded and non-HTTP-exposed.
- **No XSS sinks in React.** Grep for the standard dangerous patterns across `frontend/src/` and `ads-dashboard/src/`: zero hits.
- **Ads OAuth is exemplary** — encrypted tokens, server-bound state, single-use, 10-min expiry. This is the pattern GSC/GA4 should copy.
- **helmet + rate limiter + Zod validation + httpOnly+SameSite+Secure (conditional) cookies** — baseline web security hygiene is in place.
- **Centralised frontend API client** with 401 auto-redirect and 5xx error reporting — good separation.
- **Migration system is clean** — each table change has its own file, idempotent `_migrations` tracking.

---

## Cross-cutting themes

1. **Layering gap.** Every route file imports `db` directly and writes SQL inline. The `services/` folder only captures some concerns. Introducing a thin repository layer (`backend/repos/`) would eliminate ~30% of duplicated logic and create a seam for tests to mock.
2. **Multi-tenancy is partially retrofitted.** Company-scoping checks work but are manually inlined 16 times across 6 files. One missing check = a cross-tenant bug. Middleware-ise the check.
3. **No centralised config.** `backend/config/` is empty. Env vars are read scattered across 12+ files with `|| 'http://localhost:…'` fallbacks. Create `backend/config/index.js` with a single `config` object.
4. **Frontend has no env system.** `import.meta.env.X` never used. One hardcoded `localhost:3001` already breaks prod in `AdsDashboard.jsx`.
5. **PRD has drifted significantly from reality.** 39% of extracted claims are outright mismatches. Biggest cluster: the Screaming Frog chapter (replaced by Playwright, but every SF-related env/flag/config is still in the doc).
6. **Test strategy is shallow.** 17 backend test files, mostly validating schema + 404/401/403 routes. Core services (`crawl-runner`, `audit-parser`, `slack`, `linear`, `sitemap-fetcher`) have zero coverage, and the tests share the production SQLite DB — one stray test can overwrite live data.

---

## What I couldn't verify (honesty register)

- **Runtime behaviour of `NODE_ENV=production`.** Static review can't tell if a given deployment sets it correctly; if it doesn't, cookie-secure and validate-env both become no-ops.
- **Whether `/api/ads/callback/` as a `PUBLIC_PATHS` prefix admits unintended routes** — would need runtime `startsWith` test against real URLs.
- **Socket.io room-isolation effect in practice** — the code path is clear, but only runtime testing confirms a real client in company A can receive company B's `ads:sync:progress` events.
- **Whether migrations 005 and 018 *should* be live.** They're on disk but not in the applied set (verified via live sqlite3 dump). Could be intentional staging or an oversight — needs a decision, not a patch.
- **Whether `ads-dashboard/` is live or scaffold-only.** It has no API wiring, only mock data, and isn't mounted anywhere — decide to delete or integrate.
- **Whether the empty `.github/workflows/` directory implies CI exists elsewhere** or is simply missing.

---

## Auto-fix batch (Phase 12 gate)

Under the user-approved strict scope (unused imports + trailing whitespace only):
- **Trailing whitespace:** 0 files found across backend + frontend source.
- **Unused imports:** quick scan of high-fanout files (routes/errors.js, routes/auth.js, routes/sites.js, middleware/*) found none. A full pass would require ESLint, which isn't currently configured (`"lint": "echo 'No linter configured yet'"` in both `frontend/package.json:12` and `backend/package.json:13`).

**Nothing to apply.** Recommend the first real change be *adding* ESLint (`@eslint/js` + `eslint-plugin-react` + `eslint-plugin-unused-imports`) — that gives the project a tool for future auto-fix runs.

---

## Next step

See `audit/audit-action-plan.md` for a prioritised, sequenced action plan with estimated effort per item.
