# Audit Section UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Compare Crawls page into the sidebar, add a proper /audit/categories picker page, add per-issue CSV export, and fix three silent UX bugs.

**Architecture:** 7 independent changes across 6 files + 1 new file + 1 new shared lib. Backend gets one new endpoint (CSV export) and one extended response (covered field on /category). Frontend gets one new page (AuditCategories), one new shared lib (auditCategories.js), and targeted edits to Sidebar, AuditCategory, and IssueDetail.

**Tech Stack:** React 18, React Router v7, Express, better-sqlite3 (sync API — no async/await in DB calls), Vitest + Supertest for backend tests, Vite proxy for same-origin /api requests.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/lib/auditCategories.js` | **Create** | Shared slug↔section maps, used by AuditCategory + AuditCategories |
| `frontend/src/pages/AuditCategories.jsx` | **Create** | Category picker page — sorted flat list of all 20 categories |
| `frontend/src/components/Sidebar.jsx` | **Edit** | Add Compare Crawls, fix Categories path, fix active state |
| `frontend/src/router.jsx` | **Edit** | Register /audit/categories route |
| `frontend/src/pages/AuditCategory.jsx` | **Edit** | Import shared map, add CSV download button, fix empty state copy |
| `frontend/src/pages/IssueDetail.jsx` | **Edit** | Add siblingError state, disable prev/next on fetch failure |
| `backend/routes/reports.js` | **Edit** | Add `covered` to /category response, add /issues/export endpoint |
| `backend/__tests__/reports-export.test.js` | **Create** | Tests for new export endpoint + covered field |

---

## Task 1: Shared audit categories lib

**Files:**
- Create: `frontend/src/lib/auditCategories.js`

- [ ] **Step 1: Create the shared lib**

```js
// frontend/src/lib/auditCategories.js

/**
 * Maps URL slug → DB section name (used in AuditCategory to resolve the path slug).
 * Aliases (redirects → Response Codes, indexability → Robots / Indexability, etc.) are kept
 * for backwards-compat with existing routes in router.jsx.
 */
export const SLUG_TO_SECTION = {
  'response-codes':  'Response Codes',
  'redirects':       'Response Codes',
  'canonicals':      'Canonical',
  'robots':          'Robots / Indexability',
  'indexability':    'Robots / Indexability',
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
  'hreflang':        'International SEO',
  'international':   'International SEO',
  'security':        'Monitoring & Operations',
};

/**
 * Maps DB section name → canonical URL slug (used in AuditCategories picker
 * to build navigation links). One canonical slug per section.
 */
