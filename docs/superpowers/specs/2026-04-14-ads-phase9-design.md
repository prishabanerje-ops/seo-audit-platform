# Phase 9 — Paid Ads API Integration: Design Spec

**Date:** 2026-04-14
**Status:** Approved — ready for implementation planning
**PRD reference:** Section 16 (authoritative source for full detail)

---

## What this is

Phase 9 replaces the hardcoded mock data in `frontend/src/pages/AdsDashboard.jsx` with live metrics fetched from Google Ads, Meta, and LinkedIn Campaign Manager. The standalone `ads-dashboard/` app is unchanged and remains a design reference.

---

## Decisions made in design review

### 1. Metric model — `leads` dropped

**Decision:** `leads` is removed from the live data model. Only `clicks`, `impressions`, `conversions`, and `spent` are fetched from all platforms.

**Why:** Google Ads, Meta, and LinkedIn do not expose a universal "leads" metric — it depends on campaign objective and conversion action configuration per account. Silently returning zero would be misleading.

**Consequence:** The "Leads" and "Avg CPL" KPI cards are removed from the dashboard when Phase 9 ships. Replaced by a single "Conversions" card. The `leads` field stays in the standalone mock data app as a design placeholder only.

---

### 2. Sub-phase order — Integrations UI before dashboard update

**Decision:** Sub-phase 9f (Integrations connect/disconnect UI) ships before 9e (dashboard replaces mock data).

**Why:** If the dashboard drops mock data before users can connect platforms, it just shows an empty state with no path forward.

**Order:**
```
9a → 9b → 9c → 9d → 9f → 9e → 9g
```

---

### 3. Role-based access

**Decision:** Matches the existing platform pattern.
- `admin` only: connect, disconnect, select account (`POST /connect`, `DELETE /connections`, `POST /accounts/:platform/select`)
- All authenticated roles: view dashboard, trigger manual sync (`GET /metrics`, `POST /metrics/refresh`)

---

### 4. Currency — native per account, no normalization

**Decision:** Each platform displays amounts in its ad account's native currency (stored in `ad_accounts.currency`) with the ISO code shown next to values (e.g. `₹`, `$`). No exchange rate conversion.

**Consequence:** The "Total (all visible platforms)" footer row in the table is suppressed when visible platforms have mixed currencies. The "Total Spent" KPI card shows a per-platform breakdown in that case.

---

### 5. Timezone — IST hardcoded

**Decision:** All date range calculations (last 7d, last 30d, this month) use IST (Asia/Kolkata, UTC+5:30) hardcoded in `ads.service.js`. Never derived from server system timezone.

| Range | Start | End |
|---|---|---|
| `last7d` | today − 6 days (IST midnight) | today (IST end of day) |
| `last30d` | today − 29 days (IST midnight) | today (IST end of day) |
| `thisMonth` | 1st of current month (IST midnight) | today (IST end of day) |

---

### 6. CSRF protection — `ad_oauth_state` table

**Decision:** A dedicated `ad_oauth_state` table stores short-lived state tokens for OAuth flows. All three platforms (Google, Meta, LinkedIn) must generate, store, and validate a `state` param.

**Table:**
```
ad_oauth_state(
  state       TEXT PK,   -- 32-byte random hex
  user_id     TEXT,      -- initiating user
  platform    TEXT,
  expires_at  TIMESTAMP  -- created_at + 10 minutes
)
```
Rows deleted on successful validation. Expired rows purged on server start.

---

### 7. Meta scope — read-only only

**Decision:** Meta OAuth requests `ads_read` + `business_management` only. `ads_management` removed — it grants write access and triggers Facebook App Review for write permissions which this dashboard does not need and would fail.

**Note:** `ads_read` still requires App Review in Live mode (typically 1–5 business days). Factor into Phase 9 timeline.

---

## Architecture summary

### New tables (migration `005_ads_integration.js`)
- `ad_oauth_state` — CSRF tokens (10-min TTL)
- `ad_connections` — one OAuth connection per platform per company
- `ad_accounts` — cached list of accessible ad accounts per connection
- `ad_snapshots` — cached metrics JSON, 1-hour TTL, per connection per date range

### New backend
```
backend/
├── routes/ads.js
└── services/
    ├── ads.service.js      # orchestrator + cache
    ├── ads.google.js       # Google Ads API
    ├── ads.meta.js         # Meta Marketing API
    └── ads.linkedin.js     # LinkedIn Campaign Manager API
```

### New API routes (`/api/ads/`)
| Method | Path | Access |
|---|---|---|
| GET | `/connections` | all roles |
| POST | `/connect/:platform` | admin |
| GET | `/callback/:platform` | — (OAuth callback) |
| DELETE | `/connections/:platform` | admin |
| GET | `/accounts/:platform` | all roles |
| POST | `/accounts/:platform/select` | admin |
| GET | `/metrics` | all roles |
| POST | `/metrics/refresh` | all roles |

### Frontend changes
- `AdsDashboard.jsx`: mock data → API call, loading/empty/error states, 5 KPI cards (drop Leads + CPL), platform pills from API response, native currency display, total row conditionally suppressed
- `Integrations` page: new "Paid Ads" section with connect/disconnect cards per platform

---

## Known risks and constraints

| Risk | Detail |
|---|---|
| Google Ads Developer Token | Requires approved application from Google Ads API Center — standard access approval takes weeks |
| Meta App Review | `ads_read` requires review in Live mode — allow 1–5 business days |
| LinkedIn rate limit | 100 requests/day on basic tier — 1-hour cache is essential; higher limits require Marketing Developer Platform approval |
| Mixed currency totals | Total row suppressed when platforms have different currencies — UX needs to clearly communicate why |
