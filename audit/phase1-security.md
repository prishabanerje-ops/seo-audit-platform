# Phase 1 — Security Audit

**Scope:** auth, SQL injection, XSS, secret/token handling, CORS, rate limits, role enforcement, cookie flags, OAuth, SSRF, CSRF, CSP, file uploads.
**Method:** Direct source inspection of every middleware, every route file touching auth or external APIs, every service making outbound fetches, and frontend XSS-sink grep.
**Date:** 2026-04-24

---

## Critical (fix immediately)

### SEC-C1 — GSC and GA4 OAuth tokens stored UNENCRYPTED at rest
**Files:** [backend/routes/gsc.js:66–84](backend/routes/gsc.js#L66-L84), [backend/routes/ga4.js:66–84](backend/routes/ga4.js#L66-L84)
**Evidence:** `INSERT INTO company_oauth_tokens (...access_token, refresh_token...)` passes `tokens.access_token` / `tokens.refresh_token` directly — no `encryptToken()` wrap. `ads.service.js:59–60` does the opposite for ads tokens (encrypts both). This is an internal inconsistency, not oversight-by-omission.
**Impact:** DB file or backup leak exposes long-lived Google refresh tokens granting read-only access to GSC (+ site verification status) and GA4 (full analytics). Refresh tokens don't expire; rotation requires manual user action in Google.
**Fix:** Reuse `services/ads.crypto.js` (`encryptToken`/`decryptToken`) — wrap on INSERT, unwrap in `/properties` and cached-fetch paths (`company_oauth_tokens` reads at gsc.js:116–118, ga4.js:116–118). Add migration to re-encrypt existing rows.
**Confidence:** High.

### SEC-C2 — Third-party API keys stored as plaintext in DB
**Files:**
- Linear API key: [backend/services/linear.service.js:42–46](backend/services/linear.service.js#L42-L46) — `SELECT value FROM company_settings WHERE key='linear_api_key'`
- Slack webhook URL: [backend/services/slack.service.js:11–20](backend/services/slack.service.js#L11-L20) — `SELECT value FROM company_settings WHERE key='slack_webhook_url'`
- PSI API key (global settings): [backend/routes/psi.js:39](backend/routes/psi.js#L39)
- Anthropic API key (global settings): [backend/routes/ai.js:69](backend/routes/ai.js#L69)

**Evidence:** No `encryptToken` usage anywhere in these services. `company_settings` + `settings` tables are plaintext key/value stores.
**Impact:** DB leak = attacker can create Linear issues, post to Slack, bill Anthropic/PSI usage, and (for Linear) read the workspace's issues.
**Fix:** Encrypt all credential-class settings using the same `ads.crypto` helper. Add a typed abstraction (e.g., `backend/services/secret-store.js`) that auto-encrypts on write and decrypts on read for a known set of keys.
**Confidence:** High.

### SEC-C3 — GSC/GA4 OAuth `state` is NOT server-bound or single-use
**Files:** [backend/routes/gsc.js:32–55](backend/routes/gsc.js#L32-L55), [backend/routes/ga4.js:32–55](backend/routes/ga4.js#L32-L55)
**Evidence:** `state: JSON.stringify({ company_id, provider })` — plain client-side JSON round-tripped through Google. Callback (`gsc.js:49–55`, `ga4.js:49–55`) does `JSON.parse(state)` and trusts `parsed.company_id`. No table, no expiry, no one-time consumption. Compare with `backend/services/ads.service.js:39–53` which does it correctly (`ad_oauth_state` table, 10-min expiry, `DELETE` on consume).
**Impact:** Attacker with any valid Google authorization code + forged state JSON can POST to `/api/gsc/callback?code=…&state={"company_id":"victim","provider":"gsc"}`, causing the callback handler to save the attacker's tokens under the victim company — or cause silent re-binding during a superadmin's mid-flow session. Also: no user binding → stolen code replayable from any machine.
**Fix:** Copy the `ad_oauth_state` pattern (stored random state, user_id binding, 10-min expiry, DELETE-after-use). Reject callback if state is missing from DB.
**Confidence:** High.

### SEC-C4 — SSRF via user-controlled crawl target URL
**Files:** [backend/routes/sites.js:15–29](backend/routes/sites.js#L15-L29), [backend/routes/crawls.js:104–146](backend/routes/crawls.js#L104-L146), [backend/services/crawl-runner.js:67–198](backend/services/crawl-runner.js#L67-L198)
**Evidence:** `siteSchema` validates `url: z.string().url()` — accepts `http://169.254.169.254/latest/meta-data/`, `http://localhost:3001/api/auth/users` (internal), `http://[::1]/`, etc. `startCrawl` passes `site.url` to `playwright-crawler` which issues outbound HTTP + launches headless Chromium. No host/IP allowlist or private-range blocklist.
**Impact:** Authenticated (non-admin) user can scan internal network, hit cloud metadata endpoints (AWS/GCP/Azure IMDS), or probe other services on the host. Playwright headless browser also executes JS from the target — can exfiltrate to attacker via XHR.
**Fix:** On site creation and before every outbound crawl:
1. Resolve DNS and reject IPs in RFC 1918 (10/8, 172.16/12, 192.168/16), RFC 3927 link-local (169.254/16), loopback (127/8, ::1), `fc00::/7`, `fe80::/10`.
2. Restrict schemes to `http:`/`https:` only.
3. Optionally pin a DNS resolver and pass the resolved IP to prevent DNS-rebind.
Same guard needed for `services/sitemap-fetcher.js:27` (SEC-C5 below).
**Confidence:** High.

### SEC-C5 — SSRF via user-controlled sitemap URL
**Files:** [backend/services/sitemap-fetcher.js:22–40](backend/services/sitemap-fetcher.js#L22-L40), [backend/routes/crawls.js:66–67](backend/routes/crawls.js#L66-L67)
**Evidence:** `sitemap_url` / `sitemap_urls` are `z.string()` (not `z.string().url()`) and are passed directly to the outbound fetch inside `fetchSitemapUrls`. Also does recursive fetch of child sitemaps (depth 5) — one sitemap can trigger up to 50,000 URL retrievals.
**Impact:** Same as SEC-C4, amplified: one fake sitemap can trigger many internal fetches.
**Fix:** Same host/IP allowlist as SEC-C4 applied inside `fetchText`. Enforce `z.string().url()` and scheme allowlist in the route's Zod schema.
**Confidence:** High.

---

## High

### SEC-H1 — `PUBLIC_PATHS` uses prefix match, not exact match
**File:** [backend/middleware/auth.js:33–35](backend/middleware/auth.js#L33-L35)
**Evidence:** `PUBLIC_PATHS.some(p => p.method === req.method && req.path.startsWith(p.path))`. Any future path that shares a prefix with a public path bypasses auth. Example: `POST /api/auth/login/impersonate` would slip through the `/api/auth/login` prefix. No exploitable path today, but `/api/ads/callback/` (line 19, trailing slash) is a particularly broad prefix — any future `GET /api/ads/callback/*` is implicitly public.
**Impact:** Defense-in-depth gap; one misplaced route and auth is bypassed.
**Fix:** Switch to exact-match for non-parametric paths, or use a tiny regex list. `/api/ads/callback/:platform` should be matched as `/api/ads/callback/google|meta|linkedin` explicitly.
**Confidence:** High.

### SEC-H2 — JWT_SECRET has no minimum length/entropy validation
**File:** [backend/validate-env.js:7–31](backend/validate-env.js#L7-L31)
**Evidence:** `REQUIRED_IN_PRODUCTION = ['JWT_SECRET', 'FRONTEND_URL']` — only existence is checked. `ads.crypto.js:10` already enforces ≥64 hex chars for its own key.
**Impact:** Deployment with a short/guessable JWT_SECRET permits token forgery.
**Fix:** In `validateEnv()`, require `JWT_SECRET.length >= 64` and ideally hex or base64. Fail-fast in production.
**Confidence:** High.

### SEC-H3 — Admin can promote team members to admin via PATCH
**Files:** [backend/routes/auth.js:156–163](backend/routes/auth.js#L156-L163) vs [backend/routes/auth.js:386–420](backend/routes/auth.js#L386-L420)
**Evidence:** `POST /invite` blocks `actorRole === 'admin' && role === 'admin'`, but `PATCH /users/:id` with `{role: 'admin'}` is allowed — `patchUserSchema.role` enum is `['admin','seo','readonly']` with no admin-self-restriction.
**Impact:** An admin can bypass the invite rule by first inviting a `seo` user and then promoting them to `admin`, creating unlimited admins without superadmin approval.
**Fix:** Mirror the invite rule: in PATCH handler, if `actorRole === 'admin' && req.body.role === 'admin'`, return 403.
**Confidence:** High.

### SEC-H4 — No session/token revocation on password change
**File:** [backend/routes/auth.js:486–515](backend/routes/auth.js#L486-L515)
**Evidence:** `change-password` updates `password_hash` but existing JWTs remain valid for their 7-day expiry (auth.js:35). JWTs are stateless, no revocation list.
**Impact:** If an attacker steals a cookie, the legitimate user changing the password does not end the attacker's session.
**Fix:** Add a `users.password_version` column (or `sessions` table), embed `pv` in JWT claims, invalidate by bumping the version on password change. Checked during `authMiddleware` JWT verification.
**Confidence:** High.

### SEC-H5 — Seeded default passwords in repo
**Files:** [backend/db/migrations/006_multi_tenancy.js](backend/db/migrations/006_multi_tenancy.js), [backend/db/migrations/008_force_password_reset.js](backend/db/migrations/008_force_password_reset.js)
**Evidence:** `SEED_ADMIN_PASSWORD` defaults to `ChangeMe123!`; `SEED_SUPERADMIN_PASSWORD` defaults to `SuperAdmin123!` (per Phase 0 route inventory). `must_reset_password = 1` mitigates but is only one flag.
**Impact:** Public repo + instance reachable before admin logs in = credential stuffing with known password.
**Fix:** Refuse to seed unless `SEED_*_PASSWORD` is explicitly set in env. In the migration, generate a cryptographically random password if env var absent and print it once to stdout.
**Confidence:** High (default values are compiled-in fallbacks).

### SEC-H6 — `errorLimiter` exported but never applied; `/api/errors` only gated by global 300/min limiter
**Files:** [backend/middleware/rateLimiter.js:17–22](backend/middleware/rateLimiter.js#L17-L22), [backend/routes/errors.js:18](backend/routes/errors.js#L18)
**Evidence:** `router.post('/', validate(errorSchema), …)` — no `errorLimiter` referenced. The limiter is defined but unused (dead export).
**Impact:** Public endpoint writes to `error_log` table at 300/min per IP. Log-flooding / storage exhaustion via a single IP.
**Fix:** Apply `errorLimiter` in `routes/errors.js` route definition.
**Confidence:** High.

### SEC-H7 — `validate-env.js` REQUIRED list doesn't include `ANTHROPIC_API_KEY`, OAuth creds, or `BACKEND_URL` when the feature is enabled
**File:** [backend/validate-env.js:7–13](backend/validate-env.js#L7-L13)
**Evidence:** Only `JWT_SECRET` + `FRONTEND_URL` are required. Anthropic, Google, Meta, LinkedIn, Slack are all "optional with warning" even in production.
**Impact:** Prod deployment silently boots with GSC/GA4/Ads disabled or with `BACKEND_URL` defaulting to `http://localhost:3001`, producing broken OAuth callbacks.
**Fix:** Distinguish "required for the feature if the feature is expected to work" from "required for the server to start." Fail startup in production when an OAuth feature flag is on but its credentials are missing.
**Confidence:** Medium — depends on deployment intent.

---

## Medium

### SEC-M1 — Cookie `secure` flag is conditional on `x-forwarded-proto`
**File:** [backend/routes/auth.js:21–29](backend/routes/auth.js#L21-L29)
**Evidence:** `isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https'`. If a deployment forgets to configure the proxy to set `x-forwarded-proto`, the cookie is set without `Secure`, exposing it to MITM on any plain-HTTP segment.
**Fix:** Force `secure: true` in production regardless (with explicit deploy-docs callout) or read a `COOKIE_SECURE=true` env var.
**Confidence:** Medium.

### SEC-M2 — Error `.message` leaked to frontend via redirect querystring
**Files:** [backend/routes/ads.js:49](backend/routes/ads.js#L49), [backend/routes/gsc.js:46, :89](backend/routes/gsc.js#L46), [backend/routes/ga4.js:46, :89](backend/routes/ga4.js#L46)
**Evidence:** `res.redirect(\`${FRONTEND_URL}/integrations?ads_error=${encodeURIComponent(err.message)}\`)`. `err.message` may include stack hints, third-party response bodies, or env var names.
**Fix:** Map internal errors to short stable error codes (`invalid_state`, `token_exchange_failed`, etc.) — already partially done for `gsc.js` (`gsc_error=invalid_state`), not for `ads.js`.
**Confidence:** High.

### SEC-M3 — JWT expiry 7 days with no refresh rotation
**File:** [backend/routes/auth.js:35](backend/routes/auth.js#L35)
**Evidence:** `expiresIn: '7d'`. No refresh token.
**Impact:** Single compromised cookie = 7 days of access.
**Fix:** Shorten to 1–2 days + implement refresh-token rotation, or add short-lived JWT + long-lived session cookie pattern.
**Confidence:** Medium — trade-off vs UX.

### SEC-M4 — Impersonation has no re-auth or confirmation step
**File:** [backend/routes/auth.js:527–584](backend/routes/auth.js#L527-L584)
**Evidence:** Any live superadmin cookie can call `/impersonate` with a `user_id` and receive a 4-hour token for that user. Only `authLimiter` (20 req / 15 min) and `audit_log` write are in place.
**Impact:** Stolen superadmin cookie → silent impersonation of any user in any company for 4 hours. The impersonation audit log is a detective control, not preventive.
**Fix:** Require re-entering the password (or passing an OTP) before issuing the impersonation token. Keep audit log.
**Confidence:** Medium.

### SEC-M5 — `express.json({ limit: '10mb' })` applied globally
**File:** [backend/server.js:77–78](backend/server.js#L77-L78)
**Evidence:** 10 MB body limit for every API route. Most endpoints accept <2 KB JSON.
**Impact:** An authenticated attacker can burn server RAM by sending 10 MB payloads at 300 req/min.
**Fix:** Tighten global limit to 1 MB. Allow larger limits only on the specific routes that need them (none currently — even `/api/crawls` POSTs are <10 KB).
**Confidence:** High.

### SEC-M6 — No body-size / upload limits on `multer`
**File:** `backend/package.json` lists `multer` but grep shows no route actually uses it — check if imported anywhere.
**Evidence:** Needs confirmation in Phase 10 (dead code).
**Fix:** Either remove the `multer` dep or apply `limits` when used.
**Confidence:** Low (pending verification).

### SEC-M7 — CSP `connectSrc` includes only `self` + `api.anthropic.com`
**File:** [backend/server.js:64](backend/server.js#L64)
**Evidence:** `connectSrc: ["'self'", "https://api.anthropic.com"]`. Frontend SSE uses `self` → fine. But avatars from Google (stored in `users.avatar_url`) will be blocked because `img-src` inherits `default-src: 'self'` only.
**Impact:** Broken Google avatars; possible UX breakage rather than security.
**Fix:** Add explicit `imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com', 'https://avatars.slack-edge.com']`.
**Confidence:** Medium.

### SEC-M8 — GSC/GA4 status/auth endpoints allow superadmin to spoof `company_id`
**Files:** [backend/routes/gsc.js:22–26](backend/routes/gsc.js#L22-L26), [backend/routes/ga4.js:22–26](backend/routes/ga4.js#L22-L26)
**Evidence:** `resolveCompanyId(req) = req.query.company_id || req.user.company_id` for superadmin. No verification that the company_id exists in the companies table.
**Impact:** Doesn't create unauthorized access (superadmin already has it), but combined with SEC-C3 allows a superadmin to unknowingly initiate an OAuth flow for an unintended company.
**Fix:** Validate `company_id` exists; log the resolution in audit_log.
**Confidence:** Medium.

### SEC-M9 — Tests use the live production DB
**File:** [backend/__tests__/](backend/__tests__/), ~17 test files
**Evidence:** Tests `import db from '../db/sqlite.js'` — this is the same `backend/seo-automation.db` used in production. No per-test fixture reset, no transaction rollback.
**Impact:** Running the test suite pollutes the live DB. Risk of data loss during dev, and tests become order-dependent.
**Fix:** Use an in-memory SQLite (`:memory:`) or a `test-*.db` file per worker, driven by `process.env.DB_PATH`.
**Confidence:** High — needs a separate read of `db/sqlite.js` to confirm there isn't a test-env branch already.

---

## Low / informational

### SEC-L1 — No CSRF issues found (stateless SameSite + CORS strict)
Cookies are `httpOnly` + `sameSite: 'lax'`; CORS `origin` is single-valued; no form-POST endpoints without Zod bodies. Traditional CSRF not exploitable.

### SEC-L2 — No XSS sinks in React frontend
Grep for the standard React XSS sinks (dangerous-HTML setter prop, direct DOM innerHTML writes, `eval`, dynamic Function constructor) across `frontend/src/` and `ads-dashboard/src/`: **zero hits**. React's default escaping is intact.

### SEC-L3 — SQL is ~99% parameterised
- User-exposed routes all use `db.prepare(sql).get/run(?, ?)`.
- Two dynamic-SET patterns (`auth.js:419`, `sites.js:105–108`) are whitelist-protected via `ALLOWED_*_PATCH_FIELDS`.
- Two admin/migration-only files use unparameterized table names (`db/reset.js:34`, `db/migrations/006:70`) — not HTTP-exposed, hardcoded table lists. Low.

### SEC-L4 — Password strength enforces only 8-char minimum
`z.string().min(8)` in `invite/accept`, `users/create`, `change-password`. No uppercase/digit/symbol rule, no entropy check, no breached-password list (HIBP).
**Fix:** Optional — add zxcvbn check or HIBP range lookup.

### SEC-L5 — `/api/auth/me` manually re-verifies JWT, duplicating `authMiddleware`
Code duplication, not a vulnerability. 15 lines redundant.

### SEC-L6 — HSTS has no `preload` directive
`helmet.hsts({ maxAge: 31536000, includeSubDomains: true })` but no `preload: true`. Low — preloading requires a separate submission anyway.

### SEC-L7 — `/api/errors` accepts user-controlled `message`/`stack` strings up to 1 KB + 5 KB
Stored in `error_log`. Not SQL-injection (parameterized), not XSS (stored, rendered as text in admin UI — need to verify Phase 2). **Verify:** how `error_log.stack` is rendered in `frontend/src/pages/AuditLog.jsx` or equivalent.

### SEC-L8 — No `X-Content-Type-Options: nosniff` explicit verification
`helmet` default includes it. Verified by default config.

### SEC-L9 — `resetStuckJobs` on server start marks all queued/running jobs as failed
Correct design for crash recovery. No issue.

### SEC-L10 — Ads OAuth state table (`ad_oauth_state`) has no periodic GC
10-min expiry enforced on consume, but expired rows remain in DB forever. Small leak.

---

## What I could NOT verify from static inspection

1. **Prod `NODE_ENV`** — if prod deployments forget to set `NODE_ENV=production`, cookies default to dev mode (no secure flag default), CSP is looser, and `validateEnv` skips required-check. Operational, not code-level.
2. **Whether `multer` is actually wired up anywhere** — Phase 10 will confirm.
3. **Behavior of `/api/ads/callback/` as a prefix in PUBLIC_PATHS** under a route like `/api/ads/callback/google` — manual test needed to confirm `startsWith` matches only expected callback paths.
4. **`error_log.stack` rendering** — Phase 2 component review will confirm.
5. **Socket.io room isolation** — `server.js:92–102` trusts client-emitted `join:company` without verifying the client actually belongs to that company. **Flag for Phase 2.**

---

## Summary numbers

| Severity | Count |
|---|---|
| Critical | 5 |
| High | 7 |
| Medium | 9 |
| Low/Info | 10 |
| **Total** | **31** |

## Top 5 fixes by impact × effort (starter punch-list)

1. **Encrypt GSC/GA4/Linear/Slack tokens at rest** (SEC-C1, SEC-C2) — reuse `ads.crypto`; ~1 day + re-encryption migration.
2. **Server-bind OAuth state for GSC/GA4** (SEC-C3) — copy the `ad_oauth_state` pattern; ~0.5 day.
3. **Private-IP + DNS-rebind guard on crawler + sitemap fetcher** (SEC-C4, SEC-C5) — centralized helper, used in `crawl-runner.js` and `sitemap-fetcher.js`; ~0.5 day.
4. **Exact-match `PUBLIC_PATHS`** (SEC-H1) + **JWT_SECRET length validation** (SEC-H2) + **errorLimiter wiring** (SEC-H6) — small edits, ~2 hours total.
5. **Password-version JWT claim for revocation** (SEC-H4) + **admin-cannot-promote-admin guard** (SEC-H3) — ~0.5 day.
