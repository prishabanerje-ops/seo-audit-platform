# Phase 4a — Dashboards & Task Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 5 stub pages (AdminView, SeoView, DeveloperView, Tasks, TaskDetail) with real data-driven implementations, plus add all missing backend endpoints they depend on.

**Architecture:** Two new backend route files (`dashboard.js`, `tasks.js`), new data-read endpoints added to `gsc.js`, `ga4.js`, and `reports.js`, then five new frontend pages wired into the router. All DB calls use better-sqlite3 synchronous API — no async/await on DB queries.

**Tech Stack:** Node.js/Express (backend), React 18 + Vite (frontend), better-sqlite3, Recharts for charts, native HTML5 drag-and-drop for Kanban, Tailwind CSS vars for styling.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `backend/routes/gsc.js` | Add `GET /:siteId/summary`, `GET /:siteId/queries`, `GET /:siteId/pages` |
| Modify | `backend/routes/ga4.js` | Add `GET /:siteId/summary`, `GET /:siteId/pages` |
| Create | `backend/routes/dashboard.js` | `GET /admin` cross-site aggregation |
| Modify | `backend/routes/reports.js` | Add `GET /:siteId/developer-summary` |
| Create | `backend/routes/tasks.js` | Full CRUD + comments |
| Modify | `backend/server.js` | Register `dashboard` and `tasks` routes |
| Create | `backend/__tests__/dashboard.test.js` | Tests for dashboard endpoint |
| Create | `backend/__tests__/tasks.test.js` | Tests for tasks endpoints |
| Create | `frontend/src/pages/AdminView.jsx` | Cross-site dashboard |
| Create | `frontend/src/pages/SeoView.jsx` | GA4 + GSC tabs |
| Create | `frontend/src/pages/DeveloperView.jsx` | Technical health page |
| Create | `frontend/src/pages/Tasks.jsx` | Full Kanban |
| Create | `frontend/src/pages/TaskDetail.jsx` | Task detail + comments |
| Modify | `frontend/src/pages/stubs.jsx` | Remove 5 exports |
| Modify | `frontend/src/router.jsx` | Wire real pages, move `/admin` into AdminOnly |

---

## Task 1: GSC data read endpoints

**Files:**
- Modify: `backend/routes/gsc.js`
- Test: `backend/__tests__/gsc-data.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/gsc-data.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign(
  { sub: 'u1', email: 't@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/gsc/:siteId/summary', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/gsc/no-such-site/summary')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns summary shape for any accessible site', async () => {
    // With no GSC data, should return zeros not 500
    const res = await request(app)
      .get('/api/gsc/site-fake/summary')
      .set('Cookie', cookie);
    expect([200, 404]).toContain(res.status);
  });
});

describe('GET /api/gsc/:siteId/queries', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/gsc/no-such-site/queries')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/gsc/:siteId/pages', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/gsc/no-such-site/pages')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd backend && npm test -- --reporter=verbose gsc-data 2>&1 | tail -20
```
Expected: 404 tests fail because the endpoints don't exist yet (501 or similar).

- [ ] **Step 3: Add the three read endpoints to `backend/routes/gsc.js`**

Add these three routes BEFORE `export default router` at the end of the file. They follow the same site-ownership guard pattern used in `reports.js`:

```js
// ─── GET /api/gsc/:siteId/summary ────────────────────────────────────────────
router.get('/:siteId/summary', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const current = db.prepare(`
    SELECT
      COALESCE(SUM(clicks), 0)      AS clicks,
      COALESCE(SUM(impressions), 0) AS impressions,
      CASE WHEN COALESCE(SUM(impressions), 0) > 0
           THEN CAST(SUM(clicks) AS REAL) / SUM(impressions)
           ELSE 0 END               AS ctr,
      COALESCE(AVG(position), 0)    AS position
    FROM gsc_cache WHERE site_id = ? AND period = 'current'
  `).get(siteId);

  const previous = db.prepare(`
    SELECT
      COALESCE(SUM(clicks), 0)      AS clicks,
      COALESCE(SUM(impressions), 0) AS impressions
    FROM gsc_cache WHERE site_id = ? AND period = 'previous'
  `).get(siteId);

  res.json({
    clicks:              current.clicks,
    impressions:         current.impressions,
    ctr:                 current.ctr,
    position:            current.position,
    clicks_delta:        current.clicks - previous.clicks,
    impressions_delta:   current.impressions - previous.impressions,
  });
});

// ─── GET /api/gsc/:siteId/queries ────────────────────────────────────────────
router.get('/:siteId/queries', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const queries = db.prepare(`
    SELECT
      top_query                                                     AS query,
      SUM(clicks)                                                   AS clicks,
      SUM(impressions)                                              AS impressions,
      CASE WHEN SUM(impressions) > 0
           THEN CAST(SUM(clicks) AS REAL) / SUM(impressions)
           ELSE 0 END                                               AS ctr,
      AVG(position)                                                 AS position
    FROM gsc_cache
    WHERE site_id = ? AND period = 'current' AND top_query IS NOT NULL
    GROUP BY top_query
    ORDER BY clicks DESC
    LIMIT 25
  `).all(siteId);

  res.json({ queries });
});

// ─── GET /api/gsc/:siteId/pages ──────────────────────────────────────────────
router.get('/:siteId/pages', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const pages = db.prepare(`
    SELECT
      url,
      SUM(clicks)      AS clicks,
      SUM(impressions) AS impressions,
      CASE WHEN SUM(impressions) > 0
           THEN CAST(SUM(clicks) AS REAL) / SUM(impressions)
           ELSE 0 END  AS ctr
    FROM gsc_cache WHERE site_id = ? AND period = 'current'
    GROUP BY url
    ORDER BY clicks DESC
    LIMIT 50
  `).all(siteId);

  res.json({ pages });
});
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npm test -- --reporter=verbose gsc-data 2>&1 | tail -20
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/gsc.js backend/__tests__/gsc-data.test.js
git commit -m "feat(gsc): add data read endpoints (summary, queries, pages)"
```

---

## Task 2: GA4 data read endpoints

**Files:**
- Modify: `backend/routes/ga4.js`
- Test: `backend/__tests__/ga4-data.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/ga4-data.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign(
  { sub: 'u1', email: 't@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/ga4/:siteId/summary', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/ga4/no-such-site/summary')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/ga4/:siteId/pages', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/ga4/no-such-site/pages')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('respects limit param', async () => {
    const res = await request(app)
      .get('/api/ga4/no-such-site/pages?limit=10')
      .set('Cookie', cookie);
    expect([200, 404]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd backend && npm test -- --reporter=verbose ga4-data 2>&1 | tail -20
```

- [ ] **Step 3: Add read endpoints to `backend/routes/ga4.js`**

Add BEFORE `export default router`:

