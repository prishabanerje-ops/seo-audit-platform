# Phase 4 — File-size violations + refactor plans

Thresholds per user direction:
- **Frontend:** hard cap 250 lines per file.
- **Backend:** 400-line soft cap (seed/data files exempt).
- **Data files:** exempt — flagged informationally.

Scoring methodology: for each over-threshold file, plan a concrete split into sub-files/hooks/services.

Data source: `audit/file-inventory.txt` (live wc -l at 2026-04-24).

---

## Data files — exempt

| File | Lines | Verdict |
|---|---|---|
| [backend/db/seed/audit-checks.js](backend/db/seed/audit-checks.js) | 3,849 | Seed data (291 checks). Accept. Consider splitting into 1 file per category for diffability, but not required. |
| [ads-dashboard/src/data/mockData.ts](ads-dashboard/src/data/mockData.ts) | 477 | Mock fixture — **but** the file being alive at all conflicts with CLAUDE.md rule "Never use mock/hardcoded data in any frontend component." Delete when ads-dashboard is wired up. |

---

## Frontend (>250 lines)

### 1. [frontend/src/pages/IssueDetail.jsx](frontend/src/pages/IssueDetail.jsx) — 893 lines (3.6×)
**What's in it:** fetches audit_result + check metadata, GSC delta, GA4 delta, AI suggestion cache lookup, AI streaming POST via `fetch()`, feedback thumbs, related-issues list, copy-link, a Slack share preview, a linear-sync CTA.
**Refactor plan:**
- `pages/issue-detail/IssueDetail.jsx` — orchestrator (~180)
- `pages/issue-detail/IssueHeader.jsx` — title, severity pill, breadcrumb
- `pages/issue-detail/IssueMetadata.jsx` — URL + section/issue_type chips
- `pages/issue-detail/IssueData.jsx` — parses `result.data` and renders as key-value table
- `pages/issue-detail/AiSuggestion.jsx` — SSE streaming UI + feedback
- `pages/issue-detail/RelatedIssues.jsx` — list of other affected URLs
- `hooks/useAiStream.js` — owns the `fetch()` + AbortController + reader loop. Returns `{ text, isStreaming, start, cancel }`.
- `hooks/useAuditResult.js` — `GET /reports/results/:resultId` + caching.
**Target per file:** ≤200 lines.

### 2. [frontend/src/pages/AdsDashboard.jsx](frontend/src/pages/AdsDashboard.jsx) — 798 lines (3.2×)
**What's in it:** top bar, KPI cards, platform filter, campaign table with expand/collapse, socket.io polling (hardcoded `localhost:3001`), sort, date-range, export to CSV.
**Refactor plan:**
- `pages/ads/AdsDashboard.jsx` — orchestrator (~150)
- `pages/ads/AdsTopBar.jsx` — platform filters + date range
- `pages/ads/AdsKpiCards.jsx` — 4 cards
- `pages/ads/AdsTable.jsx` — hierarchical table
- `pages/ads/AdsCampaignRow.jsx` — per-row with expand state
- `hooks/useAdsSocket.js` — socket connection (uses `import.meta.env.VITE_SOCKET_URL`)
- `hooks/useAdsMetrics.js` — `/ads/metrics` + refresh
- `lib/ads-format.js` — `fmtCurrency`, `fmtPercent`, etc. (mirror of `ads-dashboard/src/utils/metrics.ts`)
**Bonus:** this page duplicates a lot of what's in the standalone `ads-dashboard/` app — merge the two if they serve the same purpose.
**Target:** ≤220 lines each.

### 3. [frontend/src/pages/ScheduledCrawls.jsx](frontend/src/pages/ScheduledCrawls.jsx) — 704 lines (2.8×)
**What's in it:** list schedules, create/edit/delete, cron builder UI, notification toggles, last-run history.
**Refactor plan:**
- `pages/schedules/ScheduledCrawls.jsx` — orchestrator (~150)
- `pages/schedules/ScheduleList.jsx`
- `pages/schedules/ScheduleForm.jsx`
- `pages/schedules/CronBuilder.jsx` — pure component; probably 200 lines just for the builder
- `hooks/useSchedules.js` — CRUD hook
**Target:** ≤220.

