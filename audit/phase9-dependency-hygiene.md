# Phase 9 — Dependency hygiene

Sources: `npm audit --json` and `npm outdated --json` run 2026-04-24 on all three packages. `package.json` read directly.

---

## Vulnerabilities (npm audit)

| Package | Severity | Direct? | Affected | Fix | Notes |
|---|---|---|---|---|---|
| **nodemailer** (backend) | **HIGH** + moderate (2 CVEs) | Direct | `<7.0.7` | Update to 7.0.7+ | **Unused** — no source file imports it. Safer: remove the dep entirely. |
| @vitest/coverage-v8 (backend) | moderate | Direct | `<=2.2.0-beta.2` | vitest 4.1.5 (semver-major) | Update via vitest upgrade. |
| vitest + vite + vite-node + esbuild + @vitest/mocker (backend) | moderate (5 transitive) | Indirect via @vitest/coverage-v8 | — | vitest 4.1.5 | Single upgrade cascades the fix. |
| gaxios (backend, via googleapis → uuid) | moderate | Indirect | 6.4.0–6.7.1 | Auto-fixable | `npm audit fix` resolves. |
| follow-redirects (frontend, via axios) | moderate | Indirect | `<=1.15.11` | Auto-fixable | `npm audit fix` resolves. |
| @crawlee/* (crawler, 13 packages) | moderate (all same advisory) | Indirect | 3.10.2-beta.0 – 4.0.0-beta.6 | Auto-fixable | All @crawlee/* sub-packages. |

**Totals:**
- Backend: 1 high + 8 moderate = 9 vulnerabilities.
- Frontend: 1 moderate.
- Crawler: 13 moderate.

**Actions:**
1. **Remove nodemailer from backend/package.json** (confirmed unused — Phase 10). Removes the HIGH CVE.
2. `npm audit fix` in all three packages to resolve auto-fixable transitives.
3. Upgrade vitest + @vitest/coverage-v8 to 4.x (semver major — will need a test-suite pass).
4. Crawler: upgrade @crawlee/* via `npm update crawlee`.

---

## Outdated (major version behind latest)

### Backend
| Package | Current | Latest | Major? | Verdict |
|---|---|---|---|---|
| @anthropic-ai/sdk | 0.89.0 | 0.91.0 | no | safe patch |
| @vitest/coverage-v8 | 2.1.9 | 4.1.5 | **yes** | Required for CVE fixes |
| bcryptjs | 2.4.3 | 3.0.3 | **yes** | bcryptjs 3.x changes API; verify `hash`/`compare` signatures |
| better-sqlite3 | 11.10.0 | 12.9.0 | **yes** | Native module; verify it builds on your deploy target |
| dotenv | 16.6.1 | 17.4.2 | **yes** | Low risk (ESM-first defaults) |
| express | 4.22.1 | 5.2.1 | **yes** | Express 5 has removed deprecated APIs — material migration effort |
| express-rate-limit | 7.5.1 | 8.4.0 | **yes** | Check middleware signature changes |
| multer | 1.4.5-lts.2 | 2.1.1 | **yes** | **Unused** — remove the dep instead of upgrading |
| nodemailer | 6.10.1 | 8.0.5 | **yes** | **Unused** — remove the dep instead of upgrading |
| uuid | 11.1.0 | 14.0.0 | **yes** | Drop-in for `v4`; OK |
| vitest | 2.1.9 | 4.1.5 | **yes** | Required for CVE fixes |
| zod | 3.25.76 | (not visible in truncated output but 4.x exists) | likely yes | API differences in 4.x |

### Frontend
| Package | Current | Latest | Major? | Verdict |
|---|---|---|---|---|
| @tailwindcss/vite | 4.2.2 | 4.2.4 | no | safe patch |
| @vitejs/plugin-react | 4.7.0 | 6.0.1 | **yes** | Check Vite 6→7+ compatibility |
| axios | 1.15.0 | 1.15.2 | no | safe patch |
| lucide-react | 0.487.0 | 1.9.0 | **yes** | Icon names may have renamed |
| react | 18.3.1 | 19.2.5 | **yes** | React 19 migration required — fair amount of work |
| react-dom | 18.3.1 | 19.2.5 | **yes** | Pair with react |
| react-router | 7.14.0 | 7.14.2 | no | safe patch |
| recharts | 2.15.4 | 3.8.1 | **yes** | 3.x has API changes |
| tailwindcss | 4.2.2 | 4.2.4 | no | safe patch |
| vite | 6.4.2 | 8.0.10 | **yes** (×2) | Skipping 7 entirely; do 7 first |

### Crawler
| Package | Current | Latest | Major? | Verdict |
|---|---|---|---|---|
| jest | 29.7.0 | 30.3.0 | **yes** | Minor config differences; straightforward |
| p-limit | 6.2.0 | 7.3.0 | **yes** | ESM-only in newer versions — check |

(Crawlee, Playwright, cheerio, robots-parser already at latest minor.)

---

## Unused dependencies (high-signal — must remove)

| Package | Declared in | Grep result | Verdict |
|---|---|---|---|
| **nodemailer** | [backend/package.json:30](backend/package.json#L30) | No `from 'nodemailer'` / `require('nodemailer')` in `backend/` (only README mentions in node_modules) | **REMOVE** — resolves HIGH CVE |
| **multer** | [backend/package.json:28](backend/package.json#L28) | No import in `backend/` source | **REMOVE** — no file-upload endpoints exist |

Both were confirmed via `grep -rn "multer" backend/` and `grep -rn "nodemailer" backend/` returning only matches inside `node_modules/`. If either is needed for a roadmap feature (SMTP email from `auth.js:212` mentions "handled when SMTP settings are configured"), keep it but actually wire it up.

---

## Mixed test runners
- Backend: `vitest`
- playwright-crawler: `jest`

Two test runners in one repo increases tooling cost (two configs, two reporters, two IDE integrations). Consider consolidating on vitest (crawler tests can run under vitest without source changes).
**Severity:** LOW.

---

## Dependency graph bloat
Frontend: 223 total deps (80 prod + 142 dev). Healthy for a React + Vite app.
Backend: heavier (googleapis, google-ads-api pull in ~500 transitive deps). Consider whether google-ads-api is required for the current use (only `ads.google.js` references it — if the flow is optional, lazy-load).

---

## Recommended action plan
1. **Immediate (today):** remove `nodemailer` + `multer` from backend/package.json. Run `npm install`. Eliminates 1 high + at least 1 moderate CVE and trims install time.
2. **This week:** `npm audit fix` in all 3 packages to sweep auto-fixable transitives.
3. **Next sprint:** upgrade vitest ecosystem to 4.x (backend). Handle breaking changes in tests.
4. **Planned migration:** React 18 → 19, Vite 6 → 8, Express 4 → 5 — each is a multi-day migration; do separately, one per release.
5. **Stay on:** @anthropic-ai/sdk 0.89 → 0.91 (non-breaking).
