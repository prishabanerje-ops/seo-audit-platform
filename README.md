# SEO Audit Platform v2.0

A self-hosted technical SEO audit platform. Crawls websites via a built-in Playwright/Crawlee crawler, runs 291 SEO checks across 19 categories, surfaces AI-powered fix recommendations via Claude, and integrates with GSC, GA4, Linear, Slack, and Google Sheets.

---

## Requirements

| Dependency | Minimum version |
|---|---|
| Node.js | v20+ (v25 tested) |
| npm | v9+ |
| Playwright | Installed automatically via `npm install` |
| macOS / Linux | macOS recommended |

---

## First-time Setup

### 1. Configure Claude Code memory path (if using Claude Code)

This project stores Claude Code memory files inside the project at `memory/` so everything is portable and committable to GitHub.

On a new machine, add this to `~/.claude/settings.json` (create the file if it doesn't exist):

```json
{
  "autoMemoryDirectory": "/path/to/your/Aakash/memory"
}
```

Replace `/path/to/your/Aakash` with the absolute path where you cloned/unzipped the project. This is a one-time machine-local step.

---

### 2. Run the setup script

```bash
cd /Users/a39326/Documents/Aakash
bash setup.sh
```

The script will:
- Install all npm dependencies (root, backend, frontend)
- Create `.env` from `.env.example`
- Auto-generate `JWT_SECRET` and `ENCRYPTION_KEY`
- Install Playwright browser binaries
- Download JetBrains Mono fonts
- Run all database migrations
- Seed the 291 audit checks

### 2. Fill in optional env vars

Open `.env` and add any integrations you want to enable:

```bash
# Required for GSC + GA4
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/gsc/callback

# AI recommendations
ANTHROPIC_API_KEY=

# Slack alerts
SLACK_WEBHOOK_URL=

# PageSpeed Insights (leave empty for rate-limited free tier)
PSI_API_KEY=
```

### 3. Start the platform

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend (dev) | http://localhost:5173 |
| Backend API | http://localhost:3001 |

### 4. Log in

The `/setup` page is retired. Account creation is handled via superadmin bootstrap (see below).

Open http://localhost:5173/login and sign in with your superadmin credentials.

---

## Daily Use

### Logging In

Go to http://localhost:5173/login and sign in with your email and password.

### Navigating the Platform

The left sidebar has four sections:

| Section | Links |
|---|---|
| **MAIN** | Admin View, SEO Dashboard, Developer View |
| **PLATFORM** | Sites, Crawls, Audit Health, Core Web Vitals, Tasks |
| **WORKFLOW** | Schedules, Exports, Notifications |
| **SYSTEM** | Integrations, System Health, Users, Settings, Error Log *(admin only)* |

Collapse the sidebar with the arrow button at the bottom. It snaps to icon-only mode (56px).

### Switching Sites

Use the site selector dropdown in the top header to switch between registered sites. Your active site is remembered for the session.

### Dark / Light Mode

Click the sun/moon toggle in the top-right header. Your preference is saved in `localStorage`.

---

## Running an Audit

### Step 1 — Register a Site

Go to **Sites → Add New Site** and enter:
- Site name
- Root URL (e.g. `https://www.example.com`)
- Optional: GSC property, GA4 property ID

### Step 2 — Start a Crawl

Go to **Crawls → Start Crawl** and configure:
- Crawl depth
- Include/exclude URL patterns
- User agent
- Whether to run a live spider crawl or import a pre-existing CSV export

**Spider crawl:** the built-in Playwright/Crawlee crawler runs automatically and streams progress in real time.

**Import mode:** run any crawler externally, export the results as CSV, and import them on the Start Crawl page. You can import any subset of URLs — it does not have to be a full crawl.

### Step 3 — Monitor Live Progress

While a crawl is running, go to **Crawls → Live Run** (or click the running job) to see:
- Real-time URL count
- Live log stream
- Estimated completion

### Step 4 — Review Audit Results

Once complete, go to **Audit Health** to see:
- Overall health score (0–100)
- Issue breakdown by severity (critical / warning / info / pass)
- Category breakdown (20 categories)

Click any category or issue to drill into affected URLs.

### Step 5 — AI Recommendations (Coming Soon)

AI-powered fix recommendations via Claude are planned for a future phase. Set `ANTHROPIC_API_KEY` in `.env` now if you have one — the platform will use it once the feature ships.

---

## Comparing Two Crawls

Go to **Audit → Compare Crawls** and select two previously completed crawl jobs from the same site. The comparison shows:
- Health score delta
- Issues resolved vs. new issues introduced
- Per-category change

To compare a desktop crawl vs. a mobile crawl:
1. Run a desktop crawl (or import a desktop SF export)
2. Run a separate mobile crawl (or import a mobile SF export)
3. Select both in the Compare view

---

## Superadmin Bootstrap

The platform has exactly one **superadmin** — a global account that sits above all companies.

### Existing installation (upgrade from single-tenant)

Migration `006_multi_tenancy` runs automatically on server start and:

1. Creates the **Cars24** company record
2. Promotes `aakash.srivastava@cars24.com` to superadmin (no company affiliation)
3. Creates a Cars24 admin account — **change this password immediately:**
   - Email: `admin@c24.com`
   - Password: `Aakash@123#!`

### Fresh installation (no prior users)

A default superadmin is seeded automatically — **change this password immediately:**

- Email: `superadmin@localhost`
- Password: `SuperAdmin123!`

---

## Multi-Tenancy

Each company is a fully isolated data silo. Company A cannot see Company B's data.

| Role | Scope |
|---|---|
| `superadmin` | Global. Creates companies and admin accounts. Can impersonate any user. |
| `admin` | One company. Manages their team (`seo` / `readonly`). Subject to seat limit. |
| `seo` | One company. Full audit access, can run crawls. |
| `readonly` | One company. View-only access. |

**Creating a new company:** Log in as superadmin → Companies page → New Company. Fill in company name and admin email. An invite is sent to the admin via SMTP (or the invite URL is shown if SMTP is not configured).

**Access control:** Superadmin can toggle `is_paid` per company. Setting `is_paid = false` blocks all non-superadmin users at their next login attempt.

---

## Team Management

### As a company admin — Inviting a Team Member

Go to **Users → Invite User**, enter their email and choose a role:
- `seo` — full audit access, can manage crawls and tasks
- `readonly` — can view audit results and issues, no write access

They receive an invite link (expires in 48 hours). If the company seat limit is reached, the invite will be blocked with an error.

### Changing a Role

Go to **Users**, click the role badge next to a user, and select a new role. You cannot change your own role.

### Removing a User

Go to **Users** and click Delete next to the user.

---

## Integrations

All integrations are configured via **Settings → Integrations** or in `.env`.

### Google Search Console

1. Go to **Settings → Integrations → GSC**
2. Click **Connect** — you'll be redirected to Google OAuth
3. Select the Google account that has GSC access
4. Once connected, the **GSC Overlay** in the Audit views shows impressions/clicks per URL

Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

### Google Analytics 4

Same OAuth flow as GSC. Once connected, the **GA4 Overlay** shows sessions and revenue per URL.

### Anthropic Claude (AI)

Set `ANTHROPIC_API_KEY` in `.env`, or go to **Settings → AI** and paste the key there (stored encrypted in the database).

**Token Budget (optional):** Go to **Settings → AI → Token Budget** to set a maximum token limit. Once the limit is hit, the AI recommendation button is disabled for all users until the admin manually resets the counter from the same settings page. Set to `0` for no limit.

### Linear

Go to **Settings → Integrations → Linear** and paste your Personal API token. Once connected, you can push issues directly to your Linear workspace from the Issue Detail page.

### Slack

Set `SLACK_WEBHOOK_URL` in `.env`. You'll receive a Slack message when:
- A crawl completes
- New critical issues are found vs. the previous crawl

### PageSpeed Insights

Set `PSI_API_KEY` in `.env` for higher rate limits. Without a key the API still works but is rate-limited to ~2 requests/second.

### Google Sheets Export

Create a GCP service account, download the JSON key, save it to the repo root, and set:

```
GOOGLE_APPLICATION_CREDENTIALS=./google-service-account.json
```

Then go to **Exports** and click **Export to Sheets**.

---

## Scheduled Crawls

Go to **Schedules** to set up recurring crawls:
- Daily at a chosen time
- Weekly on a chosen day + time
- Custom cron expression

Scheduled crawls run automatically and send Slack/email notifications on completion (if configured).

---

## Exporting Data

Go to **Exports** and choose:
- **CSV** — downloads full audit results for the selected crawl job
- **Google Sheets** — pushes to a new sheet in your connected Google account (requires service account)

---

## Production Deployment

To run at a stable URL (same machine, single port):

### 1. Build the frontend

```bash
npm run build
```

This compiles React to `backend/public/`.

### 2. Set production env vars

Edit `.env`:
```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com   # or http://your-ip:3001
```

### 3. Start the backend

```bash
npm start
```

The Express server serves both the API and the compiled frontend from `localhost:3001`.

For a persistent process, use `pm2`:
```bash
npm install -g pm2
pm2 start "npm start" --name seo-platform
pm2 save
pm2 startup
```

---

## Database

The SQLite database is at `backend/seo-automation.db`. It is created automatically on first run.

### Manual migrations

```bash
npm run migrate
```

### Backup

```bash
cp backend/seo-automation.db backend/seo-automation.backup.$(date +%Y%m%d).db
```

SQLite uses WAL mode — it's safe to copy the `.db` file while the server is running (copy the `-shm` and `-wal` files too if they exist).

---

## Scripts Reference

| Command | What it does |
|---|---|
| `npm run dev` | Start backend + frontend in dev mode (concurrent) |
| `npm run build` | Build frontend to `backend/public/` |
| `npm start` | Start backend in production mode |
| `npm run setup` | Run the full first-time setup script |
| `npm run migrate` | Run pending database migrations |
| `npm run seed` | Re-seed the 291 audit checks |
| `npm test` | Run backend tests |

---

## Project Structure

```
Aakash/
├── playwright-crawler/
│   ├── src/
│   │   ├── crawler.js           # Dual-mode crawler (Cheerio + Playwright)
│   │   ├── extractors/          # 9 extractors (meta, headings, canonical, etc.)
│   │   └── output/sf-format.js  # Maps raw records → 12 CSV-compatible datasets
│   └── tests/parity.test.js     # Column + constraint + consistency validation
├── backend/
│   ├── db/
│   │   ├── sqlite.js            # DB singleton + migration runner
│   │   └── migrations/          # 001–006 SQL migrations (006 = multi-tenancy)
│   ├── middleware/
│   │   ├── auth.js              # JWT + requireRole
│   │   ├── rateLimiter.js       # express-rate-limit config
│   │   └── validate.js          # Zod request validation helper
│   ├── routes/
│   │   └── auth.js              # All /api/auth/* endpoints
│   ├── uploads/
│   │   └── logos/               # Company logo uploads (PNG/JPG/SVG/WebP, max 50KB)
│   ├── server.js                # Express app entry
│   ├── validate-env.js          # Startup env validation
│   └── seo-automation.db        # SQLite database (auto-created)
├── frontend/
│   ├── public/
│   │   └── fonts/               # JetBrains Mono woff2 files
│   └── src/
│       ├── api/index.js         # Axios instance
│       ├── components/          # Shared UI components
│       ├── context/             # Auth, Sites, Toast contexts
│       ├── pages/               # Page components
│       ├── styles/              # theme.css + fonts.css
│       ├── App.jsx
│       ├── main.jsx
│       └── router.jsx
├── scripts/
│   └── seed-checks.js           # Seeds 291 audit checks
├── .env                         # Local env (gitignored)
├── .env.example                 # Template
├── package.json                 # Root scripts
├── setup.sh                     # First-run setup
├── PRD.md                       # Full product requirements
└── README.md                    # This file
```

---

## Troubleshooting

**`JWT_SECRET not set` warnings on startup**
→ Run `bash setup.sh` or manually set `JWT_SECRET` and `ENCRYPTION_KEY` in `.env`.

**Crawler not starting**
→ Ensure `USE_PLAYWRIGHT_CRAWLER=true` is set in `.env`. Then verify Playwright browsers are installed:
```bash
cd playwright-crawler && npx playwright install chromium
```

**`Cannot GET /api/...` returns 501**
→ That endpoint is not yet implemented. It will be added in a future phase. See PRD.md §9 for the phase plan.

**Frontend shows blank screen**
→ Open browser devtools → Console. Usually a missing env var or a failed API call. Check that the backend is running on port 3001.

**Database migration errors**
→ Run `npm run migrate` manually. If a migration fails, check `backend/seo-automation.db` with any SQLite browser.

**Invite link expired**
→ Invites expire after 48 hours. The admin needs to create a new invite from the Users page.


# Start (run these in 2 separate terminal tabs):

## Terminal 1 — backend
cd /Users/a39326/Documents/Aakash && npm run start

## Terminal 2 — public tunnel
ssh -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=6 \
    -R 80:localhost:3001 nokey@localhost.run

The second command prints your public URL. Share it.

# Deploy latest version (when code has changed):

## Terminal 1 — build + start
cd /Users/a39326/Documents/Aakash && npm run build && npm run start

## Terminal 2 — tunnel
ssh -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=6 \
    -R 80:localhost:3001 nokey@localhost.run

# Stop everything:
pkill -f "node.*server.js" && pkill ssh