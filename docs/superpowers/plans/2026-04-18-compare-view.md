# Compare View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/audit/compare` page that lets users compare two completed crawl jobs (any sites) with a delta-first summary and a filterable issue-type diff table.

**Architecture:** Two new backend endpoints (`GET /api/compare/jobs` and `GET /api/compare?jobA=x&jobB=y`) in a new `backend/routes/compare.js` file, mounted in `server.js`. One new frontend page `frontend/src/pages/CompareView.jsx` replaces the existing stub. No new DB migrations needed.

**Tech Stack:** Node.js/Express, better-sqlite3 (sync), React 18, react-router v7, lucide-react, sonner toasts, CSS custom properties, Vitest + supertest

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `backend/routes/compare.js` | Two compare endpoints |
| Create | `backend/__tests__/compare.test.js` | Vitest + supertest tests |
| Modify | `backend/server.js` | Import + mount compare router |
| Create | `frontend/src/pages/CompareView.jsx` | Full compare page |
| Modify | `frontend/src/pages/stubs.jsx` | Remove `CompareView` stub export |
| Modify | `frontend/src/router.jsx` | Import `CompareView` from its own file |

---

## Task 1: Backend compare routes + tests

**Files:**
- Create: `backend/routes/compare.js`
- Create: `backend/__tests__/compare.test.js`
- Modify: `backend/server.js` (lines 42–43 area for import; line 149 area for mount)

### Codebase context

- `backend/routes/exports.js` is the pattern to follow exactly — `Router()`, try/catch, `req.user` destructuring, `db.prepare().all()` / `.get()`, `console.error` on failure.
- Auth: `req.user` is set by `authMiddleware` which runs globally. `req.user` has `{ sub, email, role, company_id }`.
- Superadmin bypass: `if (role !== 'superadmin' && ...)` — superadmins can access any company's data.
- better-sqlite3 is **synchronous** — never use async/await on DB calls.
- `crawl_jobs` has columns: `id TEXT, site_id TEXT, status TEXT, started_at TEXT, completed_at TEXT, total_urls INTEGER, health_score INTEGER`.
- `sites` has columns: `id TEXT, company_id TEXT, label TEXT`.
- `audit_results` has columns: `crawl_job_id TEXT, section TEXT, issue_type TEXT, severity TEXT, url TEXT, data TEXT`.

### Step-by-step

- [ ] **Step 1: Write the test file**