### 4. [frontend/src/components/CrawlConfigPanel.jsx](frontend/src/components/CrawlConfigPanel.jsx) — 687 lines (2.7×)
**What's in it:** 6-tab form (Spider, Robots, Speed, Custom, APIs, Auth) + `DEFAULT_CONFIG` constant + validation.
**Refactor plan:**
- `components/crawl-config/CrawlConfigPanel.jsx` — tab shell (~100)
- `components/crawl-config/tabs/SpiderTab.jsx`
- `components/crawl-config/tabs/RobotsTab.jsx`
- `components/crawl-config/tabs/SpeedTab.jsx`
- `components/crawl-config/tabs/CustomTab.jsx`
- `components/crawl-config/tabs/ApisTab.jsx`
- `components/crawl-config/tabs/AuthTab.jsx`
- `components/crawl-config/defaults.js` — exports `DEFAULT_CONFIG` (also the config-DRY target in DRY-M4)
**Target:** ≤200 each.

### 5. [frontend/src/pages/Companies.jsx](frontend/src/pages/Companies.jsx) — 577 lines (2.3×)
CRUD table for superadmins. Split into `CompanyList`, `CompanyForm`, `CompanyDetailDrawer`, `hooks/useCompanies`.

### 6. [frontend/src/pages/AuditHealth.jsx](frontend/src/pages/AuditHealth.jsx) — 556 lines (2.2×)
Split into `AuditHealthHeader` (health ring + totals), `AuditHealthTrend` (chart), `AuditHealthCategories` (accordion list), `hooks/useReportSummary`.

### 7. [frontend/src/pages/AuditCategory.jsx](frontend/src/pages/AuditCategory.jsx) — 541 lines (2.2×)
Split into `CategoryHeader`, `IssueGroupList`, `IssueRowsTable`, `hooks/useCategoryIssues` (handles pagination via `useSearchParams`).

### 8. [frontend/src/pages/CoreWebVitals.jsx](frontend/src/pages/CoreWebVitals.jsx) — 506 lines (2.0×)
Split into `CwvForm`, `CwvResultCard`, `hooks/usePsiAnalyze`.

### 9. [frontend/src/pages/Integrations.jsx](frontend/src/pages/Integrations.jsx) — 494 lines (2.0×)
Split per integration: `integrations/GscCard`, `GaCard`, `AdsCard`, `LinearCard`, `SlackCard`, `hooks/useIntegrationStatus`.

### 10. [frontend/src/pages/GscOverlay.jsx](frontend/src/pages/GscOverlay.jsx) — 463 lines (1.9×) and [frontend/src/pages/Ga4Overlay.jsx](frontend/src/pages/Ga4Overlay.jsx) — 433 (1.7×)
These two mirror each other — do them together. Extract shared `hooks/useOAuthProvider({ provider: 'gsc' | 'ga4' })` that handles status + connect + disconnect.

### 11. [frontend/src/pages/LiveRun.jsx](frontend/src/pages/LiveRun.jsx) — 456 lines (1.8×)
Split into `LiveRunHeader`, `LiveUrlStream`, `hooks/useCrawlStream` (encapsulates EventSource).

### 12. [frontend/src/pages/NewSiteWizard.jsx](frontend/src/pages/NewSiteWizard.jsx) — 415 lines (1.7×)
Four steps; give each step its own file.

### 13. [frontend/src/pages/HomePage.jsx](frontend/src/pages/HomePage.jsx) — 432 lines (1.7×)
Public marketing-style page. Splittable into `Hero`, `FeatureGrid`, `Cta`.

### 14. [frontend/src/pages/Ga4Overlay.jsx](frontend/src/pages/Ga4Overlay.jsx) — 433 (see above)

### 15. [frontend/src/components/Header.jsx](frontend/src/components/Header.jsx) — 393 lines (1.6×)
Over limit. Split into `HeaderLogo`, `HeaderSiteSwitcher`, `HeaderNotificationsBell`, `HeaderUserMenu`, `HeaderCompanySwitcher`.

