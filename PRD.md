# SEO Audit Platform v2.0 — Product Requirements Document

> **Maintainance rule:** This document must be updated after every code change, feature addition, config change, or schema migration. It is the single source of truth for rebuilding the software from scratch.
>
> **Do not guess. Do not infer missing product behavior unless explicitly confirmed.**
>
> **Last updated:** April 2026 — Phase 7 complete. Integration Hub, Compare Crawls, AuditCategories picker, per-issue CSV export, Settings refactored. Phase 10 planned (Skills Library + Content Pipeline). **Audit check reconciliation complete (Phases 1–3):** canonical 610-row check list produced, gap-mapped, and prioritized (P0/P1/P2). New seed ready: 483 canonical checks (decision: keep/edit) across **23 categories** at `backend/db/seed/audit-checks.js` (migration 018 applied; regenerate seed: `node scripts/generate-audit-checks-seed.js`).

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Confirmed Technical Decisions](#2-confirmed-technical-decisions)
3. [Roles & Permissions](#3-roles--permissions)
4. [Architecture Overview](#4-architecture-overview)
5. [Design System](#5-design-system)
6. [Database Schema](#6-database-schema)
7. [Backend — Server & Middleware](#7-backend--server--middleware)
8. [API Reference](#8-api-reference)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Pages & UI Behaviour](#10-pages--ui-behaviour)
11. [Environment Variables](#11-environment-variables)
12. [Build Phases](#12-build-phases)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [File Structure](#14-file-structure)

---

## 1. Product Overview

A self-hosted, web-based technical SEO audit platform running at a single URL. It crawls websites via a built-in Playwright/Crawlee crawler, runs 483 canonical SEO checks across 23 categories against crawl output, surfaces AI-powered fix recommendations via Anthropic Claude, and integrates with Google Search Console, Google Analytics 4, Linear, Slack, SMTP, and Google Sheets.

**Intended users:** A small internal team (2–5 people). Not a SaaS product. Runs on one machine, serves a private team.

**Single deployment URL:** `http://localhost:3001` in production (Express serves both API and compiled frontend). In development: frontend on `http://localhost:5174`, backend on `http://localhost:3001`.

---

## 2. Confirmed Technical Decisions

These were explicitly confirmed and must not be changed without user instruction.

| Decision | Confirmed value |
|---|---|
| **Repo root** | `/Users/a39326/Documents/Aakash/` |
| **Deployment** | `localhost:3001` — single URL in production |
| **Frontend framework** | React 18 |
| **Router** | `react-router` v7 (NOT `react-router-dom`) |
| **Styling** | Tailwind CSS v4 via `@tailwindcss/vite` plugin. No `tailwind.config.js`. Config is `@theme inline` block inside `theme.css`. |
| **Dark mode** | `.dark` class on `document.documentElement`. Toggled via `localStorage`. Applied before first paint via inline script in `index.html` to prevent FOUC. NOT `data-theme`. |
| **Severity tokens** | `critical / warning / info / pass / none`. `ok` is aliased to `pass` in `SeverityPill` for backward compatibility. |
| **Backend** | Node.js (v20+ required; v25.2.1 in use) + Express v4 + Socket.io v4 |
| **Database** | SQLite via `better-sqlite3` v11. WAL mode. Foreign keys ON. Idempotent migration system. DB file: `backend/seo-automation.db`. |
| **Auth** | JWT in HttpOnly cookie. Global auth middleware (`authMiddleware`). Routes opt OUT via `PUBLIC_PATHS`. Cookie: 7-day maxAge, SameSite=strict, Secure in production only. |
| **Password hashing** | `bcryptjs`, cost factor 12 |
| **Request validation** | Zod (backend). No client-side schema library. |
| **Toast notifications** | `sonner` |
| **Charts** | `recharts` |
| **Icons** | `lucide-react` v0.487 |
| **Font** | JetBrains Mono — self-hosted `.woff2` files in `frontend/public/fonts/`. Regular (400) and Medium (500). |
| **Design source** | Figma Make file `J1sJUWxKyX11FuP7Wg6rOi`. Figma wins on all visual conflicts with this PRD. |
| **Crawler** | Built-in Playwright/Crawlee crawler (`playwright-crawler/`). Dual mode: CheerioCrawler (fast) with automatic PlaywrightCrawler fallback for JS shells. Controlled by `USE_PLAYWRIGHT_CRAWLER` env flag. |
| **M-site vs Desktop** | Option A — user runs two separate crawls manually and selects both in the Compare UI. |
| **Compare mode** | Two existing completed crawl jobs only. No new crawl triggered from compare screen. |
| **Crawl import** | Any subset of URLs is valid — not required to import the full crawl. |
| **AI (Anthropic)** | `ANTHROPIC_API_KEY` in `.env` OR set via Settings UI (stored encrypted in DB). Stubs gracefully when not set. |
| **Google OAuth** | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `.env` |
| **Linear integration** | API token entered via Settings UI (later phase). NOT in `.env`. |
| **Slack** | `SLACK_WEBHOOK_URL` in `.env` |
| **SMTP** | Stubbed. Env vars present; implementation in later phase. |
| **`GET /api/auth/me`** | Returns `200 + { user: null }` when no session. Never returns 401 for this route. |
| **`POST /api/errors`** | Public endpoint (no auth required). Used by frontend error interceptor. |
| **PSI API key** | `PSI_API_KEY` in `.env` |
| **`health_score`** | Added to `crawl_jobs` in migration 004 via `ALTER TABLE`. |

---

## 3. Roles & Permissions

Four roles. The platform is multi-tenant: each company is a fully isolated data silo. All data access is scoped by `company_id` enforced server-side on every query.

| Role | Scope | What they can do |
|---|---|---|
| `superadmin` | Global — no company | Creates and manages companies. Creates admin accounts. Can impersonate any user. Sees all companies via explicit context switch. Manages global settings (Anthropic API key). Exactly one superadmin exists (enforced by DB unique index + backend validation). Cannot be created via invite — bootstrapped via migration. |
| `admin` | One company | Everything within their company: all dashboards, user management, integrations, per-company settings, system health, error log. Cannot change their own role. Cannot delete their own account. Invites `seo` / `readonly` users for their company. Subject to company seat limit. |
| `seo` | One company | Audit dashboard, crawl management, tasks, exports, schedules, notifications within their company. Cannot access system pages. |
| `readonly` | One company | Can view audit results, issue detail, CWV within their company. No crawl actions, no write operations. |

**Account creation flow:**
- Superadmin is bootstrapped via migration 006 (existing admin promoted) or created with default credentials on fresh install (see README).
- Admins are invited by superadmin via a single form (company + admin email). Invite email sent via SMTP; if SMTP not configured, invite URL shown on screen.
- `seo` and `readonly` users are invited by their company's admin. Same 48-hour invite link flow.
- `POST /api/auth/register` is permanently disabled (returns 403). The `/setup` page is retired.

**Access control:**
- `is_paid = false` on a company → all non-superadmin users blocked at login with `402 access_expired`.
- `status = inactive` on a company → same block.
- Superadmin can always access any company regardless of payment status.
- Seat limit enforced at invite creation: if `active_users + pending_invites >= company.max_seats`, invite fails with 400.

**JWT payload:** `{ sub, email, name, role, company_id }`. `company_id` is `null` for superadmin.

---

## 4. Architecture Overview

```
/Users/a39326/Documents/Aakash/
├── backend/                Node.js + Express + Socket.io
│   ├── server.js           App entry point
│   ├── routes/             API route handlers
│   ├── services/           Business logic (crawl runner, SF parser, etc.)
│   ├── middleware/         auth, validate, rateLimiter
│   ├── db/                 SQLite singleton + migrations
│   └── public/             Compiled frontend (production only)
├── ads-dashboard/          Standalone Paid Ads Performance Dashboard (React + TypeScript)
├── playwright-crawler/     Built-in crawler package (ESM, standalone)
│   ├── src/
│   │   ├── crawler.js      Core dual-mode crawler (Cheerio + Playwright)
│   │   ├── index.js        Package entry — exports crawl, toSfFormat, getRobotsTxt
│   │   ├── extractors/     Per-field extractors (meta, headings, canonical, etc.)
│   │   ├── output/         SF-format translation layer (sf-format.js)
│   │   ├── parsers/        robots-txt.js
│   │   └── utils/          url.js, logger.js
│   └── tests/
│       └── parity.test.js  Self-validation + SF CSV diff test
├── frontend/               React 18 + Vite
│   └── src/
│       ├── pages/          Page components
│       ├── components/     Shared UI components
│       ├── context/        React context providers
│       ├── api/            Axios instance
│       ├── styles/         CSS variables + fonts
│       ├── router.jsx      Route definitions
│       ├── App.jsx         Provider tree
│       └── main.jsx        Entry point
└── scripts/                Seed scripts (seed-checks.js)
```

**Dev:** `npm run dev` (root) runs both via `concurrently`. Frontend on `:5174`, backend on `:3001`. Vite proxies `/api` and `/socket.io` to `:3001`.

**Production:** `npm run build` compiles React to `backend/public/`. Express serves both API and static files from port 3001.

---

## 5. Design System

### Theme
- Dark mode default. `.dark` class on `<html>`.
- Applied before first paint via inline script in `frontend/index.html`.
- Toggle persisted in `localStorage` under key `"theme"`.

### CSS Variables (defined in `frontend/src/styles/theme.css`)

**Backgrounds**
| Variable | Light | Dark |
|---|---|---|
| `--bg-base` | `#f8f9fc` | `#0f1117` |
| `--bg-surface` | `#ffffff` | `#1a1d27` |
| `--bg-raised` | `#f1f3f9` | `#222635` |
| `--bg-overlay` | `rgba(0,0,0,0.40)` | `rgba(15,17,23,0.80)` |

**Borders**
| Variable | Light | Dark |
|---|---|---|
| `--border-default` | `#e2e6f0` | `#2d3148` |
| `--border-subtle` | `#edf0f7` | `#1e2235` |
| `--border-strong` | `#c8cfe0` | `#404669` |

**Text**
| Variable | Light | Dark |
|---|---|---|
| `--text-primary` | `#0f1117` | `#e2e8f0` |
| `--text-secondary` | `#475569` | `#94a3b8` |
| `--text-muted` | `#94a3b8` | `#64748b` |
| `--text-disabled` | `#cbd5e1` | `#334155` |

**Brand**
| Variable | Light | Dark |
|---|---|---|
| `--brand` | `#6366f1` | `#6366f1` |
| `--brand-hover` | `#4f46e5` | `#818cf8` |
| `--brand-text` | `#4338ca` | `#a5b4fc` |
| `--brand-subtle` | `rgba(99,102,241,0.08)` | `rgba(99,102,241,0.10)` |

**Severity tokens** (each has: base color, `-bg`, `-text`, `-border`)
| Severity | Light base | Dark base |
|---|---|---|
| `critical` | `#dc2626` | `#ef4444` |
| `warning` | `#d97706` | `#f59e0b` |
| `info` | `#2563eb` | `#3b82f6` |
| `pass` | `#059669` | `#10b981` |
| `none` | `#94a3b8` | `#64748b` |

### Tailwind
All CSS variables exposed to Tailwind via `@theme inline` in `theme.css`. No `tailwind.config.js`. Using `@tailwindcss/vite` plugin.

### Typography
- Font: JetBrains Mono (self-hosted)
- Base font size: `14px` on `html`
- Regular weight: 400 — `JetBrainsMono-Regular.woff2`
- Medium weight: 500 — `JetBrainsMono-Medium.woff2`

### P0 UI Components (in `frontend/src/components/ui/`)

**Button** — variants: `primary`, `secondary`, `destructive`, `ghost`, `outline`. Sizes: `sm` (28px), `md` (34px), `lg` (40px). Props: `loading`, `disabled`, `iconLeft`, `iconRight`.

**Input** — props: `label`, `error`. Shows error text below, red border on error. Focus ring via `boxShadow`.

**Modal** — props: `open`, `onClose`, `title`, `size` (sm/md/lg/xl). Closes on Escape key, overlay click, or X button. Locks body scroll.

**Tabs** — props: `tabs` (array of `{value, label, count?}`), `activeTab`, `onChange`. Active tab has brand-coloured underline.

---

## 6. Database Schema

SQLite file: `backend/seo-automation.db`. All tables created via idempotent migrations in `backend/db/migrations/`.

Migration runner: `backend/db/sqlite.js`. Tracks applied migrations in `_migrations` table. Auto-runs in development. Run manually: `npm run migrate`.

### Migration files

| File | What it does |
|---|---|
| `001_initial.js` | Creates all core tables |
| `002_v3_additions.js` | Adds performance indexes |
| `003_gsc_extended.js` | Extended GSC cache columns |
| `004_task_detail.js` | Adds `task_comments`, adds columns to `task_status`, adds `health_score` to `crawl_jobs` |
| `005_founder_to_admin.js` | Renames `founder` role to `admin`, adds AI token budget settings, adds `cms_type` to sites |
| `006_multi_tenancy.js` | Adds `companies` table, `audit_log` table, `company_id` column to all data tables, partial unique index enforcing single superadmin, seeds Cars24 company, promotes `aakash.srivastava@cars24.com` to superadmin, creates `admin@c24.com` as Cars24 admin |
| `012_company_settings.js` | Adds `company_settings` (key-value settings per company) and `company_oauth_tokens` (GSC/GA4 OAuth tokens per company) tables |
| `013_site_crawl_config.js` | Adds `crawl_config TEXT` column to `sites` table — stores per-site default crawl configuration as a JSON string |
| `015_ai_suggestions_per_url.js` | Adds `result_id INTEGER` (FK → `audit_results.id`, UNIQUE INDEX where NOT NULL) and `feedback INTEGER` (thumbs up +1 / thumbs down -1 / null) columns to `ai_suggestions` |
| `016_sheets_spreadsheet_id.js` | Adds `sheets_spreadsheet_id` to `company_settings` |
| `019_password_version.js` | Adds `users.password_version INTEGER NOT NULL DEFAULT 0` for JWT revocation-on-password-change. Migrations 017–018 exist on disk but are intentionally unapplied — see Phase 11 audit for reconciliation. |
| `017_skills_library.js` | Adds `content_skills` table. Platform-wide AI instruction layer (Phase 10a). |
| `018_content_pipeline.js` | Adds `content_pipeline_runs`, `content_pipeline_steps`, `content_pages`, `content_pipeline_logs` tables. Adds `publish_webhook_url` column to `sites`. (Phase 10b). |

### Tables

#### `companies` (added migration 006)
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | Display name |
| `contact_email` | TEXT | |
| `domain` | TEXT | Informational only — not used for validation |
| `logo_url` | TEXT | External URL — nullable |
| `logo_path` | TEXT | Relative path under `backend/uploads/logos/` — nullable |
| `max_seats` | INTEGER | Default 10. Enforced at invite creation. |
| `plan` | TEXT | `Starter` / `Pro` / `Enterprise` — display label only |
| `is_paid` | INTEGER | `1` = access active, `0` = access expired. Managed by superadmin only. |
| `status` | TEXT | `active` / `inactive`. Inactive = blocked at login. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | Updated on any PATCH |

**Logo upload:** PNG, JPG, SVG, WebP. Max 50 KB. Stored in `backend/uploads/logos/`. Either `logo_url` or `logo_path` may be set — neither is required.

**Seat limit enforcement:** Before creating an invite, count `active users + pending invites` for the company. If `>= max_seats` → 400 `{ error: 'Seat limit reached. Contact your superadmin.' }`.

**Access block:** `is_paid = 0` OR `status = inactive` → login returns `402 { error: 'access_expired' }` for all non-superadmin users. Existing sessions not forcibly invalidated — block applies on next login attempt only.

#### `audit_log` (added migration 006)
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `actor_id` | TEXT | user.id who performed the action |
| `actor_email` | TEXT | Denormalised for readability |
| `action` | TEXT | `impersonate` / `company_created` / `company_deactivated` / `is_paid_toggled` / `admin_invited` |
| `target_type` | TEXT | `company` / `user` |
| `target_id` | TEXT | ID of the affected record |
| `company_id` | TEXT | Company context at time of action |
| `metadata` | TEXT | JSON — any extra context |
| `created_at` | TIMESTAMP | |

Visible only to superadmin. Accessible via Phase 2 Audit Log page under the Admin dropdown.

#### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `email` | TEXT UNIQUE | Stored lowercase |
| `password_hash` | TEXT | bcrypt, cost 12 |
| `name` | TEXT | |
| `role` | TEXT | `superadmin` / `admin` / `seo` / `readonly` |
| `company_id` | TEXT | FK → companies. `NULL` for superadmin. Added migration 006. |
| `avatar_url` | TEXT | nullable |
| `status` | TEXT | `active` / `inactive` |
| `last_active_at` | TEXT | Updated non-blocking on every authed request |
| `must_reset_password` | INTEGER | `0` / `1`. Added migration 008. `1` forces the user to hit `/change-password` before any login; `login` returns `403 password_reset_required` until cleared. |
| `password_version` | INTEGER | Monotonically increasing counter, default `0`. Added migration 019. Embedded in JWTs as the `pv` claim; `change-password` bumps it; `authMiddleware` rejects tokens whose `pv` drifts below the column value. Pre-migration tokens have no `pv` claim and are treated as `pv = 0` (the column default), so existing sessions survive deploy. |
| `created_at` | TIMESTAMP | |

**Superadmin constraint:** `CREATE UNIQUE INDEX idx_single_superadmin ON users(role) WHERE role = 'superadmin'` — DB-level enforcement that exactly one superadmin can exist.

#### `invites`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `email` | TEXT | |
| `role` | TEXT | `admin` (superadmin-issued only) / `seo` / `readonly` |
| `company_id` | TEXT | FK → companies. Set at invite creation, copied to user on accept. Added migration 006. |
| `token` | TEXT UNIQUE | 64-char hex (two UUIDs, hyphens removed) |
| `invited_by` | TEXT | user.id of inviter |
| `expires_at` | TEXT | 48 hours from creation |
| `accepted` | INTEGER | 0 = pending, 1 = accepted |
| `created_at` | TEXT | |

#### `sites`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `company_id` | TEXT | FK → companies. All queries filter by this. Added migration 006. |
| `project_id` | TEXT | nullable |
| `label` | TEXT | Display name |
| `url` | TEXT | Root URL, trailing slash stripped |
| `gsc_property` | TEXT | e.g. `sc-domain:example.com` |
| `ga4_property_id` | TEXT | e.g. `G-XXXXXXXXXX` |
| `color` | TEXT | Hex colour, default `#6366f1` |
| `sheets_tab_name` | TEXT | For Google Sheets export |
| `linear_project_id` | TEXT | For Linear sync |
| `publish_webhook_url` | TEXT | nullable. URL called on content publish (Phase 10b). POST with JSON content page payload. |
| `created_at` | TIMESTAMP | |

#### `crawl_jobs`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `site_id` | TEXT FK → sites | CASCADE DELETE |
| `company_id` | TEXT | FK → companies. Denormalised for query efficiency. Added migration 006. |
| `project_id` | TEXT | nullable |
| `started_at` | DATETIME | Set when job created (queued) |
| `completed_at` | DATETIME | Set on complete/failed/cancelled |
| `status` | TEXT | `queued` / `running` / `completed` / `failed` / `cancelled` |
| `mode` | TEXT | `spider` / `list` / `sitemap` / `sitemap-list` / `import` |
| `total_urls` | INTEGER | Updated live during spider crawl |
| `error_message` | TEXT | Max 500 chars. Set on failure. |
| `config` | TEXT | JSON string — crawl config + output dir path |
| `health_score` | INTEGER | 0–100, set after audit processing (Phase 3) |

**Startup behaviour:** On server start, all jobs with `status IN ('queued', 'running')` are reset to `failed` with message `"Server restarted while crawl was in progress."` — handled by `resetStuckJobs()` in `services/crawl-runner.js`.

#### `audit_results`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `crawl_job_id` | TEXT FK → crawl_jobs | CASCADE DELETE |
| `site_id` | TEXT FK → sites | CASCADE DELETE |
| `section` | TEXT | Audit category slug |
| `url` | TEXT | Affected URL |
| `data` | TEXT | JSON — additional check-specific data |
| `severity` | TEXT | `critical` / `warning` / `info` / `pass` / `none` |
| `issue_type` | TEXT | Check identifier slug |

#### `audit_checks`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `check_number` | INTEGER UNIQUE | Numeric part of canonical check_id (e.g. C001 → 1) |
| `name` | TEXT | Rule statement ("Title Tag Present") |
| `issue_name` | TEXT | Problem statement shown on findings ("Missing Title Tag") |
| `category` | TEXT | Top-level section, Title Case (23 categories) |
| `subsection` | TEXT | Second-level grouping (e.g. "HTTP Status Codes") |
| `description` | TEXT | Human-readable explanation |
| `implementation_rule` | TEXT | Pseudocode detection logic from CSV |
| `automation_type` | TEXT | `'automated'` \| `'manual'` \| `'hybrid'` |
| `is_automated` | INTEGER | `1` = automated, `0` = manual or hybrid (legacy compat) |
| `severity_default` | TEXT | `'critical'` \| `'warning'` \| `'info'` |
| `created_at` | TIMESTAMP | Auto |

**23 categories (483 active checks):**
Response Codes & Redirects · Canonicalisation · Robots & Crawl Directives · XML Sitemaps · Crawlability & Indexability · URL Structure · JavaScript Rendering · Mobile & Usability · Security & HTTPS · Core Web Vitals ·
Title Tags · Meta Descriptions · Headings · Content Quality · Images · Schema & Structured Data · Internal Linking · International SEO ·
Rankings & Traffic · E-E-A-T Signals · AI Overviews & AIO Optimization · GEO & LLM Crawlers · Local SEO

Seeded by: `scripts/seed-checks.js` (run via `npm run seed`).

#### `manual_check_results` (added migration 021)
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `site_id` | TEXT NOT NULL FK → `sites(id)` | UUID. ON DELETE CASCADE |
| `check_number` | INTEGER NOT NULL | Joins to `audit_checks.check_number` |
| `status` | TEXT | `'pass'` \| `'fail'` \| `'needs_review'` \| NULL (not yet reviewed) |
| `notes` | TEXT | Analyst free-text notes. Max 5000 chars enforced at API layer |
| `updated_at` | TIMESTAMP | Set on every upsert — used to show staleness |

**UNIQUE(site_id, check_number)** — one result row per site per check. Upsert via `ON CONFLICT DO UPDATE`.

Migration history: migration 020 created this table with `site_id INTEGER` (type error). Migration 021 drops and recreates with `site_id TEXT` to match `sites.id` UUID. Any install that ran 020 before 021 has the table recreated on next server start.

#### `gsc_cache`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `site_id` | TEXT FK | |
| `url` | TEXT | |
| `clicks` | INTEGER | |
| `impressions` | INTEGER | |
| `ctr` | REAL | |
| `position` | REAL | |
| `top_query` | TEXT | |
| `period` | TEXT | `current` / `previous` |
| `fetched_at` | DATETIME | |

#### `ga4_cache`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `site_id` | TEXT FK | |
| `url` | TEXT | |
| `sessions` | INTEGER | |
| `engaged_sessions` | INTEGER | |
| `engagement_rate` | REAL | |
| `bounce_rate` | REAL | |
| `avg_session_duration` | REAL | |
| `total_revenue` | REAL | |
| `conversions` | INTEGER | |
| `fetched_at` | TEXT | |
| UNIQUE | (site_id, url) | |

#### `schedules`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `site_ids` | TEXT | JSON array of site IDs |
| `cron_expression` | TEXT | Standard cron format |
| `notify_slack` | INTEGER | 0/1 |
| `notify_email` | INTEGER | 0/1 |
| `enabled` | INTEGER | 0/1 |
| `last_run` | DATETIME | |
| `next_run` | DATETIME | |
| `crawl_results` | TEXT | JSON array of recent job IDs |

#### `settings`
| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | |
| `value` | TEXT | Sensitive values stored AES-256 encrypted |

#### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `name` | TEXT | |
| `slug` | TEXT UNIQUE | |
| `description` | TEXT | |
| `created_by` | TEXT | user.id |
| `created_at` | TIMESTAMP | |

#### `linear_tickets`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `audit_result_id` | TEXT | |
| `site_id` | TEXT | |
| `linear_issue_id` | TEXT | |
| `linear_url` | TEXT | |
| `title` | TEXT | |
| `priority` | INTEGER | |
| `created_at` | TIMESTAMP | |
| `created_by` | TEXT | user.id |

#### `ai_suggestions`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `check_id` | INTEGER | FK → audit_checks |
| `job_id` | TEXT | FK → crawl_jobs |
| `site_id` | TEXT | |
| `section` | TEXT | |
| `response_text` | TEXT | Full Claude response |
| `result_id` | INTEGER | FK → `audit_results.id`. Added migration 015. UNIQUE INDEX where NOT NULL. Enables per-URL caching. |
| `feedback` | INTEGER | Thumbs up (+1) / thumbs down (-1) / null. Added migration 015. |
| `company_id` | TEXT | FK → companies. Added migration 006. |
| `created_at` | TIMESTAMP | |

#### `ai_suggestion_feedback`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `suggestion_id` | TEXT | FK → ai_suggestions |
| `user_id` | TEXT | FK → users |
| `rating` | INTEGER | 1 = helpful, -1 = not helpful |
| `created_at` | TIMESTAMP | |
| UNIQUE | (suggestion_id, user_id) | |

#### `content_skills` (added migration 017 — Phase 10a)
Platform-wide AI instruction layer. Skills are injected into AI prompts across the entire platform — both audit check suggestions and content pipeline steps.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `company_id` | TEXT | FK → companies. NULL for global platform skills. |
| `name` | TEXT NOT NULL | Display name e.g. "E-E-A-T Compliance Rules" |
| `description` | TEXT | One-line summary of what this skill does |
| `skill_type` | TEXT | `writing_style \| seo_rules \| brand_voice \| reference \| tone \| custom` |
| `content` | TEXT NOT NULL | The actual instruction text injected into prompts |
| `applies_to_steps` | TEXT | JSON array of step numbers e.g. `[4,5]`. NULL = applies to all steps. For audit suggestions, treated as applicable always. |
| `applies_to_categories` | TEXT | JSON array of audit category names e.g. `["Content","Title Tags"]`. NULL = all categories. |
| `is_global` | INTEGER | `1` = platform-managed skill (superadmin only). `0` = company skill (admin/superadmin). |
| `is_active` | INTEGER | `1` = active, `0` = disabled. Default 1. |
| `created_by` | TEXT | user.id |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Permission rules:**
- `is_global = 1`: only superadmin can create, edit, or delete
- `is_global = 0`, company skill: admin or superadmin of that company can create/edit/delete
- `seo` and `readonly` roles: view only, cannot modify

**Auto-application rules (audit suggestions):**
Skills are injected automatically based on `applies_to_categories` matching the audit check's category. Company skills for the requesting company are always included if active. Global skills are always included if active and category matches.

**Auto-application rules (content pipeline):**
Skills injected per step based on `applies_to_steps`. If null, injected into all steps.

**Pre-seeded global skills (seeded on migration 017):**
| Name | Skill Type | Applies To Categories | Applies To Steps |
|---|---|---|---|
| Title Tag Rules | seo_rules | Title Tags | 4, 7 |
| Meta Description Rules | seo_rules | Meta Description | 4, 7 |
| Heading Structure Rules | seo_rules | Headings | 4, 5, 7 |
| E-E-A-T Compliance Guidelines | seo_rules | Content | 4, 5, 7 |
| Keyword Density Rules | seo_rules | Content | 5, 7 |
| Internal Linking Strategy | seo_rules | Internal Linking | 5, 7 |
| Schema Markup Guidelines | seo_rules | Schema / Structured Data | 7 |
| AIO Content Quality Framework | seo_rules | LLM / AI Crawlers | 4, 5 |

#### `content_pipeline_runs` (added migration 018 — Phase 10b)
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `company_id` | TEXT | FK → companies |
| `site_id` | TEXT | FK → sites |
| `created_by` | TEXT | FK → users.id |
| `status` | TEXT | `pending \| running \| awaiting_trust_review \| trust_rejected \| completed \| failed \| cancelled` |
| `input_keyword` | TEXT | Seed keyword provided by user |
| `input_context` | TEXT | JSON — `{ business_type, page_type, target_url?, extra_instructions? }` |
| `model_config` | TEXT | JSON — per-step model priority overrides set by user at run creation. Shape: `{ "1": ["deepseek","claude","openai"], "3": ["gemini","claude"], ... }` |
| `current_step` | INTEGER | 1–8. Which step is currently running. |
| `skill_ids` | TEXT | JSON array of `content_skills.id` values selected for this run |
| `started_at` | TIMESTAMP | |
| `completed_at` | TIMESTAMP | |
| `error_message` | TEXT | Max 1000 chars. Set on failure. |
| `created_at` | TIMESTAMP | |

**Default model priority per step (overridable per run):**
| Step | Default Priority |
|---|---|
| 1 — Keyword Expansion | deepseek → claude → openai → gemini |
| 2 — Funnel Mapping | custom logic (no AI) |
| 3 — Intent Classification | gemini → claude → openai → deepseek |
| 4 — Content Brief | openai → claude → gemini → deepseek |
| 5 — Content Generation | claude (extended thinking) → openai → gemini |
| 6 — Trust Layer | human gate (no AI) |
| 7 — SEO Optimization | openai → claude → gemini → deepseek |
| 8 — Publish | system action (no AI) |

**Auto-fallback:** If the primary model's API key is not configured or the API returns an error, the pipeline automatically tries the next model in the priority list. Failure is only recorded if all models in the list fail.

#### `content_pipeline_steps` (added migration 018 — Phase 10b)
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `run_id` | TEXT | FK → content_pipeline_runs. CASCADE DELETE. |
| `company_id` | TEXT | FK → companies |
| `step_number` | INTEGER | 1–8 |
| `step_name` | TEXT | Human-readable e.g. "Keyword Expansion" |
| `model_used` | TEXT | Model that actually ran e.g. `claude-sonnet-4-6`, `deepseek-chat`, `custom-logic` |
| `prompt_used` | TEXT | Full prompt sent to model (including injected skills) |
| `raw_output` | TEXT | Raw response from model |
| `parsed_output` | TEXT | JSON — structured version of raw_output |
| `status` | TEXT | `pending \| running \| completed \| failed \| skipped \| awaiting_trust_review` |
| `tokens_used` | INTEGER | Total tokens for this step |
| `cost_usd` | REAL | Estimated cost in USD |
| `duration_ms` | INTEGER | How long this step took |
| `started_at` | TIMESTAMP | |
| `completed_at` | TIMESTAMP | |
| `error_message` | TEXT | |

#### `content_pages` (added migration 018 — Phase 10b)
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `run_id` | TEXT | FK → content_pipeline_runs |
| `company_id` | TEXT | FK → companies |
| `site_id` | TEXT | FK → sites |
| `created_by` | TEXT | FK → users.id |
| `title` | TEXT | Page title |
| `meta_title` | TEXT | SEO meta title (max 60 chars) |
| `meta_description` | TEXT | SEO meta description (max 160 chars) |
| `h1` | TEXT | Main heading |
| `content_html` | TEXT | Full HTML content |
| `content_markdown` | TEXT | Markdown version |
| `target_keyword` | TEXT | Primary keyword |
| `secondary_keywords` | TEXT | JSON array |
| `schema_markup` | TEXT | JSON-LD schema as string |
| `internal_links` | TEXT | JSON array of suggested internal links |
| `word_count` | INTEGER | |
| `readability_score` | REAL | |
| `seo_score` | INTEGER | 0–100 |
| `status` | TEXT | `draft \| review \| approved \| published \| rejected` |
| `published_at` | TIMESTAMP | |
| `published_url` | TEXT | URL where content was published |
| `override_fields` | TEXT | JSON — fields manually edited by user. These are NEVER overwritten by automation. |
| `last_updated_by` | TEXT | `system` or user.id |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Override protection:** Any field edited via `PATCH /api/content/pages/:id` is added to `override_fields`. The system will never overwrite a field listed in `override_fields` during update loops or re-generation.

#### `content_pipeline_logs` (added migration 018 — Phase 10b)
Append-only event log. Every pipeline action logged here.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `run_id` | TEXT | FK → content_pipeline_runs |
| `step_id` | TEXT | FK → content_pipeline_steps. Nullable. |
| `company_id` | TEXT | FK → companies |
| `site_id` | TEXT | FK → sites |
| `event_type` | TEXT | `run_started \| step_started \| step_completed \| step_failed \| model_fallback \| trust_waiting \| trust_approved \| trust_rejected \| content_generated \| content_published \| content_rejected \| manual_override \| update_loop_triggered` |
| `event_data` | TEXT | JSON — full context of the event |
| `actor` | TEXT | `system` or user.id |
| `created_at` | TIMESTAMP | |

#### `task_status`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `audit_result_id` | TEXT | nullable |
| `site_id` | TEXT FK → sites | CASCADE DELETE |
| `company_id` | TEXT | FK → companies. Added migration 006. |
| `title` | TEXT | |
| `description` | TEXT | |
| `status` | TEXT | `backlog` / `in_progress` / `review` / `done` (underscore, 4 values) |
| `assignee_id` | TEXT | user.id |
| `linear_ticket_id` | TEXT | |
| `linear_url` | TEXT | |
| `created_by` | TEXT | user.id |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |
| `priority` | TEXT | `low` / `medium` / `high` / `critical`. Default `medium`. |
| `due_date` | TEXT | |
| `issue_type` | TEXT | |
| `issue_section` | TEXT | |
| `affected_urls_count` | INTEGER | Default 0 |

#### `task_comments`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `task_id` | TEXT FK → task_status | CASCADE DELETE |
| `user_id` | TEXT | FK → users |
| `body` | TEXT | |
| `created_at` | TIMESTAMP | |

#### `notifications`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `user_id` | TEXT | nullable — null = broadcast |
| `type` | TEXT | e.g. `crawl_complete`, `new_issue` |
| `title` | TEXT | |
| `body` | TEXT | |
| `link` | TEXT | |
| `is_read` | INTEGER | 0/1 |
| `created_at` | TIMESTAMP | |

#### `error_log`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `level` | TEXT | `error` / `warn` / `info` |
| `source` | TEXT | `frontend` / `backend` |
| `message` | TEXT | |
| `stack` | TEXT | |
| `user_id` | TEXT | nullable |
| `url` | TEXT | Page URL at time of error |
| `created_at` | TIMESTAMP | |

### Indexes (migration 002)
```sql
idx_audit_results_job       ON audit_results(crawl_job_id)
idx_audit_results_section   ON audit_results(section)
idx_audit_results_severity  ON audit_results(severity)
idx_audit_results_site      ON audit_results(site_id)
idx_audit_results_site_job  ON audit_results(site_id, crawl_job_id)
idx_audit_results_url       ON audit_results(url)
idx_gsc_cache_site_url      ON gsc_cache(site_id, url)
idx_ga4_cache_site_url      ON ga4_cache(site_id, url)
idx_notifications_user      ON notifications(user_id, is_read)
idx_task_status_site        ON task_status(site_id, status)
idx_crawl_jobs_site         ON crawl_jobs(site_id, started_at DESC)
idx_error_log_created       ON error_log(created_at DESC)
```

---

## 7. Backend — Server & Middleware

### `backend/server.js`
Entry point. Startup order:
1. `validateEnv()` — checks required/optional env vars, exits in production if required vars missing
2. `import db` — triggers auto-migration in development
3. Helmet (CSP: `defaultSrc self`, `scriptSrc self unsafe-inline`, `connectSrc self + api.anthropic.com`)
4. CORS (origin from `FRONTEND_URL`, credentials true)
5. `express.json` (10MB limit), `express.urlencoded` (10MB), `cookie-parser`
6. Socket.io (same CORS origin)
7. `authMiddleware` — global, applied before all routes
8. `apiLimiter` — 300 req/min on `/api/*`
9. Routes registered: `/api/auth`, `/api/sites`, `/api/crawls`, `/api/errors`, `/api/reports`, `/api/gsc`, `/api/ga4`, `/api/ai`, `/api/dashboard`, `/api/tasks`
10. `resetStuckJobs()` — resets queued/running jobs to failed
11. Static file serving in production from `backend/public/`
12. Global error handler

### `backend/middleware/auth.js`
`authMiddleware`: Applied globally. Routes opt out via `PUBLIC_PATHS` (matched by exact method + path — no prefix matching).

**Public paths (no auth required):**
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `POST /api/auth/register`
- `GET  /api/auth/setup-status`
- `GET  /api/auth/invite/validate`
- `POST /api/auth/invite/accept`
- `POST /api/auth/change-password`
- `GET  /api/ads/callback/google`
- `GET  /api/ads/callback/meta`
- `GET  /api/ads/callback/linkedin`
- `GET  /api/gsc/callback`
- `GET  /api/ga4/callback`
- `GET  /api/health`
- `POST /api/errors`

On success: sets `req.user = { sub, email, name, role, company_id }`. `company_id` is `null` for superadmin. Non-blocking `last_active_at` update via `setImmediate`.

`requireRole(...roles)`: Factory that returns a middleware checking `req.user.role` is in the allowed list. Returns 403 if not. Applied to, among others:
- `/api/sites` POST/PATCH/DELETE → `admin`, `superadmin` (mutation guard)
- `/api/ai/suggest` POST and `/api/ai/suggest/:id/feedback` POST → `admin`, `seo`, `superadmin` (readonly users cannot trigger paid AI calls)

**Admin → admin promotion:** `POST /api/auth/invite` (line 161) and `PATCH /api/auth/users/:id` (line ~405) both refuse a request from an `admin` actor that would yield another `admin` role, preventing admin proliferation within a company without superadmin involvement.

### `backend/middleware/rateLimiter.js`
| Limiter | Window | Max | Used on |
|---|---|---|---|
| `authLimiter` | 15 min | 20 requests | `POST /login`, `POST /invite/accept` |
| `apiLimiter` | 1 min | 300 requests | All `/api/*` |
| `aiLimiter` | 1 min | 10 requests | AI recommendation endpoints (Phase 3+) |
| `errorLimiter` | 1 min | 30 requests | Error reporting endpoints |

### `backend/services/secret-store.js`
Central helper for credential-class settings. Callers read with
`getGlobalSetting(key)` / `getCompanySetting(companyId, key)` and write
with `setGlobalSetting(key, value)` / `setCompanySetting(companyId, key, value)`.
`SECRET_KEYS` defines the set that is auto-encrypted at rest via
`services/ads.crypto.encryptToken`: `anthropic_api_key`, `psi_api_key`,
`linear_api_key`, `slack_webhook_url`, `smtp_pass`. Non-secret keys are
stored verbatim. Reads are idempotent for legacy plaintext so the migration
to encrypted storage is seamless. `GET /api/settings` never returns a
cleartext secret — if a known-secret key is present, the response value is
the sentinel `"__set__"`, which the Settings UI renders as a populated
password field with a "(saved — type to replace)" placeholder. A `PUT` that
re-submits `"__set__"` is a no-op for that field.

### `backend/services/oauth-state.service.js`
Provider-agnostic server-bound OAuth state. `createState(userId, provider, context)`
returns a random 32-byte hex token stored in `ad_oauth_state` with a 10-minute
expiry and `(userId, encodedProvider)` binding; the encoded provider allows
extra context such as `{ companyId }` without a schema change.
`consumeState(state, expectedProvider)` deletes the row (single-use) and
returns `{ userId, provider, context }`. Used by GSC/GA4 `/auth` + `/callback`
to replace the previous client-side JSON state token.

### `backend/lib/url-safety.js`
`assertSafeOutboundUrl(url)` — SSRF guard. Rejects non-http(s) schemes and
any target whose resolved IP falls in a private, loopback, link-local, ULA,
multicast, or documentation range (both IPv4 and IPv6, including
IPv4-mapped-IPv6 forms). Called from `crawl-runner.startCrawl` and
`sitemap-fetcher.fetchText` before any outbound request.

### `backend/startup-audit.js`
`auditSeededPasswords(db)` — self-check invoked from `server.js` after
migrations and `seedAuditChecks`. Reads every `admin` / `superadmin` row and
`bcrypt.compareSync`s the stored hash against the known migration
defaults (`ChangeMe123!`, `SuperAdmin123!`). If a match is found, prints a
loud multi-line warning to stderr with rotation instructions. Never throws
— the server keeps booting so operators are not locked out. Migration 006
files are immutable (CLAUDE.md rule #9), so this runtime warning is the
supported mitigation for SEC-H5.

### `backend/middleware/validate.js`
Zod schema validation for `req.body`. On failure: `400` with `{ error: 'Validation failed', details: fieldErrors }`. On success: replaces `req.body` with parsed + coerced data.

### `backend/services/crawl-runner.js`
Manages crawl jobs. Routes to the built-in Playwright crawler when `USE_PLAYWRIGHT_CRAWLER=true`.

**Exports:**
- `CRAWL_DATA_DIR` — `backend/crawl-data/` (auto-created)
- `getJobDir(jobId)` — returns `backend/crawl-data/{jobId}/`, creates if missing
- `resetStuckJobs()` — resets queued/running jobs to failed on startup
- `startCrawl(job, io)` — starts crawl, updates DB, emits Socket.io events
- `cancelCrawl(jobId)` — cancels a running crawl, marks job cancelled
- `pauseCrawl(jobId)` — pauses a running crawl
- `resumeCrawl(jobId)` — resumes a paused crawl

**SSRF guard:** `startCrawl` calls `lib/url-safety.assertSafeOutboundUrl(startUrl)` before any network activity. The helper refuses non-http(s) schemes and any target that resolves to an RFC 1918, loopback, link-local, or IPv6 unique-local / link-local / documentation address, including IPv4-mapped v6 forms. `services/sitemap-fetcher.js` applies the same guard inside `fetchText`, so recursive sitemap indexes cannot pivot into internal addresses either.

**Feature flag:** `USE_PLAYWRIGHT_CRAWLER` constant read from `process.env` at startup. When `true`, `startCrawl()` delegates to `_runPlaywrightCrawl()` and returns immediately.

**`_runPlaywrightCrawl(job, io)` (internal async):**
- Dynamically imports `playwright-crawler/src/crawler.js` and `playwright-crawler/src/output/sf-format.js` (lazy — only loaded when flag is `true`)
- Calls `crawl({ startUrl: url, maxUrls, maxConcurrency: 5, onProgress })` — emits `crawl:progress` per page via `onProgress` callback
- Calls `toSfFormat(pages)` → 12 named datasets
- Writes each dataset to `outputDir/{name}.csv` via `writeDatasetAsCsv()`
- Calls `parseAndStore(jobId, siteId, outputDir, companyId)` — same post-completion step as before
- Supports spider mode only. List/sitemap modes throw a descriptive error.

**`writeDatasetAsCsv(filePath, rows)` (internal):** Serialises an array of row objects to RFC 4180 CSV. Headers taken from keys of first row. Values containing commas, double-quotes, or newlines are quoted and escaped.

**Post-completion (both paths):** Calls `parseAndStore(jobId, siteId, outputDir, companyId)` (async) to populate `audit_results` from CSV files in `outputDir`. Emits `crawl:parsed` when done.

**Socket.io events emitted:**
| Event | Payload | When |
|---|---|---|
| `crawl:progress` | `{ jobId, urlCount, message, status }` | Per page crawled (Playwright path) |
| `crawl:complete` | `{ jobId, totalUrls }` | Crawl finished |
| `crawl:parsed` | `{ jobId, findings }` | After CSV parsing completes |
| `crawl:error` | `{ jobId, error }` | Crawl failed |
| `crawl:updated` | `{ jobId, status, totalUrls?, findings? }` | Broadcast to all clients on status change |

**Socket.io rooms:** Clients join `job:{jobId}` or `company:{companyId}` rooms to receive scoped events. Every Socket.io connection is authenticated by a handshake middleware that verifies the `auth_token` cookie JWT; anonymous connections are rejected. `join:job` is additionally authorised by looking up the job's `company_id` and rejecting if it does not match the caller's company (superadmin bypasses). `join:company` is rejected unless the supplied `companyId` matches the caller's (superadmin bypasses).

### `playwright-crawler/` — Built-in Crawler Package
Standalone ESM Node.js package. Called by `crawl-runner.js` when `USE_PLAYWRIGHT_CRAWLER=true`.

**Entry point:** `playwright-crawler/src/index.js` — exports `crawl`, `toSfFormat`, `getRobotsTxt`.

**`crawl(options)` → `Promise<object[]>`**

| Option | Default | Description |
|---|---|---|
| `startUrl` | required | Crawl root URL |
| `maxUrls` | `500` | Max pages to crawl |
| `maxConcurrency` | `5` | Parallel requests |
| `timeoutSecs` | `30` | Per-page timeout |
| `onProgress(crawled, queued)` | — | Progress callback |

Dual-mode crawl: every page first attempted with `CheerioCrawler` (fast, no browser). If `isJsShell($)` returns `true` (detects `#root`/`#app`/`#__next` + thin title + body text under 200 chars), the page is re-queued for `PlaywrightCrawler` (full browser render). Uses isolated Crawlee storage per run (`new Configuration({ storageClientOptions: { localDataDirectory: uniqueTempDir } })`).

**`toSfFormat(pages)` → datasets object**

Converts raw page records into 12 named datasets:

| Key | Content |
|---|---|
| `internal_all` | All pages: Address, Content Type, Status Code, Status, Indexability, Title 1/2, Meta Description 1/2, H1-1/2, H2-1, Canonical, Word Count, Text Ratio, Size, Crawl Depth, Unique Inlinks, Unique Outlinks |
| `response_codes_all` | Address, Status Code, Status, Redirect URL, Redirect Type |
| `page_titles_all` | Address, Title 1/2, lengths, Indexability |
| `meta_description_all` | Address, Meta Description 1/2, lengths, Indexability |
| `h1_all` | Address, H1-1/2, lengths, occurrences, Indexability |
| `h2_all` | Address, H2-1/2, lengths, occurrences, Indexability |
| `canonicals_all` | Address, Canonical Link Element 1, Canonical HTTP Header, match flag, Indexability |
| `images_all` | One row per image: Address, Source, Alt Text, Alt Text Length, Missing Alt Text, Alt Text Too Long |
| `structured_data_all` | One row per schema block: Address, Type, Property, Content, Errors, Warnings |
| `structured_data_validation_errors` | Per-block validation errors |
| `structured_data_validation_warnings` | Per-block validation warnings |
| `javascript_all` | Address, Rendered Word Count, Raw Word Count, Rendered Title, Raw Title |

`Unique Inlinks` is computed cross-page after all pages are crawled.

**Extractors** (`playwright-crawler/src/extractors/`):

| File | Extracts |
|---|---|
| `response.js` | Address, Status Code, Status, Content Type, Redirect URL/Type, Response Time, Last Modified, X-Robots-Tag, Vary. `deriveIndexability()` from status code + meta robots + x-robots-tag. |
| `meta.js` | Title 1/2 + lengths + pixel width estimate, Meta Description 1/2 + lengths, Meta Robots, OG tags, Twitter card, Viewport, Meta Refresh |
| `headings.js` | H1-1/2 + H2-1/2 + lengths + occurrences, H3–H6 counts |
| `canonical.js` | Canonical Link Element 1/2, Canonical HTTP Header, match flag, rel=next/prev, hreflang |
| `links.js` | Internal/external link arrays with href, anchor text, nofollow flag. Unique Outlinks count. |
| `images.js` | Per-image: Source, Alt Text, Alt Text Length, Missing Alt Text (True/False), Alt Text Too Long (True/False) |
| `content.js` | Word Count, Text Ratio, Size, Rendered/Raw Word Count, Rendered/Raw Title, Missing Doctype, Missing Language Attr |
| `schema.js` | JSON-LD blocks: Type, Property, Content, Errors, Warnings. Validates required properties per schema type. |
| `resources.js` | JS/CSS/font classification into Critical/Deferrable/Safe to Block/Removable. 25 third-party pattern rules. |

**`getRobotsTxt(siteUrl)` → robots object**

Fetches and parses `robots.txt`. Tests 13 bots: Googlebot, Google-Extended, Bingbot, GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Bytespider, CCBot, Applebot, FacebookBot. Returns per-bot `{ allowed, crawlDelay }`, sitemap URLs found in robots.txt, and flags `_criticalPathBlocked`, `_jsCssBlocked`.

**Dependencies:** `crawlee ^3.13.0`, `playwright ^1.52.0`, `cheerio ^1.0.0`, `p-limit ^6.2.0`, `robots-parser ^3.0.1`

**Test runner:** `node playwright-crawler/test.js <url> [maxUrls]` — crawls URL, writes 14 JSON files to `playwright-crawler/test-output/`, prints console summary table and issues count.

**Parity test:** `node playwright-crawler/tests/parity.test.js <url> [sfCsvDir]` — Mode 1: validates all required columns are present, value constraints (3-digit status codes, Indexable/Non-Indexable values, numeric fields), absolute URL format, no duplicate addresses, title/meta description length fields match actual string lengths. Mode 2 (optional): diffs field-by-field against real SF CSV exports, reports match % per file, target ≥95%.

### `backend/services/sf-parser.service.js`
Exports `parseAndStore(jobId, siteId, outputDir, companyId)` — async function.

Reads CSV files from `outputDir` after a completed crawl and populates `audit_results`. Built-in RFC 4180 CSV parser (no external library) handles quoted fields and BOM stripping. All findings inserted in a single `db.transaction()`. Called by `crawl-runner.js` after both the Playwright crawler path and the import path complete.

**CSV files parsed:**
- `response_codes_all.csv` → Response Codes checks
- `internal_all.csv` → Internal Linking checks
- `page_titles_all.csv` → Title Tags checks
- `meta_description_all.csv` → Meta Description checks
- `h1_all.csv` → Headings checks (H1)
- `h2_all.csv` → Headings checks (H2/H3)
- `images_all.csv` → Image Optimisation checks
- `canonicals_all.csv` → Canonical checks
- `structured_data_all.csv` → Schema / Structured Data checks

Missing files are skipped gracefully (no error). Returns total findings count.

---

## 8. API Reference

### Health

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/health` | Public | — | `{ status, version, environment, timestamp, vars: {key: 'set'/'missing'}, mode: 'full'/'import-only' }` |

### Auth

| Method | Path | Auth | Request body | Response |
|---|---|---|---|---|
| GET | `/api/auth/setup-status` | Public | — | `{ needsSetup: bool }` — `true` only if no `superadmin` exists in DB |
| POST | `/api/auth/register` | — | — | Always `403`. Disabled. Bootstrap via migration 006. |
| POST | `/api/auth/login` | Public | `{ email, password }` | `{ user }` + sets cookie. `401` on bad creds. `403` if user inactive. `402 { error: 'access_expired' }` if company `is_paid=0` or `status=inactive`. |
| POST | `/api/auth/logout` | Public | — | `{ ok: true }` + clears cookie |
| GET | `/api/auth/me` | Public | — | `{ user }` or `{ user: null }` — always 200 |
| POST | `/api/auth/users/create` | Admin or Superadmin | `{ name, email, role, password (min 8), company_id? }` — Admin: role must be `seo`/`readonly`, company inferred from JWT. Superadmin: any role, `company_id` required. | `{ user }`. 409 if email already exists. 403 if admin tries to create admin. Creates user immediately — no email or token required. |
| POST | `/api/auth/invite` | Admin or Superadmin | Admin: `{ email, role: 'seo'/'readonly' }` — company inferred from JWT. Superadmin: `{ email, role: 'admin', company_id }` | `{ inviteUrl, token, expiresAt }`. Token expires 48h. If SMTP configured, email sent; otherwise `inviteUrl` must be shared manually. `400` if seat limit reached. Note: invite URL path mismatch — backend generates `/invite/<token>` but frontend route is `/invite/accept?token=<token>`. Use direct user creation (`/api/auth/users/create`) instead. |
| GET | `/api/auth/invite/validate` | Public | `?token=` | `{ email, role, company_name }`. 400 if invalid/expired. |
| POST | `/api/auth/invite/accept` | Public | `{ token, name, password (min 8) }` | `{ user }` + sets cookie. Creates user with `company_id` from invite. |
| GET | `/api/auth/users` | Admin or Superadmin | Admin: returns own company users only. Superadmin: requires `?company_id=` | `{ users: [...], invites: [...pending...] }` |
| PATCH | `/api/auth/users/:id` | Admin or Superadmin | `{ role?, status?, name? }` (at least 1 field). Admin: target must share same `company_id`. | `{ user }`. 403 if modifying own role. |
| DELETE | `/api/auth/users/:id` | Admin or Superadmin | Admin: target must share same `company_id`. | `{ ok: true }`. 403 if deleting self. |
| POST | `/api/auth/impersonate` | Superadmin | `{ user_id: uuid }` | Issues 4h JWT with `impersonated_by` claim; sets `auth_token` cookie. Logs `user.impersonate` audit event. Blocked if already impersonating, target is inactive/superadmin/self. |
| POST | `/api/auth/impersonate/end` | Any authed (impersonating) | — | Re-issues JWT as original superadmin; clears impersonation. Logs `user.impersonate_end` audit event. |

**User object shape:** `{ sub, email, name, role, company_id, avatar_url? }`

**JWT:** HS256, 7-day expiry. Cookie name: `auth_token`. HttpOnly, SameSite=strict, Secure in production. Payload includes `company_id` (null for superadmin).

### Companies (Phase 2 UI — backend foundation in Phase 1)

All routes require `superadmin` role.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/companies` | Superadmin | — | Array of company objects |
| POST | `/api/companies` | Superadmin | `{ name, contact_email?, domain?, max_seats?, plan?, admin_email }` | Created company + pending invite for admin |
| GET | `/api/companies/:id` | Superadmin | — | Company object |
| PATCH | `/api/companies/:id` | Superadmin | `{ name?, contact_email?, domain?, logo_url?, max_seats?, plan?, is_paid?, status? }` | Updated company object |
| DELETE | `/api/companies/:id` | Superadmin | — | 204. Cascade-deletes all users, sites, crawl data for that company. |
| POST | `/api/companies/:id/logo` | Superadmin | `multipart/form-data`: `logo` (PNG/JPG/SVG/WebP, max 50KB) | `{ logo_path }` |

**Invite URL format:** `{FRONTEND_URL}/invite/{token}` — note: frontend route is `/invite/accept?token=...` — **currently the invite URL generated by the backend uses `/invite/{token}` but the frontend route is `/invite/accept?token=...`. This is a known mismatch to fix in Phase 7.**

### Settings

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/settings` | Admin or Superadmin | `?company_id=` (superadmin only) | `{ settings: { key: value } }` for company settings. Superadmin also gets `global: { key: value }` with Anthropic API key. |
| PUT | `/api/settings` | Admin or Superadmin | `{ settings?: { key: value }, global?: { key: value } }` | `{ ok: true }`. Company keys whitelisted: `slack_webhook_url`, `linear_api_key`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`, `psi_api_key`. Global keys (superadmin only): `anthropic_api_key`. |

### GSC OAuth (per company)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/gsc/auth` | Admin or Superadmin | `?company_id=` (superadmin) | `{ authUrl }` — verifies the target company exists, creates a server-bound OAuth state via `oauth-state.service` (10-min expiry, single-use, bound to user + companyId), returns the Google OAuth initiation URL |
| GET | `/api/gsc/callback` | Public (OAuth callback) | `?code=&state=` | Redirects to `/integrations?gsc_connected=1` or `/integrations?gsc_error=...`. Consumes the state (single-use), stores tokens in `company_oauth_tokens` **encrypted at rest** via `services/ads.crypto`. |
| GET | `/api/gsc/status` | Admin or Superadmin | `?company_id=` | `{ connected, connected_email, connected_at }` |
| DELETE | `/api/gsc/disconnect` | Admin or Superadmin | `?company_id=` | `{ ok: true }`. Removes token row. |
| GET | `/api/gsc/properties` | Admin or Superadmin | `?company_id=` | `{ properties: [{ url, permission_level }] }`. Decrypts the stored tokens; auto-refreshes on expiry and re-encrypts the new access token. |

### GA4 OAuth (per company)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/ga4/auth` | Admin or Superadmin | `?company_id=` (superadmin) | `{ authUrl }` — verifies the target company exists, creates a server-bound OAuth state via `oauth-state.service`, returns the Google OAuth initiation URL |
| GET | `/api/ga4/callback` | Public (OAuth callback) | `?code=&state=` | Redirects to `/integrations?ga4_connected=1` or `/integrations?ga4_error=...`. Consumes the state (single-use), stores tokens in `company_oauth_tokens` **encrypted at rest** via `services/ads.crypto`. |
| GET | `/api/ga4/status` | Admin or Superadmin | `?company_id=` | `{ connected, connected_email, connected_at }` |
| DELETE | `/api/ga4/disconnect` | Admin or Superadmin | `?company_id=` | `{ ok: true }`. Removes token row. |
| GET | `/api/ga4/properties` | Admin or Superadmin | `?company_id=` | `{ properties: [{ name, display_name, property_id }] }`. Decrypts stored tokens; auto-refreshes on expiry and re-encrypts the new access token. |

### Sites

All routes require authentication.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/sites` | Any authed | — | Array of site objects with extra fields: `crawl_count`, `latest_job_id`, `latest_job_status`, `latest_health_score`, `last_crawled_at` |
| POST | `/api/sites` | Any authed | `{ label, url, gsc_property?, ga4_property_id?, color?, sheets_tab_name?, linear_project_id?, project_id?, crawl_config? }` | Created site object. `color` must be `#rrggbb`. `crawl_config` is a JSON string of crawl settings. |
| GET | `/api/sites/:id` | Any authed | — | Site object |
| PATCH | `/api/sites/:id` | Any authed | Partial of POST body. Allowed fields whitelisted server-side. | Updated site object |
| DELETE | `/api/sites/:id` | Any authed | — | 204. Cascades to crawl_jobs, audit_results, etc. |

### Crawls

All routes require authentication.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/crawls` | Any authed | `?site_id=&limit=30&offset=0` | `{ jobs: [...], total }`. Jobs include `site_label`, `site_url`, `site_color`. |
| POST | `/api/crawls` | Any authed | See below | Created job object. 409 if crawl already running for that site. |
| POST | `/api/crawls/import` | Any authed | `multipart/form-data`: `file` (CSV), `site_id` | Created job object. Mode auto-set to `import`. Status immediately `completed`. |
| GET | `/api/crawls/:id` | Any authed | — | Job object with `site_label`, `site_url`, `site_color` |
| POST | `/api/crawls/:id/cancel` | Any authed | — | `{ success: true }`. 400 if not queued/running. |
| DELETE | `/api/crawls/:id` | Any authed | — | 204. Also cancels if running. Cascades to audit_results. |

**`POST /api/crawls` body:**
```json
{
  "site_id": "uuid",
  "mode": "spider | list | sitemap | sitemap-list | import",
  "config": {
    // Spider audit options
    "crawl_sitemap": false,
    "structured_data_validation": true,
    // List mode
    "list_urls": ["https://..."],
    // Sitemap mode (single)
    "sitemap_url": "https://example.com/sitemap.xml",
    // Sitemap-list mode
    "sitemap_urls": ["https://..."],
    // Spider-specific (ignored for list/sitemap modes)
    "max_depth": 5, "max_urls": 500, ...
  }
}
```

**Crawl job status flow:** `queued` → `running` → `completed` / `failed` / `cancelled`

**Import mode:** CSV file uploaded via multipart. Rows counted (minus header). Job immediately set to `completed`. File stored in `backend/uploads/`. Max file size: 250 MB. Only `.csv` accepted.

**Spider mode:** Crawler started via `setImmediate`. Follows links from `startUrl` up to `max_urls`. Emits Socket.io progress events.

**List mode:** Audits only the provided URLs without following links. URLs written to `crawl-data/{jobId}/url-list.txt` before crawl starts.

**Sitemap mode:** Fetches the sitemap URL and audits all discovered URLs.

**Sitemap-list mode:** Accepts multiple sitemap URLs (one per line); URLs written to `crawl-data/{jobId}/sitemap-list.txt` before crawl starts.

Note: The built-in Playwright crawler (`USE_PLAYWRIGHT_CRAWLER=true`) currently supports spider mode only. List/sitemap modes return a descriptive error if the flag is enabled.

All crawl modes emit Socket.io progress events.

### Errors

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/errors` | Public | `{ level: 'error'/'warn'/'info', source: 'frontend'/'backend', message, stack?, url? }` | 204 |
| GET | `/api/errors` | Any authed | `?limit=100&offset=0&level=` | `{ errors: [...], total }` |

### Reports

All routes require authentication.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/reports/checks/count` | Any authed | — | `{ total, seeded }` — count of seeded audit checks |
| GET | `/api/reports/:siteId/summary` | Any authed | — | See below |
| GET | `/api/reports/:siteId/trend` | Any authed | — | `{ trend: [...] }` — last 10 completed jobs in chronological order, each with `id`, `started_at`, `completed_at`, `health_score`, `total_urls` |

**`GET /api/reports/:siteId/summary` response:**
```json
{
  "jobId": "uuid",
  "totalUrls": 500,
  "startedAt": "2026-04-12T...",
  "completedAt": "2026-04-12T...",
  "healthScore": 82,
  "totals": { "critical": 1, "warning": 3, "info": 12 },
  "sections": {
    "Response Codes": { "critical": 1, "warning": 2, "info": 0, "ok": 0 }
  },
  "checkCounts": [{ "category": "...", "severity_default": "...", "total": 5 }],
  "allChecks": [{ "name": "...", "category": "...", "severity_default": "..." }],
  "issueTypeCounts": [{ "issue_type": "...", "count": 3 }],
  "coveredSections": ["Response Codes", "Title Tags"]
}
```
`coveredSections` = categories that have any rows in `audit_results` for this job. Used by the frontend to distinguish "passed" (covered + no issues) from "no data" (not covered).

`healthScore` is computed as `max(0, round(100 - (critical*3 + warning*2 + info*1) / totalUrls * 10))` and persisted back to `crawl_jobs.health_score` if not already set.

### Reports (continued — Phase 3 + Phase 4a additions)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/reports/:siteId/category` | Any authed | `?section=<name>&job_id=<optional>` | `{ jobId, section, groups: [{ issue_type, severity, count }], covered: boolean }`. Groups ordered by severity rank then count DESC. `covered` is `true` if the section has any rows for this job. `{ jobId: null, section, groups: [], covered: false }` if no completed job. |
| GET | `/api/reports/:siteId/issues` | Any authed | `?section=<name>&issue_type=<name>&job_id=<optional>&limit=50&offset=0` | `{ results: [{ id, url, severity, data }], total, limit, offset }`. Max limit 200. |
| GET | `/api/reports/results/:resultId` | Any authed | — | `{ result: { id, url, issue_type, section, severity, data }, check: { id, name, description, seo_impact, implementation_rule, subsection } \| null }`. 404 if not found. 403 if wrong company. `check` is null if no matching `audit_checks` row. |
| GET | `/api/reports/:siteId/developer-summary` | Any authed | — | `{ job: { id, total_urls, health_score, started_at, completed_at, duration_seconds } \| null, response_codes: { 2xx, 3xx, 4xx, 5xx }, top_issues: [{ issue_type, section, severity, count }], custom_extraction: [{ id, url, issue_type, data }] }`. Top 10 issues by severity then count. Up to 50 custom extraction rows. |
| GET | `/api/reports/:siteId/issues/export` | Any authed | `?section=<name>&issue_type=<name>` (both required) | `text/csv` download. Filename: `<section-slug>-<issue_type-slug>.csv`. Columns: `url` + all `data` JSON keys. Uses latest completed job. 400 if params missing, 404 if no completed job. |

### Manual Checks

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/sites/:siteId/manual-checks` | `seo` / `admin` / `superadmin` | — | `{ checks: [ { check_number, name, category, severity_default, implementation_rule, status, notes, updated_at } ] }`. All 38 `automation_type='manual'` checks LEFT JOINed with saved results for this site. Sorted by category then check_number. `status` / `notes` / `updated_at` are null if not yet reviewed. 404 if site not found. 403 if wrong company. |
| PUT | `/api/sites/:siteId/manual-checks/:checkNumber` | `seo` / `admin` / `superadmin` | `{ status?, notes? }` — both optional. `status` must be `'pass'`, `'fail'`, `'needs_review'`, or `null`. Notes max 5000 chars. | Updated check row in the same shape as a single GET item. Upserts `manual_check_results`. Sets `updated_at = CURRENT_TIMESTAMP`. 400 if invalid status or notes too long. 404 if site not found or check not a manual check. 403 if wrong company. `readonly` role returns 403. |

### Compare

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/compare/jobs` | Any authed | — | `{ jobs: [{ id, siteId, siteLabel, startedAt, totalUrls, healthScore }] }` — all completed jobs for the company, newest first. |
| GET | `/api/compare` | Any authed | `?jobA=<id>&jobB=<id>` | `{ jobA: { id, siteLabel, startedAt, totalUrls, healthScore }, jobB: { ... }, summary: { scoreDelta, criticalDelta, warningDelta, infoDelta, urlsDelta }, rows: [{ section, issue_type, severity, countA, countB, delta }] }`. Rows sorted by `abs(delta)` DESC. 400 if same job IDs or params missing. 404/403 per job. |

### GSC Data

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/gsc/:siteId/summary` | Any authed | — | `{ clicks, impressions, ctr, position, clicks_delta, impressions_delta }`. Aggregates `gsc_cache` WHERE `period='current'`. Deltas = current minus previous period totals. Returns all zeros if no data. 404 if site not found, 403 if wrong company. |
| GET | `/api/gsc/:siteId/queries` | Any authed | — | `{ queries: [{ query, clicks, impressions, ctr, position }] }`. Top 25 queries by clicks, grouped by `top_query` WHERE `period='current'`. |
| GET | `/api/gsc/:siteId/pages` | Any authed | — | `{ pages: [{ url, clicks, impressions, ctr, position }] }`. Top 50 pages by clicks, WHERE `period='current'`. |

### GA4 Data

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/ga4/:siteId/summary` | Any authed | — | `{ sessions, bounce_rate, avg_duration }`. Aggregates `ga4_cache` for the site. Returns zeros if no data. 404/403 same access control as GSC. |
| GET | `/api/ga4/:siteId/pages` | Any authed | `?limit=50&offset=0` | `{ pages: [{ url, sessions, bounce_rate, avg_duration }], total, limit, offset }`. Max limit 200. Ordered by sessions DESC. |

### Dashboard

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/dashboard/admin` | Admin or Superadmin | — | `{ sites: [{ id, label, color, url, gsc, ga4, health_score, last_crawl }], task_summary: { backlog, in_progress, review, done } }`. `gsc` is null if no GSC data. `ga4` is null if no GA4 data. `health_score` is null if no completed crawl. Superadmin sees all companies' sites. Admin sees own company only. `task_summary` scoped to company (global for superadmin). |

**`gsc` object:** `{ clicks, impressions, ctr, position, clicks_delta, impressions_delta }`
**`ga4` object:** `{ sessions, bounce_rate, avg_duration }`

### Tasks

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/tasks` | Any authed | `?site_id=&status=&assignee_id=` | `{ tasks: [{ id, title, description, status, priority, site_id, site_label, site_color, assignee_id, assignee_name, due_date, linear_url, created_at, updated_at }] }`. Scoped to company (superadmin sees all). |
| POST | `/api/tasks` | Any authed | `{ title (required), site_id (required), description?, status?, priority?, assignee_id?, due_date?, linear_url? }` | Created task object. `status` defaults to `backlog`. `priority` defaults to `medium`. Valid statuses: `backlog`, `in_progress`, `review`, `done`. Valid priorities: `low`, `medium`, `high`, `critical`. 400 if title or site_id missing, or site not found/wrong company. |
| GET | `/api/tasks/:id` | Any authed | — | `{ task: { ...fields, site_label, site_color, assignee_name }, comments: [{ id, body, created_at, user_id, user_name }] }`. Comments ordered by created_at ASC. 404 if not found. 403 if wrong company. |
| PATCH | `/api/tasks/:id` | Any authed | Any subset of `{ title, description, status, priority, assignee_id, due_date, linear_url }` | Updated task object. 400 if status/priority not in valid list. 404 if not found. 403 if wrong company. |
| POST | `/api/tasks/:id/comments` | Any authed | `{ body (required) }` | `{ comment: { id, body, created_at, user_id, user_name } }`. 400 if body empty. 404/403 same as above. |

### AI Recommendations

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/ai/suggest` | Any authed | `{ result_id: number }` | **Cached path:** `{ cached: true, id: "uuid", suggestion: "..." }`. **Stream path:** SSE (text/event-stream) — token-by-token deltas then done event. Rate limited: 10 req/min per IP. |
| GET | `/api/ai/suggest` | Any authed | `?result_id=<number>` | `{ suggestion: "...", id: "uuid", feedback: null }` or `{ suggestion: null }` if not cached. |
| POST | `/api/ai/suggest/:id/feedback` | Any authed | `{ value: 1 }` (thumbs up) or `{ value: -1 }` (thumbs down) | `{ ok: true }`. Verifies company ownership. |

**AI suggest stream path detail:**
1. Fetch `audit_results` row by `result_id`. 404 if missing, 403 if wrong company.
2. Fetch matching `audit_checks` row (by `name = issue_type OR issue_name = issue_type`). Proceeds even if null.
3. Resolve Anthropic API key: `process.env.ANTHROPIC_API_KEY` → fallback `settings` table key `anthropic_api_key`.
4. No key: `503 { error: 'AI recommendations require an Anthropic API key. Configure it in Settings.' }`
5. Model: `claude-sonnet-4-6`, max 1024 tokens. Streaming via `client.messages.stream()`.
6. On stream end: INSERT into `ai_suggestions` (keyed by `result_id`).

**SSE event format:**
```
data: {"type":"delta","text":"The title..."}
data: {"type":"done","id":"<suggestion-uuid>"}
data: [DONE]
```

**Caching:** One suggestion per `result_id`. UNIQUE index on `ai_suggestions(result_id) WHERE result_id IS NOT NULL`. Fetching the same `result_id` again returns the cached result immediately without calling the API.

### Skills Library (Phase 10a)

Registered as `/api/skills` in `server.js`.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/skills` | Any authed | `?company_id=` (superadmin) | `{ skills: [...] }` — company skills + all active global skills. Each skill: `{ id, name, description, skill_type, content, applies_to_steps, applies_to_categories, is_global, is_active, created_at }` |
| POST | `/api/skills` | Admin or Superadmin | `{ name, skill_type, content, description?, applies_to_steps?, applies_to_categories?, is_global? }` | Created skill object. Only superadmin may set `is_global = 1`. |
| PATCH | `/api/skills/:id` | Admin or Superadmin | Any subset of POST body fields | Updated skill. 403 if non-superadmin tries to edit a global skill. 403 if admin tries to edit another company's skill. |
| DELETE | `/api/skills/:id` | Admin or Superadmin | — | `{ ok: true }`. 403 if non-superadmin tries to delete global skill. Cannot delete pre-seeded global skills (returns 403 with message). |

**Skill injection into AI suggest (`POST /api/ai/suggest`):**
When generating an audit AI suggestion, relevant skills are loaded and appended to the system prompt:
1. Load all active global skills where `applies_to_categories` includes the check's category (or is null)
2. Load all active company skills for the requesting company where `applies_to_categories` includes the check's category (or is null)
3. Append each skill's `content` to the system prompt under a `## Instructions` heading before calling the model

### Content Pipeline (Phase 10b)

Registered as `/api/content` in `server.js`.

#### Pipeline Runs

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/content/runs` | `seo` or `admin` | `{ site_id, keyword, business_type, page_type, extra_instructions?, model_config?, skill_ids? }` | Created run object. Pipeline starts via `setImmediate`. |
| GET | `/api/content/runs` | Any authed | `?site_id=&limit=20&offset=0&status=` | `{ runs: [...], total }` |
| GET | `/api/content/runs/:id` | Any authed | — | Full run object with `steps` array (8 items) |
| POST | `/api/content/runs/:id/cancel` | `seo` or `admin` | — | `{ ok: true }`. Only if `status = pending`. |
| POST | `/api/content/runs/:id/trust-approve` | `seo` or `admin` | `{ checklist: { facts_verified, data_checked, expert_reviewed, brand_approved, compliance_checked } }` | `{ ok: true }`. All 5 checklist booleans must be `true`. Resumes pipeline from Step 7. |
| POST | `/api/content/runs/:id/trust-reject` | `seo` or `admin` | `{ reason }` | `{ ok: true }`. Sets run status to `trust_rejected`. |

#### Content Pages

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/content/pages` | Any authed | `?site_id=&status=&limit=20&offset=0` | `{ pages: [...], total }` |
| GET | `/api/content/pages/:id` | Any authed | — | Full page object including `override_fields` |
| PATCH | `/api/content/pages/:id` | `seo` or `admin` | `{ field: value, ... }` | Updated page. Any updated field added to `override_fields`. |
| POST | `/api/content/pages/:id/approve` | `admin` | — | Sets `status = approved` |
| POST | `/api/content/pages/:id/reject` | `admin` | `{ reason }` | Sets `status = rejected` |
| POST | `/api/content/pages/:id/publish` | `admin` | `{ target_url? }` | Sets `status = published`, records `published_at` + `published_url`. Calls site's `publish_webhook_url` if configured (POST with full content page JSON). |

#### Cost & Logs

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/content/cost-summary` | `admin` | `?site_id=&days=30` | `{ total_runs, total_cost_usd, avg_cost_per_run, cost_by_step: [{ step_number, step_name, model_used, total_cost_usd }] }` |
| GET | `/api/content/runs/:id/logs` | Any authed | — | `{ logs: [...] }` — all log entries for the run, ordered by created_at ASC |

**Validation (Zod):**
- `keyword`: string, min 2, max 200 chars
- `business_type`: string, min 2, max 100 chars
- `page_type`: enum `landing | blog | comparison | category | product | local`
- All routes scope to `company_id` from JWT

**Socket.IO events emitted during pipeline:**
| Event | Payload | When |
|---|---|---|
| `pipeline:step:start` | `{ run_id, step_number, step_name, model }` | Step begins |
| `pipeline:step:complete` | `{ run_id, step_number, cost_usd, duration_ms }` | Step done |
| `pipeline:step:failed` | `{ run_id, step_number, error }` | Step failed |
| `pipeline:model:fallback` | `{ run_id, step_number, from_model, to_model }` | Auto-fallback triggered |
| `pipeline:content:chunk` | `{ run_id, text }` | Step 5 streaming (text chunks only, not thinking) |
| `pipeline:trust:waiting` | `{ run_id }` | Step 6 gate reached |
| `pipeline:trust:approved` | `{ run_id }` | Trust approved, Step 7 starting |
| `pipeline:trust:rejected` | `{ run_id, reason }` | Trust rejected |
| `pipeline:completed` | `{ run_id, page_id }` | All 8 steps done |
| `pipeline:failed` | `{ run_id, step_number, error }` | Run failed |

### Not yet implemented (return 501)

All other `/api/*` endpoints return `501 Not Implemented` until their phase is built.

---

## 9. Frontend Architecture

### Entry Point
`frontend/src/main.jsx` → renders `<App />` in `StrictMode`.

### Provider tree (`frontend/src/App.jsx`)
```
ErrorBoundary
  ToastProvider
    AuthProvider
      SitesProvider
        RouterProvider
        Toaster (sonner)
```

### Contexts

**`AuthContext`** (`frontend/src/context/AuthContext.jsx`)
- Fetches `GET /api/auth/me` on mount
- Exposes: `{ user, isLoading, setUser, logout }`
- `logout()` calls `POST /api/auth/logout` then sets user to null

**`SitesContext`** (`frontend/src/context/SitesContext.jsx`)
- Fetches `GET /api/sites` when user is present
- Active site persisted in `sessionStorage` under key `activeSiteId`
- Exposes: `{ sites, activeSite, setActiveSite, loading, reload, createSite, updateSite, deleteSite }`
- `createSite(data)` → POST + reload + sets new site as active
- `updateSite(id, data)` → PATCH + reload + updates activeSite if matches
- `deleteSite(id)` → DELETE + clears activeSite if matches + reload

**`ToastContext`** (`frontend/src/context/ToastContext.jsx`)
- Wraps sonner's toast API
- Exposes: `{ toast: { success, error, info, warn, loading, dismiss } }`

### API Client (`frontend/src/api/index.js`)
- Axios instance, `baseURL: '/api'`, `withCredentials: true`, `timeout: 30000`
- Response interceptor:
  - Shows sonner toast on all errors **except** 401
  - Logs 5xx errors to `POST /api/errors` (fire-and-forget)

### Router (`frontend/src/router.jsx`)
`createBrowserRouter`. Two wrappers:
- `AuthedShell` — wraps all authed routes in `ProtectedRoute` + `AppShell`
- `AdminOnly` — wraps admin-only routes in `RequireRole roles=['admin']`

### `ProtectedRoute` / `RequireRole`
- `ProtectedRoute`: Shows spinner while auth resolves. Redirects to `/login?from=<path>` if no user. Passes `state.from` for post-login redirect.
- `RequireRole`: Redirects to `/admin` with toast error if role doesn't match.

### `AppShell`
Sidebar (220px expanded / 56px collapsed) + Header (56px) + scrollable main content. Sidebar collapse state managed in `AppShell`.

### Shared Components

| Component | File | Purpose |
|---|---|---|
| `Sidebar` | `components/Sidebar.jsx` | 4-section nav, collapsible, role-filtered |
| `Header` | `components/Header.jsx` | Site selector, search, theme toggle, user menu |
| `SeverityPill` | `components/SeverityPill.jsx` | Coloured badge for critical/warning/info/pass/none/ok |
| `HealthRing` | `components/HealthRing.jsx` | SVG donut ring. Green ≥80, amber 50–79, red <50, grey if null |
| `LoadingSkeleton` | `components/LoadingSkeleton.jsx` | Types: `table` (rows × cols), `card`, `ring` |
| `EmptyState` | `components/EmptyState.jsx` | Icon + message + description + optional action (Link or button) |
| `ErrorBoundary` | `components/ErrorBoundary.jsx` | Class component, catches JS errors, posts to `/api/errors`, shows retry UI |

### Sidebar navigation sections

**MAIN**
- Admin View → `/admin` (admin only)
- Developer View → `/developer`
- SEO View → `/seo`

**PLATFORM**
- Sites → `/sites`
- Crawls → `/crawl/status`
- Paid Ads → `/ads`
- Audit Health → `/audit`
- Audit Categories → `/audit/categories` (custom `isActiveFn` — active for any `/audit/:slug` except `/audit/compare`, `/audit/cwv`, `/audit/custom-extraction`, `/audit/log-file`, `/audit/gsc`, `/audit/ga4`)
- Compare Crawls → `/audit/compare`
- Core Web Vitals → `/audit/cwv`
- Custom Extraction → `/audit/custom-extraction`
- Log File Intel. → `/audit/log-file`

**WORKFLOW**
- Tasks → `/tasks`
- Reports/Exports → `/exports`
- Scheduled Crawls → `/schedules`
- Notifications → `/notifications`

**CONTENT** (seo or admin)
- Content Pipeline → `/content`
- Content Pages → `/content/pages`
- Skills Library → `/skills`

**SYSTEM** (admin only)
- Integrations → `/integrations`
- System Health → `/system`
- Users → `/users`
- Settings → `/settings`

---

## 10. Pages & UI Behaviour

### Public pages (no auth required)

#### `/setup` — First-run Setup
- Shows only when `GET /api/auth/setup-status` returns `{ needsSetup: true }`
- System health check panel (DB, Crawler, Anthropic) — fetches `GET /api/health` on mount
- Check states: `idle` → `checking` → `ok` / `warn`
- Form: full name, email, password (min 8), confirm password
- On submit: `POST /api/auth/register` → sets user → navigates to `/admin`
- Client-side validation: passwords must match, min 8 chars

#### `/login` — Login
- Split layout: 55% brand panel (hidden on mobile), 45% form
- Brand panel: logo mark, tagline, 3 feature bullets (483 checks, AI-powered fixes, self-hosted)
- Form: email, password (with show/hide toggle), error display, submit with loading state
- On submit: `POST /api/auth/login` → sets user → navigates to `location.state.from || '/admin'`

#### `/invite/accept?token=...` — Accept Invite
- On mount: `GET /api/auth/invite/validate?token=` → shows email + role, or error state
- While validating: spinner
- Invalid/expired token: red error card, no form
- Form: full name, password, confirm password
- On submit: `POST /api/auth/invite/accept` → sets user → navigates to `/admin`

### Authenticated pages (built — Phases 1–2)

#### `/sites` — Sites List
- Table showing all registered sites
- Columns: Site (colour dot + label + URL link), Last Crawl (timeAgo), URLs (crawl count), Health (HealthRing), Actions
- Status badge shown under last crawl if latest job is not completed
- Actions: Crawl (navigates to `/crawl` with site set as active), Edit (navigates to `/sites/:id/edit` — **not yet built**), Delete (confirmation modal)
- Delete cascades all crawl jobs and audit results
- Empty state: Globe icon + "Add Site" CTA

#### `/sites/new` — Add New Site
- 5-step wizard: Basic info → Integrations → Crawl config → Connect APIs → Review
- Step 1 (Basic): site name, root URL, colour picker (8 preset hex colours)
- Step 2 (Integrations — optional): GSC property string, GA4 property ID
- Step 3 (Crawl config): full `CrawlConfigPanel` — depth, max URLs, follow settings, URL patterns, headers, auth. Defaults applied from `DEFAULT_CONFIG`.
- Step 4 (Connect APIs): informational links to integrations (no action required)
- Step 5 (Review): shows site name, URL, GSC/GA4 properties, crawl config summary before confirming
- On submit: `POST /api/sites` with `crawl_config` (JSON string) — saved to `sites.crawl_config` column
- Client-side validation: name required, URL must be valid (includes protocol)
- Crawl config set in the wizard is pre-loaded on the Start Crawl page when that site is selected

#### `/crawl` — Start Crawl
- Site selector dropdown (all registered sites)
- **Four tabs: Spider Crawl / List Mode / Sitemap / Import CSV**
- **Spider tab:** depth slider (1–20, default 5), include/exclude URL patterns, plus Audit Options section (Sitemap coverage toggle, Structured Data Validation toggle)
- **List Mode tab:** Info box explaining list mode (audits specific URLs, no link-following). Textarea for URLs (one per line). Live count badge. On submit: `POST /api/crawls` with `mode: 'list'`, `config.list_urls: string[]` → navigates to `/crawl/{jobId}/live`
- **Sitemap tab:** Info box. Radio: Single sitemap / Multiple sitemaps. Single: URL text input. Multiple: textarea (one sitemap URL per line) with count badge. On submit: `POST /api/crawls` with `mode: 'sitemap'` (single) or `mode: 'sitemap-list'` (multiple) → navigates to `/crawl/{jobId}/live`
- **Import tab:** info box with SF export instructions, drag-and-drop / click CSV upload zone (max 250MB), remove file link
- Error display below tabs
- On spider submit: `POST /api/crawls` → navigates to `/crawl/{jobId}/live`
- On import submit: `POST /api/crawls/import` (multipart) → navigates to `/crawl/status`
- "View Jobs" secondary button always visible

#### `/crawl/status` — Crawl Jobs
- Table showing all crawl jobs (filtered to active site by default; toggle to show all)
- Columns: Site (colour dot + label), Status (badge with animated dot for running), Mode, URLs (formatted), Started, Duration, Actions
- Running banner shown if any active jobs
- Live updates via Socket.io (`crawl:updated`, `crawl:complete` events) — refetches on event
- Actions: Live (→ `/crawl/{jobId}/live`, shown for queued/running), Cancel (shown for queued/running), View Audit (→ `/audit`, shown for completed), Delete (icon, disabled while running)
- Delete confirmation modal
- Empty state: Activity icon + "Start Crawl" CTA

#### `/crawl/:jobId/live` — Live Run
- Fetches job from `GET /api/crawls/:id` on mount
- Connects to Socket.io, joins room `job:{jobId}`
- Job header: site colour + label, job ID (mono), URL counter (large number), status badge, Cancel / View Audit buttons
- **Two tabs: CRAWL (default) and LOG**
- **CRAWL tab:**
  - Progress bar: % from `SpiderProgress` lines (`/SpiderProgress\s*\[mActive=(\d+),\s*mCompleted=([\d,]+),\s*mWaiting=([\d,]+),\s*mCompleted=([\d.]+)%\]/`)
  - 4 stat cards: Active Threads / Completed / Queued / URLs per sec
  - URLs/sec computed as delta completed ÷ delta time between SpiderProgress ticks
  - Live URL feed: URLs extracted from log lines via `/https?:\/\/[^\s"']+/`, last 200 kept, auto-scrolls
- **LOG tab:**
  - Scrolling terminal output, auto-scroll toggle, log line count
  - Log line colours: error=red, success=green, warn=amber, default=secondary
- Cancel: `POST /api/crawls/:id/cancel` → updates local job state + appends log line
- Back link → `/crawl/status`
- Error message shown if `job.error_message` is set

#### `/audit` — Audit Health
- Fetches `GET /api/reports/:siteId/summary`, `GET /api/reports/:siteId/trend`, `GET /api/reports/checks/count` in parallel on mount. Also fetches `GET /api/sites/:siteId/manual-checks` sequentially after (best-effort — failure does not block the page)
- **Health ring + KPI cards:** SVG donut ring (score 0–100), Critical issues / Warnings / Info count cards
- **Trend chart:** Recharts line chart of health score across last 10 crawls. Shows "Run at least 2 crawls" if fewer than 2 data points
- **SEO Checklist Registry accordion:** one collapsible row per category
  - Header shows: category name, check count, severity totals (or ✓ if no issues)
  - **Manual checks pill** (Phase 4d): shown in the accordion header row alongside severity counts. Red `"N manual flagged"` if any checks are `fail`/`needs_review`; grey `"N unreviewed"` if all are null; hidden if all pass. Links to `/audit/manual-checks/:siteId?category=<category>`.
  - **Expanded panel shows every individual check in the category**, each with:
    - Check name (text)
    - Severity tag (`critical` / `warning` / `info`) from `audit_checks.severity_default`
    - Status: green ✓ if section covered + no issues; red count badge if issues found; grey `—` if section not in `coveredSections` (no SF data for that category)
  - "View details →" link at bottom of expanded panel (routes to category-specific audit page)
- "Start crawl" CTA at bottom

### Authenticated pages (built — Phase 3)

#### `/audit/categories` — Audit Categories Picker (`AuditCategories.jsx`)
- Auth: any authed user, company-scoped
- Fetches `GET /api/reports/:siteId/summary` on mount (same endpoint as AuditHealth)
- **Flat list of all 19 audit categories** sorted by severity: critical → warning → info → pass (covered, 0 issues) → notAudited
- Each row: category name, left-border colour by state, `SeverityBadge` (CRITICAL / WARNING / INFO / ✓ PASS / NOT AUDITED), count pills (critical / warning / info)
- Not-audited rows (section not in `coveredSections`) are greyed out and non-clickable
- Row click navigates to the corresponding `/audit/:slug` page via `SECTION_TO_SLUG` map
- Empty state if no active site; loading skeleton while fetching

#### `/audit/:slug` — Audit Category (`AuditCategory.jsx`)
- Auth: any authed user, company-scoped
- Single component handles all 20 audit category routes (slug → DB section name via shared `lib/auditCategories.js`)
- Fetches `GET /api/reports/:siteId/category?section=<name>` on mount
- **Accordion layout:** one row per issue_type, shows severity pill + count badge
- **On expand (lazy):** fetches `GET /api/reports/:siteId/issues?section=...&issue_type=...&limit=50` — shows URL list with parsed `data` key-value pairs
- **Load more:** increments offset by 50, appends results
- **Export CSV button:** per issue_type — triggers `GET /api/reports/:siteId/issues/export?section=...&issue_type=...`, downloads a CSV of all affected URLs + data fields for the latest completed job
- **URL row click:** navigates to `/audit/issue/:resultId?from=<slug>&issueType=<type>&pos=<n>&total=<n>`
- Empty state if no completed crawl or no issues in this category
- Unknown slug renders "Unknown category" empty state

#### `/audit/issue/:resultId` — Issue Detail (`IssueDetail.jsx`)
- Auth: any authed user, company-scoped
- On mount, three fetches in parallel:
  1. `GET /api/reports/results/:resultId` → result + check definition
  2. `GET /api/ai/suggest?result_id=<resultId>` → populate suggestion if already cached
  3. After fetch 1 resolves: `GET /api/reports/:siteId/issues?section=...&issue_type=...&limit=200` → sibling IDs for prev/next navigation
- **Data panel:** `JSON.parse(result.data)` rendered as two-column key→value table. Falls back to `<pre>` if not valid JSON.
- **Check panel:** shown only if `check` is non-null. Fields: Description, SEO Impact (`seo_impact`), How to Fix (`implementation_rule`).
- **AI recommendation:** "Get AI Recommendation" button → `POST /api/ai/suggest`. Hybrid response: if cached returns immediately, else SSE stream renders token-by-token. After suggestion displayed: thumbs up / thumbs down feedback buttons (`POST /api/ai/suggest/:id/feedback`).
- **Prev / Next navigation:** uses `pos` query param + sibling IDs array loaded on mount. Buttons are disabled (opacity 0.4, `cursor: not-allowed`) when no sibling exists in that direction. If the sibling fetch fails entirely (`siblingError`), both buttons are disabled and show a native tooltip: "Navigation unavailable".
- **Breadcrumb:** back to `/audit/:slug`.
- Error states: 404 if resultId not found, 403 if wrong company, "No Anthropic API key" notice with link to `/settings`.

### Authenticated pages (built — Phase 4a)

#### `/admin` — Admin View (`AdminView.jsx`)
- Auth: admin or superadmin
- Fetches `GET /api/dashboard/admin` on mount
- **Sites table:** columns: Site (colour dot + label), Health Score (HealthRing component), GSC Clicks, GSC Impressions, GSC CTR, GSC Position, GA4 Sessions, GA4 Bounce Rate, Last Crawl
  - GSC cells: show data + delta badge (green/red arrow) if connected, else "Connect GSC" link to `/integrations`
  - GA4 cells: show sessions if connected, else "Connect GA4" link
  - Row click: sets active site + navigates to `/audit`
- **Task KPI row:** 4 KpiCard buttons (Backlog, In Progress, Review, Done), each navigates to `/tasks?status=<status>`
- **Compact Kanban:** 4 columns (Backlog / In Progress / Review / Done), shows top 5 tasks per column, "+N more →" link if over 5, "View all →" link per column
- Empty state if no active site selected

#### `/seo` — SEO View (`SeoView.jsx`)
- Auth: any authed user
- **Two tabs: Analytics and Issues**
- **Analytics tab:**
  - Fetches `GET /api/ga4/:siteId/pages` (paginated, 50 per page, offset-based Load More)
  - Shows GA4 pages table: URL, Sessions, Bounce Rate, Avg Duration
- **Issues tab:**
  - Fetches `GET /api/gsc/:siteId/queries`, `GET /api/gsc/:siteId/pages`, and reports summary in parallel via `Promise.allSettled`
  - CollapsibleSection components for GSC Queries (top 25) and GSC Pages (top 50)
  - Columns: Query/URL, Clicks, Impressions, CTR, Position
- Empty state if no active site

#### `/developer` — Developer View (`DeveloperView.jsx`)
- Auth: any authed user
- Fetches `GET /api/reports/:siteId/developer-summary` on mount
- **Crawl Health section:** 4 StatCards — Total URLs, Health Score, Duration, Completed At
- **Response Codes section:** Recharts BarChart, per-bar colours (2xx=green `#22c55e`, 3xx=amber `#f59e0b`, 4xx=red `#ef4444`, 5xx=dark-red `#7f1d1d`). Only bars with count > 0 shown.
- **Top Issues section:** table showing top 10 issues — issue type, section, severity pill, count. Each row links to `/audit/:slug` via SECTION_SLUG mapping.
- **Custom Extraction section:** table of up to 50 custom extraction results — URL, issue type, data key-value pairs.
- Empty state if no active site or no completed crawl job.

#### `/tasks` — Task Board (`Tasks.jsx`)
- Auth: any authed user
- 4-column Kanban: Backlog / In Progress / Review / Done
- Fetches `GET /api/tasks` on mount (filtered by active site if selected)
- **Drag-and-drop:** Native HTML5 drag-and-drop. Optimistic UI update on drop; reverts on `PATCH` failure with `toast.error`.
- **"allSites" toggle:** Show only active site's tasks or all company tasks.
- **URL filter:** `?status=<status>` query param scrolls/highlights a column on load.
- **New Task Modal:** title (required) + site dropdown (required) + priority selector + description textarea. Posts to `POST /api/tasks`.
- `LoadingSkeleton columns={4}` while loading.

#### `/tasks/:id` — Task Detail (`TaskDetail.jsx`)
- Auth: any authed user
- Fetches `GET /api/tasks/:id` on mount
- 404 state if task not found
- **Left panel:** inline-editable title (onBlur → PATCH), comments thread
- **Right panel:** metadata fields — Status dropdown, Priority dropdown, Site (read-only link), Assignee, Due Date, Linear URL, Created date. Status/Priority changes trigger immediate PATCH.
- **Comments:** `POST /api/tasks/:id/comments`. Appended optimistically. Shows user name + timestamp. Comments ordered by `created_at` ASC.
- Breadcrumb back to `/tasks`.

### Authenticated pages (built — Phase 7)

#### `/audit/compare` — Compare Crawls (`CompareView.jsx`)
- Auth: any authed user, company-scoped
- On mount: fetches `GET /api/compare/jobs` — all completed jobs for the company
- **Two job pickers:** dropdowns from the jobs list. Each option shows `siteLabel · date · URL count · Score`. Resetting either picker clears the comparison result.
- **Compare button:** calls `GET /api/compare?jobA=<id>&jobB=<id>` on both selections
- **Delta summary cards:** 4 cards — Health Score (positive=good), Critical Issues (negative=good/fewer), Warnings (negative=good), Info (negative=good). Colours inverted for issue-count cards so decreases show green.
- **Diff table:** columns — Section, Issue Type, Severity (pill), Job A count, Job B count, Delta (with `DeltaBadge`: `NEW` if only in B, `GONE` if only in A, `—` if delta=0, arrow+number otherwise). Filterable by severity and section. Rows sorted by `abs(delta)` DESC.
- Empty state if fewer than 2 completed jobs exist

#### `/integrations` — Integration Hub (`Integrations.jsx`)
- Auth: admin only (under `AdminOnly` route guard)
- **Tab strip:** All / SEO Data / Analytics / Advertising / CRM / Communication / Developer — filters the cards grid
- **27 integrations** across 6 categories (SEO Data: 5, Analytics: 4, Advertising: 6, CRM: 4, Communication & Workflow: 5, Developer & Data: 3), each rendered as a card with logo, name, description, and a status badge (Connected / Disconnected / Coming Soon)
- **Integration types:**
  - `oauth` (GSC, GA4): Connect button → initiates OAuth flow via `/api/gsc/auth` or `/api/ga4/auth`. Status fetched from `/api/gsc/status` or `/api/ga4/status`. Connected state shows connected email + disconnect button.
  - `apikey` (PSI, Slack, Linear): Inline expand panel with input field. Saves via `PUT /api/settings`. PSI uses key `psi_api_key`; Slack uses `slack_webhook_url`; Linear uses `linear_api_key`.
  - `ads` (Google Ads, Meta Ads, LinkedIn Ads): Connect/disconnect UI calling `/api/ads/connect/:platform` and `/api/ads/disconnect/:platform`. Shows connection status from `/api/ads/connections`.
  - `soon`: Greyed-out card with "Coming Soon" badge — non-interactive.
- **Inline expand/collapse:** clicking a connected/disconnected card expands a panel with the connection form or status details inline.
- OAuth callbacks (GSC, GA4) redirect back to `/integrations?gsc_connected=1` / `/integrations?ga4_connected=1` and show a success toast on load.
- Error feedback shown inline if connect/disconnect fails.

#### `/settings` — Settings (`Settings.jsx`)
- Auth: admin only
- **SMTP section:** form fields — SMTP Host, Port, Username, Password, From Address. Saves to `PUT /api/settings` (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`).
- **Global section** (superadmin only): Anthropic API Key field. Saves to `PUT /api/settings` with `global: { anthropic_api_key }`.
- Integration settings (GSC, GA4, PSI, Slack, Linear) have been moved to `/integrations`. Settings page no longer has integration tabs.

### Authenticated pages (built — Phase 4d)

#### `/audit/manual-checks/:siteId` — Manual Checks (`ManualChecks.jsx`)
- Auth: any authed user, company-scoped
- Fetches `GET /api/sites/:siteId/manual-checks` on mount
- **Header:** "Manual Checks" title + progress summary — `"X of 38 reviewed · Y flagged"`
- **Filter tabs:** All / Unreviewed / Flagged — with per-tab counts
- **Category groups:** collapsible sections using `AUDIT_CATEGORY_GROUPS`. Each header shows group label + `X/Y reviewed` count. Only groups with at least one manual check are rendered.
- **Check row** (per check):
  - Severity badge + check name
  - Three-way status toggle: **Pass** / **Review** / **Fail** — clicking fires `PUT` immediately (optimistic update, reverts on error)
  - Staleness: `"Today"` / `"Xd ago"` / `"Not reviewed"` based on `updated_at`
  - Chevron → expandable notes panel showing `implementation_rule` hint + textarea. Notes saved on `onBlur` only.
- **`?category=<name>` query param** scrolls to and opens the matching group — used by AuditHealth deep-link pills
- `readonly` role users can view but the PUT is blocked server-side (403)

### Phase 10a pages (Skills Library — not yet built)

#### `/skills` — Skills Library (`SkillsLibrary.jsx`)
- Auth: any authed user (view). Admin or superadmin to create/edit/delete.
- **Two-column layout:** Left = skills list grouped by `skill_type`. Right = skill detail / editor panel.
- **List:** each skill shows name, type badge, active/inactive toggle, edit button. Global skills show a "Platform" badge and are read-only for non-superadmin.
- **Skill type filter tabs:** All / Writing Style / SEO Rules / Brand Voice / Reference / Tone / Custom
- **Create button** (admin/superadmin): opens right panel with empty form.
- **Form fields:** Name, Skill Type (select), Description, Content (large textarea — the instruction injected into prompts), Applies to Steps (multi-select checkboxes 1–8, or "All Steps"), Applies to Categories (multi-select of the 19 audit categories, or "All Categories"), Is Global (superadmin only toggle).
- **Pre-seeded global skills** rendered read-only for all non-superadmin users. Superadmin can edit content of global skills.
- **Active toggle:** admin can toggle any company skill on/off. Takes effect immediately on next AI call.
- **Delete:** confirmation modal. Cannot delete pre-seeded platform skills.

### Phase 10b pages (Content Pipeline — not yet built)

#### `/content` — Content Pipeline Dashboard (`ContentDashboard.jsx`)
- Auth: seo or admin
- **"New Content" button:** opens modal with fields — Keyword (required), Site (dropdown, required), Business Type (required text), Page Type (select: landing/blog/comparison/category/product/local, required), Extra Instructions (textarea, optional), Per-Step Model Override (expandable advanced section — shows each of 8 steps with a model priority picker, pre-filled with system defaults), Skills Selection (multi-select from company + global skills).
- **Runs table:** columns — Keyword, Site, Status (badge), Progress (e.g. "3/8"), Est. Cost, Created. Newest first. Click row → `/content/runs/:id`.
- **Filter bar:** by site, by status.
- **Auto-refresh:** table polls every 5 seconds when any run is in `running` status.

#### `/content/runs/:id` — Pipeline Run Detail (`ContentRunDetail.jsx`)
- Auth: any authed
- **Header:** keyword, site, status badge, created by, created at, total cost so far.
- **8-step vertical timeline:** each step is a card showing step name, model used (or "Custom Logic" for Step 2, "Human Gate" for Step 6), status badge, duration, cost, toggle button to expand prompt + raw output.
- **Running step:** spinner animation.
- **Step 5 card:** streaming content rendered in real-time via Socket.IO `pipeline:content:chunk` events. Collapsible "Claude's Reasoning" section (the thinking summary — collapsed by default, never shown in main view).
- **Step 6 card (Trust Layer):** amber "Awaiting Review" badge when active. Shows 5-item checklist: Facts verified, Data/prices checked, Expert review done, Brand voice approved, Legal/compliance checked. User must check all 5 before "Approve" button activates. "Reject" button always available (requires reason input). Only seo or admin can approve/reject.
- **Model fallback notice:** if a fallback occurred, shows inline notice "Tried DeepSeek, fell back to Claude" on that step card.
- **Bottom:** "View Generated Page" button when run status is `completed`.

#### `/content/pages` — Content Pages List (`ContentPages.jsx`)
- Auth: any authed
- **Table:** Title, Keyword, Site, Status (badge), SEO Score, Word Count, Created. Click row → `/content/pages/:id`.
- **Filter tabs:** All / Draft / Review / Approved / Published / Rejected.

#### `/content/pages/:id` — Content Page Editor (`ContentPageEditor.jsx`)
- Auth: any authed (view). seo or admin to edit. readonly role: view only.
- **Two-panel layout:** Left 60% = content editor. Right 40% = SEO metadata panel.
- **Left panel tabs:** Visual (read-only rendered HTML, content sanitized before render), Markdown (textarea), HTML Source (textarea).
- **Right panel fields (all editable by seo/admin):**
  - Meta Title — character counter, red if >60
  - Meta Description — character counter, red if >160
  - H1
  - Target Keyword
  - Secondary Keywords (tag input)
  - Schema Markup (JSON textarea)
  - SEO Score (display only)
  - Internal Links (list with add/remove)
- **Override indicator:** any manually edited field shows a small orange dot + tooltip "Manually overridden — won't be changed by automation". Per-field "Reset to AI version" button removes the field from `override_fields`.
- **Action buttons:** Save Draft, Submit for Review (status = review), Approve (admin only), Reject (admin only, requires reason), Publish (admin only).
- **Publish flow:** admin clicks Publish → confirmation modal with optional target URL input → confirms → POST /api/content/pages/:id/publish → status badge updates to "Published".

### Stub pages (not yet built)

The following routes still render a `Stub` component ("Coming in a later phase"). See `frontend/src/pages/stubs.jsx`.

- `/system` — System Health
- `/errors` — Error Log
- `/audit/custom-extraction` — Custom Extraction
- `/audit/log-file` — Log File Intelligence

---

## 11. Environment Variables

File: `.env` (gitignored). Template: `.env.example`.
Auto-generated on first run via `setup.sh`: `JWT_SECRET` (64 hex chars), `ENCRYPTION_KEY` (32 hex chars).

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3001` | Backend HTTP port |
| `FRONTEND_URL` | **Prod required** | `http://localhost:5173` | Frontend origin for CORS + invite URLs |
| `JWT_SECRET` | **Prod required** | `dev-secret-change-in-production` | Min 64 random chars (`openssl rand -hex 64`). `validate-env.js` hard-fails in production when the secret is below 32 chars, warns loudly when 32–63. |
| `ENCRYPTION_KEY` | **Prod required** | — | 32-byte hex for AES-256 settings. `openssl rand -hex 32` |
| `USE_PLAYWRIGHT_CRAWLER` | No | `false` | Set to `true` to use the built-in Playwright/Crawlee crawler. |
| `GOOGLE_CLIENT_ID` | No | — | Required for GSC + GA4 OAuth |
| `GOOGLE_CLIENT_SECRET` | No | — | Required for GSC + GA4 OAuth |
| `GOOGLE_REDIRECT_URI` | No | — | Must match Google Console: `http://localhost:3001/api/gsc/callback` |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | — | Path to GCP service account JSON for Sheets export |
| `ANTHROPIC_API_KEY` | No | — | Claude AI key. Can also be set via Settings UI (encrypted in DB). |
| `PSI_API_KEY` | No | — | PageSpeed Insights. Unauthenticated (rate-limited) if empty. |
| `SLACK_WEBHOOK_URL` | No | — | Slack incoming webhook URL |
| `SMTP_HOST` | No | — | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | — | From address for outgoing emails |
| `DEEPSEEK_API_KEY` | No | — | DeepSeek API key. Used for Step 1 (Keyword Expansion) in content pipeline. Stubs gracefully if not set — auto-fallbacks to next model in priority list. |
| `GEMINI_API_KEY` | No | — | Google Gemini API key. Used for Step 3 (Intent Classification). Stubs gracefully if not set. |
| `OPENAI_API_KEY` | No | — | OpenAI API key. Used for Steps 4 and 7 (Content Brief, SEO Optimization). Stubs gracefully if not set. |

**Frontend-only env vars (prefix `VITE_`):**

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_SOCKET_URL` | No | `window.location.origin` | Socket.io server URL. Leave unset when frontend and backend share an origin (dev via Vite's `/socket.io` proxy, production via the same host). Set explicitly only when the frontend is hosted on a different origin from the backend. |

---

## 12. Build Phases

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Foundation: CSS system, P0 components, app shell, auth pages (Login, Setup, InviteAccept), backend auth + DB migrations | ✅ Complete |
| **Phase 2** | Sites + Crawl Management: live crawl via Socket.io, import CSV, crawl status page. Built-in Playwright/Crawlee crawler (`playwright-crawler/`) replaces external crawler dependency — dual-mode (Cheerio fast pass + Playwright fallback), 9 extractors, 12 SF-compatible datasets, parity-tested. Wired into `crawl-runner.js` behind `USE_PLAYWRIGHT_CRAWLER` feature flag. | ✅ Complete |
| **Phase 3** | Audit Engine: parse CSV output → `audit_results`, run 291 checks across 19 categories, calculate health score, category pages, issue detail page, AI recommendations | ✅ Complete — CSV parser (9 CSV files → audit_results), health score, AuditHealth accordion, category pages (AuditCategory — all 20 routes), issue detail page (IssueDetail), AI recommendations (`claude-sonnet-4-6` SSE streaming, per-URL caching in `ai_suggestions` via `result_id`, thumbs up/down feedback). |
| **Phase 4a** | Dashboards: Admin View, SEO View, Developer View with real data; Task board | ✅ Complete — Admin View (sites table + GSC/GA4 data + task KPI + compact kanban), SEO View (Analytics + Issues tabs with GA4 pages and GSC queries/pages), Developer View (crawl health stats + response codes BarChart + top issues + custom extraction), Task board (4-column kanban, native drag-and-drop), Task detail page (inline editing + comments + metadata panel). Backend: `/api/dashboard`, `/api/tasks`, GSC data endpoints, GA4 data endpoints, developer-summary endpoint. |
| **Phase 5** | Integrations: GSC overlay, GA4 overlay, PageSpeed Insights | ✅ Complete — `GET /api/psi/analyze` (PSI v5, psiLimiter 15 req/min); `GscOverlay.jsx` (KPI cards + Pages/Queries tabs + connect prompt, role-gated /api/gsc/status); `Ga4Overlay.jsx` (KPI cards + paginated pages table + connect prompt); `CoreWebVitals.jsx` (URL form + mobile/desktop toggle + score gauge + metric cards with Good/NI/Poor thresholds); all 3 pages wired in router, removed from stubs. |
| **Phase 6** | Tasks extensions: Linear sync, scheduled crawls (cron), notifications feed, Slack webhook | ✅ Complete — Scheduled crawls: `node-cron` singleton scheduler (`schedule.service.js`), full CRUD at `/api/schedules` with company scoping, `ScheduledCrawls.jsx` page (cron presets, enabled toggle, per-site multi-select). Notifications: `GET/PATCH/DELETE /api/notifications` with `buildScopeClause` isolation, `Notifications.jsx` page (All/Unread filter, optimistic mutations with rollback, toast errors), Header bell badge with live unread count synced via `notifications:count` custom event. Slack: `sendScheduleNotification` in `slack.service.js` (company_settings lookup → env var fallback, Block Kit payload, 20-line truncation guard). Linear: `createLinearIssue` in `linear.service.js` (Bearer auth, team auto-fetch, `issueCreate` mutation), `POST /api/tasks/:id/sync-linear` (admin-only, idempotency 409 guard, updates `task_status.linear_url` + inserts `linear_tickets`), TaskDetail "Sync to Linear" button. |
| **Phase 7** | Exports (CSV, Sheets), compare view, users management UI, settings UI, integrations UI. | ✅ Complete — Users page (direct user creation, no invite email required), Settings page (SMTP + Global/Anthropic key; integration tabs removed and moved to Integration Hub), Integration Hub (`/integrations`: 27 integrations, tab-strip filter, inline expand panels, OAuth/API-key/Ads/Coming-soon types), Compare Crawls (`/audit/compare`: job pickers, delta summary cards, filterable diff table), AuditCategories picker (`/audit/categories`: flat sorted list of all 20 categories), per-issue CSV export (`GET /api/reports/:siteId/issues/export`). Sheets export remains pending (future phase). |
| **Phase 4b** | Audit-checks PRD re-sync: regenerated `audit-checks` seed from canonical CSV (483 checks, 23 categories). Updated PRD to reflect canonical check count. | ✅ Complete |
| **Phase 4c** | Frontend category taxonomy sync: fixed `auditCategories.js` — renamed `Local SEO & GEO` → `Local SEO`, removed `Backlinks & Authority`, removed Off-Page & Authority group. Replaced hardcoded `CATEGORY_ROUTES` in `AuditHealth.jsx` with derived `SECTION_TO_SLUG` lookup. | ✅ Complete |
| **Phase 4d** | Manual Checks Workflow: `manual_check_results` table (migration 021, `site_id TEXT`), `GET /api/sites/:siteId/manual-checks` + `PUT` upsert route (tenant-isolated, role-gated), `ManualChecks.jsx` page (`/audit/manual-checks/:siteId`) with filter tabs, collapsible category groups, pass/fail/needs_review toggles + notes, AuditHealth integration showing flagged/unreviewed pills per category row. | ✅ Complete |
| **Phase 8** | Polish: empty states, error handling, loading states, production build, pm2 setup | Pending |
| **Phase 9** | Paid Ads API Integration: replace mock data in `AdsDashboard` with live data from Google Ads API, Meta Marketing API, and LinkedIn Campaign Manager API. OAuth per platform, token storage, metrics caching, account selector, date-range-aware fetching. | Planned |
| **Phase 10a** | **Skills Library** — Platform-wide AI instruction layer. Migration `017_skills_library.js` (`content_skills` table). `/api/skills` routes. Pre-seed 8 global skills from audit check knowledge base. Update `POST /api/ai/suggest` to load and inject relevant skills into system prompt. Frontend: `/skills` — `SkillsLibrary.jsx` (two-column layout, type filter tabs, create/edit/delete, active toggle, global badge). | Planned |
| **Phase 10b** | **Content Pipeline** — 8-step multi-model AI content generation. Migration `018_content_pipeline.js` (4 tables + `publish_webhook_url` on sites). AI clients: `backend/services/ai-clients/` (deepseek, gemini, openai, anthropic with extended thinking) + `model-router.js` (per-step priority list + auto-fallback). Pipeline service: `content-pipeline.service.js` (orchestrator) + `backend/services/pipeline-steps/` (8 step handlers). Socket.IO streaming for Step 5 (content generation). Step 6 = Trust Layer (human gate, not skippable). Auto-fallback across models if API key missing or error. `/api/content` routes. Frontend: `/content` (dashboard + new run modal with per-step model override + skills selection), `/content/runs/:id` (8-step timeline, streaming, trust layer checklist), `/content/pages` (list), `/content/pages/:id` (editor with override protection + publish flow). Update loop: node-cron job checks GSC rankings 30/60 days post-publish and re-queues content for regeneration if rankings dropped. New env vars: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`. | Planned |
| **Phase 11** | **Feedback & Learning Loop** — Outcome tracking, pattern extraction, insights dashboard. Separate prompt to be defined after Phase 10 is complete. | Future |
| **Phase 12** | **Cars Demo Website** — Standalone Next.js website powered by the content pipeline. 300 car pages, fully automated. Separate prompt to be defined after Phase 10 + 11 are proven. | Future |
| **Phase 13** | **Billing with Stripe** — Subscription billing, plan tiers, seat limits, usage enforcement. Separate prompt to be defined when first paying client is ready. | Future |

---

## 13. Non-Functional Requirements

- All data stays on-premise — no external data transmission except to explicitly configured integrations
- SQLite WAL mode for concurrent reads during active crawls
- Socket.io for real-time crawl progress (no polling on the live run page)
- CrawlStatus page uses Socket.io events (`crawl:updated`) to refresh the job list
- JWT expiry: 7 days
- Cookie: HttpOnly, SameSite=strict, Secure only in production
- Rate limits: 300 req/min general API; 20 req/15 min auth endpoints; 10 req/min AI endpoints
- Frontend error interceptor: toasts on all non-401 errors; logs 5xx to backend
- Crawler `maxUrls` controls page limit per crawl job (default 500, configurable per job)
- Production: frontend compiled to `backend/public/`, served by Express — single URL
- Startup: stuck crawl jobs (status=queued/running) reset to failed on every server start

---

## 14. File Structure

```
/Users/a39326/Documents/Aakash/
├── .env                                  # Local env (gitignored)
├── .env.example                          # Template with all vars
├── package.json                          # Root — concurrently dev script
├── setup.sh                              # First-run setup script
├── PRD.md                                # This document
├── README.md                             # Operational how-to guide
│
├── scripts/
│   └── seed-checks.js                    # Seeds 483 canonical checks into DB (requires migration 018)
│
├── backend/
│   ├── package.json                      # type:module, dependencies
│   ├── server.js                         # Express app entry
│   ├── validate-env.js                   # Startup env validation
│   ├── seo-automation.db                 # SQLite database (auto-created)
│   ├── crawl-data/                       # Crawler CSV output per job (auto-created)
│   ├── uploads/                          # CSV imports (auto-created)
│   │
│   ├── db/
│   │   ├── sqlite.js                     # DB singleton + migration runner
│   │   └── migrations/
│   │       ├── 001_initial.js            # All core tables
│   │       ├── 002_v3_additions.js       # Performance indexes
│   │       ├── 003_gsc_extended.js       # Extended GSC cache
│   │       ├── 004_task_detail.js        # task_comments, task columns, health_score
│   │       └── 015_ai_suggestions_per_url.js  # Adds result_id + feedback to ai_suggestions
│   │
│   ├── middleware/
│   │   ├── auth.js                       # JWT middleware + requireRole
│   │   ├── rateLimiter.js                # auth/api/ai/error limiters
│   │   └── validate.js                   # Zod body validation factory
│   │
│   ├── routes/
│   │   ├── auth.js                       # /api/auth/*
│   │   ├── sites.js                      # /api/sites/*
│   │   ├── crawls.js                     # /api/crawls/*
│   │   ├── reports.js                    # /api/reports/* (summary, trend, category, issues, result detail, developer-summary)
│   │   ├── errors.js                     # /api/errors
│   │   ├── gsc.js                        # /api/gsc/* (OAuth + summary, queries, pages data endpoints)
│   │   ├── ga4.js                        # /api/ga4/* (OAuth + summary, pages data endpoints)
│   │   ├── ai.js                         # /api/ai/suggest (SSE streaming, cache, feedback)
│   │   ├── dashboard.js                  # /api/dashboard/admin (site + GSC/GA4 + task summary)
│   │   └── tasks.js                      # /api/tasks/* (CRUD + comments)
│   │
│   ├── __tests__/
│   │   ├── gsc-data.test.js              # GSC data endpoint tests
│   │   ├── ga4-data.test.js              # GA4 data endpoint tests
│   │   └── tasks.test.js                 # Tasks CRUD tests
│   │
│   └── services/
│       ├── crawl-runner.js               # Crawl job manager — Playwright path + feature flag
│       ├── sf-parser.service.js          # CSV → audit_results (RFC 4180 parser, 9 CSV files)
│       ├── content-pipeline.service.js   # Phase 10b — pipeline orchestrator (8 steps)
│       ├── pipeline-steps/
│       │   ├── step1-keyword-expansion.js    # DeepSeek (default) — keyword + intent analysis
│       │   ├── step2-funnel-mapping.js       # Custom logic — no AI, proprietary business rules
│       │   ├── step3-intent-classification.js # Gemini (default) — audience + pain points
│       │   ├── step4-content-brief.js        # OpenAI (default) — structured brief generation
│       │   ├── step5-content-generation.js   # Claude Opus extended thinking — streams via Socket.IO
│       │   ├── step6-trust-layer.js          # Human gate — pauses pipeline, emits trust:waiting
│       │   ├── step7-seo-optimization.js     # OpenAI (default) — SEO pass + schema + scoring
│       │   └── step8-publish.js              # System action — DB update + webhook call
│       └── ai-clients/
│           ├── model-router.js               # Per-step priority list + auto-fallback logic
│           ├── deepseek.client.js            # DeepSeek API (OpenAI-compatible). Stubs if no key.
│           ├── gemini.client.js              # Google Generative AI. Stubs if no key.
│           ├── openai.client.js              # OpenAI gpt-4o. Stubs if no key.
│           └── anthropic.client.js           # Anthropic claude-opus-4-5 extended thinking. Streaming.
│
├── playwright-crawler/
│   ├── PLAN.md                           # Build plan (all 4 phases complete)
│   ├── package.json                      # type:module — crawlee, playwright, cheerio, robots-parser
│   ├── test.js                           # Manual test runner — dumps JSON to test-output/
│   ├── src/
│   │   ├── index.js                      # Package entry — exports crawl, toSfFormat, getRobotsTxt
│   │   ├── crawler.js                    # Dual-mode crawler (CheerioCrawler + PlaywrightCrawler)
│   │   ├── extractors/
│   │   │   ├── response.js               # Status code, headers, redirect chain
│   │   │   ├── meta.js                   # Title, meta description, robots, OG, viewport
│   │   │   ├── headings.js               # H1–H6 content + lengths + counts
│   │   │   ├── canonical.js              # Canonical tag + HTTP header + hreflang
│   │   │   ├── links.js                  # Internal/external links, nofollow, outlinks count
│   │   │   ├── images.js                 # src, alt, alt length, missing alt flags
│   │   │   ├── content.js                # Word count, text ratio, size, raw vs rendered
│   │   │   ├── schema.js                 # JSON-LD extraction + validation
│   │   │   └── resources.js              # JS/CSS/font classification (25 pattern rules)
│   │   ├── output/
│   │   │   └── sf-format.js              # Raw records → 12 named CSV-compatible datasets
│   │   ├── parsers/
│   │   │   └── robots-txt.js             # Per-bot robots.txt parsing (13 bots)
│   │   └── utils/
│   │       ├── url.js                    # URL normalisation, scope check, dedup set
│   │       └── logger.js                 # Namespaced logger with LOG_LEVEL support
│   └── tests/
│       └── parity.test.js                # Column presence, constraints, consistency checks
│
└── frontend/
    ├── package.json
    ├── vite.config.js                    # Tailwind plugin, proxy /api + /socket.io → :3001
    ├── index.html                        # FOUC-prevention dark mode inline script
    │
    └── src/
        ├── index.css                     # @import tailwindcss + fonts + theme
        ├── main.jsx                      # ReactDOM.createRoot entry
        ├── App.jsx                       # Provider tree + RouterProvider + Toaster
        ├── router.jsx                    # createBrowserRouter route definitions
        │
        ├── styles/
        │   ├── theme.css                 # CSS variables (light + dark) + @theme inline
        │   └── fonts.css                 # @font-face for JetBrains Mono
        │
        ├── api/
        │   └── index.js                  # Axios instance + error interceptor
        │
        ├── context/
        │   ├── AuthContext.jsx           # user, isLoading, setUser, logout
        │   ├── SitesContext.jsx          # sites, activeSite, CRUD mutations, reload
        │   └── ToastContext.jsx          # toast.success/error/info/warn/loading/dismiss
        │
        ├── components/
        │   ├── AppShell.jsx              # Sidebar + Header + scrollable main
        │   ├── Sidebar.jsx               # Collapsible nav (220px/56px)
        │   ├── Header.jsx                # Site selector, search, theme toggle, user menu
        │   ├── ProtectedRoute.jsx        # Auth guard + RequireRole wrapper
        │   ├── SeverityPill.jsx          # critical/warning/info/pass/none/ok badge
        │   ├── HealthRing.jsx            # SVG donut score ring
        │   ├── LoadingSkeleton.jsx       # table/card/ring skeletons
        │   ├── EmptyState.jsx            # Empty state with optional CTA
        │   ├── ErrorBoundary.jsx         # JS error catch + report
        │   └── ui/
        │       ├── Button.jsx            # primary/secondary/destructive/ghost/outline
        │       ├── Input.jsx             # label + error + focus ring
        │       ├── Modal.jsx             # Overlay modal sm/md/lg/xl
        │       └── Tabs.jsx              # Underline tabs with optional counts
        │
        └── pages/
            ├── Login.jsx                 # /login
            ├── Setup.jsx                 # /setup
            ├── InviteAccept.jsx          # /invite/accept
            ├── NotFound.jsx              # * catch-all
            ├── Sites.jsx                 # /sites
            ├── NewSiteWizard.jsx         # /sites/new
            ├── CrawlStart.jsx            # /crawl
            ├── CrawlStatus.jsx           # /crawl/status
            ├── LiveRun.jsx               # /crawl/:jobId/live (CRAWL + LOG tabs)
            ├── AuditHealth.jsx           # /audit (health ring, trend chart, per-check accordion)
            ├── AuditCategory.jsx         # /audit/:slug — all 20 category routes (accordion + lazy issue load)
            ├── IssueDetail.jsx           # /audit/issue/:resultId — URL detail + AI recommendation
            ├── AdminView.jsx             # /admin — sites table + GSC/GA4 + task KPI + compact kanban
            ├── SeoView.jsx               # /seo — Analytics (GA4 pages) + Issues (GSC queries/pages) tabs
            ├── SkillsLibrary.jsx         # /skills — Phase 10a skills management (two-column, type filter)
            ├── ContentDashboard.jsx      # /content — Phase 10b pipeline runs table + new run modal
            ├── ContentRunDetail.jsx      # /content/runs/:id — 8-step timeline, streaming, trust layer
            ├── ContentPages.jsx          # /content/pages — content pages list with status filter
            └── ContentPageEditor.jsx     # /content/pages/:id — editor with override protection
            ├── DeveloperView.jsx         # /developer — crawl health + response codes chart + top issues + custom extraction
            ├── Tasks.jsx                 # /tasks — 4-column kanban, drag-and-drop, new task modal
            ├── TaskDetail.jsx            # /tasks/:id — inline edit + comments + metadata panel
            └── stubs.jsx                 # Remaining not-yet-built pages
```

---

## 15. Paid Ads Performance Dashboard

Standalone React + TypeScript application located at `ads-dashboard/`. Completely independent of the main SEO Audit Platform — no shared code, no auth, no API calls. Runs entirely off mock data.

### Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript (strict mode) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Bundler | Vite 6 |
| Data | Hardcoded mock data in `src/data/mockData.ts` |

### Dev

```bash
cd ads-dashboard
npm install
npm run dev   # http://localhost:5173
```

### Data Model

```
Platform
  └─ Campaign[]         (clicks, impressions, leads, conversions, spent)
       └─ AdSet[]        (same raw metrics)
            └─ Ad[]      (same raw metrics — leaf node)
```

Raw metrics stored at every node level. Derived metrics (CTR, CPC, CPL, CPM) are **never stored** — always computed on the fly in `src/utils/metrics.ts`.

| Derived metric | Formula |
|---|---|
| CTR | `clicks / impressions` |
| CPC | `spent / clicks` |
| CPL | `spent / leads` |
| CPM | `(spent / impressions) × 1000` |

### Mock Platforms

| Platform | Campaigns |
|---|---|
| Google Ads | Brand Keywords, Competitor Targeting, Used Cars by Category, City Targeting — Delhi NCR |
| Meta | Lead Generation — Mumbai, Retargeting — Website Visitors, Brand Awareness — Tier 2 Cities |
| LinkedIn | B2B Dealer Acquisition, Talent Acquisition — Tech |

### Components

| File | Responsibility |
|---|---|
| `src/App.tsx` | Root. Owns all state: `dateRange`, `visiblePlatforms`, `expandedCampaigns`, `sortConfig`. |
| `src/components/TopBar.tsx` | Page title, date range `<select>`, platform filter pills (toggle visibility), Export button (`console.log`). |
| `src/components/KPICards.tsx` | 6 KPI cards: Total Spent, Impressions, Clicks, Leads, Avg CPL, Avg CTR. Aggregated across visible platforms. Hardcoded delta strings for now. |
| `src/components/AdsTable.tsx` | Main table. 13 columns. 3 row levels: Platform header, Campaign (indent 16px, collapse/expand chevron), Ad Set+Ad (indent 32px, shown when parent expanded). Sticky header. Horizontal scroll. Total row at bottom. |
| `src/components/StatusBadge.tsx` | Pill badge for `active` \| `paused` \| `draft` \| `ended`. |
| `src/data/mockData.ts` | All mock data. Types: `Status`, `RawMetrics`, `Ad`, `AdSet`, `Campaign`, `Platform`. |
| `src/utils/metrics.ts` | `aggregateMetrics()`, `getCampaignMetrics()`, `getPlatformMetrics()`, `derivedMetrics()`, `getSortValue()`, `fmtMetric()`, formatting helpers. |

### Table Behaviour

- **Platform rows:** Always visible. Show platform name with colour accent bar, campaign count badge, and aggregated metrics.
- **Campaign rows:** Indent 16px. Click to expand/collapse ad rows (chevron rotates 90°). Sorted by active sort column within each platform group independently.
- **Ad rows (Ad Set + Ad):** Indent 32px (visible only when parent campaign expanded). Show ad set name + ad name in separate columns.
- **Sorting:** Click any metric column header to sort campaign rows within each platform group. Second click reverses direction. Arrow indicator (↑ / ↓ / ⇅) in header.
- **Platform filter:** Toggling a platform pill removes its rows from the table and its data from KPI totals. At least one platform must remain visible.
- **Total row:** Sticky footer row aggregating all currently visible platform metrics.

### Number Formatting

| Type | Format | Example |
|---|---|---|
| Currency (large) | `₹` + `toLocaleString('en-IN')`, 0 decimal | ₹5,52,600 |
| Currency (per-unit) | `₹` + `toLocaleString('en-IN')`, 2 decimal | ₹30.04 |
| Count | `toLocaleString('en-IN')` | 18,420 |
| Percentage | `.toFixed(2) + '%'` | 5.91% |

### Design Tokens

Matches the main platform Figma (`J1sJUWxKyX11FuP7Wg6rOi`). Same CSS variables: `--bg-base`, `--bg-surface`, `--bg-raised`, `--border-default`, `--text-primary`, `--text-muted`, `--brand-default`. JetBrains Mono for all metric cells. Dark theme only (v1).

### File Structure

```
ads-dashboard/
├── package.json          # React 18, TypeScript, Tailwind v4, Vite 6
├── vite.config.ts
├── tsconfig.json         # strict mode
├── index.html            # loads JetBrains Mono from Google Fonts
└── src/
    ├── App.tsx           # Root component + all state
    ├── main.tsx          # ReactDOM entry
    ├── index.css         # CSS variables + Tailwind import + scrollbar
    ├── components/
    │   ├── TopBar.tsx
    │   ├── KPICards.tsx
    │   ├── AdsTable.tsx
    │   └── StatusBadge.tsx
    ├── data/
    │   └── mockData.ts   # 3 platforms, 9 campaigns, ~18 ad sets, ~36 ads
    └── utils/
        └── metrics.ts    # All calculations + all formatters
```

**Main platform integration:** The dashboard is also embedded in the main SEO Audit Platform at `/ads` (`frontend/src/pages/AdsDashboard.jsx`), accessible via the "Paid Ads" nav item (BarChart3 icon) in the PLATFORM sidebar section. When Phase 9 ships, only the main platform version will be updated to use real API data; the standalone `ads-dashboard/` remains as a design reference.



---

## 16. Phase 9 — Paid Ads API Integration (Planned)

Replaces mock data in `frontend/src/pages/AdsDashboard.jsx` with live metrics fetched from three ad platforms. The standalone `ads-dashboard/` app is unaffected and remains a design reference.

---

### 16.1 Scope

| Platform | API | Auth |
|---|---|---|
| Google Ads | Google Ads API v18+ (`google-ads-api` npm package) | Google OAuth 2.0 + Developer Token |
| Meta | Meta Marketing API v21+ (REST, no official Node SDK) | Meta OAuth 2.0 (Facebook Login) |
| LinkedIn | LinkedIn Campaign Manager API (REST) | LinkedIn OAuth 2.0 |

Each platform requires a separate OAuth flow. Tokens are stored per company and per platform in a new `ad_connections` table.

---

### 16.2 Database Schema

Four new tables added via a single migration file (`005_ads_integration.js`).

#### `ad_oauth_state`

Short-lived CSRF protection tokens generated at OAuth initiation. Rows are deleted immediately after successful validation, and expired rows are purged on server start.

| Column | Type | Notes |
|---|---|---|
| `state` | TEXT PK | 32-byte random hex string |
| `user_id` | TEXT | FK → `users.id` — the user who initiated the flow |
| `platform` | TEXT | `google` \| `meta` \| `linkedin` |
| `expires_at` | TIMESTAMP | `created_at + 10 minutes` |

#### `ad_connections`

Stores one row per connected ad platform per company.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `company_id` | TEXT | FK → `companies.id` |
| `platform` | TEXT | `google` \| `meta` \| `linkedin` |
| `access_token` | TEXT | Encrypted at rest (AES-256-GCM, key from `JWT_SECRET`) |
| `refresh_token` | TEXT | Encrypted. Null for platforms that don't issue refresh tokens |
| `token_expires_at` | TIMESTAMP | When to trigger a refresh |
| `account_id` | TEXT | Ad account ID selected by the user during setup |
| `account_name` | TEXT | Display name of the connected account |
| `meta` | TEXT | JSON — platform-specific extras (e.g. Google customer_id, Meta act_ prefix) |
| `status` | TEXT | `active` \| `error` \| `revoked` |
| `last_synced_at` | TIMESTAMP | Last successful metrics fetch |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

Unique constraint: `(company_id, platform)` — one connection per platform per company.

#### `ad_accounts`

Cached list of ad accounts accessible via a connection. Populated on first connect and on manual refresh. Used to power the account selector in the UI if the user has multiple accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `connection_id` | TEXT | FK → `ad_connections.id` |
| `platform_account_id` | TEXT | Native account ID from the platform |
| `name` | TEXT | Display name |
| `currency` | TEXT | ISO 4217 currency code |
| `is_selected` | INTEGER | 1 = currently active selection |

#### `ad_snapshots`

Cached metrics per connection per date range. Reduces API calls and provides near-instant page loads after the first fetch.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `connection_id` | TEXT | FK → `ad_connections.id` |
| `date_range` | TEXT | `last7d` \| `last30d` \| `thisMonth` |
| `fetched_at` | TIMESTAMP | When this snapshot was pulled |
| `expires_at` | TIMESTAMP | TTL: `fetched_at + 1 hour` |
| `payload` | TEXT | JSON — full campaigns → ad sets → ads metrics tree |

Cache invalidation: on every `GET /api/ads/metrics`, check `expires_at`. If expired, re-fetch from the platform and overwrite.

**Date range → actual dates:** The backend converts the `dateRange` query param to absolute start/end dates before calling any platform API. Timezone is always **IST (Asia/Kolkata, UTC+5:30)**, hardcoded as a constant in `ads.service.js` — never derived from the server's system timezone.

| `dateRange` value | Start date | End date |
|---|---|---|
| `last7d` | today − 6 days (IST midnight) | today (IST end of day) |
| `last30d` | today − 29 days (IST midnight) | today (IST end of day) |
| `thisMonth` | 1st of current month (IST midnight) | today (IST end of day) |

---

### 16.3 Backend Routes

All routes under `/api/ads/` — require `authMiddleware`. Token scoping: responses are filtered to the requesting user's `company_id`.

**Role-based access:** Connect/disconnect routes (`POST /connect`, `DELETE /connections`, `POST /accounts/:platform/select`) require `requireRole('admin')`. Read routes (`GET /connections`, `GET /accounts`, `GET /metrics`, `POST /metrics/refresh`) are accessible to all authenticated roles — any user can view the dashboard and trigger a sync.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ads/connections` | List all connected platforms for the current company |
| `POST` | `/api/ads/connect/:platform` | Initiate OAuth flow — returns redirect URL |
| `GET` | `/api/ads/callback/:platform` | OAuth callback — exchanges code for tokens, saves `ad_connections` row |
| `DELETE` | `/api/ads/connections/:platform` | Revoke and delete connection |
| `GET` | `/api/ads/accounts/:platform` | List ad accounts accessible via the connection |
| `POST` | `/api/ads/accounts/:platform/select` | Set `is_selected = 1` for the chosen account |
| `GET` | `/api/ads/metrics` | Return metrics for all connected platforms. Query params: `?dateRange=last30d`. Serves from `ad_snapshots` cache if valid; fetches live if expired. |
| `POST` | `/api/ads/metrics/refresh` | Force-invalidate the cache and re-fetch from all platforms |

---

### 16.4 Services

```
backend/services/
├── ads.service.js          # Orchestrator: routes requests to platform services, manages cache
├── ads.google.js           # Google Ads API client — fetches campaigns → ad groups → ads
├── ads.meta.js             # Meta Marketing API client — fetches campaigns → ad sets → ads
└── ads.linkedin.js         # LinkedIn Campaign Manager API — fetches campaigns → creatives
```

**`ads.service.js`** responsibilities:
- Read `ad_connections` for the requesting company
- For each active connection, check `ad_snapshots` cache
- If cache is valid: return cached `payload`
- If cache is expired: call the relevant platform service, normalize to the shared data model, write new snapshot, return data
- Token refresh: if `token_expires_at` is within 5 minutes, call the platform's token refresh endpoint before fetching metrics

**Shared data model** (output from all platform services — matches the existing mock data shape):

```json
{
  "platform": "google",
  "accountName": "Cars24 — Main",
  "campaigns": [
    {
      "id": "...",
      "name": "Brand Keywords",
      "status": "active",
      "adSets": [
        {
          "id": "...",
          "name": "Exact Match",
          "status": "active",
          "ads": [
            {
              "id": "...",
              "name": "Cars24 — Best Deals",
              "status": "active",
              "clicks": 5820,
              "impressions": 94000,
              "conversions": 308,
              "spent": 174600
            }
          ]
        }
      ]
    }
  ]
}
```

All amounts are in the ad account's native currency — displayed with the ISO currency code, no cross-platform normalization (see currency display note below). Status values are normalized to `active | paused | draft | ended` — platform-specific statuses are mapped at the service layer.

**Currency display:** Each platform displays amounts in its ad account's native currency (stored in `ad_accounts.currency`). The currency ISO code (e.g. `INR`, `USD`) is shown as a prefix or suffix next to all monetary values — no cross-platform normalization or exchange rate conversion. The "Total (all visible platforms)" row in the table is suppressed when visible platforms have mixed currencies, since summing across currencies is meaningless. The KPI "Total Spent" card shows a per-platform breakdown instead of a single total in that case.

**Metric definition note — `leads` is dropped for live data.** Google Ads, Meta, and LinkedIn do not expose a universal "leads" metric — it depends on campaign objective and conversion action configuration, which varies per account. To avoid silently returning misleading zeros, the live data model omits `leads` entirely and relies on `conversions` only (which all three platforms expose reliably). Consequence: the KPI card currently labelled "Leads" becomes "Conversions" when Phase 9 ships. The `leads` field remains in the mock data (standalone `ads-dashboard/`) as a design placeholder only.

---

### 16.5 OAuth Flows

#### CSRF Protection (all platforms)

All three OAuth flows **must** include a `state` parameter to prevent CSRF attacks:
1. On `POST /api/ads/connect/:platform`, backend generates a cryptographically random `state` token (e.g. 32 bytes via `crypto.randomBytes`), stores it in a dedicated `ad_oauth_state` table (columns: `state TEXT PK`, `user_id TEXT`, `platform TEXT`, `expires_at TIMESTAMP`) with a 10-minute TTL. This table is added in the 9a migration alongside the main ads tables.
2. The `state` value is appended to the redirect URL sent to the ad platform.
3. On `GET /api/ads/callback/:platform`, backend reads the `state` query param, looks it up in the store, verifies it matches the initiating user, and deletes it. If missing or mismatched → 400 error, do not proceed.

#### Google Ads

1. User clicks "Connect Google Ads" in Integrations UI
2. Backend generates `state`, stores it, builds Google OAuth URL with scopes: `https://www.googleapis.com/auth/adwords` and `state` param
3. User grants access → callback receives `code` + `state`
4. Validate `state` (see CSRF section above)
5. Exchange `code` for `access_token` + `refresh_token` via Google token endpoint
6. List accessible customer accounts via `GoogleAdsClient.listAccessibleCustomers()`
7. If multiple accounts: show account selector in UI, user picks one, call `POST /api/ads/accounts/google/select`
8. Save to `ad_connections`

**Requirement:** A Google Ads Developer Token is required (apply via Google Ads API Center). Store as `GOOGLE_ADS_DEVELOPER_TOKEN` in `.env`. Without an approved Developer Token, the API returns test data only. Standard access approval can take several weeks — factor this into the Phase 9 timeline.

#### Meta

1. User clicks "Connect Meta Ads" in Integrations UI
2. Backend generates `state`, stores it, builds Facebook Login URL with scopes: `ads_read`, `business_management` and `state` param
   - **Do not request `ads_management`** — it grants write access and triggers Facebook App Review for write permissions, which the dashboard does not need and would fail. `ads_read` is sufficient for all reporting use cases.
3. User grants access → callback receives `code` + `state`
4. Validate `state` (see CSRF section above)
5. Exchange for long-lived user token (60-day TTL — Meta does not issue refresh tokens in the standard sense)
6. List ad accounts via `GET /v21.0/me/adaccounts`
7. Save to `ad_connections`. Store token expiry as `fetched_at + 60 days`.
8. Re-auth required every 60 days — surface a "Reconnect" prompt when `status = error`

**Note:** `ads_read` still requires Facebook App Review for apps in Live mode. Factor in review time (typically 1–5 business days for read-only data access, but can vary).

#### LinkedIn

1. User clicks "Connect LinkedIn Ads" in Integrations UI
2. Backend generates `state`, stores it, builds LinkedIn OAuth URL with scopes: `r_ads`, `r_ads_reporting` and `state` param
3. User grants access → callback receives `code` + `state`
4. Validate `state` (see CSRF section above)
5. Exchange for `access_token` (60-day TTL) + `refresh_token` (1-year TTL) via LinkedIn token endpoint
6. List ad accounts via `GET https://api.linkedin.com/rest/adAccounts?q=search&search.type.values[0]=BUSINESS`
7. Save to `ad_connections`

---

### 16.6 New Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Yes (Phase 9) | From Google Ads API Center — requires approved application |
| `GOOGLE_ADS_CLIENT_ID` | Yes (Phase 9) | Can reuse `GOOGLE_CLIENT_ID` if same OAuth app |
| `GOOGLE_ADS_CLIENT_SECRET` | Yes (Phase 9) | Can reuse `GOOGLE_CLIENT_SECRET` if same OAuth app |
| `META_APP_ID` | Yes (Phase 9) | Facebook Developer app ID |
| `META_APP_SECRET` | Yes (Phase 9) | Facebook Developer app secret |
| `LINKEDIN_CLIENT_ID` | Yes (Phase 9) | LinkedIn Developer app client ID |
| `LINKEDIN_CLIENT_SECRET` | Yes (Phase 9) | LinkedIn Developer app client secret |
| `ADS_TOKEN_ENCRYPTION_KEY` | Yes (Phase 9) | 32-byte hex key for AES-256-GCM token encryption. Derive from `JWT_SECRET` if not set separately. |

---

### 16.7 Frontend Changes

#### `AdsDashboard.jsx`

- Remove `MOCK_DATA` constant and all inline mock data
- Remove the "Leads" KPI card and "Avg CPL" KPI card — both depend on `leads` which is not available in live data. Replace with a "Conversions" card. This reduces the KPI row from 6 cards to 5.
- On mount: `GET /api/ads/metrics?dateRange=last30d` — populate state
- Loading state: skeleton cards + table placeholder while fetching
- Empty state: "No ad platforms connected. Go to Integrations to connect Google Ads, Meta, or LinkedIn."
- Error state: per-platform error banner if one platform fails (others still render)
- Date range selector: triggers a real API call with the new `dateRange` param when changed
- Export button: downloads CSV of current metrics (constructed client-side from API response — no new backend route needed)
- Platform pills: populated from API response, not hardcoded

#### Integrations page (`/integrations`)

Add a new "Paid Ads" section below the existing GSC/GA4 section:
- One connect/disconnect card per platform (Google Ads, Meta, LinkedIn)
- Connected state shows: account name, last synced timestamp, "Sync Now" button, "Disconnect" button
- Disconnected state shows: platform logo, brief description, "Connect" button
- If `status = error`: show "Reconnect" button with error detail

---

### 16.8 Caching Strategy

| Scenario | Behaviour |
|---|---|
| First page load after connection | Live fetch — may take 2–5 seconds depending on platform |
| Subsequent loads within 1 hour | Served from `ad_snapshots` — instant |
| After 1 hour | Stale snapshot returned immediately; background refresh triggered (stale-while-revalidate) |
| User clicks "Sync Now" | Force-invalidates cache for all platforms, fetches live, streams progress via Socket.io event `ads:sync:progress` |
| Token expired | Auto-refresh before fetch for Google/LinkedIn; prompt reconnect for Meta |

---

### 16.9 API Rate Limits (Known Constraints)

| Platform | Key Limit | Mitigation |
|---|---|---|
| Google Ads | 15,000 operations/day (standard access) | 1-hour cache; request only needed fields via `SELECT` in GAQL |
| Meta | 200 score points per hour per app | 1-hour cache; batch requests where possible |
| LinkedIn | 100 requests/day per app (Marketing Developer Platform basic tier) | 1-hour cache; single request per date range per account |

**Note:** LinkedIn's basic tier rate limit (100 req/day) is very restrictive. LinkedIn requires a Marketing Developer Platform application approval for higher limits. At basic tier, the 1-hour cache is essential.

---

### 16.10 Sub-phases

| Sub-phase | Scope |
|---|---|
| 9a | DB migration (`005_ads_integration.js`), backend route scaffolding, token encryption utility, CSRF state store |
| 9b | Google Ads OAuth + `ads.google.js` service + cache layer |
| 9c | Meta OAuth + `ads.meta.js` service |
| 9d | LinkedIn OAuth + `ads.linkedin.js` service |
| 9f | Integrations page: connect/disconnect UI for all three platforms — ships before dashboard so users can connect accounts |
| 9e | Frontend: replace mock data in `AdsDashboard.jsx` with real API calls, loading/error/empty states |
| 9g | "Sync Now" via Socket.io, stale-while-revalidate background refresh |

Each platform service (9b/9c/9d) can ship independently — e.g. 9b alone gives a working Google Ads integration while Meta and LinkedIn still fall back gracefully. 9f must ship before 9e so users have a way to connect platforms before the dashboard removes mock data.