Create `backend/__tests__/compare.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const cookie = `auth_token=${jwt.sign(
  { sub: 'u1', email: 'test@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
)}`;

describe('GET /api/compare/jobs', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/compare/jobs');
    expect(res.status).toBe(401);
  });

  it('returns 200 with jobs array when authenticated', async () => {
    const res = await request(app).get('/api/compare/jobs').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jobs');
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });
});

describe('GET /api/compare', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/compare?jobA=a&jobB=b');
    expect(res.status).toBe(401);
  });

  it('returns 400 when jobA is missing', async () => {
    const res = await request(app).get('/api/compare?jobB=b').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobA/i);
  });

  it('returns 400 when jobB is missing', async () => {
    const res = await request(app).get('/api/compare?jobA=a').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobB/i);
  });

  it('returns 400 when jobA === jobB', async () => {
    const res = await request(app).get('/api/compare?jobA=same&jobB=same').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/itself/i);
  });

  it('returns 404 when jobA does not exist', async () => {
    const res = await request(app).get('/api/compare?jobA=no-such-job&jobB=also-no').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /path/to/Aakash/backend && npx vitest run __tests__/compare.test.js
```

Expected: all tests FAIL (route doesn't exist yet → likely 404 or connection error).

- [ ] **Step 3: Create `backend/routes/compare.js`**

```js
/**
 * @module routes/compare
 * Compare two completed crawl jobs — issue-type-level diff.
 */
import { Router } from 'express';
import db         from '../db/sqlite.js';

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function verifyJob(jobId, companyId, role) {
  const job = db.prepare(`
    SELECT j.id, j.site_id, j.started_at, j.total_urls, j.health_score,
           s.company_id, s.label
    FROM crawl_jobs j
    JOIN sites s ON s.id = j.site_id
    WHERE j.id = ? AND j.status = 'completed'
  `).get(jobId);
  if (!job) return { error: 'Job not found', status: 404 };
  if (role !== 'superadmin' && job.company_id !== companyId) {
    return { error: 'Access denied', status: 403 };
  }
  return { job };
}

// ─── GET /api/compare/jobs ────────────────────────────────────────────────────
router.get('/jobs', (req, res) => {
  try {
    const { company_id, role } = req.user;

    const jobs = role === 'superadmin'
      ? db.prepare(`
          SELECT j.id, j.site_id, s.label AS siteLabel,
                 j.started_at, j.total_urls, j.health_score
          FROM crawl_jobs j
          JOIN sites s ON s.id = j.site_id
          WHERE j.status = 'completed'
          ORDER BY j.started_at DESC
        `).all()
      : db.prepare(`
          SELECT j.id, j.site_id, s.label AS siteLabel,
                 j.started_at, j.total_urls, j.health_score
          FROM crawl_jobs j
          JOIN sites s ON s.id = j.site_id
          WHERE j.status = 'completed' AND s.company_id = ?
          ORDER BY j.started_at DESC
        `).all(company_id);

    res.json({ jobs });
  } catch (err) {
    console.error('[compare] GET /jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/compare?jobA=x&jobB=y ──────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { jobA, jobB } = req.query;
    const { company_id, role } = req.user;

    if (!jobA) return res.status(400).json({ error: 'jobA is required' });
    if (!jobB) return res.status(400).json({ error: 'jobB is required' });
    if (jobA === jobB) return res.status(400).json({ error: 'Cannot compare a job with itself' });

    const checkA = verifyJob(jobA, company_id, role);
    if (checkA.error) return res.status(checkA.status).json({ error: checkA.error });

    const checkB = verifyJob(jobB, company_id, role);
    if (checkB.error) return res.status(checkB.status).json({ error: checkB.error });

    const { job: jA } = checkA;
    const { job: jB } = checkB;

    // Aggregate counts per (section, issue_type, severity) for each job
    const aggQuery = `
      SELECT section, issue_type, severity, COUNT(*) AS count
      FROM audit_results
      WHERE crawl_job_id = ?
      GROUP BY section, issue_type, severity
    `;
    const rowsA = db.prepare(aggQuery).all(jobA);
    const rowsB = db.prepare(aggQuery).all(jobB);

    // Build lookup maps keyed by "section|||issue_type|||severity"
    const mapA = {};
    for (const r of rowsA) mapA[`${r.section}|||${r.issue_type}|||${r.severity}`] = r.count;
    const mapB = {};
    for (const r of rowsB) mapB[`${r.section}|||${r.issue_type}|||${r.severity}`] = r.count;

    // Union of all keys
    const allKeys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

    let criticalA = 0, criticalB = 0;
    let warningA  = 0, warningB  = 0;
    let infoA     = 0, infoB     = 0;

    const rows = [];
    for (const key of allKeys) {
      const [section, issue_type, severity] = key.split('|||');
      const countA = mapA[key] || 0;
      const countB = mapB[key] || 0;
      const delta  = countB - countA;

      if (severity === 'critical')     { criticalA += countA; criticalB += countB; }
      else if (severity === 'warning') { warningA  += countA; warningB  += countB; }
      else if (severity === 'info')    { infoA     += countA; infoB     += countB; }

      rows.push({ section, issue_type, severity, countA, countB, delta });
    }

    // Sort by absolute delta descending (biggest changes first)
    rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    res.json({
      jobA: {
        id: jA.id, siteLabel: jA.label,
        startedAt: jA.started_at, totalUrls: jA.total_urls, healthScore: jA.health_score,
      },
      jobB: {
        id: jB.id, siteLabel: jB.label,
        startedAt: jB.started_at, totalUrls: jB.total_urls, healthScore: jB.health_score,
      },
      summary: {
        scoreDelta:    (jB.health_score || 0) - (jA.health_score || 0),
        criticalDelta: criticalB - criticalA,
        warningDelta:  warningB  - warningA,
        infoDelta:     infoB     - infoA,
        urlsDelta:     (jB.total_urls || 0) - (jA.total_urls || 0),
      },
      rows,
    });
  } catch (err) {
    console.error('[compare] GET / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 4: Mount the router in `backend/server.js`**

Add the import alongside the other route imports (near line 42):
```js
import compareRoutes from './routes/compare.js';
```

Add the mount alongside the other `app.use` calls (near line 149, after the exportsRoutes line):
```js
app.use('/api/compare',        compareRoutes);
```

- [ ] **Step 5: Run the tests — expect all to pass**

```bash
cd /path/to/Aakash/backend && npx vitest run __tests__/compare.test.js
```

Expected output:
```
✓ GET /api/compare/jobs > returns 401 when unauthenticated
✓ GET /api/compare/jobs > returns 200 with jobs array when authenticated
✓ GET /api/compare > returns 401 when unauthenticated
✓ GET /api/compare > returns 400 when jobA is missing
✓ GET /api/compare > returns 400 when jobB is missing
✓ GET /api/compare > returns 400 when jobA === jobB
✓ GET /api/compare > returns 404 when jobA does not exist

Tests  7 passed (7)
```

- [ ] **Step 6: Commit**

```bash
git add backend/routes/compare.js backend/__tests__/compare.test.js backend/server.js
git commit -m "feat(compare): backend compare routes — GET /jobs and GET /"
```

---

## Task 2: Frontend CompareView page + router wiring

**Files:**
- Create: `frontend/src/pages/CompareView.jsx`
- Modify: `frontend/src/pages/stubs.jsx` (remove `CompareView` line)
- Modify: `frontend/src/router.jsx` (swap stub import for real import)

### Codebase context

- `frontend/src/pages/Exports.jsx` is the closest reference for patterns: `useCallback`, `useEffect` with `AbortController`, CSS custom properties throughout, `api.get(...)` from `../api/index.js`, `LoadingSkeleton` for loading states, `Button` from `../components/ui/Button.jsx`.
- The axios interceptor in `../api/index.js` fires `toast.error(message)` for all non-401 errors automatically — do NOT add redundant `toast.error` calls in catch blocks.
- CSS tokens available: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--bg-surface)`, `var(--bg-raised)`, `var(--bg-base)`, `var(--border-default)`, `var(--border-subtle)`, `var(--brand)`, `var(--severity-critical)`, `var(--severity-critical-bg)`, `var(--severity-warning)`, `var(--severity-warning-bg)`, `var(--severity-info)`, `var(--severity-info-bg)`, `var(--severity-pass)`, `var(--severity-pass-bg)`.
- `Button` component props: `variant` ('primary'|'secondary'|'ghost'|'outline'|'destructive'), `size` ('sm'|'md'|'lg'), `loading`, `disabled`, `iconLeft`, `children`.
- `LoadingSkeleton` props: `type` ('table'|'ring'), `rows`, `cols`.
- `import { useNavigate } from 'react-router'` — note: package is `react-router`, not `react-router-dom`.
- `stubs.jsx` line 181 has: `export function CompareView() { ... }` — remove the entire line.
- `router.jsx` line 29 imports `CompareView` from `stubs.jsx` — replace with a direct import.

### Step-by-step

- [ ] **Step 1: Create `frontend/src/pages/CompareView.jsx`**

```jsx
/**
 * CompareView — compare two completed crawl jobs.
 *
 * Picks any two completed jobs from all accessible sites,
 * shows delta summary cards, and a filterable issue-type diff table.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { GitCompareArrows, ArrowUp, ArrowDown } from 'lucide-react';
import api                 from '../api/index.js';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { Button }          from '../components/ui/Button.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function jobLabel(job) {
  return `${job.siteLabel} · ${fmtDate(job.startedAt)} · ${(job.totalUrls || 0).toLocaleString()} URLs${job.healthScore != null ? ` · Score ${job.healthScore}` : ''}`;
}

// ── Delta card ────────────────────────────────────────────────────────────────

function DeltaCard({ label, delta, invertColor }) {
  // invertColor=true means negative delta is good (fewer issues = better)
  const isGood    = invertColor ? delta < 0 : delta > 0;
  const isBad     = invertColor ? delta > 0 : delta < 0;
  const isNeutral = delta === 0;

  const bg    = isNeutral ? 'var(--bg-surface)'           : isGood ? 'var(--severity-pass-bg)'     : 'var(--severity-critical-bg)';
  const color = isNeutral ? 'var(--text-muted)'           : isGood ? 'var(--severity-pass)'         : 'var(--severity-critical)';
  const sign  = delta > 0 ? '+' : '';

  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center justify-center gap-1"
      style={{ backgroundColor: bg, border: '1px solid var(--border-default)' }}
    >
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>
        {isNeutral ? '—' : `${sign}${delta}`}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

// ── Severity pill ─────────────────────────────────────────────────────────────

function SeverityPill({ severity }) {
  const styles = {
    critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    warning:  { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
    info:     { color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)'     },
  };
  const s = styles[severity] || styles.info;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {severity}
    </span>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function DeltaBadge({ countA, countB, delta }) {
  if (countA === 0 && countB > 0) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
        style={{ color: 'var(--severity-info)', backgroundColor: 'var(--severity-info-bg)' }}
      >
        NEW
      </span>
    );
  }
  if (countB === 0 && countA > 0) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
        style={{ color: 'var(--severity-pass)', backgroundColor: 'var(--severity-pass-bg)' }}
      >
        GONE
      </span>
    );
  }
  if (delta === 0) {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  }
  const improved = delta < 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 font-semibold text-sm tabular-nums"
      style={{ color: improved ? 'var(--severity-pass)' : 'var(--severity-critical)' }}
    >
      {improved
        ? <ArrowDown className="w-3 h-3" />
        : <ArrowUp   className="w-3 h-3" />}
      {Math.abs(delta)}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CompareView() {
  const [jobs,        setJobs]        = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobIdA,      setJobIdA]      = useState('');
  const [jobIdB,      setJobIdB]      = useState('');
  const [comparison,  setComparison]  = useState(null);
  const [cmpLoading,  setCmpLoading]  = useState(false);

  // Filter state
  const [sectionFilter,  setSectionFilter]  = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [changedOnly,    setChangedOnly]    = useState(true);
  const [sortAsc,        setSortAsc]        = useState(false); // false = largest change first

  // Load all accessible completed jobs on mount
  useEffect(() => {
    const controller = new AbortController();
    api.get('/compare/jobs', { signal: controller.signal })
      .then(res => setJobs(res.data.jobs || []))
      .catch(err => { if (err.name !== 'CanceledError') { /* interceptor handles toast */ } })
      .finally(() => setJobsLoading(false));
    return () => controller.abort();
  }, []);

  // Load comparison whenever both jobs are selected
  const loadComparison = useCallback(async (idA, idB, signal) => {
    setCmpLoading(true);
    setComparison(null);
    try {
      const res = await api.get('/compare', { params: { jobA: idA, jobB: idB }, signal });
      setComparison(res.data);
    } catch (err) {
      if (err.name !== 'CanceledError') { /* interceptor handles toast */ }
    } finally {
      setCmpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jobIdA || !jobIdB) return;
    const controller = new AbortController();
    loadComparison(jobIdA, jobIdB, controller.signal);
    return () => controller.abort();
  }, [jobIdA, jobIdB, loadComparison]);

  // Derived: sections present in the comparison result
  const availableSections = useMemo(() => {
    if (!comparison) return [];
    return [...new Set(comparison.rows.map(r => r.section))].sort();
  }, [comparison]);

  // Derived: filtered + sorted rows
  const filteredRows = useMemo(() => {
    if (!comparison) return [];
    let rows = comparison.rows;
    if (changedOnly)     rows = rows.filter(r => r.delta !== 0);
    if (sectionFilter)   rows = rows.filter(r => r.section === sectionFilter);
    if (severityFilter)  rows = rows.filter(r => r.severity === severityFilter);
    const sorted = [...rows].sort((a, b) =>
      sortAsc
        ? Math.abs(a.delta) - Math.abs(b.delta)
        : Math.abs(b.delta) - Math.abs(a.delta)
    );
    return sorted;
  }, [comparison, changedOnly, sectionFilter, severityFilter, sortAsc]);

  if (jobsLoading) {
    return <div className="p-6"><LoadingSkeleton type="table" rows={3} cols={1} /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Compare Crawls</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Select two completed crawl jobs to compare issue counts.
        </p>
      </div>

      {/* Job pickers */}
      <div
        className="rounded-xl p-5 mb-5"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        {jobs.length < 2 ? (
          <EmptyState
            icon={GitCompareArrows}
            message="Not enough crawls"
            description="You need at least 2 completed crawls to compare. Run more crawls first."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Picker A */}
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Baseline (A)
              </label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                value={jobIdA}
                onChange={e => setJobIdA(e.target.value)}
              >
                <option value="">Select a job…</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id} disabled={j.id === jobIdB}>
                    {jobLabel(j)}
                  </option>
                ))}
              </select>
            </div>

            {/* Picker B */}
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Comparison (B)
              </label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                value={jobIdB}
                onChange={e => setJobIdB(e.target.value)}
              >
                <option value="">Select a job…</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id} disabled={j.id === jobIdA}>
                    {jobLabel(j)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Comparison results */}
      {(jobIdA && jobIdB) && (
        cmpLoading ? (
          <LoadingSkeleton type="table" rows={6} cols={4} />
        ) : comparison ? (
          <>
            {/* Summary delta cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <DeltaCard label="Health Score"     delta={comparison.summary.scoreDelta}    invertColor={false} />
              <DeltaCard label="Critical Issues"  delta={comparison.summary.criticalDelta} invertColor={true}  />
              <DeltaCard label="Warnings"         delta={comparison.summary.warningDelta}  invertColor={true}  />
              <DeltaCard label="Info"             delta={comparison.summary.infoDelta}     invertColor={true}  />
            </div>

            {/* Diff table */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border-default)' }}
            >
              {/* Filter bar */}
              <div
                className="flex flex-wrap items-center gap-3 px-4 py-3"
                style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}
              >
                {/* Section filter */}
                <select
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                  value={sectionFilter}
                  onChange={e => setSectionFilter(e.target.value)}
                >
                  <option value="">All sections</option>
                  {availableSections.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Severity filter */}
                <select
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                  value={severityFilter}
                  onChange={e => setSeverityFilter(e.target.value)}
                >
                  <option value="">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>

                {/* Changed only toggle */}
                <label
                  className="flex items-center gap-1.5 cursor-pointer text-xs select-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <input
                    type="checkbox"
                    checked={changedOnly}
                    onChange={e => setChangedOnly(e.target.checked)}
                  />
                  Changed only
                </label>

                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                  {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              <table className="w-full text-sm" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
                    {['Issue Type', 'Section', 'Severity', 'Before', 'After'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                    <th
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide cursor-pointer select-none"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => setSortAsc(v => !v)}
                      title="Toggle sort direction"
                    >
                      Δ {sortAsc ? '↑' : '↓'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        No issues match the current filters
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, i) => (
                      <tr
                        key={`${row.section}-${row.issue_type}-${row.severity}`}
                        style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                      >
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
                          {row.issue_type}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {row.section}
                        </td>
                        <td className="px-4 py-2.5">
                          <SeverityPill severity={row.severity} />
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {row.countA.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {row.countB.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <DeltaBadge countA={row.countA} countB={row.countB} delta={row.delta} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove `CompareView` stub from `frontend/src/pages/stubs.jsx`**

Find and delete the line (it is the last export in the file):
```js
export function CompareView()      { return <Stub title="Compare Crawls"     description="Side-by-side comparison of two completed crawls." />; }
```

Delete that entire line.

- [ ] **Step 3: Update `frontend/src/router.jsx`**

Current (around lines 27–31):
```js
import { Exports } from './pages/Exports.jsx';
import {
  Integrations, SystemHealth,
  ErrorLog, CompareView,
  AuditCustomExtraction, AuditLogFile,
} from './pages/stubs.jsx';
```

Change to:
```js
import { Exports }      from './pages/Exports.jsx';
import { CompareView }  from './pages/CompareView.jsx';
import {
  Integrations, SystemHealth,
  ErrorLog,
  AuditCustomExtraction, AuditLogFile,
} from './pages/stubs.jsx';
```

- [ ] **Step 4: Verify the Vite build passes**

```bash
cd /path/to/Aakash/frontend && npm run build
```

Expected: clean build, no errors. (Pre-existing chunk size warning is acceptable.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CompareView.jsx frontend/src/pages/stubs.jsx frontend/src/router.jsx
git commit -m "feat(compare): CompareView page — job pickers, delta cards, diff table"
```

---

## Final: Run full backend test suite

- [ ] **Run all backend tests**

```bash
cd /path/to/Aakash/backend && npx vitest run
```

Expected: all previously passing tests still pass, plus the 7 new compare tests. The pre-existing `EADDRINUSE` uncaught exceptions from parallel test file loading are acceptable (pre-existing issue, not caused by this feature).