**Additional frontend pages over 250** (not expanded above but should follow the same "split into 3–4 files + 1 hook" pattern):
- CompareView.jsx (407) — FeedbackSplit: results-side-by-side + job-picker.
- CrawlStart.jsx (403) — wizard-style; split into step forms.
- Tasks.jsx (363) — KanbanBoard + TaskFilters.
- Sites.jsx (360) — SiteList + SiteForm.
- Exports.jsx (357) — ExportJobList + ExportForm.
- Users.jsx (359) — UserList + UserForm.
- CrawlStatus.jsx (321) — JobList + PollingHook.
- AdminView.jsx (304) — Header + StatCards + CompaniesList.
- TaskDetail.jsx (289) — Header + StatusBar + CommentsThread.
- AuditCategories.jsx (271) — CategoryGrid + CategoryCard.
- SeoView.jsx (270) — Same pattern as AdminView.
- DeveloperView.jsx (255) — Header + MetricsGrid.

**Frontend totals:** 25+ pages/components over the 250-line cap. Average split factor 3×.

---

## Backend (>400 lines)

### 1. [backend/routes/auth.js](backend/routes/auth.js) — 629 lines
**Contents:** login, logout, me, register (disabled), invite, invite/validate, invite/accept, users/create, users (GET), users/:id (PATCH), users/:id (DELETE), change-password, impersonate, impersonate/end.
**Split plan:**
- `routes/auth.login.js` — login + logout + me (~120)
- `routes/auth.invite.js` — invite + validate + accept (~150)
- `routes/auth.users.js` — users CRUD (~200)
- `routes/auth.password.js` — change-password (~80)
- `routes/auth.impersonate.js` — impersonate + end (~120)
- `routes/auth/index.js` — mount the five sub-routers under `/api/auth`
Shared helpers move to `services/auth.service.js` (signToken, cookie options, password hash, JWT verify for /me).

### 2. [backend/routes/reports.js](backend/routes/reports.js) — 519 lines
**Contents:** checks/count, results/:id, :siteId/category, :siteId/issues, :siteId/summary, :siteId/trend, :siteId/developer-summary, :siteId/issues/export.
**Split plan:**
- `routes/reports.summary.js` — summary + trend (~140)
- `routes/reports.category.js` — category + issues (~140)
- `routes/reports.developer.js` — developer-summary (~120)
- `routes/reports.export.js` — CSV export (~80)
- `services/health-score.js` — health score computation (currently inline)
- `services/reports.helpers.js` — `getLatestCompletedJob(siteId)` (the DRY-H2 fix)

### 3. [backend/services/audit-parser.service.js](backend/services/audit-parser.service.js) — 516 lines
Large because it owns parsing 12 SF-format datasets into audit_results. Likely one big switch-by-section. Consider splitting into `parsers/response-codes.js`, `parsers/titles.js`, etc. with a registry.

### 4. [backend/services/crawl-runner.js](backend/services/crawl-runner.js) — 272 lines — under threshold.

### 5. [backend/routes/tasks.js](backend/routes/tasks.js) — 347 lines — under threshold but close. Extract `getEnrichedTaskById` (DRY-H3) to `services/task.service.js`.

### 6. [backend/routes/ads.js](backend/routes/ads.js) — 312 lines
Split OAuth URL builders + callback handlers into `services/ads.oauth.js` per platform. Keep route file thin (~150 lines).

### 7. [backend/routes/gsc.js](backend/routes/gsc.js) — 301 lines
Similar — extract OAuth setup + token storage into `services/gsc.oauth.js` (and reuse with ga4 via a factory).

### 8. [backend/routes/exports.js](backend/routes/exports.js) — 256 lines — under threshold.

### 9. [backend/routes/crawls.js](backend/routes/crawls.js) — 256 lines — under threshold.

---

## Refactor tracker (1-line per violation)