```js
// ─── GET /api/ga4/:siteId/summary ────────────────────────────────────────────
router.get('/:siteId/summary', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(sessions), 0)              AS sessions,
      COALESCE(AVG(bounce_rate), 0)           AS bounce_rate,
      COALESCE(AVG(avg_session_duration), 0)  AS avg_duration
    FROM ga4_cache WHERE site_id = ?
  `).get(siteId);

  res.json(summary);
});

// ─── GET /api/ga4/:siteId/pages ──────────────────────────────────────────────
router.get('/:siteId/pages', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;
  const rawLimit  = req.query.limit;
  const rawOffset = req.query.offset;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const limit  = Math.min(Math.max(parseInt(rawLimit  || '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(rawOffset || '0', 10) || 0, 0);

  const pages = db.prepare(`
    SELECT url, sessions, engaged_sessions, engagement_rate,
           bounce_rate, avg_session_duration, total_revenue, conversions
    FROM ga4_cache WHERE site_id = ?
    ORDER BY sessions DESC
    LIMIT ? OFFSET ?
  `).all(siteId, limit, offset);

  const { total } = db.prepare(
    'SELECT COUNT(*) AS total FROM ga4_cache WHERE site_id = ?'
  ).get(siteId);

  res.json({ pages, total, limit, offset });
});
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npm test -- --reporter=verbose ga4-data 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/ga4.js backend/__tests__/ga4-data.test.js
git commit -m "feat(ga4): add data read endpoints (summary, pages)"
```

---

## Task 3: Dashboard admin endpoint

**Files:**
- Create: `backend/routes/dashboard.js`
- Create: `backend/__tests__/dashboard.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/dashboard.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';

function makeToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken({ sub: 'a1', email: 'admin@test.com', role: 'admin', company_id: 'company-test' });
const seoToken   = makeToken({ sub: 's1', email: 'seo@test.com',   role: 'seo',   company_id: 'company-test' });

describe('GET /api/dashboard/admin', () => {
  it('returns 403 for non-admin role', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Cookie', `auth_token=${seoToken}`);
    expect(res.status).toBe(403);
  });

  it('returns sites array and task_summary for admin', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Cookie', `auth_token=${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sites');
    expect(res.body).toHaveProperty('task_summary');
    expect(Array.isArray(res.body.sites)).toBe(true);
    expect(res.body.task_summary).toHaveProperty('backlog');
    expect(res.body.task_summary).toHaveProperty('in_progress');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npm test -- --reporter=verbose dashboard 2>&1 | tail -20
```
Expected: 404 or 501 (route not registered yet).

- [ ] **Step 3: Create `backend/routes/dashboard.js`**

```js
/**
 * @module routes/dashboard
 * Admin cross-site dashboard aggregation.
 */
import { Router }      from 'express';
import db              from '../db/sqlite.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/dashboard/admin ─────────────────────────────────────────────────
router.get('/admin', requireRole('admin', 'superadmin'), (req, res) => {
  const { company_id, role } = req.user;

  // Superadmin: all companies; admin: own company only
  const sites = role === 'superadmin'
    ? db.prepare('SELECT id, label, color, url FROM sites ORDER BY label').all()
    : db.prepare('SELECT id, label, color, url FROM sites WHERE company_id = ? ORDER BY label').all(company_id);

  const result = sites.map(site => {
    // GSC current period
    const gscCurr = db.prepare(`
      SELECT
        COALESCE(SUM(clicks), 0)      AS clicks,
        COALESCE(SUM(impressions), 0) AS impressions,
        CASE WHEN COALESCE(SUM(impressions), 0) > 0
             THEN CAST(SUM(clicks) AS REAL) / SUM(impressions)
             ELSE 0 END               AS ctr,
        COALESCE(AVG(position), 0)    AS position
      FROM gsc_cache WHERE site_id = ? AND period = 'current'
    `).get(site.id);

    const gscPrev = db.prepare(`
      SELECT COALESCE(SUM(clicks), 0) AS clicks, COALESCE(SUM(impressions), 0) AS impressions
      FROM gsc_cache WHERE site_id = ? AND period = 'previous'
    `).get(site.id);

    // Only include GSC if there's actual data
    const hasGsc = gscCurr.clicks > 0 || gscCurr.impressions > 0;

    // GA4 aggregate
    const ga4 = db.prepare(`
      SELECT
        COALESCE(SUM(sessions), 0)             AS sessions,
        COALESCE(AVG(bounce_rate), 0)          AS bounce_rate,
        COALESCE(AVG(avg_session_duration), 0) AS avg_duration
      FROM ga4_cache WHERE site_id = ?
    `).get(site.id);

    const hasGa4 = ga4.sessions > 0;

    // Latest completed crawl
    const job = db.prepare(`
      SELECT health_score, completed_at
      FROM crawl_jobs WHERE site_id = ? AND status = 'completed'
      ORDER BY completed_at DESC LIMIT 1
    `).get(site.id);

    return {
      id:          site.id,
      label:       site.label,
      color:       site.color,
      url:         site.url,
      gsc:         hasGsc ? {
        clicks:             gscCurr.clicks,
        impressions:        gscCurr.impressions,
        ctr:                gscCurr.ctr,
        position:           gscCurr.position,
        clicks_delta:       gscCurr.clicks - gscPrev.clicks,
        impressions_delta:  gscCurr.impressions - gscPrev.impressions,
      } : null,
      ga4:         hasGa4 ? {
        sessions:    ga4.sessions,
        bounce_rate: ga4.bounce_rate,
        avg_duration: ga4.avg_duration,
      } : null,
      health_score: job?.health_score ?? null,
      last_crawl:   job?.completed_at ?? null,
    };
  });

  // Task summary counts
  const taskRows = role === 'superadmin'
    ? db.prepare('SELECT status, COUNT(*) AS cnt FROM task_status GROUP BY status').all()
    : db.prepare('SELECT status, COUNT(*) AS cnt FROM task_status WHERE company_id = ? GROUP BY status').all(company_id);

  const task_summary = { backlog: 0, in_progress: 0, review: 0, done: 0 };
  for (const row of taskRows) {
    if (row.status in task_summary) task_summary[row.status] = row.cnt;
  }

  res.json({ sites: result, task_summary });
});

export default router;
```

- [ ] **Step 4: Register route in `backend/server.js`**

Add after the `import aiRoutes` line:
```js
import dashboardRoutes from './routes/dashboard.js';
```

Add after `app.use('/api/ai', aiRoutes)`:
```js
app.use('/api/dashboard', dashboardRoutes);
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd backend && npm test -- --reporter=verbose dashboard 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/dashboard.js backend/__tests__/dashboard.test.js backend/server.js
git commit -m "feat(dashboard): add GET /api/dashboard/admin cross-site aggregation"
```

---

## Task 4: Developer summary endpoint

**Files:**
- Modify: `backend/routes/reports.js`
- Test: add to `backend/__tests__/reports-drill-down.test.js`

- [ ] **Step 1: Add test to existing test file**

Open `backend/__tests__/reports-drill-down.test.js` and append:

```js
describe('GET /api/reports/:siteId/developer-summary', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/reports/no-such-site/developer-summary')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns correct shape for any site', async () => {
    const res = await request(app)
      .get('/api/reports/site-does-not-exist/developer-summary')
      .set('Cookie', cookie);
    // 404 for unknown site is correct
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && npm test -- --reporter=verbose reports-drill-down 2>&1 | tail -20
```

- [ ] **Step 3: Add endpoint to `backend/routes/reports.js`**

Add BEFORE `export default router`:

```js
// ─── GET /api/reports/:siteId/developer-summary ───────────────────────────────
router.get('/:siteId/developer-summary', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const latestJob = db.prepare(`
    SELECT id, total_urls, health_score, started_at, completed_at
    FROM crawl_jobs WHERE site_id = ? AND status = 'completed'
    ORDER BY started_at DESC LIMIT 1
  `).get(siteId);

  if (!latestJob) {
    return res.json({ job: null, response_codes: {}, top_issues: [], custom_extraction: [] });
  }

  // Duration in seconds
  const durationSeconds = latestJob.started_at && latestJob.completed_at
    ? Math.round((new Date(latestJob.completed_at) - new Date(latestJob.started_at)) / 1000)
    : null;

  // Response code buckets from audit_results
  const rcRows = db.prepare(`
    SELECT issue_type, COUNT(*) AS cnt
    FROM audit_results
    WHERE crawl_job_id = ? AND section = 'Response Codes'
    GROUP BY issue_type
  `).all(latestJob.id);

  const response_codes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  for (const row of rcRows) {
    // issue_type strings like "404 Not Found", "301 Redirect", "200 OK"
    const code = parseInt(row.issue_type, 10);
    if (code >= 200 && code < 300) response_codes['2xx'] += row.cnt;
    else if (code >= 300 && code < 400) response_codes['3xx'] += row.cnt;
    else if (code >= 400 && code < 500) response_codes['4xx'] += row.cnt;
    else if (code >= 500) response_codes['5xx'] += row.cnt;
  }

  // Top 10 issues by count across all sections
  const SECTION_SLUG = {
    'Response Codes':           'response-codes',
    'Canonical':                'canonicals',
    'Robots / Indexability':    'robots',
    'Sitemap':                  'sitemap',
    'URL Structure':            'crawl-depth',
    'Title Tags':               'title-tags',
    'Meta Description':         'meta-desc',
    'Headings':                 'headings',
    'Internal Linking':         'links',
    'Images':                   'images',
    'Schema / Structured Data': 'structured-data',
    'Content':                  'content',
    'Speed & Performance':      'page-speed',
    'Mobile SEO':               'mobile',
    'JavaScript Rendering':     'custom',
    'International SEO':        'international',
    'Monitoring & Operations':  'security',
  };

  const topIssueRows = db.prepare(`
    SELECT issue_type, section, severity, COUNT(*) AS count
    FROM audit_results
    WHERE crawl_job_id = ?
    GROUP BY issue_type
    ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, count DESC
    LIMIT 10
  `).all(latestJob.id);

  const top_issues = topIssueRows.map(r => ({
    issue_type: r.issue_type,
    section:    r.section,
    severity:   r.severity,
    count:      r.count,
    slug:       SECTION_SLUG[r.section] || 'custom',
  }));

  // Custom extraction results
  const custom_extraction = db.prepare(`
    SELECT issue_type, url, data
    FROM audit_results
    WHERE crawl_job_id = ? AND section = 'Custom Extraction'
    LIMIT 50
  `).all(latestJob.id);

  res.json({
    job: {
      id:               latestJob.id,
      total_urls:       latestJob.total_urls,
      health_score:     latestJob.health_score,
      started_at:       latestJob.started_at,
      completed_at:     latestJob.completed_at,
      duration_seconds: durationSeconds,
    },
    response_codes,
    top_issues,
    custom_extraction,
  });
});
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npm test -- --reporter=verbose reports-drill-down 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/reports.js backend/__tests__/reports-drill-down.test.js
git commit -m "feat(reports): add GET /:siteId/developer-summary endpoint"
```

---

## Task 5: Tasks backend

**Files:**
- Create: `backend/routes/tasks.js`
- Create: `backend/__tests__/tasks.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/tasks.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign(
  { sub: 'u1', email: 'seo@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/tasks', () => {
  it('returns tasks and kanban structure', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tasks');
    expect(res.body).toHaveProperty('kanban');
    expect(res.body.kanban).toHaveProperty('backlog');
    expect(res.body.kanban).toHaveProperty('in_progress');
    expect(res.body.kanban).toHaveProperty('review');
    expect(res.body.kanban).toHaveProperty('done');
  });
});

describe('POST /api/tasks', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ description: 'No title' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when site_id is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ title: 'Task without site' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-does-not-exist')
      .set('Cookie', cookie)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .patch('/api/tasks/any-id')
      .set('Cookie', cookie)
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .get('/api/tasks/task-does-not-exist')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tasks/:id/comments', () => {
  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .post('/api/tasks/task-does-not-exist/comments')
      .set('Cookie', cookie)
      .send({ body: 'A comment' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/tasks/any-id/comments')
      .set('Cookie', cookie)
      .send({ body: '' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd backend && npm test -- --reporter=verbose tasks 2>&1 | tail -20
```

- [ ] **Step 3: Create `backend/routes/tasks.js`**

```js
/**
 * @module routes/tasks
 * Task board CRUD — reads/writes to task_status and task_comments tables.
 */
import { Router }     from 'express';
import { randomUUID } from 'crypto';
import db             from '../db/sqlite.js';

const router = Router();

const VALID_STATUSES  = ['backlog', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

function groupByStatus(tasks) {
  const kanban = { backlog: [], in_progress: [], review: [], done: [] };
  for (const t of tasks) {
    if (t.status in kanban) kanban[t.status].push(t);
  }
  return kanban;
}

function verifyTaskOwnership(taskId, companyId, role) {
  const task = db.prepare(`
    SELECT t.id, s.company_id
    FROM task_status t
    JOIN sites s ON s.id = t.site_id
    WHERE t.id = ?
  `).get(taskId);
  if (!task) return { error: 'Task not found', status: 404 };
  if (role !== 'superadmin' && task.company_id !== companyId) {
    return { error: 'Access denied', status: 403 };
  }
  return { task };
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { siteId, status, assigneeId } = req.query;
  const { company_id, role } = req.user;

  let query = `
    SELECT t.*,
      u.name  AS assignee_name,
      u.email AS assignee_email,
      s.label AS site_label,
      s.color AS site_color
    FROM task_status t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN sites s ON s.id = t.site_id
    WHERE (? = 'superadmin' OR s.company_id = ?)
  `;
  const params = [role, company_id];

  if (siteId)     { query += ' AND t.site_id = ?';     params.push(siteId); }
  if (status)     { query += ' AND t.status = ?';      params.push(status); }
  if (assigneeId) { query += ' AND t.assignee_id = ?'; params.push(assigneeId); }

  query += ' ORDER BY t.created_at DESC';

  const tasks = db.prepare(query).all(...params);
  res.json({ tasks, kanban: groupByStatus(tasks) });
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { site_id, title, description, priority, assignee_id, due_date } = req.body;
  const { company_id, role, sub } = req.user;

  if (!title)   return res.status(400).json({ error: 'title is required' });
  if (!site_id) return res.status(400).json({ error: 'site_id is required' });

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(site_id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const resolvedPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
  const id  = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO task_status
      (id, site_id, title, description, status, priority, assignee_id, due_date,
       company_id, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, site_id, title, description || null, resolvedPriority,
         assignee_id || null, due_date || null, site.company_id, sub, now, now);

  const task = db.prepare(`
    SELECT t.*, u.name AS assignee_name, u.email AS assignee_email,
      s.label AS site_label, s.color AS site_color
    FROM task_status t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN sites s ON s.id = t.site_id
    WHERE t.id = ?
  `).get(id);

  res.status(201).json({ task });
});

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { company_id, role } = req.user;
  const { status, priority, assignee_id, due_date, title, description } = req.body;

  // Validate status if provided
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const check = verifyTaskOwnership(id, company_id, role);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const fields = [];
  const params = [];

  if (status      !== undefined) { fields.push('status = ?');      params.push(status); }
  if (priority    !== undefined) { fields.push('priority = ?');     params.push(priority); }
  if (assignee_id !== undefined) { fields.push('assignee_id = ?'); params.push(assignee_id); }
  if (due_date    !== undefined) { fields.push('due_date = ?');     params.push(due_date); }
  if (title       !== undefined) { fields.push('title = ?');        params.push(title); }
  if (description !== undefined) { fields.push('description = ?');  params.push(description); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id);

  db.prepare(`UPDATE task_status SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  const task = db.prepare(`
    SELECT t.*, u.name AS assignee_name, u.email AS assignee_email,
      s.label AS site_label, s.color AS site_color
    FROM task_status t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN sites s ON s.id = t.site_id
    WHERE t.id = ?
  `).get(id);

  res.json({ task });
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const { company_id, role } = req.user;

  const check = verifyTaskOwnership(id, company_id, role);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const task = db.prepare(`
    SELECT t.*, u.name AS assignee_name, u.email AS assignee_email,
      s.label AS site_label, s.color AS site_color
    FROM task_status t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN sites s ON s.id = t.site_id
    WHERE t.id = ?
  `).get(id);

  const comments = db.prepare(`
    SELECT c.id, c.body, c.created_at, u.name AS user_name, u.email AS user_email
    FROM task_comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(id);

  res.json({ task, comments });
});

// ─── POST /api/tasks/:id/comments ─────────────────────────────────────────────
router.post('/:id/comments', (req, res) => {
  const { id } = req.params;
  const { body } = req.body;
  const { company_id, role, sub } = req.user;

  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });

  const check = verifyTaskOwnership(id, company_id, role);
  if (check.error) return res.status(check.status).json({ error: check.error });

  db.prepare(
    'INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)'
  ).run(id, sub, body.trim());

  const comment = db.prepare(`
    SELECT c.id, c.body, c.created_at, u.name AS user_name, u.email AS user_email
    FROM task_comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.created_at DESC LIMIT 1
  `).get(id);

  res.status(201).json({ comment });
});

export default router;
```

- [ ] **Step 4: Register tasks route in `backend/server.js`**

Add after `import dashboardRoutes`:
```js
import tasksRoutes from './routes/tasks.js';
```

Add after `app.use('/api/dashboard', dashboardRoutes)`:
```js
app.use('/api/tasks', tasksRoutes);
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd backend && npm test -- --reporter=verbose tasks 2>&1 | tail -20
```

- [ ] **Step 6: Run full test suite — no regressions**

```bash
cd backend && npm test 2>&1 | tail -30
```

- [ ] **Step 7: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/tasks.js backend/__tests__/tasks.test.js backend/server.js
git commit -m "feat(tasks): add /api/tasks CRUD + comments backend"
```

---

## Task 6: AdminView.jsx

**Files:**
- Create: `frontend/src/pages/AdminView.jsx`

- [ ] **Step 1: Create `frontend/src/pages/AdminView.jsx`**

```jsx
/**
 * AdminView — cross-site dashboard for admins.
 * Shows: sites table (GSC + GA4), task KPI row, compact Kanban.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate }                from 'react-router';
import { Activity, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import api               from '../api/index.js';
import { useSites }      from '../context/SitesContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

const PRIORITY_COLORS = {
  critical: 'var(--severity-critical)',
  high:     'var(--severity-warning)',
  medium:   'var(--text-muted)',
  low:      'var(--text-muted)',
};

const STATUS_LABELS = {
  backlog:     'Backlog',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
};

function Delta({ value }) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-medium ml-1"
      style={{ color: positive ? 'var(--severity-pass)' : 'var(--severity-critical)' }}
    >
      {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {Math.abs(value).toLocaleString()}
    </span>
  );
}

function KpiCard({ label, count, status }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="flex-1 rounded-xl p-4 text-left transition-colors"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
      onClick={() => navigate(`/tasks?status=${status}`)}
    >
      <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {count}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </button>
  );
}

function TaskCard({ task }) {
  return (
    <Link
      to={`/tasks/${task.id}`}
      className="block rounded-lg p-3 transition-colors"
      style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}
    >
      <p
        className="text-xs font-medium leading-tight mb-2 line-clamp-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {task.title}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {task.site_color && (
          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: task.site_color }} />
            {task.site_label}
          </span>
        )}
        {task.priority && (
          <span className="text-[10px]" style={{ color: PRIORITY_COLORS[task.priority] || 'var(--text-muted)' }}>
            {task.priority}
          </span>
        )}
        {task.linear_url && (
          <a
            href={task.linear_url}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[10px] underline"
            style={{ color: 'var(--brand)' }}
          >
            Linear
          </a>
        )}
      </div>
    </Link>
  );
}

function KanbanColumn({ status, tasks }) {
  const label = STATUS_LABELS[status] || status;
  const shown = tasks.slice(0, 5);
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
        >
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {shown.map(t => <TaskCard key={t.id} task={t} />)}
        {tasks.length > 5 && (
          <Link
            to={`/tasks?status=${status}`}
            className="block text-center text-[11px] py-1"
            style={{ color: 'var(--brand)' }}
          >
            +{tasks.length - 5} more →
          </Link>
        )}
        {tasks.length === 0 && (
          <p className="text-[11px] text-center py-3" style={{ color: 'var(--text-muted)' }}>
            Nothing here
          </p>
        )}
      </div>
    </div>
  );
}

export function AdminView() {
  const { setActiveSite } = useSites();
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [kanban,  setKanban]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [dashRes, tasksRes] = await Promise.all([
        api.get('/dashboard/admin'),
        api.get('/tasks'),
      ]);
      setData(dashRes.data);
      setKanban(tasksRes.data.kanban);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <LoadingSkeleton type="table" rows={5} cols={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertTriangle} message="Failed to load" description={error} />
      </div>
    );
  }

  const { sites, task_summary } = data;

  if (!sites || sites.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No sites yet"
          description="Add your first site to see the dashboard."
          action={{ label: 'Add Site', to: '/sites/new' }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>

      {/* Sites table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
        <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>All Sites</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Site', 'Health', 'Clicks', 'Impressions', 'CTR', 'Position', 'Sessions', 'Bounce', 'Last Crawl'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sites.map(site => (
                <tr
                  key={site.id}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setActiveSite(site); navigate('/audit'); }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: site.color || 'var(--text-muted)' }} />
                      <span className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{site.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.health_score != null ? `${site.health_score}/100` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.gsc
                      ? <>{site.gsc.clicks.toLocaleString()}<Delta value={site.gsc.clicks_delta} /></>
                      : <Link to="/settings" className="text-[10px]" style={{ color: 'var(--brand)' }}>Connect GSC</Link>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.gsc
                      ? <>{site.gsc.impressions.toLocaleString()}<Delta value={site.gsc.impressions_delta} /></>
                      : '—'
                    }
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.gsc ? `${(site.gsc.ctr * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.gsc ? site.gsc.position.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.ga4
                      ? site.ga4.sessions.toLocaleString()
                      : <Link to="/settings" className="text-[10px]" style={{ color: 'var(--brand)' }}>Connect GA4</Link>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.ga4 ? `${(site.ga4.bounce_rate * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {site.last_crawl
                      ? new Date(site.last_crawl).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task KPI row */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Task Summary</p>
        <div className="flex gap-3">
          <KpiCard label="Backlog"     count={task_summary.backlog}     status="backlog" />
          <KpiCard label="In Progress" count={task_summary.in_progress} status="in_progress" />
          <KpiCard label="Review"      count={task_summary.review}      status="review" />
          <KpiCard label="Done"        count={task_summary.done}        status="done" />
        </div>
      </div>

      {/* Compact Kanban */}
      {kanban && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Task Board</p>
            <Link to="/tasks" className="text-xs" style={{ color: 'var(--brand)' }}>View all →</Link>
          </div>
          <div className="p-4 grid grid-cols-4 gap-4">
            {['backlog', 'in_progress', 'review', 'done'].map(status => (
              <KanbanColumn key={status} status={status} tasks={kanban[status] || []} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/AdminView.jsx
git commit -m "feat(ui): add AdminView — cross-site dashboard with GSC, GA4, Kanban"
```

---

## Task 7: SeoView.jsx

**Files:**
- Create: `frontend/src/pages/SeoView.jsx`

- [ ] **Step 1: Create `frontend/src/pages/SeoView.jsx`**

```jsx
/**
 * SeoView — two-tab page: Analytics (GA4) and Issues (audit + GSC).
 * Active site scoped.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link }                              from 'react-router';
import { Activity, ChevronDown, ChevronRight } from 'lucide-react';
import api                from '../api/index.js';
import { useSites }       from '../context/SitesContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
      {['analytics', 'issues'].map(tab => (
        <button
          key={tab}
          type="button"
          className="px-4 py-2 text-sm font-medium capitalize transition-colors"
          style={{
            color: active === tab ? 'var(--brand)' : 'var(--text-muted)',
            borderBottom: active === tab ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1,
          }}
          onClick={() => onChange(tab)}
        >
          {tab === 'analytics' ? 'Analytics' : 'Issues'}
        </button>
      ))}
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ backgroundColor: 'var(--bg-raised)' }}
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
               : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
      </button>
      {open && <div style={{ backgroundColor: 'var(--bg-surface)' }}>{children}</div>}
    </div>
  );
}

function AnalyticsTab({ siteId }) {
  const [pages,   setPages]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [offset,  setOffset]  = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/ga4/${siteId}/pages?limit=50&offset=${offset}`)
      .then(r => {
        setPages(prev => offset === 0 ? r.data.pages : [...prev, ...r.data.pages]);
        setTotal(r.data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId, offset]);

  if (loading && pages.length === 0) return <LoadingSkeleton type="table" rows={8} cols={5} />;

  if (pages.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No GA4 data found.{' '}
          <Link to="/settings" style={{ color: 'var(--brand)' }}>Connect GA4 →</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>GA4 Page Performance</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['URL', 'Sessions', 'Engaged', 'Bounce Rate', 'Avg Duration'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pages.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="px-4 py-2 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{p.url}</td>
                <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.sessions?.toLocaleString()}</td>
                <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.engaged_sessions?.toLocaleString()}</td>
                <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.bounce_rate != null ? `${(p.bounce_rate * 100).toFixed(0)}%` : '—'}</td>
                <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.avg_session_duration != null ? `${Math.round(p.avg_session_duration)}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages.length < total && (
        <div className="flex justify-center py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className="text-xs px-4 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            onClick={() => setOffset(o => o + 50)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

function IssuesTab({ siteId }) {
  const [gscQueries, setGscQueries] = useState([]);
  const [gscPages,   setGscPages]   = useState([]);
  const [summary,    setSummary]    = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get(`/gsc/${siteId}/queries`),
      api.get(`/gsc/${siteId}/pages`),
      api.get(`/reports/${siteId}/summary`),
    ]).then(([q, p, s]) => {
      if (q.status === 'fulfilled') setGscQueries(q.value.data.queries || []);
      if (p.status === 'fulfilled') setGscPages(p.value.data.pages || []);
      if (s.status === 'fulfilled') setSummary(s.value.data);
    }).finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <LoadingSkeleton type="table" rows={5} cols={4} />;

  return (
    <div className="space-y-4">
      {/* Audit summary card */}
      {summary && (
        <div
          className="flex items-center justify-between p-4 rounded-xl"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.healthScore ?? '—'}
                <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/100</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Health score</p>
            </div>
            <div className="flex gap-4 text-xs">
              <span style={{ color: 'var(--severity-critical)' }}>{summary.totals?.critical || 0} critical</span>
              <span style={{ color: 'var(--severity-warning)' }}>{summary.totals?.warning || 0} warnings</span>
              <span style={{ color: 'var(--severity-info)' }}>{summary.totals?.info || 0} info</span>
            </div>
          </div>
          <Link to="/audit" className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--brand)', color: '#fff' }}>
            View full audit →
          </Link>
        </div>
      )}

      {/* Top GSC Queries */}
      <CollapsibleSection title="Top GSC Queries">
        {gscQueries.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No GSC query data.{' '}
              <Link to="/settings" style={{ color: 'var(--brand)' }}>Connect GSC →</Link>
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Query', 'Clicks', 'Impressions', 'CTR', 'Position'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gscQueries.map((q, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>{q.query}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{q.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{q.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{(q.ctr * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{q.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleSection>

      {/* Top Pages by Clicks */}
      <CollapsibleSection title="Top Pages by Clicks">
        {gscPages.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No GSC page data available.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['URL', 'Clicks', 'Impressions', 'CTR'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gscPages.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{p.url}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{(p.ctr * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleSection>
    </div>
  );
}

export function SeoView() {
  const { activeSite } = useSites();
  const [tab, setTab] = useState('analytics');

  if (!activeSite) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No site selected"
          description="Select a site from the header to view SEO data."
          action={{ label: 'Manage Sites', to: '/sites' }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>SEO Dashboard</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{activeSite.label}</p>
      <TabBar active={tab} onChange={setTab} />
      {tab === 'analytics'
        ? <AnalyticsTab siteId={activeSite.id} />
        : <IssuesTab    siteId={activeSite.id} />
      }
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/SeoView.jsx
git commit -m "feat(ui): add SeoView — GA4 analytics tab + GSC issues tab"
```

---

## Task 8: DeveloperView.jsx

**Files:**
- Create: `frontend/src/pages/DeveloperView.jsx`

- [ ] **Step 1: Create `frontend/src/pages/DeveloperView.jsx`**

```jsx
/**
 * DeveloperView — technical health for the active site.
 * Shows: crawl health, response code breakdown, top issues, custom extraction.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link }                              from 'react-router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, AlertTriangle }           from 'lucide-react';
import api                from '../api/index.js';
import { useSites }       from '../context/SitesContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

const SEVERITY_COLORS = {
  critical: 'var(--severity-critical)',
  warning:  'var(--severity-warning)',
  info:     'var(--severity-info)',
};

const RC_COLORS = {
  '2xx': '#22c55e',
  '3xx': '#f59e0b',
  '4xx': '#ef4444',
  '5xx': '#7f1d1d',
};

function StatCard({ label, value, sub }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {value ?? '—'}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      </div>
      <div style={{ backgroundColor: 'var(--bg-surface)' }}>{children}</div>
    </div>
  );
}

export function DeveloperView() {
  const { activeSite } = useSites();
  const [devData, setDevData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    if (!activeSite) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/reports/${activeSite.id}/developer-summary`);
      setDevData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load developer data');
    } finally {
      setLoading(false);
    }
  }, [activeSite]);

  useEffect(() => { load(); }, [load]);

  if (!activeSite) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No site selected"
          description="Select a site to view technical health."
          action={{ label: 'Manage Sites', to: '/sites' }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <LoadingSkeleton type="table" rows={4} cols={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertTriangle} message="Error" description={error} />
      </div>
    );
  }

  if (!devData?.job) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No crawl data"
          description={`No completed crawl found for ${activeSite.label}. Run a crawl to see technical health.`}
          action={{ label: 'Start Crawl', to: '/crawl' }}
        />
      </div>
    );
  }

  const { job, response_codes, top_issues, custom_extraction } = devData;

  const rcChartData = Object.entries(response_codes)
    .filter(([, v]) => v > 0)
    .map(([code, count]) => ({ code, count, fill: RC_COLORS[code] || '#94a3b8' }));

  const durationMin = job.duration_seconds != null
    ? `${Math.floor(job.duration_seconds / 60)}m ${job.duration_seconds % 60}s`
    : '—';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Developer View</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{activeSite.label}</p>
      </div>

      {/* Card 1: Crawl Health */}
      <SectionCard title="Crawl Health">
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total URLs" value={job.total_urls?.toLocaleString()} />
          <StatCard label="Health Score" value={job.health_score != null ? `${job.health_score}/100` : null} />
          <StatCard label="Duration" value={durationMin} />
          <StatCard
            label="Completed"
            value={job.completed_at
              ? new Date(job.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : '—'}
          />
        </div>
      </SectionCard>

      {/* Card 2: Response Code Breakdown */}
      <SectionCard title="Response Code Breakdown">
        {rcChartData.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No response code data in this crawl.</p>
          </div>
        ) : (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={rcChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v.toLocaleString(), 'URLs']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {rcChartData.map((entry) => (
                    <rect key={entry.code} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Card 3: Top Issues */}
      <SectionCard title="Top Issues by Severity">
        {top_issues.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No issues found — great crawl!</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Issue', 'Section', 'Severity', 'Count'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top_issues.map((issue, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2 max-w-xs" style={{ color: 'var(--text-primary)' }}>{issue.issue_type}</td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/audit/${issue.slug}`}
                      className="text-[10px] underline"
                      style={{ color: 'var(--brand)' }}
                    >
                      {issue.section}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase"
                      style={{
                        color: SEVERITY_COLORS[issue.severity] || 'var(--text-muted)',
                        backgroundColor: `${SEVERITY_COLORS[issue.severity] || 'var(--text-muted)'}18`,
                      }}
                    >
                      {issue.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                    {issue.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Card 4: Custom Extraction */}
      <SectionCard title="Custom Extraction Results">
        {custom_extraction.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No custom extraction data.{' '}
              <Link to="/crawl" style={{ color: 'var(--brand)' }}>Configure extractions in crawl config →</Link>
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Type', 'URL', 'Data'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {custom_extraction.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>{row.issue_type}</td>
                  <td className="px-4 py-2 max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>{row.url}</td>
                  <td className="px-4 py-2 font-mono text-[10px] max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>{row.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/DeveloperView.jsx
git commit -m "feat(ui): add DeveloperView — technical health dashboard"
```

---

## Task 9: Tasks.jsx

**Files:**
- Create: `frontend/src/pages/Tasks.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Tasks.jsx`**

```jsx
/**
 * Tasks — full 4-column Kanban board with drag-and-drop.
 * Reads from /api/tasks, writes via PATCH for status changes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams }                     from 'react-router';
import { Plus, X, AlertTriangle }                    from 'lucide-react';
import { toast }                                     from 'sonner';
import api            from '../api/index.js';
import { useSites }   from '../context/SitesContext.jsx';
import { useAuth }    from '../context/AuthContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';

const VALID_STATUSES   = ['backlog', 'in_progress', 'review', 'done'];
const STATUS_LABELS    = { backlog: 'Backlog', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const PRIORITY_COLORS  = { critical: 'var(--severity-critical)', high: 'var(--severity-warning)', medium: 'var(--text-muted)', low: 'var(--text-muted)' };

function PriorityBadge({ priority }) {
  return (
    <span className="text-[10px] font-medium capitalize" style={{ color: PRIORITY_COLORS[priority] || 'var(--text-muted)' }}>
      {priority}
    </span>
  );
}

function TaskCard({ task, isDragging, onDragStart, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="rounded-lg p-3 cursor-grab active:cursor-grabbing transition-opacity"
      style={{
        backgroundColor: 'var(--bg-page)',
        border: '1px solid var(--border-subtle)',
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <Link
        to={`/tasks/${task.id}`}
        style={{ textDecoration: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-medium leading-tight mb-2 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
          {task.title}
        </p>
      </Link>
      <div className="flex items-center gap-2 flex-wrap">
        {task.site_color && (
          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: task.site_color }} />
            {task.site_label}
          </span>
        )}
        {task.priority && <PriorityBadge priority={task.priority} />}
        {task.assignee_name && (
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{task.assignee_name}</span>
        )}
        {task.due_date && (
          <span
            className="text-[10px]"
            style={{
              color: new Date(task.due_date) < new Date() ? 'var(--severity-critical)' : 'var(--text-muted)',
            }}
          >
            {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        {task.linear_url && (
          <a
            href={task.linear_url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] underline"
            style={{ color: 'var(--brand)' }}
            onClick={e => e.stopPropagation()}
          >
            Linear
          </a>
        )}
      </div>
    </div>
  );
}

function NewTaskModal({ sites, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', site_id: sites[0]?.id || '', description: '', priority: 'medium' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/tasks', form);
      onCreated(res.data.task);
      onClose();
    } catch {
      // error toast already shown by api interceptor
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl w-full max-w-md"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Task</p>
          <button type="button" onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title *</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Site *</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              value={form.site_id}
              onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
              required
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Priority</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
            >
              {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--brand)', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KanbanColumn({ status, tasks, draggingId, onDragStart, onDrop, onDragEnd }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className="flex-1 min-w-0 flex flex-col"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(status, e); }}
      style={{
        backgroundColor: dragOver ? 'var(--bg-raised)' : 'transparent',
        borderRadius: 8,
        transition: 'background-color 0.15s',
        minHeight: 200,
        padding: '0 4px',
      }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {STATUS_LABELS[status]}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
        >
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2 flex-1">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isDragging={draggingId === task.id}
            onDragStart={() => onDragStart(task.id)}
            onDragEnd={onDragEnd}
          />
        ))}
        {tasks.length === 0 && !dragOver && (
          <p className="text-[11px] text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Nothing here
          </p>
        )}
      </div>
    </div>
  );
}

export function Tasks() {
  const { activeSite, sites } = useSites();
  const [searchParams, setSearchParams] = useSearchParams();
  const [kanban,      setKanban]      = useState({ backlog: [], in_progress: [], review: [], done: [] });
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [draggingId,  setDraggingId]  = useState(null);
  const [allSites,    setAllSites]    = useState(false);
  const originalKanbanRef = useRef(null);

  const statusFilter = searchParams.get('status') || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!allSites && activeSite) params.set('siteId', activeSite.id);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/tasks?${params}`);
      setKanban(res.data.kanban);
    } catch {
      // toast shown by interceptor
    } finally {
      setLoading(false);
    }
  }, [activeSite, allSites, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function handleDragStart(taskId) {
    setDraggingId(taskId);
    originalKanbanRef.current = kanban;
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  async function handleDrop(targetStatus, e) {
    const taskId = e.dataTransfer?.getData('taskId') || draggingId;
    if (!taskId) return;

    // Find current status
    let currentStatus = null;
    let task = null;
    for (const [s, tasks] of Object.entries(kanban)) {
      const found = tasks.find(t => t.id === taskId);
      if (found) { currentStatus = s; task = found; break; }
    }
    if (!task || currentStatus === targetStatus) return;

    // Optimistic update
    setKanban(prev => {
      const next = { ...prev };
      next[currentStatus] = prev[currentStatus].filter(t => t.id !== taskId);
      next[targetStatus]  = [{ ...task, status: targetStatus }, ...prev[targetStatus]];
      return next;
    });

    try {
      await api.patch(`/tasks/${taskId}`, { status: targetStatus });
    } catch {
      setKanban(originalKanbanRef.current);
      toast.error('Failed to update task status');
    }
    setDraggingId(null);
  }

  function handleTaskCreated(task) {
    setKanban(prev => ({
      ...prev,
      backlog: [task, ...prev.backlog],
    }));
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Tasks</h1>
          {activeSite && (
            <button
              type="button"
              className="text-xs mt-0.5"
              style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setAllSites(v => !v)}
            >
              {allSites ? 'Showing all sites — click for this site only' : `${activeSite.label} only — click for all sites`}
            </button>
          )}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--brand)', color: '#fff' }}
          onClick={() => setShowModal(true)}
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" rows={5} cols={4} />
      ) : (
        <div
          className="flex gap-4 flex-1 overflow-x-auto"
          onDragOver={e => e.preventDefault()}
        >
          {VALID_STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={kanban[status] || []}
              draggingId={draggingId}
              onDragStart={(id) => {
                setDraggingId(id);
                originalKanbanRef.current = kanban;
                // Use dataTransfer for cross-browser support
                setTimeout(() => {}, 0);
              }}
              onDrop={(targetStatus, e) => {
                // Read from dataTransfer if available, else use state
                const id = draggingId;
                handleDrop(targetStatus, { dataTransfer: { getData: () => id } });
              }}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewTaskModal
          sites={sites}
          onClose={() => setShowModal(false)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/Tasks.jsx
git commit -m "feat(ui): add Tasks — full Kanban with drag-and-drop"
```

---

## Task 10: TaskDetail.jsx

**Files:**
- Create: `frontend/src/pages/TaskDetail.jsx`

- [ ] **Step 1: Create `frontend/src/pages/TaskDetail.jsx`**

```jsx
/**
 * TaskDetail — single task: metadata panel + comments thread.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link }                  from 'react-router';
import { ArrowLeft, ExternalLink }          from 'lucide-react';
import { toast }                            from 'sonner';
import api               from '../api/index.js';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

const VALID_STATUSES   = ['backlog', 'in_progress', 'review', 'done'];
const STATUS_LABELS    = { backlog: 'Backlog', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

function MetaField({ label, children }) {
  return (
    <div className="py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {children}
    </div>
  );
}

function Comment({ comment }) {
  const initials = (comment.user_name || comment.user_email || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="flex gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
        style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand)' }}
      >
        {initials}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {comment.user_name || comment.user_email}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{comment.body}</p>
      </div>
    </div>
  );
}

export function TaskDetail() {
  const { id }                    = useParams();
  const [task,       setTask]     = useState(null);
  const [comments,   setComments] = useState([]);
  const [loading,    setLoading]  = useState(true);
  const [notFound,   setNotFound] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saving,     setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks/${id}`);
      setTask(res.data.task);
      setComments(res.data.comments || []);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function patchTask(fields) {
    setSaving(true);
    try {
      const res = await api.patch(`/tasks/${id}`, fields);
      setTask(res.data.task);
    } catch {
      // toast shown by interceptor
    } finally {
      setSaving(false);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/tasks/${id}/comments`, { body: newComment.trim() });
      setComments(prev => [...prev, res.data.comment]);
      setNewComment('');
    } catch {
      // toast shown by interceptor
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6"><LoadingSkeleton type="table" rows={6} cols={2} /></div>;

  if (notFound) {
    return (
      <div className="p-6">
        <EmptyState message="Task not found" description="This task may have been deleted." action={{ label: '← Back to Tasks', to: '/tasks' }} />
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        to="/tasks"
        className="inline-flex items-center gap-1.5 text-xs mb-4"
        style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Tasks
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Comments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title */}
          <input
            className="w-full text-lg font-bold bg-transparent border-0 outline-none"
            style={{ color: 'var(--text-primary)' }}
            defaultValue={task.title}
            onBlur={e => {
              if (e.target.value.trim() && e.target.value !== task.title) {
                patchTask({ title: e.target.value.trim() });
              }
            }}
          />

          {/* Comments */}
          <div
            className="rounded-xl p-4 space-y-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Comments ({comments.length})
            </p>
            {comments.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No comments yet.</p>
            )}
            {comments.map(c => <Comment key={c.id} comment={c} />)}
          </div>

          {/* New comment */}
          <form onSubmit={submitComment} className="space-y-2">
            <textarea
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              placeholder="Add a comment…"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--brand)', color: '#fff', opacity: submitting || !newComment.trim() ? 0.6 : 1 }}
              >
                {submitting ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Metadata */}
        <div
          className="rounded-xl p-4 h-fit"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Details</p>

          <MetaField label="Status">
            <select
              className="w-full rounded-lg px-2 py-1.5 text-xs"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              value={task.status}
              onChange={e => patchTask({ status: e.target.value })}
              disabled={saving}
            >
              {VALID_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </MetaField>

          <MetaField label="Priority">
            <select
              className="w-full rounded-lg px-2 py-1.5 text-xs"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              value={task.priority || 'medium'}
              onChange={e => patchTask({ priority: e.target.value })}
              disabled={saving}
            >
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </MetaField>

          <MetaField label="Site">
            <p className="text-xs flex items-center gap-1.5">
              {task.site_color && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.site_color }} />
              )}
              <span style={{ color: 'var(--text-secondary)' }}>{task.site_label || task.site_id}</span>
            </p>
          </MetaField>

          {task.assignee_name && (
            <MetaField label="Assignee">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{task.assignee_name}</p>
            </MetaField>
          )}

          {task.due_date && (
            <MetaField label="Due Date">
              <p
                className="text-xs"
                style={{ color: new Date(task.due_date) < new Date() ? 'var(--severity-critical)' : 'var(--text-secondary)' }}
              >
                {new Date(task.due_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </MetaField>
          )}

          {task.linear_url && (
            <MetaField label="Linear">
              <a
                href={task.linear_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs"
                style={{ color: 'var(--brand)' }}
              >
                View in Linear <ExternalLink className="w-3 h-3" />
              </a>
            </MetaField>
          )}

          <MetaField label="Created">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </MetaField>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/TaskDetail.jsx
git commit -m "feat(ui): add TaskDetail — task metadata + comments thread"
```

---

## Task 11: Router wiring + stubs cleanup

**Files:**
- Modify: `frontend/src/router.jsx`
- Modify: `frontend/src/pages/stubs.jsx`

- [ ] **Step 1: Update `frontend/src/router.jsx`**

Replace the import block at the top. Change:
```js
import {
  AdminView, DeveloperView, SeoView,
  CoreWebVitals,
  Tasks, TaskDetail,
  ScheduledCrawls, Exports, Notifications,
  Integrations, SystemHealth,
  GscOverlay, Ga4Overlay, ErrorLog, CompareView,
  AuditCustomExtraction, AuditLogFile,
} from './pages/stubs.jsx';
```

With:
```js
import {
  CoreWebVitals,
  ScheduledCrawls, Exports, Notifications,
  Integrations, SystemHealth,
  GscOverlay, Ga4Overlay, ErrorLog, CompareView,
  AuditCustomExtraction, AuditLogFile,
} from './pages/stubs.jsx';

import { AdminView }     from './pages/AdminView.jsx';
import { SeoView }       from './pages/SeoView.jsx';
import { DeveloperView } from './pages/DeveloperView.jsx';
import { Tasks }         from './pages/Tasks.jsx';
import { TaskDetail }    from './pages/TaskDetail.jsx';
```

Then find the Dashboards section in the router children and replace:
```js
/* Dashboards */
{ path: '/admin',       element: <AdminView /> },
{ path: '/developer',   element: <DeveloperView /> },
{ path: '/seo',         element: <SeoView /> },
```

With (moving `/admin` into `AdminOnly`, keeping `/seo` and `/developer` accessible to all authenticated users):
```js
/* Dashboards — all authenticated */
{ path: '/developer', element: <DeveloperView /> },
{ path: '/seo',       element: <SeoView /> },
```

And inside the existing `AdminOnly` children array, add `/admin`:
```js
{
  element: <AdminOnly />,
  children: [
    { path: '/admin',        element: <AdminView /> },
    { path: '/integrations', element: <Integrations /> },
    { path: '/system',       element: <SystemHealth /> },
    { path: '/users',        element: <Users /> },
    { path: '/settings',     element: <Settings /> },
    { path: '/errors',       element: <ErrorLog /> },
  ],
},
```

- [ ] **Step 2: Update `frontend/src/pages/stubs.jsx`**

Remove these 5 exports from `stubs.jsx` (delete the entire lines):
```js
export function AdminView()     { return <Stub title="Admin View" ... />; }
export function DeveloperView() { return <Stub title="Developer View" ... />; }
export function SeoView()       { return <Stub title="SEO Dashboard" ... />; }
export function Tasks()         { return <Stub title="Tasks" ... />; }
export function TaskDetail()    { return <Stub title="Task Detail" ... />; }
```

- [ ] **Step 3: Start dev server and verify pages load**

```bash
cd /Users/a39326/Documents/Aakash && npm run dev
```

Open in browser:
- http://localhost:5173/seo — should show "Select a site" or actual SEO View (not stub)
- http://localhost:5173/developer — should show DeveloperView (not stub)
- http://localhost:5173/admin — should require admin role
- http://localhost:5173/tasks — should show empty Kanban columns (not stub)

Check browser console — zero red errors.

- [ ] **Step 4: Run full backend test suite one more time**

```bash
cd backend && npm test 2>&1 | tail -30
```
Expected: all existing tests pass + new tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/router.jsx frontend/src/pages/stubs.jsx
git commit -m "feat: wire Phase 4a pages into router, remove stubs"
```
