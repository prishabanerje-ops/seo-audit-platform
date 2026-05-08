# Audit Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 20 audit category stub pages and the IssueDetail stub with real data-driven pages, complete with a per-URL AI recommendation engine backed by a new `/api/ai` route.

**Architecture:** A single `AuditCategory.jsx` component handles all 20 category routes by reading a slug → DB section map. `IssueDetail.jsx` is URL-centric (one `audit_results` row per page) with prev/next navigation and hybrid AI (auto-show if cached, button if not). The AI route streams via SSE using `@anthropic-ai/sdk` and caches per `result_id`.

**Tech Stack:** React 18 + React Router v7, Express, better-sqlite3 (sync), @anthropic-ai/sdk streaming SSE, express-rate-limit, Vitest + supertest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/db/migrations/015_ai_suggestions_per_url.js` | Adds `result_id UNIQUE` + `feedback` columns to `ai_suggestions` |
| Modify | `backend/db/sqlite.js` | Import and register migration 015 |
| Modify | `backend/routes/reports.js` | Add 3 new endpoints: category groups, issues list, single result+check |
| Create | `backend/routes/ai.js` | POST suggest (SSE + cache fast-path), GET cache lookup, POST feedback |
| Modify | `backend/middleware/rateLimiter.js` | Add `aiLimiter` (10 req/min per IP) |
| Modify | `backend/server.js` | Import and register `/api/ai` route |
| Create | `frontend/src/pages/AuditCategory.jsx` | Generic category page for all 20 slug routes |
| Create | `frontend/src/pages/IssueDetail.jsx` | URL-centric issue detail with AI recommendation + prev/next |
| Modify | `frontend/src/pages/stubs.jsx` | Remove 20 `AuditXxx` exports + `IssueDetail` export |
| Modify | `frontend/src/router.jsx` | Wire AuditCategory to all 20 routes; wire real IssueDetail |

---

## Task 1: Migration 015 — add `result_id` and `feedback` to `ai_suggestions`

**Files:**
- Create: `backend/db/migrations/015_ai_suggestions_per_url.js`
- Modify: `backend/db/sqlite.js` (lines 6–49)

- [ ] **Step 1: Write the migration file**

Create `backend/db/migrations/015_ai_suggestions_per_url.js`:

```js
export function up(db) {
  const cols = db.pragma('table_info(ai_suggestions)').map(c => c.name);

  if (!cols.includes('result_id')) {
    db.prepare('ALTER TABLE ai_suggestions ADD COLUMN result_id INTEGER').run();
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_suggestions_result_id
      ON ai_suggestions(result_id) WHERE result_id IS NOT NULL
    `).run();
  }

  if (!cols.includes('feedback')) {
    db.prepare('ALTER TABLE ai_suggestions ADD COLUMN feedback INTEGER').run();
  }
}
```

- [ ] **Step 2: Register migration 015 in `backend/db/sqlite.js`**

Add the import after line 18 (after migration014 import):
```js
import { up as migration015 } from './migrations/015_ai_suggestions_per_url.js';
```

Add to the MIGRATIONS array after the id:14 entry:
```js
  { id: 15, fn: migration015, name: '015_ai_suggestions_per_url' },
```

- [ ] **Step 3: Run migrations manually to verify**

```bash
cd /Users/a39326/Documents/Aakash/backend && node db/sqlite.js
```

Expected: no error output (migration runs silently; columns added if not present).

- [ ] **Step 4: Verify columns exist**

```bash
cd /Users/a39326/Documents/Aakash/backend && node -e "
import db from './db/sqlite.js';
const cols = db.pragma('table_info(ai_suggestions)').map(c => c.name);
console.log(cols);
" 2>&1 | grep -E 'result_id|feedback'
```

Expected: both `result_id` and `feedback` appear in output.

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/db/migrations/015_ai_suggestions_per_url.js backend/db/sqlite.js
git commit -m "feat(db): migration 015 — add result_id and feedback to ai_suggestions"
```

---

## Task 2: Three new report endpoints

**Files:**
- Modify: `backend/routes/reports.js` (append 3 new routes)

- [ ] **Step 1: Write a failing test for all three endpoints**

Create `backend/__tests__/reports-drill-down.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign(
  { sub: 'u1', email: 't@test.com', role: 'seo', company_id: 'company-test' },
  SECRET,
  { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/reports/:siteId/category', () => {
  it('returns 400 when section param is missing', async () => {
    const res = await request(app)
      .get('/api/reports/site-fake/category')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/reports/site-does-not-exist/category?section=Title+Tags')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/reports/:siteId/issues', () => {
  it('returns 400 when section or issue_type param is missing', async () => {
    const res = await request(app)
      .get('/api/reports/site-fake/issues?section=Title+Tags')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/reports/results/:resultId', () => {
  it('returns 404 for non-existent resultId', async () => {
    const res = await request(app)
      .get('/api/reports/results/9999999')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test -- --reporter=verbose reports-drill-down
```

Expected: tests fail because routes don't exist yet (501 or similar).

- [ ] **Step 3: Implement the three endpoints in `backend/routes/reports.js`**

Append to `backend/routes/reports.js` before the final `export default router;` line (or at the end of the file):

```js
// ─── GET /api/reports/:siteId/category ───────────────────────────────────────
router.get('/:siteId/category', (req, res) => {
  const { siteId } = req.params;
  const { section, job_id } = req.query;
  const { company_id, role } = req.user;

  if (!section) return res.status(400).json({ error: 'section param is required' });

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Resolve job_id — use provided or fall back to latest completed
  let jobId = job_id || null;
  if (!jobId) {
    const latestJob = db.prepare(`
      SELECT id FROM crawl_jobs
      WHERE site_id = ? AND status = 'completed'
      ORDER BY started_at DESC LIMIT 1
    `).get(siteId);
    jobId = latestJob?.id || null;
  }

  if (!jobId) {
    return res.json({ jobId: null, section, groups: [] });
  }

  const groups = db.prepare(`
    SELECT issue_type, severity, COUNT(*) AS count
    FROM audit_results
    WHERE crawl_job_id = ? AND section = ?
    GROUP BY issue_type, severity
    ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
      count DESC
  `).all(jobId, section);

  res.json({ jobId, section, groups });
});

// ─── GET /api/reports/:siteId/issues ─────────────────────────────────────────
router.get('/:siteId/issues', (req, res) => {
  const { siteId } = req.params;
  const { section, issue_type, job_id, limit: rawLimit, offset: rawOffset } = req.query;
  const { company_id, role } = req.user;

  if (!section)     return res.status(400).json({ error: 'section param is required' });
  if (!issue_type)  return res.status(400).json({ error: 'issue_type param is required' });

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const limit  = Math.min(parseInt(rawLimit  || '50',  10), 200);
  const offset = parseInt(rawOffset || '0', 10);

  let jobId = job_id || null;
  if (!jobId) {
    const latestJob = db.prepare(`
      SELECT id FROM crawl_jobs
      WHERE site_id = ? AND status = 'completed'
      ORDER BY started_at DESC LIMIT 1
    `).get(siteId);
    jobId = latestJob?.id || null;
  }

  if (!jobId) {
    return res.json({ results: [], total: 0, limit, offset });
  }

  const results = db.prepare(`
    SELECT id, url, severity, data
    FROM audit_results
    WHERE crawl_job_id = ? AND section = ? AND issue_type = ?
    ORDER BY url
    LIMIT ? OFFSET ?
  `).all(jobId, section, issue_type, limit, offset);

  const { total } = db.prepare(`
    SELECT COUNT(*) AS total
    FROM audit_results
    WHERE crawl_job_id = ? AND section = ? AND issue_type = ?
  `).get(jobId, section, issue_type);

  res.json({ results, total, limit, offset });
});

// ─── GET /api/reports/results/:resultId ──────────────────────────────────────
// NOTE: This route must be defined BEFORE /:siteId routes to avoid Express
// treating "results" as a siteId value. Place this block before the /:siteId
// routes above, or ensure it is added at the top of the file after /checks/count.
router.get('/results/:resultId', (req, res) => {
  const { resultId } = req.params;
  const { company_id, role } = req.user;

  const result = db.prepare(`
    SELECT id, url, issue_type, section, severity, data, company_id
    FROM audit_results
    WHERE id = ?
  `).get(resultId);

  if (!result) return res.status(404).json({ error: 'Result not found' });
  if (role !== 'superadmin' && result.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const check = db.prepare(`
    SELECT id, name, description, seo_impact, implementation_rule, subsection
    FROM audit_checks
    WHERE name = ?
  `).get(result.issue_type) || null;

  res.json({ result, check });
});
```

**IMPORTANT:** The `/results/:resultId` route must appear in the file **before** the `/:siteId/category` and `/:siteId/issues` routes, otherwise Express will try to match `results` as a `siteId`. Place the `results/:resultId` route directly after the `/checks/count` route, not at the end.

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test -- --reporter=verbose reports-drill-down
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/reports.js backend/__tests__/reports-drill-down.test.js
git commit -m "feat(reports): add category groups, issues list, and single result endpoints"
```

---

## Task 3: Create `backend/routes/ai.js`

**Files:**
- Create: `backend/routes/ai.js`
- Modify: `backend/middleware/rateLimiter.js` (add `aiLimiter`)

- [ ] **Step 1: Write a failing test for the AI routes**

Create `backend/__tests__/ai-suggest.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign(
  { sub: 'u1', email: 't@test.com', role: 'seo', company_id: 'company-test' },
  SECRET,
  { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/ai/suggest', () => {
  it('returns 400 when result_id is missing', async () => {
    const res = await request(app)
      .get('/api/ai/suggest')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('returns { suggestion: null } when result_id has no cached suggestion', async () => {
    const res = await request(app)
      .get('/api/ai/suggest?result_id=9999999')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestion: null });
  });
});

describe('POST /api/ai/suggest', () => {
  it('returns 400 when result_id is missing from body', async () => {
    const res = await request(app)
      .post('/api/ai/suggest')
      .set('Cookie', cookie)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when result_id does not exist', async () => {
    const res = await request(app)
      .post('/api/ai/suggest')
      .set('Cookie', cookie)
      .send({ result_id: 9999999 });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/ai/suggest/:id/feedback', () => {
  it('returns 400 when value is not 1 or -1', async () => {
    const res = await request(app)
      .post('/api/ai/suggest/fake-id/feedback')
      .set('Cookie', cookie)
      .send({ value: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when suggestion id does not exist', async () => {
    const res = await request(app)
      .post('/api/ai/suggest/does-not-exist/feedback')
      .set('Cookie', cookie)
      .send({ value: 1 });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test -- --reporter=verbose ai-suggest
```

Expected: tests fail (routes don't exist yet).

- [ ] **Step 3: Add `aiLimiter` to `backend/middleware/rateLimiter.js`**

Read the file, then add after the existing limiters:

```js
// 10 requests per minute per IP — for AI suggestion endpoint
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a minute.' },
});
```

- [ ] **Step 4: Create `backend/routes/ai.js`**

```js
/**
 * @module routes/ai
 * Per-URL AI recommendations via Claude (SSE streaming + cache).
 */
import { Router }    from 'express';
import { randomUUID } from 'crypto';
import Anthropic      from '@anthropic-ai/sdk';
import db             from '../db/sqlite.js';
import { aiLimiter }  from '../middleware/rateLimiter.js';

const router = Router();

// ─── GET /api/ai/suggest?result_id=:id ───────────────────────────────────────
// Cache lookup — returns cached suggestion or { suggestion: null }
router.get('/suggest', (req, res) => {
  const { result_id } = req.query;
  if (!result_id) return res.status(400).json({ error: 'result_id is required' });

  const row = db.prepare(`
    SELECT id, response_text AS suggestion, feedback
    FROM ai_suggestions
    WHERE result_id = ?
  `).get(result_id);

  if (!row) return res.json({ suggestion: null });
  res.json({ suggestion: row.suggestion, id: row.id, feedback: row.feedback });
});

// ─── POST /api/ai/suggest ─────────────────────────────────────────────────────
// Generate or return cached AI recommendation for a specific audit result row.
router.post('/suggest', aiLimiter, async (req, res) => {
  const { result_id } = req.body;
  if (!result_id) return res.status(400).json({ error: 'result_id is required' });

  const { company_id, role } = req.user;

  // 1. Fetch audit result
  const result = db.prepare(`
    SELECT id, url, issue_type, section, severity, data, company_id,
           crawl_job_id, site_id
    FROM audit_results WHERE id = ?
  `).get(result_id);
  if (!result) return res.status(404).json({ error: 'Result not found' });
  if (role !== 'superadmin' && result.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // 2. Cache fast-path
  const cached = db.prepare(`
    SELECT id, response_text AS suggestion
    FROM ai_suggestions WHERE result_id = ?
  `).get(result_id);
  if (cached) {
    return res.json({ cached: true, id: cached.id, suggestion: cached.suggestion });
  }

  // 3. Fetch matching audit check (by name = issue_type)
  const check = db.prepare(`
    SELECT id, name, description, seo_impact, implementation_rule
    FROM audit_checks WHERE name = ?
  `).get(result.issue_type);

  // 4. Resolve Anthropic API key
  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const setting = db.prepare(`SELECT value FROM settings WHERE key = 'anthropic_api_key'`).get();
    apiKey = setting?.value || null;
  }
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI recommendations require an Anthropic API key. Configure it in Settings.',
    });
  }

  // 5. Parse detected data
  let parsedData;
  try {
    parsedData = JSON.parse(result.data);
  } catch {
    parsedData = result.data;
  }

  // 6. Build prompt
  const prompt = [
    check ? `Issue type: ${check.name}` : `Issue type: ${result.issue_type}`,
    check?.description          ? `Description: ${check.description}`              : null,
    check?.seo_impact           ? `Why it matters: ${check.seo_impact}`            : null,
    check?.implementation_rule  ? `How to fix: ${check.implementation_rule}`       : null,
    ``,
    `Affected page URL: ${result.url}`,
    `Detected data: ${JSON.stringify(parsedData)}`,
    ``,
    `Give a concise, actionable recommendation (3–5 sentences) to fix this issue on this exact page.`,
    `Use the detected data values — do not give generic advice.`,
  ].filter(l => l !== null).join('\n');

  // 7. Stream SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const client = new Anthropic({ apiKey });
  let fullText = '';

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are an SEO expert reviewing a specific page issue found by an automated audit.',
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const text = event.delta.text;
        fullText += text;
        res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
    }

    // 8. Persist to cache
    const suggestionId = randomUUID();
    db.prepare(`
      INSERT INTO ai_suggestions
        (id, result_id, check_id, job_id, site_id, section, response_text, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      suggestionId,
      result.id,
      check?.id || null,
      result.crawl_job_id,
      result.site_id,
      result.section,
      fullText,
      result.company_id,
    );

    res.write(`data: ${JSON.stringify({ type: 'done', id: suggestionId })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

// ─── POST /api/ai/suggest/:id/feedback ───────────────────────────────────────
router.post('/suggest/:id/feedback', (req, res) => {
  const { id } = req.params;
  const { value } = req.body;
  const { company_id, role } = req.user;

  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: 'value must be 1 (thumbs up) or -1 (thumbs down)' });
  }

  const suggestion = db.prepare(
    'SELECT id, company_id FROM ai_suggestions WHERE id = ?'
  ).get(id);
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });
  if (role !== 'superadmin' && suggestion.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare('UPDATE ai_suggestions SET feedback = ? WHERE id = ?').run(value, id);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test -- --reporter=verbose ai-suggest
```

Expected: all 6 tests pass (API key tests will get 503 or 404, not 500).

- [ ] **Step 6: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/routes/ai.js backend/__tests__/ai-suggest.test.js backend/middleware/rateLimiter.js
git commit -m "feat(ai): add per-URL AI suggestion route with SSE streaming and feedback"
```

---

## Task 4: Register AI route in `backend/server.js`

**Files:**
- Modify: `backend/server.js` (lines 25–35 imports, lines 123–134 route registrations)

- [ ] **Step 1: Add import to `backend/server.js`**

After the `import ga4Routes` line (line 35), add:
```js
import aiRoutes       from './routes/ai.js';
```

- [ ] **Step 2: Register the route in `backend/server.js`**

After the `app.use('/api/ga4', ga4Routes);` line (line 134), add:
```js
app.use('/api/ai',        aiRoutes);
```

- [ ] **Step 3: Start the backend and verify the route is reachable**

```bash
cd /Users/a39326/Documents/Aakash/backend && node server.js &
sleep 2
curl -s http://localhost:3001/api/ai/suggest?result_id=1
```

Expected: `{"suggestion":null}` or `{"error":"..."}` — NOT a 501 "not yet implemented" response.

Kill the test server: `kill %1`

- [ ] **Step 4: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add backend/server.js
git commit -m "feat(server): register /api/ai routes"
```

---

## Task 5: Create `frontend/src/pages/AuditCategory.jsx`

**Files:**
- Create: `frontend/src/pages/AuditCategory.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/AuditCategory.jsx`:

```jsx
/**
 * AuditCategory — generic category drill-down page.
 * Handles all 20 audit category routes via slug → section mapping.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ChevronDown, ChevronRight, AlertTriangle, Info, Loader2 } from 'lucide-react';
import api           from '../api/index.js';
import { useSites }  from '../context/SitesContext.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';

// Maps URL slug → audit_results.section value in the DB
const CATEGORY_SLUG_MAP = {
  'response-codes':  'Response Codes',
  'canonicals':      'Canonical',
  'robots':          'Robots / Indexability',
  'sitemap':         'Sitemap',
  'crawl-depth':     'URL Structure',
  'title-tags':      'Title Tags',
  'meta-desc':       'Meta Description',
  'headings':        'Headings',
  'links':           'Internal Linking',
  'images':          'Images',
  'structured-data': 'Schema / Structured Data',
  'content':         'Content',
  'page-speed':      'Speed & Performance',
  'mobile':          'Mobile SEO',
  'custom':          'JavaScript Rendering',
  'indexability':    'Robots / Indexability',
  'hreflang':        'International SEO',
  'redirects':       'Response Codes',
  'security':        'Monitoring & Operations',
  'international':   'International SEO',
};

const SEVERITY_STYLES = {
  critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
  warning:  { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
  info:     { color: 'var(--severity-info)',      bg: 'var(--severity-info-bg)'    },
};

function SeverityBadge({ severity }) {
  const s = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
  return (
    <span
      style={{
        fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px',
        borderRadius: 4, color: s.color, backgroundColor: s.bg,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}
    >
      {severity}
    </span>
  );
}

export function AuditCategory() {
  const { slug } = useParams();
  const { activeSite } = useSites();

  const sectionName = CATEGORY_SLUG_MAP[slug];

  const [loading, setLoading]     = useState(true);
  const [groups, setGroups]       = useState([]);
  const [jobId, setJobId]         = useState(null);
  const [expanded, setExpanded]   = useState(new Set());
  // urlMap: issue_type → { results: [], total: 0, loading: false, offset: 0 }
  const [urlMap, setUrlMap]       = useState({});

  // Fetch category groups on mount / site change
  useEffect(() => {
    if (!activeSite || !sectionName) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setGroups([]);
    setJobId(null);
    setExpanded(new Set());
    setUrlMap({});

    api.get(`/reports/${activeSite.id}/category`, { params: { section: sectionName } })
      .then(r => {
        setGroups(r.data.groups || []);
        setJobId(r.data.jobId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeSite?.id, sectionName]);

  // Fetch URLs for an issue_type accordion row (lazy)
  function fetchUrls(issueType, offset = 0) {
    setUrlMap(prev => ({
      ...prev,
      [issueType]: { ...(prev[issueType] || {}), loading: true },
    }));

    api.get(`/reports/${activeSite.id}/issues`, {
      params: { section: sectionName, issue_type: issueType, limit: 50, offset },
    }).then(r => {
      setUrlMap(prev => {
        const existing = prev[issueType]?.results || [];
        return {
          ...prev,
          [issueType]: {
            results: offset === 0 ? r.data.results : [...existing, ...r.data.results],
            total: r.data.total,
            loading: false,
            offset: offset + r.data.results.length,
          },
        };
      });
    }).catch(() => {
      setUrlMap(prev => ({
        ...prev,
        [issueType]: { ...(prev[issueType] || {}), loading: false },
      }));
    });
  }

  function toggleAccordion(issueType) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(issueType)) {
        next.delete(issueType);
      } else {
        next.add(issueType);
        // Lazy-load URLs on first expand
        if (!urlMap[issueType]?.results) {
          fetchUrls(issueType, 0);
        }
      }
      return next;
    });
  }

  // Unknown slug
  if (!sectionName) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          message="Unknown category"
          description="This audit category does not exist."
          action={{ to: '/audit', label: '← Back to Audit Health' }}
        />
      </div>
    );
  }

  // No site selected
  if (!activeSite) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          message="No site selected"
          description="Select a site to view audit issues."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  // No crawl
  if (!jobId) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          message={`No completed crawl for ${activeSite.label}`}
          description="Start a crawl to see audit results."
          action={{ to: '/crawl', label: 'Start Crawl' }}
        />
      </div>
    );
  }

  // No issues in this section
  if (groups.length === 0) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          {sectionName}
        </h1>
        <EmptyState
          message={`No ${sectionName} issues found in the latest crawl.`}
          description="Run a new crawl to check again."
          action={{ to: '/crawl', label: 'Start Crawl' }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '0.75rem' }}>
        <Link to="/audit" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Audit Health
        </Link>
      </div>

      <h1 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
        {sectionName}
      </h1>

      {/* Accordion rows — one per issue_type */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {groups.map(group => {
          const isOpen  = expanded.has(group.issue_type);
          const urlData = urlMap[group.issue_type];

          return (
            <div
              key={group.issue_type}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-surface)',
                overflow: 'hidden',
              }}
            >
              {/* Accordion header */}
              <button
                onClick={() => toggleAccordion(group.issue_type)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: '0.75rem', padding: '0.875rem 1rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {isOpen
                  ? <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  : <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                }
                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {group.issue_type}
                </span>
                <SeverityBadge severity={group.severity} />
                <span
                  style={{
                    marginLeft: '0.5rem', fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--text-muted)',
                  }}
                >
                  {group.count.toLocaleString()} URL{group.count !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Expanded URL list */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {urlData?.loading && !urlData?.results?.length && (
                    <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
                      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}

                  {urlData?.results?.map((row, idx) => {
                    let parsed = null;
                    try { parsed = JSON.parse(row.data); } catch { /* raw */ }

                    return (
                      <Link
                        key={row.id}
                        to={`/audit/issue/${row.id}?from=${slug}&issueType=${encodeURIComponent(group.issue_type)}&pos=${idx}&total=${group.count}`}
                        style={{
                          display: 'block', padding: '0.75rem 1rem',
                          borderBottom: '1px solid var(--border)',
                          textDecoration: 'none',
                          background: 'transparent',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontSize: '0.8rem', color: 'var(--brand)', wordBreak: 'break-all' }}>
                          {row.url}
                        </div>
                        {parsed && typeof parsed === 'object' && (
                          <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {Object.entries(parsed).slice(0, 4).map(([k, v]) => (
                              <span key={k} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span style={{ fontWeight: 600 }}>{k}:</span> {String(v).slice(0, 80)}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                    );
                  })}

                  {/* Load more */}
                  {urlData && urlData.results && urlData.total > urlData.results.length && (
                    <div style={{ padding: '0.75rem 1rem' }}>
                      <button
                        onClick={() => fetchUrls(group.issue_type, urlData.offset)}
                        disabled={urlData.loading}
                        style={{
                          fontSize: '0.8rem', color: 'var(--brand)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {urlData.loading ? 'Loading…' : `Load more (${urlData.total - urlData.results.length} remaining)`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component renders without crash (visual check)**

Start dev server (`npm run dev` from project root), navigate to `/audit/title-tags` with an active site that has a completed crawl. Confirm:
- Page shows `Title Tags` heading
- At least one accordion row renders
- Clicking a row expands it and shows URLs (or "loading" spinner)
- Each URL row links to `/audit/issue/:id?from=title-tags&...`

If no crawl data exists, confirm the "No completed crawl" empty state renders.

- [ ] **Step 3: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/AuditCategory.jsx
git commit -m "feat(frontend): add AuditCategory page — generic drill-down for all 20 audit categories"
```

---

## Task 6: Create `frontend/src/pages/IssueDetail.jsx`

**Files:**
- Create: `frontend/src/pages/IssueDetail.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/IssueDetail.jsx`:

```jsx
/**
 * IssueDetail — URL-centric issue detail page.
 * Shows: result row, check definition panel, detected data table,
 * AI recommendation (auto if cached, button if not), prev/next navigation.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router';
import {
  ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown,
  Sparkles, Loader2, AlertTriangle,
} from 'lucide-react';
import api          from '../api/index.js';
import { useSites } from '../context/SitesContext.jsx';
import { Button }   from '../components/ui/Button.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';

// Inverse lookup: section name → slug (for breadcrumb label)
const SECTION_TO_SLUG = {
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
  'International SEO':        'hreflang',
  'Monitoring & Operations':  'security',
};

const SLUG_LABELS = {
  'response-codes':  'Response Codes',
  'canonicals':      'Canonicals',
  'robots':          'Robots / Indexability',
  'sitemap':         'Sitemap',
  'crawl-depth':     'Crawl Depth',
  'title-tags':      'Title Tags',
  'meta-desc':       'Meta Descriptions',
  'headings':        'Headings',
  'links':           'Internal Linking',
  'images':          'Images',
  'structured-data': 'Structured Data',
  'content':         'Content',
  'page-speed':      'Page Speed',
  'mobile':          'Mobile SEO',
  'custom':          'JavaScript Rendering',
  'indexability':    'Indexability',
  'hreflang':        'Hreflang',
  'redirects':       'Redirects',
  'security':        'Security',
  'international':   'International SEO',
};

const SEVERITY_STYLES = {
  critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
  warning:  { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
  info:     { color: 'var(--severity-info)',      bg: 'var(--severity-info-bg)'    },
};

export function IssueDetail() {
  const { resultId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeSite } = useSites();

  const fromSlug  = searchParams.get('from') || '';
  const issueType = searchParams.get('issueType') || '';
  const pos       = parseInt(searchParams.get('pos') || '0', 10);
  const total     = parseInt(searchParams.get('total') || '0', 10);

  const [loading, setLoading]           = useState(true);
  const [result, setResult]             = useState(null);
  const [check, setCheck]               = useState(null);
  const [notFound, setNotFound]         = useState(false);

  const [siblingIds, setSiblingIds]     = useState([]);
  const siblingsLoadedRef               = useRef(false);

  const [suggestion, setSuggestion]     = useState(null);
  const [suggestionId, setSuggestionId] = useState(null);
  const [feedback, setFeedback]         = useState(null);
  const [streaming, setStreaming]       = useState(false);
  const [streamError, setStreamError]   = useState(null);
  const [aiChecked, setAiChecked]       = useState(false);

  // Fetch result + cached AI suggestion in parallel on mount
  useEffect(() => {
    setLoading(true);
    setResult(null);
    setCheck(null);
    setNotFound(false);
    setSuggestion(null);
    setSuggestionId(null);
    setFeedback(null);
    setStreamError(null);
    setAiChecked(false);
    siblingsLoadedRef.current = false;

    Promise.all([
      api.get(`/reports/results/${resultId}`).catch(e => ({ error: e })),
      api.get(`/ai/suggest`, { params: { result_id: resultId } }).catch(() => null),
    ]).then(([resultResp, aiResp]) => {
      if (resultResp.error || resultResp.data?.error) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setResult(resultResp.data.result);
      setCheck(resultResp.data.check);

      if (aiResp?.data?.suggestion) {
        setSuggestion(aiResp.data.suggestion);
        setSuggestionId(aiResp.data.id);
        setFeedback(aiResp.data.feedback ?? null);
      }
      setAiChecked(true);
      setLoading(false);

      // Fetch siblings sequentially (needs result.section)
      const section = resultResp.data.result.section;
      if (activeSite && issueType && section && !siblingsLoadedRef.current) {
        siblingsLoadedRef.current = true;
        api.get(`/reports/${activeSite.id}/issues`, {
          params: { section, issue_type: issueType, limit: 200 },
        }).then(r => {
          setSiblingIds((r.data.results || []).map(row => row.id));
        }).catch(() => {});
      }
    });
  }, [resultId]);

  // Navigate to prev/next
  function goToSibling(newPos) {
    const id = siblingIds[newPos];
    if (!id) return;
    navigate(`/audit/issue/${id}?from=${fromSlug}&issueType=${encodeURIComponent(issueType)}&pos=${newPos}&total=${total}`);
  }

  // Request AI recommendation (streaming)
  async function requestAI() {
    setStreaming(true);
    setStreamError(null);
    setSuggestion('');
    setSuggestionId(null);

    try {
      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ result_id: parseInt(resultId, 10) }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setStreamError(body.error || `Error ${resp.status}`);
        setStreaming(false);
        return;
      }

      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        // Cached fast-path: plain JSON
        const body = await resp.json();
        setSuggestion(body.suggestion);
        setSuggestionId(body.id);
        setStreaming(false);
        return;
      }

      // SSE stream
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            setStreaming(false);
            return;
          }
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'delta') {
              setSuggestion(prev => (prev || '') + evt.text);
            } else if (evt.type === 'done') {
              setSuggestionId(evt.id);
            } else if (evt.type === 'error') {
              setStreamError(evt.message || 'AI generation failed');
              setStreaming(false);
              return;
            }
          } catch { /* ignore malformed events */ }
        }
      }
      setStreaming(false);
    } catch (err) {
      setStreamError(err.message || 'Network error');
      setStreaming(false);
    }
  }

  async function submitFeedback(value) {
    if (!suggestionId) return;
    try {
      await api.post(`/ai/suggest/${suggestionId}/feedback`, { value });
      setFeedback(value);
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 800 }}>
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          message="Issue not found"
          description="This result may have been removed or does not exist."
          action={fromSlug ? { to: `/audit/${fromSlug}`, label: `← Back to ${SLUG_LABELS[fromSlug] || 'Category'}` } : { to: '/audit', label: '← Audit Health' }}
        />
      </div>
    );
  }

  let parsedData = null;
  try { parsedData = JSON.parse(result.data); } catch { /* raw */ }

  const severityStyle = SEVERITY_STYLES[result.severity] || SEVERITY_STYLES.info;
  const prevIndex = pos - 1;
  const nextIndex = pos + 1;
  const hasPrev = prevIndex >= 0 && siblingIds[prevIndex] !== undefined;
  const hasNext = nextIndex < total && siblingIds[nextIndex] !== undefined;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {fromSlug && (
          <Link
            to={`/audit/${fromSlug}`}
            style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            ← {SLUG_LABELS[fromSlug] || 'Category'}
          </Link>
        )}
        {!fromSlug && (
          <Link to="/audit" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Audit Health
          </Link>
        )}

        {/* Prev / Next navigation */}
        {(hasPrev || hasNext) && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {pos + 1} / {total}
            </span>
            <button
              onClick={() => goToSibling(prevIndex)}
              disabled={!hasPrev}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 6, padding: '4px 8px', cursor: hasPrev ? 'pointer' : 'not-allowed',
                opacity: hasPrev ? 1 : 0.4, display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => goToSibling(nextIndex)}
              disabled={!hasNext}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 6, padding: '4px 8px', cursor: hasNext ? 'pointer' : 'not-allowed',
                opacity: hasNext ? 1 : 0.4, display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Issue header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {result.issue_type}
          </h1>
          <span
            style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px',
              borderRadius: 4, color: severityStyle.color, backgroundColor: severityStyle.bg,
              textTransform: 'uppercase',
            }}
          >
            {result.severity}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
          <a href={result.url} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--brand)' }}>
            {result.url}
          </a>
        </div>
      </div>

      {/* Check definition panel */}
      {check && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--bg-surface)', padding: '1rem', marginBottom: '1rem',
        }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Check Definition
          </h2>
          {check.description && (
            <div style={{ marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Description: </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{check.description}</span>
            </div>
          )}
          {check.seo_impact && (
            <div style={{ marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>SEO Impact: </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{check.seo_impact}</span>
            </div>
          )}
          {check.implementation_rule && (
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>How to fix: </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{check.implementation_rule}</span>
            </div>
          )}
        </div>
      )}

      {/* Detected data panel */}
      {result.data && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--bg-surface)', padding: '1rem', marginBottom: '1rem',
        }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Detected Data
          </h2>
          {parsedData && typeof parsedData === 'object' ? (
            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <tbody>
                {Object.entries(parsedData).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '4px 8px 4px 0', fontWeight: 600, color: 'var(--text-muted)', width: '35%', verticalAlign: 'top' }}>{k}</td>
                    <td style={{ padding: '4px 0', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre style={{ fontSize: '0.8rem', color: 'var(--text-primary)', overflowX: 'auto', margin: 0 }}>
              {String(result.data)}
            </pre>
          )}
        </div>
      )}

      {/* AI Recommendation panel */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: 8,
        background: 'var(--bg-surface)', padding: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Sparkles size={15} style={{ color: 'var(--brand)' }} />
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            AI Recommendation
          </h2>
        </div>

        {/* Stream error */}
        {streamError && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--severity-critical)', marginBottom: '0.5rem' }}>
              <AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} />
              {streamError.includes('API key')
                ? <><span>{streamError} </span><Link to="/settings" style={{ color: 'var(--brand)' }}>Go to Settings →</Link></>
                : streamError}
            </div>
            <Button variant="outline" size="sm" onClick={requestAI}>Retry</Button>
          </div>
        )}

        {/* Suggestion text */}
        {suggestion && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, marginBottom: suggestionId ? '0.75rem' : 0 }}>
            {suggestion}
            {streaming && <span style={{ opacity: 0.5 }}>▌</span>}
          </p>
        )}

        {/* "Get AI Recommendation" button — shown when no suggestion yet and not streaming */}
        {aiChecked && !suggestion && !streaming && !streamError && (
          <Button variant="outline" size="sm" iconLeft={<Sparkles size={14} />} onClick={requestAI}>
            Get AI Recommendation
          </Button>
        )}

        {/* Streaming indicator */}
        {streaming && !suggestion && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <Loader2 size={14} className="animate-spin" />
            Generating…
          </div>
        )}

        {/* Feedback buttons — only after suggestion is saved (suggestionId set) */}
        {suggestionId && !streaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Was this helpful?</span>
            <button
              onClick={() => submitFeedback(1)}
              disabled={feedback !== null}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '4px 8px', cursor: feedback !== null ? 'default' : 'pointer',
                color: feedback === 1 ? 'var(--severity-pass)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => submitFeedback(-1)}
              disabled={feedback !== null}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '4px 8px', cursor: feedback !== null ? 'default' : 'pointer',
                color: feedback === -1 ? 'var(--severity-critical)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <ThumbsDown size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Visual check — navigate to a real issue detail URL**

With dev server running, click any URL row from an expanded AuditCategory accordion.
Confirm:
- URL is `/audit/issue/:id?from=...&issueType=...&pos=0&total=N`
- Issue header shows `issue_type` and severity badge
- URL links open in new tab
- Check definition panel appears (or is absent if no matching check)
- Data table renders key→value pairs
- AI panel shows "Get AI Recommendation" button (or cached suggestion if one exists)
- Prev/Next buttons appear once siblings load

- [ ] **Step 3: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/IssueDetail.jsx
git commit -m "feat(frontend): add IssueDetail page with AI recommendation and prev/next navigation"
```

---

## Task 7: Update `frontend/src/pages/stubs.jsx`

**Files:**
- Modify: `frontend/src/pages/stubs.jsx` (lines 37, 199–218)

- [ ] **Step 1: Remove `IssueDetail` export from `stubs.jsx`**

Delete line 37:
```js
export function IssueDetail()      { return <Stub title="Issue Detail"        description="Deep-dive into a specific SEO issue." />; }
```

- [ ] **Step 2: Remove the 20 AuditXxx exports from `stubs.jsx`**

Delete lines 199–218 (the entire "Audit category stubs" block):
```js
/* ── Audit category stubs (20 categories) ────────────────────────────────── */
export function AuditIndexability()   { return <Stub title="Indexability"    />; }
export function AuditTitleTags()      { return <Stub title="Title Tags"      />; }
export function AuditMetaDesc()       { return <Stub title="Meta Descriptions" />; }
export function AuditHeadings()       { return <Stub title="Headings"        />; }
export function AuditCanonicals()     { return <Stub title="Canonicals"      />; }
export function AuditHreflang()       { return <Stub title="Hreflang"        />; }
export function AuditImages()         { return <Stub title="Images"          />; }
export function AuditLinks()          { return <Stub title="Links"           />; }
export function AuditRedirects()      { return <Stub title="Redirects"       />; }
export function AuditResponseCodes()  { return <Stub title="Response Codes"  />; }
export function AuditPageSpeed()      { return <Stub title="Page Speed"      />; }
export function AuditStructuredData() { return <Stub title="Structured Data" />; }
export function AuditSecurity()       { return <Stub title="Security"        />; }
export function AuditMobile()         { return <Stub title="Mobile"          />; }
export function AuditCrawlDepth()     { return <Stub title="Crawl Depth"     />; }
export function AuditSitemap()        { return <Stub title="Sitemap"         />; }
export function AuditRobots()         { return <Stub title="Robots.txt"      />; }
export function AuditInternational()  { return <Stub title="International"   />; }
export function AuditContent()        { return <Stub title="Content"         />; }
export function AuditCustom()              { return <Stub title="Custom Checks"      />; }
```

Keep `AuditCustomExtraction` and `AuditLogFile` — they are NOT in the slug map and remain stubs.

- [ ] **Step 3: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/stubs.jsx
git commit -m "refactor(stubs): remove IssueDetail and 20 AuditXxx stubs now replaced by real pages"
```

---

## Task 8: Update `frontend/src/router.jsx`

**Files:**
- Modify: `frontend/src/router.jsx` (lines 1–39, 107–135)

- [ ] **Step 1: Replace stub imports with real component imports in `router.jsx`**

Replace the block at lines 27–39:
```js
import {
  AdminView, DeveloperView, SeoView,
  IssueDetail, CoreWebVitals,
  Tasks, TaskDetail,
  ScheduledCrawls, Exports, Notifications,
  Integrations, SystemHealth,
  GscOverlay, Ga4Overlay, ErrorLog, CompareView,
  AuditIndexability, AuditTitleTags, AuditMetaDesc,
  AuditHeadings, AuditCanonicals, AuditHreflang,
  AuditImages, AuditLinks, AuditRedirects, AuditResponseCodes,
  AuditPageSpeed, AuditStructuredData, AuditSecurity, AuditMobile,
  AuditCrawlDepth, AuditSitemap, AuditRobots, AuditInternational,
  AuditContent, AuditCustom, AuditCustomExtraction, AuditLogFile,
} from './pages/stubs.jsx';
```

With:
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

import { AuditCategory } from './pages/AuditCategory.jsx';
import { IssueDetail }   from './pages/IssueDetail.jsx';
```

- [ ] **Step 2: Update the route definitions in `router.jsx`**

Replace lines 107–135 (the audit + audit categories section):

Current:
```js
          /* Audit */
          { path: '/audit',                element: <AuditHealth /> },
          { path: '/audit/issue/:id',      element: <IssueDetail /> },
          { path: '/audit/cwv',            element: <CoreWebVitals /> },
          { path: '/audit/compare',        element: <CompareView /> },
          { path: '/audit/gsc',            element: <GscOverlay /> },
          { path: '/audit/ga4',            element: <Ga4Overlay /> },

          /* Audit categories */
          { path: '/audit/indexability',   element: <AuditIndexability /> },
          { path: '/audit/title-tags',     element: <AuditTitleTags /> },
          { path: '/audit/meta-desc',      element: <AuditMetaDesc /> },
          { path: '/audit/headings',       element: <AuditHeadings /> },
          { path: '/audit/canonicals',     element: <AuditCanonicals /> },
          { path: '/audit/hreflang',       element: <AuditHreflang /> },
          { path: '/audit/images',         element: <AuditImages /> },
          { path: '/audit/links',          element: <AuditLinks /> },
          { path: '/audit/redirects',      element: <AuditRedirects /> },
          { path: '/audit/response-codes', element: <AuditResponseCodes /> },
          { path: '/audit/page-speed',     element: <AuditPageSpeed /> },
          { path: '/audit/structured-data',element: <AuditStructuredData /> },
          { path: '/audit/security',       element: <AuditSecurity /> },
          { path: '/audit/mobile',         element: <AuditMobile /> },
          { path: '/audit/crawl-depth',    element: <AuditCrawlDepth /> },
          { path: '/audit/sitemap',        element: <AuditSitemap /> },
          { path: '/audit/robots',         element: <AuditRobots /> },
          { path: '/audit/international',  element: <AuditInternational /> },
          { path: '/audit/content',             element: <AuditContent /> },
          { path: '/audit/custom',              element: <AuditCustom /> },
          { path: '/audit/custom-extraction',   element: <AuditCustomExtraction /> },
          { path: '/audit/log-file',            element: <AuditLogFile /> },
```

Replace with:
```js
          /* Audit */
          { path: '/audit',                     element: <AuditHealth /> },
          { path: '/audit/issue/:resultId',     element: <IssueDetail /> },
          { path: '/audit/cwv',                 element: <CoreWebVitals /> },
          { path: '/audit/compare',             element: <CompareView /> },
          { path: '/audit/gsc',                 element: <GscOverlay /> },
          { path: '/audit/ga4',                 element: <Ga4Overlay /> },

          /* Audit categories — all 20 handled by AuditCategory with slug prop */
          { path: '/audit/indexability',        element: <AuditCategory /> },
          { path: '/audit/title-tags',          element: <AuditCategory /> },
          { path: '/audit/meta-desc',           element: <AuditCategory /> },
          { path: '/audit/headings',            element: <AuditCategory /> },
          { path: '/audit/canonicals',          element: <AuditCategory /> },
          { path: '/audit/hreflang',            element: <AuditCategory /> },
          { path: '/audit/images',              element: <AuditCategory /> },
          { path: '/audit/links',               element: <AuditCategory /> },
          { path: '/audit/redirects',           element: <AuditCategory /> },
          { path: '/audit/response-codes',      element: <AuditCategory /> },
          { path: '/audit/page-speed',          element: <AuditCategory /> },
          { path: '/audit/structured-data',     element: <AuditCategory /> },
          { path: '/audit/security',            element: <AuditCategory /> },
          { path: '/audit/mobile',              element: <AuditCategory /> },
          { path: '/audit/crawl-depth',         element: <AuditCategory /> },
          { path: '/audit/sitemap',             element: <AuditCategory /> },
          { path: '/audit/robots',              element: <AuditCategory /> },
          { path: '/audit/international',       element: <AuditCategory /> },
          { path: '/audit/content',             element: <AuditCategory /> },
          { path: '/audit/custom',              element: <AuditCategory /> },

          /* Still stubs — no DB data */
          { path: '/audit/custom-extraction',   element: <AuditCustomExtraction /> },
          { path: '/audit/log-file',            element: <AuditLogFile /> },
```

**Note:** `AuditCategory` uses `useParams()` to read the last segment as `slug`. The route paths like `/audit/title-tags` match and the component reads `slug` = `title-tags` from params. This works because `useParams()` in React Router v7 returns `{ slug: undefined }` — wait, actually these are static paths, not `:slug`. 

The routes need a `:slug` param for `useParams()` to return a value. **Alternative approach:** Use `window.location.pathname` to derive the slug, or restructure as `/audit/:slug`. Since the router has individual static paths, extract the slug from `location.pathname` instead of `useParams()`.

**Fix:** In `AuditCategory.jsx`, change the slug extraction from `useParams()` to `useLocation()`:

In `AuditCategory.jsx`, replace:
```js
import { useParams, useNavigate, Link } from 'react-router';
// ...
const { slug } = useParams();
```

With:
```js
import { useLocation, useNavigate, Link } from 'react-router';
// ...
const location = useLocation();
const slug = location.pathname.replace('/audit/', '').split('/')[0];
```

Make the same update in `IssueDetail.jsx` — `resultId` still comes from `useParams()` correctly since the route is `/audit/issue/:resultId`.

- [ ] **Step 3: Fix `AuditCategory.jsx` to extract slug from `useLocation()`**

In `frontend/src/pages/AuditCategory.jsx`, change:
```js
import { useParams, useNavigate, Link } from 'react-router';
```
to:
```js
import { useLocation, useNavigate, Link } from 'react-router';
```

And change:
```js
  const { slug } = useParams();
```
to:
```js
  const location = useLocation();
  const slug = location.pathname.replace('/audit/', '').split('/')[0];
```

- [ ] **Step 4: Confirm frontend builds without errors**

```bash
cd /Users/a39326/Documents/Aakash/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript/Vite errors. If there are import errors (missing exports from stubs), verify Tasks 7 and 8 steps are complete.

- [ ] **Step 5: Final visual smoke test (in browser)**

With dev server running:
1. Visit `/audit/title-tags` → confirm real data loads (or "no crawl" state), NOT the stub "Coming in a later phase" message
2. Click a URL row → navigates to `/audit/issue/:id?from=title-tags&...`
3. On issue detail: check definition renders, data table renders, "Get AI Recommendation" button appears
4. Click "Get AI Recommendation" → button triggers fetch (may get 503 if no API key — show inline notice with Settings link)
5. Visit `/audit/custom-extraction` → still shows the stub page (intentional)
6. Visit `/audit` (Audit Health) → category "View" links still navigate correctly

- [ ] **Step 6: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/router.jsx frontend/src/pages/AuditCategory.jsx
git commit -m "feat(router): wire AuditCategory to all 20 audit routes, IssueDetail to /audit/issue/:resultId"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Migration 015: `result_id UNIQUE` + `feedback` on `ai_suggestions` → Task 1
- ✅ `GET /api/reports/:siteId/category` → Task 2
- ✅ `GET /api/reports/:siteId/issues` → Task 2
- ✅ `GET /api/reports/results/:resultId` → Task 2
- ✅ `POST /api/ai/suggest` (SSE + cache fast-path) → Task 3
- ✅ `GET /api/ai/suggest` (cache lookup) → Task 3
- ✅ `POST /api/ai/suggest/:id/feedback` → Task 3
- ✅ AI rate limiter (10 req/min) → Task 3
- ✅ Register `/api/ai` in server.js → Task 4
- ✅ `AuditCategory.jsx` with `CATEGORY_SLUG_MAP`, accordion, lazy URL load, load more → Task 5
- ✅ `IssueDetail.jsx` with result, check panel, data table, AI recommendation, prev/next, feedback → Task 6
- ✅ Remove 20 stubs + IssueDetail from stubs.jsx → Task 7
- ✅ Router update → Task 8
- ✅ `/results/:resultId` route ordering (before `/:siteId` routes) → Task 2 note
- ✅ slug extraction via `useLocation()` not `useParams()` (static routes) → Task 8 step 3

**No placeholders:** All code blocks are complete and runnable.

**Type consistency:**
- `result_id` is used consistently as the field name across migration, routes, AI route, and frontend
- `suggestionId` (camelCase) in frontend state vs `id` in API responses — correctly mapped
- `siblingIds` array contains integer IDs matching `audit_results.id`