| File | Lines | Threshold | Factor | Suggested split count |
|---|---|---|---|---|
| backend/db/seed/audit-checks.js | 3,849 | — | — | Data; exempt |
| ads-dashboard/src/data/mockData.ts | 477 | — | — | Delete when integrating |
| backend/routes/auth.js | 629 | 400 | 1.6 | 5 files |
| backend/routes/reports.js | 519 | 400 | 1.3 | 4 + helpers |
| backend/services/audit-parser.service.js | 516 | 400 | 1.3 | Parser registry split |
| frontend/src/pages/IssueDetail.jsx | 893 | 250 | 3.6 | 6 + 2 hooks |
| frontend/src/pages/AdsDashboard.jsx | 798 | 250 | 3.2 | 5 + 2 hooks |
| frontend/src/pages/ScheduledCrawls.jsx | 704 | 250 | 2.8 | 4 + 1 hook |
| frontend/src/components/CrawlConfigPanel.jsx | 687 | 250 | 2.7 | 8 |
| frontend/src/pages/Companies.jsx | 577 | 250 | 2.3 | 4 + 1 hook |
| frontend/src/pages/AuditHealth.jsx | 556 | 250 | 2.2 | 4 + 1 hook |
| frontend/src/pages/AuditCategory.jsx | 541 | 250 | 2.2 | 3 + 1 hook |
| frontend/src/pages/CoreWebVitals.jsx | 506 | 250 | 2.0 | 3 + 1 hook |
| frontend/src/pages/Integrations.jsx | 494 | 250 | 2.0 | 5 cards + 1 hook |
| frontend/src/pages/GscOverlay.jsx | 463 | 250 | 1.9 | 3 + shared hook with Ga4 |
| frontend/src/pages/LiveRun.jsx | 456 | 250 | 1.8 | 3 + 1 hook |
| frontend/src/pages/Ga4Overlay.jsx | 433 | 250 | 1.7 | (paired with GscOverlay) |
| frontend/src/pages/HomePage.jsx | 432 | 250 | 1.7 | 3 |
| frontend/src/pages/NewSiteWizard.jsx | 415 | 250 | 1.7 | 4 step files |
| frontend/src/pages/CompareView.jsx | 407 | 250 | 1.6 | 3 |
| frontend/src/pages/CrawlStart.jsx | 403 | 250 | 1.6 | 3 + 1 hook |
| frontend/src/components/Header.jsx | 393 | 250 | 1.6 | 5 |
| frontend/src/pages/Tasks.jsx | 363 | 250 | 1.5 | 3 |
| frontend/src/pages/Sites.jsx | 360 | 250 | 1.4 | 3 |
| frontend/src/pages/Users.jsx | 359 | 250 | 1.4 | 3 |
| frontend/src/pages/Exports.jsx | 357 | 250 | 1.4 | 3 |
| frontend/src/pages/CrawlStatus.jsx | 321 | 250 | 1.3 | 2 + polling hook |
| frontend/src/pages/AdminView.jsx | 304 | 250 | 1.2 | 3 |
| frontend/src/pages/TaskDetail.jsx | 289 | 250 | 1.2 | 2 |
| frontend/src/pages/AuditCategories.jsx | 271 | 250 | 1.1 | 2 |
| frontend/src/pages/SeoView.jsx | 270 | 250 | 1.1 | 2 |
| frontend/src/pages/DeveloperView.jsx | 255 | 250 | 1.0 | 2 |

**Count:** 3 backend files over 400 + 28 frontend files over 250 = **31 files** requiring a split.

**Estimated effort:** 6–10 engineer-days for the full refactor (roughly 20 min/file for the small ones, 1–2 h for IssueDetail / AdsDashboard / ScheduledCrawls / CrawlConfigPanel).

**Recommended first batch** (biggest bang-for-buck):
1. CrawlConfigPanel.jsx — 8 tab files + 1 defaults file, unlocks DRY-M4 too.
2. IssueDetail.jsx — 6 files + 2 hooks, unlocks `useAiStream` reuse.
3. routes/auth.js — 5 files, makes the auth flow easy to reason about.
4. reports.js + audit-parser.service.js — enables the `health-score` + `getLatestCompletedJob` helpers.
5. GscOverlay + Ga4Overlay together — share one `useOAuthProvider` hook.