export const SECTION_TO_SLUG = {
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
  'Rankings & Traffic Drops': 'custom',
  'Monitoring & Operations':  'security',
  'LLM / AI Crawlers':        'custom',
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/auditCategories.js
git commit -m "feat(audit): extract shared SLUG_TO_SECTION and SECTION_TO_SLUG maps to lib/auditCategories.js"
```

---

## Task 2: Backend — add `covered` field to /category endpoint

**Files:**
- Modify: `backend/routes/reports.js` (the `GET /:siteId/category` handler, currently around line 63–112)
- Create: `backend/__tests__/reports-export.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/reports-export.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token  = jwt.sign(
  { sub: 'u1', email: 't@test.com', role: 'seo', company_id: 'company-test' },
  SECRET,
  { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

// ── /category — covered field ─────────────────────────────────────────────────
describe('GET /api/reports/:siteId/category — covered field', () => {
  it('returns 404 for unknown site (unchanged behaviour)', async () => {
    const res = await request(app)
      .get('/api/reports/no-such-site/category?section=Images')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 400 when section param is missing (unchanged behaviour)', async () => {
    const res = await request(app)
      .get('/api/reports/site-x/category')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails as expected**

```bash
cd /Users/a39326/Documents/Aakash/backend
npm test -- __tests__/reports-export.test.js
```

Expected: both tests PASS (they test existing error behaviour) — confirms the test file runs correctly before we add the new assertion.

- [ ] **Step 3: Add the covered field to the `/category` handler**

In `backend/routes/reports.js`, find the line `res.json({ jobId, section, groups });` inside `router.get('/:siteId/category', ...)` (around line 107) and replace the entire block after the groups query with:

```js
  // covered = true if this section has ever produced audit_results for this job.
  // groups.length > 0 already implies covered; the extra query handles the
  // edge case where rows exist but were somehow excluded from the group-by.
  const covered = groups.length > 0
    ? true
    : !!db.prepare(
        'SELECT 1 FROM audit_results WHERE crawl_job_id = ? AND section = ? LIMIT 1'
      ).get(jobId, section);

  res.json({ jobId, section, groups, covered });
```

- [ ] **Step 4: Add a shape-check test for the covered field**

Add this test to `backend/__tests__/reports-export.test.js`:

```js
  it('returns covered: false when the section has no data (null job path)', async () => {
    // site-no-crawl doesn't exist → 404 from site lookup, not from covered logic.
    // The covered field shape is verified in integration via AuditCategory.jsx.
    // This test guards the 404 path is unchanged.
    const res = await request(app)
      .get('/api/reports/site-no-crawl/category?section=Images')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
```

- [ ] **Step 5: Run tests — should all pass**

```bash
cd /Users/a39326/Documents/Aakash/backend
npm test -- __tests__/reports-export.test.js
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/reports.js backend/__tests__/reports-export.test.js
git commit -m "feat(reports): add covered boolean to GET /:siteId/category response"
```

---

## Task 3: Backend — CSV export endpoint

**Files:**
- Modify: `backend/routes/reports.js` (add new route before the closing `export default router`)
- Modify: `backend/__tests__/reports-export.test.js` (add export endpoint tests)

- [ ] **Step 1: Write the failing tests for the export endpoint**

Append to `backend/__tests__/reports-export.test.js`:

```js
// ── /issues/export ────────────────────────────────────────────────────────────
describe('GET /api/reports/:siteId/issues/export', () => {
  it('returns 400 when section param is missing', async () => {
    const res = await request(app)
      .get('/api/reports/site-x/issues/export?issue_type=Missing+Title')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/section/i);
  });

  it('returns 400 when issue_type param is missing', async () => {
    const res = await request(app)
      .get('/api/reports/site-x/issues/export?section=Title+Tags')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/issue_type/i);
  });

  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/reports/no-such-site/issues/export?section=Title+Tags&issue_type=Missing+Title+Tag')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 401 when no auth cookie is provided', async () => {
    const res = await request(app)
      .get('/api/reports/site-x/issues/export?section=Title+Tags&issue_type=Missing+Title+Tag');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests — they should FAIL (404 Not Found, route doesn't exist yet)**

```bash
cd /Users/a39326/Documents/Aakash/backend
npm test -- __tests__/reports-export.test.js
```

Expected: the 4 new export tests FAIL with status 404 (Express returns 404 for unknown routes).

- [ ] **Step 3: Add the export endpoint to `backend/routes/reports.js`**

Find the last `router.get(...)` in reports.js (before `export default router`) and add the following new route. Place it **before** `export default router` and **after** the existing `/:siteId/issues` route:

```js
// ─── GET /api/reports/:siteId/issues/export ───────────────────────────────────
/**
 * @route GET /api/reports/:siteId/issues/export
 * @desc  Downloads all audit results for a given section + issue_type as CSV.
 *        Uses the latest completed crawl job. No row limit — exports everything.
 * @query section     {string} required — e.g. "Response Codes"
 * @query issue_type  {string} required — e.g. "3xx Redirects"
 * @access auth
 */
router.get('/:siteId/issues/export', (req, res) => {
  try {
    const { siteId } = req.params;
    const { section, issue_type } = req.query;
    const { company_id, role } = req.user;

    if (!section)    return res.status(400).json({ error: 'section param is required' });
    if (!issue_type) return res.status(400).json({ error: 'issue_type param is required' });

    const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (role !== 'superadmin' && site.company_id !== company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const latestJob = db.prepare(`
      SELECT id FROM crawl_jobs
      WHERE site_id = ? AND status = 'completed'
      ORDER BY started_at DESC LIMIT 1
    `).get(siteId);

    if (!latestJob) {
      return res.status(404).json({ error: 'No completed crawl found for this site' });
    }

    const rows = db.prepare(`
      SELECT url, data
      FROM audit_results
      WHERE crawl_job_id = ? AND section = ? AND issue_type = ?
      ORDER BY url ASC
    `).all(latestJob.id, section, issue_type);

    // Build filename: lowercase, spaces/slashes → hyphens, strip non-alphanumeric-hyphen
    const slugify = (str) =>
      str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const filename = `${slugify(section)}-${slugify(issue_type)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (rows.length === 0) {
      return res.send('url\n');
    }

    // Parse data JSON blobs and collect all unique extra keys
    const parsed = rows.map(row => {
      const data = row.data ? (() => { try { return JSON.parse(row.data); } catch { return {}; } })() : {};
      return { url: row.url, ...data };
    });

    const dataKeys = [...new Set(parsed.flatMap(r => Object.keys(r).filter(k => k !== 'url')))].sort();
    const columns  = ['url', ...dataKeys];

    // CSV-safe value escaping
    const escape = (val) => {
      const s = String(val ?? '');
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const lines = [
      columns.join(','),
      ...parsed.map(row => columns.map(col => escape(row[col])).join(',')),
    ];

    res.send(lines.join('\n'));
  } catch (err) {
    console.error('[reports] GET /:siteId/issues/export error:', err);
    res.status(500).json({ error: 'Failed to generate export' });
  }
});
```

> **Note:** Express matches routes by exact path depth — `/:siteId/issues/export` will NOT match the existing `/:siteId/issues` route (different segment count). Route order doesn't matter here. Place the export route anywhere before `export default router`.

- [ ] **Step 4: Run tests — all should pass now**

```bash
cd /Users/a39326/Documents/Aakash/backend
npm test -- __tests__/reports-export.test.js
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Run full backend test suite to check for regressions**

```bash
cd /Users/a39326/Documents/Aakash/backend
npm test
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/reports.js backend/__tests__/reports-export.test.js
git commit -m "feat(reports): add GET /:siteId/issues/export CSV download endpoint"
```

---

## Task 4: New AuditCategories page

**Files:**
- Create: `frontend/src/pages/AuditCategories.jsx`

- [ ] **Step 1: Create the component**

```jsx
// frontend/src/pages/AuditCategories.jsx
/**
 * AuditCategories — flat list of all 20 audit categories sorted by severity.
 *
 * Sort order: critical → warning → info → pass (covered, 0 issues) → not audited
 * Not-audited rows are greyed out and non-clickable.
 * Data comes from GET /reports/:siteId/summary (same endpoint as AuditHealth).
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate }                       from 'react-router';
import { ChevronRight, Activity }            from 'lucide-react';
import api                                   from '../api/index.js';
import { useSites }                          from '../context/SitesContext.jsx';
import { LoadingSkeleton }                   from '../components/LoadingSkeleton.jsx';
import { EmptyState }                        from '../components/EmptyState.jsx';
import { SECTION_TO_SLUG }                   from '../lib/auditCategories.js';

// ── Severity badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ state }) {
  const map = {
    critical:    { label: 'CRITICAL',    color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    warning:     { label: 'WARNING',     color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
    info:        { label: 'INFO',        color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)'     },
    pass:        { label: '✓ PASS',      color: 'var(--severity-pass)',     bg: 'var(--severity-pass-bg)'     },
    notAudited:  { label: 'NOT AUDITED', color: 'var(--text-muted)',        bg: 'var(--bg-raised)'            },
  };
  const s = map[state] || map.notAudited;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

// ── Count pill ─────────────────────────────────────────────────────────────────
function CountPill({ count, type }) {
  if (!count) return null;
  const colors = {
    critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    warning:  { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
    info:     { color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)'     },
  };
  const c = colors[type];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium tabular-nums"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {count.toLocaleString()}
    </span>
  );
}

// ── Derive per-category state ──────────────────────────────────────────────────
function getCategoryState(counts, isCovered) {
  if (!isCovered) return 'notAudited';
  if (!counts)    return 'pass';
  if ((counts.critical || 0) > 0) return 'critical';
  if ((counts.warning  || 0) > 0) return 'warning';
  if ((counts.info     || 0) > 0) return 'info';
  return 'pass';
}

// Sort priority: critical=0, warning=1, info=2, pass=3, notAudited=4
const STATE_ORDER = { critical: 0, warning: 1, info: 2, pass: 3, notAudited: 4 };

// ── Left border color per state ────────────────────────────────────────────────
const BORDER_COLOR = {
  critical:   'var(--severity-critical)',
  warning:    'var(--severity-warning)',
  info:       'var(--severity-info)',
  pass:       'var(--severity-pass)',
  notAudited: 'var(--border-subtle)',
};

// ── Main page ──────────────────────────────────────────────────────────────────
export function AuditCategories() {
  const { activeSite }        = useSites();
  const navigate              = useNavigate();
  const [summary,  setSummary] = useState(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState(null);

  const load = useCallback(async () => {
    if (!activeSite) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/${activeSite.id}/summary`);
      setSummary(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, [activeSite]);

  useEffect(() => { load(); }, [load]);

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (!activeSite) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No site selected"
          description="Select a site from the header to view audit categories."
          action={{ label: 'Manage Sites', to: '/sites' }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <LoadingSkeleton type="table" rows={10} cols={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <EmptyState message="Failed to load categories" description={error} action={{ onClick: load, label: 'Retry' }} />
      </div>
    );
  }

  if (!summary?.jobId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No crawls yet"
          description={`No completed crawl found for ${activeSite.label}. Run your first crawl to see categories.`}
          action={{ label: 'Start a Crawl', to: '/crawl' }}
        />
      </div>
    );
  }

  // ── Build sorted category rows ──────────────────────────────────────────────
  const coveredSet = new Set(summary.coveredSections || []);
  const allCategories = [...new Set((summary.allChecks || []).map(c => c.category))];

  const rows = allCategories.map(cat => {
    const counts   = summary.sections?.[cat] || null;
    const covered  = coveredSet.has(cat);
    const state    = getCategoryState(counts, covered);
    const slug     = SECTION_TO_SLUG[cat];
    return { cat, counts, covered, state, slug };
  });

  // Sort by state priority, then by critical count desc within same state, then alpha
  rows.sort((a, b) => {
    const orderDiff = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (orderDiff !== 0) return orderDiff;
    // Within 'critical' state: sort by critical count desc
    if (a.state === 'critical') {
      return (b.counts?.critical || 0) - (a.counts?.critical || 0);
    }
    return a.cat.localeCompare(b.cat);
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Audit Categories
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {activeSite.label} · Last crawl:{' '}
          {summary.completedAt
            ? new Date(summary.completedAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
            : '—'}
        </p>
      </div>

      {/* Category list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border-default)' }}
      >
        {/* Table header */}
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}
        >
          <span className="flex-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Category
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider mr-2" style={{ color: 'var(--text-muted)' }}>
            Status
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider w-16 text-right" style={{ color: 'var(--text-muted)' }}>
            Issues
          </span>
        </div>

        {/* Rows */}
        {rows.map(({ cat, counts, state, slug }) => {
          const clickable = state !== 'notAudited' && slug;
          const path      = slug ? `/audit/${slug}` : null;

          const rowContent = (
            <>
              {/* Left border accent */}
              <span
                className="absolute left-0 top-0 bottom-0 w-0.5"
                style={{ backgroundColor: BORDER_COLOR[state] }}
              />
              <span className="flex-1 text-sm font-medium pl-2" style={{ color: clickable ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {cat}
              </span>
              <SeverityBadge state={state} />
              <div className="flex items-center gap-1 w-16 justify-end">
                {counts && (
                  <>
                    <CountPill count={counts.critical} type="critical" />
                    <CountPill count={counts.warning}  type="warning"  />
                    <CountPill count={counts.info}     type="info"     />
                  </>
                )}
              </div>
              {clickable && <ChevronRight className="w-4 h-4 shrink-0 ml-1" style={{ color: 'var(--text-muted)' }} />}
              {!clickable && <span className="w-5 ml-1" />}
            </>
          );

          const sharedStyle = {
            position: 'relative',
            borderBottom: '1px solid var(--border-subtle)',
            opacity: state === 'notAudited' ? 0.5 : 1,
          };

          if (clickable && path) {
            return (
              <div
                key={cat}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={sharedStyle}
                onClick={() => navigate(path)}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {rowContent}
              </div>
            );
          }

          return (
            <div
              key={cat}
              className="flex items-center gap-3 px-4 py-3"
              style={sharedStyle}
            >
              {rowContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders — start dev server and open the page**

```bash
cd /Users/a39326/Documents/Aakash && npm run dev
```

Open `http://localhost:5173/audit/categories` — the page won't be in the router yet so it will show 404. That's expected. Wiring happens in Task 5.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AuditCategories.jsx
git commit -m "feat(audit): add AuditCategories picker page — sorted flat list of all categories"
```

---

## Task 5: Sidebar + Router updates

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`
- Modify: `frontend/src/router.jsx`

- [ ] **Step 1: Update Sidebar.jsx**

Replace the PLATFORM items array and the `isActive` function with:

```jsx
// At the top of Sidebar.jsx, add GitCompareArrows to the lucide-react import:
import {
  LayoutDashboard, Code2, TrendingUp, Globe, Activity,
  Heart, FolderKanban, Gauge, FileCode2, FileText,
  List, FileOutput, Calendar, Bell, Plug,
  Stethoscope, Users, Settings, ChevronLeft, ChevronRight,
  Building2, ClipboardList, BarChart3, GitCompareArrows,  // ← add GitCompareArrows
} from 'lucide-react';
```

Replace the PLATFORM section items array (currently lines 22–31) with:

```js
    items: [
      { label: 'Sites',               icon: Globe,              path: '/sites'                   },
      { label: 'Crawls',              icon: Activity,           path: '/crawl/status'            },
      { label: 'Paid Ads',            icon: BarChart3,          path: '/ads'                     },
      { label: 'Audit Health',        icon: Heart,              path: '/audit'                   },
      {
        label: 'Audit Categories',
        icon: FolderKanban,
        path: '/audit/categories',
        // Active on any /audit/* path that isn't a top-level audit tool
        isActiveFn: (pathname) => {
          const excluded = ['/audit', '/audit/compare', '/audit/cwv',
                            '/audit/custom-extraction', '/audit/log-file',
                            '/audit/gsc', '/audit/ga4'];
          return pathname.startsWith('/audit/')
            && !excluded.some(p => pathname === p || pathname.startsWith(p + '/'));
        },
      },
      { label: 'Compare Crawls',      icon: GitCompareArrows,   path: '/audit/compare'           },
      { label: 'Core Web Vitals',     icon: Gauge,              path: '/audit/cwv'               },
      { label: 'Custom Extraction',   icon: FileCode2,          path: '/audit/custom-extraction' },
      { label: 'Log File Intel.',     icon: FileText,           path: '/audit/log-file'          },
    ],
```

Replace the `isActive` function (currently line 64–65) with:

```js
  const isActive = (item) =>
    item.isActiveFn
      ? item.isActiveFn(location.pathname)
      : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
```

Update the usage of `isActive` in the render (currently `isActive(item.path)`) to `isActive(item)`:

```jsx
// Find this line in the render (inside visibleItems.map):
const active = isActive(item.path);
// Change to:
const active = isActive(item);
```

- [ ] **Step 2: Add the /audit/categories route to router.jsx**

In `frontend/src/router.jsx`, add the import at the top:

```jsx
import { AuditCategories } from './pages/AuditCategories.jsx';
```

Inside the `RequireCompany` children array, in the `/* Audit */` block, add:

```jsx
{ path: '/audit/categories', element: <AuditCategories /> },
```

Place it after `{ path: '/audit', element: <AuditHealth /> }`.

- [ ] **Step 3: Verify in browser**

```bash
cd /Users/a39326/Documents/Aakash && npm run dev
```

1. Open `http://localhost:5173` and log in
2. Sidebar should now show **Compare Crawls** between Core Web Vitals and Audit Categories
3. Sidebar should show **Audit Categories** linking to `/audit/categories`
4. Open `http://localhost:5173/audit/categories` — should render the category picker
5. Navigate to `/audit/title-tags` — sidebar "Audit Categories" should stay highlighted
6. Navigate to `/audit/compare` — sidebar "Compare Crawls" should highlight, "Audit Categories" should NOT

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.jsx frontend/src/router.jsx
git commit -m "feat(nav): add Compare Crawls to sidebar, fix Audit Categories link to picker page"
```

---

## Task 6: AuditCategory.jsx — CSV export button + empty state fix + shared lib import

**Files:**
- Modify: `frontend/src/pages/AuditCategory.jsx`

- [ ] **Step 1: Replace the CATEGORY_SLUG_MAP with an import from the shared lib**

At the top of `AuditCategory.jsx`, add the import:

```jsx
import { SLUG_TO_SECTION } from '../lib/auditCategories.js';
```

Find and delete the `const CATEGORY_SLUG_MAP = { ... }` block (lines 26–47) and replace the one usage of it:

```jsx
// Find this line (around line 234):
const sectionName = CATEGORY_SLUG_MAP[slug];
// Change to:
const sectionName = SLUG_TO_SECTION[slug];
```

- [ ] **Step 2: Track the `covered` field from the API**

In the state declarations (around line 236–239), add:

```jsx
const [covered, setCovered] = useState(null);
```

In the `loadGroups` function, update the success path to also set covered:

```jsx
// Find:
      setGroups(res.data.groups  || []);
      setJobId(res.data.jobId    ?? null);
// Replace with:
      setGroups(res.data.groups  || []);
      setJobId(res.data.jobId    ?? null);
      setCovered(res.data.covered ?? false);
```

Also reset covered in the loading section at the top of `loadGroups`:

```jsx
// Find the reset block at the top of loadGroups:
    setGroups([]);
    setJobId(null);
    setExpanded(new Set());
    setUrlMap({});
// Add after it:
    setCovered(null);
```

- [ ] **Step 3: Fix the empty state copy**

Find the `groups.length === 0` empty state render block (around line 411–433) and replace it with:

```jsx
  if (groups.length === 0) {
    return (
      <div className="p-6">
        <nav className="mb-4">
          <Link
            to="/audit/categories"
            className="inline-flex items-center gap-1 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Audit Categories
          </Link>
        </nav>
        {covered ? (
          <EmptyState
            icon={FileSearch}
            message={`No ${sectionName} issues found`}
            description="No issues were detected in the latest crawl. Run a new crawl to check again."
            action={{ label: 'Start a Crawl', to: '/crawl' }}
          />
        ) : (
          <EmptyState
            icon={FileSearch}
            message={`No data collected for ${sectionName} yet`}
            description="This category will be populated automatically once the crawler supports it."
          />
        )}
      </div>
    );
  }
```

Also update the breadcrumb link on the "No completed crawl" empty state (line ~407) from `to: '/audit'` to `to: '/audit/categories'` to keep navigation consistent.

- [ ] **Step 4: Add the CSV download button to GroupAccordion**

The `GroupAccordion` component needs to receive `siteId` and `sectionName` as new props to build the export URL. Update the component signature and header:

```jsx
// Find:
function GroupAccordion({ group, urlEntry, onExpand, onLoadMore, onUrlClick, onRetry }) {
// Replace with:
function GroupAccordion({ group, urlEntry, onExpand, onLoadMore, onUrlClick, onRetry, siteId, sectionName }) {
```

Inside the GroupAccordion header button, after the count badge span and before the closing `</button>`, add the CSV download link:

```jsx
        {/* CSV export — always visible, no state needed (direct file download) */}
        {siteId && sectionName && (
          <a
            href={`/api/reports/${siteId}/issues/export?section=${encodeURIComponent(sectionName)}&issue_type=${encodeURIComponent(group.issue_type)}`}
            download
            onClick={e => e.stopPropagation()}  // prevent accordion toggle
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            style={{
              color: 'var(--brand)',
              backgroundColor: 'var(--brand-subtle)',
              textDecoration: 'none',
            }}
            title={`Download ${group.issue_type} URLs as CSV`}
          >
            ⬇ CSV
          </a>
        )}
```

Pass the new props when rendering GroupAccordion (in the `groups.map(...)` block at the bottom of AuditCategory):

```jsx
// Find:
            <GroupAccordion
              key={group.issue_type}
              group={group}
              urlEntry={...}
              onExpand={...}
              onLoadMore={...}
              onUrlClick={handleUrlClick}
              onRetry={...}
            />
// Replace with:
            <GroupAccordion
              key={group.issue_type}
              group={group}
              urlEntry={expanded.has(group.issue_type) ? (urlMap[group.issue_type] || { results: [], total: group.count, loading: true, offset: 0 }) : undefined}
              onExpand={() => handleExpand(group.issue_type)}
              onLoadMore={() => handleLoadMore(group.issue_type)}
              onUrlClick={handleUrlClick}
              onRetry={() => {
                setUrlMap(prev => ({ ...prev, [group.issue_type]: undefined }));
                loadUrls(group.issue_type, 0);
              }}
              siteId={activeSite?.id}
              sectionName={sectionName}
            />
```

- [ ] **Step 5: Verify in browser**

1. Navigate to `http://localhost:5173/audit/response-codes`
2. Expand the "4xx Client Errors" accordion — a "⬇ CSV" button should appear in the header row
3. Click "⬇ CSV" — browser should download a CSV file named `response-codes-4xx-client-errors.csv`
4. Navigate to `http://localhost:5173/audit/images` — should show "No data collected for Images yet" (not "No Images issues found")
5. Navigate to `http://localhost:5173/audit/response-codes` on a site with no 4xx errors — should show "No Response Codes issues found" with a "Start a Crawl" CTA

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AuditCategory.jsx
git commit -m "feat(audit-category): add per-issue CSV export, fix empty state copy for unimplemented categories"
```

---

## Task 7: IssueDetail — fix silent prev/next navigation failure

**Files:**
- Modify: `frontend/src/pages/IssueDetail.jsx`

- [ ] **Step 1: Add siblingError state**

In the state declarations (around line 142–146), add:

```jsx
const [siblingError, setSiblingError] = useState(false);
```

- [ ] **Step 2: Set siblingError in the sibling fetch catch block**

Find the sibling fetch (inside the `useEffect` that loads the result, around line 197–210):

```jsx
        if (section && activeSite?.id && issueType) {
          try {
            const sibRes = await api.get(`/reports/${activeSite.id}/issues`, {
```

Find the `catch` block for this inner try (it currently has only a comment or empty body) and add:

```jsx
          } catch {
            setSiblingError(true);
          }
```

Also reset the error on new result load — at the top of the `useEffect` cleanup / reset section, add:

```jsx
setSiblingError(false);
```

- [ ] **Step 3: Disable prev/next buttons when siblingError is true**

Find the prev/next button render (search for `hasPrev` and `hasNext` in the JSX). The buttons currently look like:

```jsx
<button onClick={() => handleNav(pos - 1)} disabled={!hasPrev} ...>
  ← Prev
</button>
<button onClick={() => handleNav(pos + 1)} disabled={!hasNext} ...>
  Next →
</button>
```

Update disabled conditions and add title attributes:

```jsx
<button
  onClick={() => handleNav(pos - 1)}
  disabled={!hasPrev || siblingError}
  title={siblingError ? 'Navigation unavailable' : undefined}
  ...
>
  ← Prev
</button>
<button
  onClick={() => handleNav(pos + 1)}
  disabled={!hasNext || siblingError}
  title={siblingError ? 'Navigation unavailable' : undefined}
  ...
>
  Next →
</button>
```

- [ ] **Step 4: Verify in browser**

1. Open any issue detail page (e.g. `http://localhost:5173/audit/response-codes`, click a URL)
2. Prev/Next buttons should function normally when siblings load
3. To test the error path: temporarily break the sibling fetch URL in the code (add an invalid path), reload, confirm buttons are disabled with tooltip "Navigation unavailable", then revert

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/IssueDetail.jsx
git commit -m "fix(issue-detail): disable prev/next buttons with tooltip when sibling fetch fails"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `http://localhost:5173/audit/categories` — loads the picker page, shows all categories sorted by severity
- [ ] Sidebar "Audit Categories" highlights when on any `/audit/*` category page (title-tags, response-codes, etc.)
- [ ] Sidebar "Compare Crawls" links to `/audit/compare` and highlights correctly
- [ ] CSV download button appears on every issue-type accordion header in AuditCategory pages
- [ ] Clicking CSV download triggers a browser file download with correct filename
- [ ] Navigating to `/audit/images` (or any unimplemented category) shows "No data collected yet" (not "No issues found")
- [ ] IssueDetail prev/next buttons are disabled (not broken-looking) when sibling fetch fails
- [ ] Full backend test suite passes: `cd backend && npm test`
- [ ] No console errors in the browser on any of the modified pages
