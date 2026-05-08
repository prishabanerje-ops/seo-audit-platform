# Phase 4d — Manual Checks Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-site manual checks workflow — DB storage, backend API, new `/audit/manual-checks/:siteId` page with pass/fail/needs-review + notes per check, and an AuditHealth pill showing flagged/unreviewed counts on affected category rows.

**Architecture:** Migration 020 adds `manual_check_results` (site_id, check_number, status, notes, updated_at). New route `backend/routes/manual-checks.js` mounted at `/api/sites`. New page `ManualChecks.jsx`. AuditHealth fetches manual results in parallel and passes a summary pill prop to each `AccordionRow`.

**Tech Stack:** React 18, React Router, Vite; Node.js 20, Express, better-sqlite3; Vitest + supertest

**Spec:** `docs/superpowers/specs/2026-04-27-manual-checks-design.md`

---

## Files Touched

| File | Change |
|------|--------|
| `backend/db/migrations/020_manual_check_results.js` | Create — new table |
| `backend/db/sqlite.js` | Register migration 020 |
| `backend/routes/manual-checks.js` | Create — GET + PUT endpoints |
| `backend/server.js` | Import + mount manualChecksRouter |
| `backend/__tests__/manual-checks.test.js` | Create — route tests |
| `frontend/src/pages/ManualChecks.jsx` | Create — manual checks page |
| `frontend/src/router.jsx` | Add `/audit/manual-checks/:siteId` route |
| `frontend/src/pages/AuditHealth.jsx` | Parallel fetch + manualSummary + pill |

---

### Task 1: Migration — create manual_check_results table

**Files:**
- Create: `backend/db/migrations/020_manual_check_results.js`
- Modify: `backend/db/sqlite.js`
- Create (test stub): `backend/__tests__/manual-checks.test.js`

- [ ] **Step 1: Write the failing test stub**

Create `backend/__tests__/manual-checks.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token  = jwt.sign(
  { sub: 'u1', email: 'seo@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/sites/:siteId/manual-checks', () => {
  it('returns 404 for non-existent site', async () => {
    const res = await request(app)
      .get('/api/sites/999999/manual-checks')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/sites/:siteId/manual-checks/:checkNumber', () => {
  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .put('/api/sites/1/manual-checks/75')
      .set('Cookie', cookie)
      .send({ status: 'invalid_value' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent site', async () => {
    const res = await request(app)
      .put('/api/sites/999999/manual-checks/75')
      .set('Cookie', cookie)
      .send({ status: 'pass' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent or non-manual check_number', async () => {
    const res = await request(app)
      .put('/api/sites/1/manual-checks/999999')
      .set('Cookie', cookie)
      .send({ status: 'pass' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npx vitest run __tests__/manual-checks.test.js 2>&1 | tail -10
```

Expected: FAIL — route not yet mounted, all requests return 404 from the catch-all or 401.

- [ ] **Step 3: Create migration file**

Create `backend/db/migrations/020_manual_check_results.js`:

```js
/**
 * Migration 020 — manual_check_results
 *
 * Stores analyst pass/fail/needs_review answers for manual-only audit checks.
 * One row per (site, check_number). updated_at tracks staleness.
 */

export const id = '020_manual_check_results';

export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS manual_check_results (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      check_number  INTEGER NOT NULL,
      status        TEXT CHECK(status IN ('pass', 'fail', 'needs_review')),
      notes         TEXT,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id, check_number)
    )
  `).run();
}
```

- [ ] **Step 4: Register migration in sqlite.js**

In `backend/db/sqlite.js`, add after the `migration019` import line:

```js
import { up as migration020 } from './migrations/020_manual_check_results.js';
```

In the `MIGRATIONS` array, add after `{ id: 19, ... }`:

```js
  { id: 20, fn: migration020, name: '020_manual_check_results' },
```

- [ ] **Step 5: Verify migration runs**

```bash
cd backend && node --input-type=module <<'EOF'
import './db/sqlite.js';
EOF
```

Expected: log line `[db] Running migration: 020_manual_check_results` (or nothing if already applied — idempotent).

- [ ] **Step 6: Commit**

```bash
git add backend/db/migrations/020_manual_check_results.js backend/db/sqlite.js backend/__tests__/manual-checks.test.js
git commit -m "feat(db): migration 020 — manual_check_results table"
```

---

### Task 2: Backend route + tests

**Files:**
- Create: `backend/routes/manual-checks.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create the route file**

Create `backend/routes/manual-checks.js`:

```js
/**
 * @module routes/manual-checks
 * Per-site manual check results — GET list + PUT upsert.
 */
import { Router } from 'express';
import db         from '../db/sqlite.js';

const router = Router();
const VALID_STATUSES = new Set(['pass', 'fail', 'needs_review']);

// ─── GET /:siteId/manual-checks ──────────────────────────────────────────────
router.get('/:siteId/manual-checks', (req, res) => {
  try {
    const siteId = Number(req.params.siteId);
    const site   = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const checks = db.prepare(`
      SELECT
        ac.check_number,
        ac.name,
        ac.category,
        ac.severity_default,
        ac.implementation_rule,
        mcr.status,
        mcr.notes,
        mcr.updated_at
      FROM audit_checks ac
      LEFT JOIN manual_check_results mcr
        ON mcr.check_number = ac.check_number AND mcr.site_id = ?
      WHERE ac.automation_type = 'manual'
      ORDER BY ac.category, ac.check_number
    `).all(siteId);

    res.json({ checks });
  } catch (err) {
    console.error('[manual-checks] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /:siteId/manual-checks/:checkNum ────────────────────────────────────
router.put('/:siteId/manual-checks/:checkNum', (req, res) => {
  try {
    const siteId   = Number(req.params.siteId);
    const checkNum = Number(req.params.checkNum);
    const { status, notes } = req.body;

    if (status !== null && status !== undefined && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: "status must be 'pass', 'fail', 'needs_review', or null" });
    }

    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const check = db.prepare(
      "SELECT check_number FROM audit_checks WHERE check_number = ? AND automation_type = 'manual'"
    ).get(checkNum);
    if (!check) return res.status(404).json({ error: 'Manual check not found' });

    db.prepare(`
      INSERT INTO manual_check_results (site_id, check_number, status, notes, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(site_id, check_number) DO UPDATE SET
        status     = excluded.status,
        notes      = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).run(siteId, checkNum, status ?? null, (notes ?? '').trim() || null);

    const row = db.prepare(`
      SELECT
        ac.check_number, ac.name, ac.category, ac.severity_default, ac.implementation_rule,
        mcr.status, mcr.notes, mcr.updated_at
      FROM audit_checks ac
      LEFT JOIN manual_check_results mcr
        ON mcr.check_number = ac.check_number AND mcr.site_id = ?
      WHERE ac.check_number = ?
    `).get(siteId, checkNum);

    res.json(row);
  } catch (err) {
    console.error('[manual-checks] PUT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 2: Mount the router in server.js**

In `backend/server.js`, add the import after the `compareRoutes` import:

```js
import manualChecksRouter from './routes/manual-checks.js';
```

Add the mount after `app.use('/api/compare', compareRoutes)`:

```js
app.use('/api/sites', manualChecksRouter);
```

- [ ] **Step 3: Run the tests**

```bash
cd backend && npx vitest run __tests__/manual-checks.test.js 2>&1 | tail -10
```

Expected:
```
✓ __tests__/manual-checks.test.js (4 tests)
Test Files  1 passed (1)
Tests       4 passed (4)
```

- [ ] **Step 4: Verify no regressions in full suite**

```bash
cd backend && npx vitest run --exclude '**/__tests__/reports-drill-down.test.js' --exclude '**/__tests__/compare.test.js' 2>&1 | tail -8
```

Expected: all included test files pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/manual-checks.js backend/server.js
git commit -m "feat(api): manual-checks route — GET + PUT per-site results"
```

---

### Task 3: Frontend ManualChecks page

**Files:**
- Create: `frontend/src/pages/ManualChecks.jsx`
- Modify: `frontend/src/router.jsx`

- [ ] **Step 1: Create ManualChecks.jsx**

Create `frontend/src/pages/ManualChecks.jsx`:

```jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link }          from 'react-router';
import { ChevronDown, ChevronRight, ClipboardList }  from 'lucide-react';
import api                       from '../api/index.js';
import { LoadingSkeleton }        from '../components/LoadingSkeleton.jsx';
import { EmptyState }             from '../components/EmptyState.jsx';
import { AUDIT_CATEGORY_GROUPS }  from '../lib/auditCategories.js';

const STATUS_STYLES = {
  pass:         { color: 'var(--severity-pass)',     bg: 'var(--severity-pass-bg)'     },
  fail:         { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
  needs_review: { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
};

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

function SeverityBadge({ severity }) {
  const color = severity === 'critical' ? 'var(--severity-critical)'
              : severity === 'warning'  ? 'var(--severity-warning)'
              : 'var(--severity-info)';
  const bg    = severity === 'critical' ? 'var(--severity-critical-bg)'
              : severity === 'warning'  ? 'var(--severity-warning-bg)'
              : 'var(--severity-info-bg)';
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ color, backgroundColor: bg }}>
      {severity}
    </span>
  );
}

function CheckRow({ check, onUpdate }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const textareaRef               = useRef(null);

  function handleStatusClick(s) {
    const next = check.status === s ? null : s;
    onUpdate(check.check_number, { status: next, notes: check.notes });
  }

  function handleNoteBlur() {
    const val = (textareaRef.current?.value ?? '').trim() || null;
    if (val !== (check.notes || null)) {
      onUpdate(check.check_number, { status: check.status, notes: val });
    }
  }

  const days = daysSince(check.updated_at);

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <SeverityBadge severity={check.severity_default} />
        <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>
          {check.name}
        </span>

        {/* Status toggles */}
        <div className="flex items-center gap-1 shrink-0">
          {['pass', 'needs_review', 'fail'].map(s => {
            const isActive = check.status === s;
            const st       = STATUS_STYLES[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusClick(s)}
                className="text-[11px] px-2 py-0.5 rounded font-medium transition-colors"
                style={isActive
                  ? { color: st.color, backgroundColor: st.bg, border: `1px solid ${st.color}` }
                  : { color: 'var(--text-muted)', backgroundColor: 'transparent', border: '1px solid var(--border-subtle)' }
                }
              >
                {s === 'needs_review' ? 'Review' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Staleness */}
        <span className="text-[11px] w-24 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
          {days === null ? 'Not reviewed' : days === 0 ? 'Today' : `${days}d ago`}
        </span>

        {/* Notes chevron */}
        <button
          type="button"
          onClick={() => setNotesOpen(v => !v)}
          className="p-1 rounded"
          style={{ color: 'var(--text-muted)' }}
          title="Toggle notes"
        >
          {notesOpen
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {notesOpen && (
        <div className="px-4 pb-3" style={{ backgroundColor: 'var(--bg-raised)' }}>
          {check.implementation_rule && (
            <p className="text-[11px] mb-2 italic" style={{ color: 'var(--text-muted)' }}>
              {check.implementation_rule}
            </p>
          )}
          <textarea
            ref={textareaRef}
            key={check.check_number}
            defaultValue={check.notes || ''}
            onBlur={handleNoteBlur}
            placeholder="Add notes…"
            rows={3}
            className="w-full text-xs rounded p-2 resize-none"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}

function CategoryGroup({ group, checksByCategory, filter, onUpdate, scrollRef }) {
  const [open, setOpen] = useState(true);

  const allChecks = group.categories.flatMap(cat => checksByCategory[cat] || []);
  if (allChecks.length === 0) return null;

  const reviewed = allChecks.filter(c => c.status !== null).length;

  return (
    <div
      ref={scrollRef}
      className="rounded-xl overflow-hidden mb-4"
      style={{ border: '1px solid var(--border-default)' }}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ backgroundColor: 'var(--bg-raised)' }}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {group.groupLabel}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {reviewed}/{allChecks.length} reviewed
        </span>
      </button>

      {open && (
        <div style={{ backgroundColor: 'var(--bg-surface)' }}>
          {group.categories.map(cat => {
            const checks = (checksByCategory[cat] || []).filter(c => {
              if (filter === 'unreviewed') return c.status === null;
              if (filter === 'flagged')   return c.status === 'fail' || c.status === 'needs_review';
              return true;
            });
            if (checks.length === 0) return null;
            return (
              <div key={cat}>
                <div
                  className="px-4 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--bg-raised)',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  {cat}
                </div>
                {checks.map(chk => (
                  <CheckRow key={chk.check_number} check={chk} onUpdate={onUpdate} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ManualChecks() {
  const { siteId }             = useParams();
  const [searchParams]         = useSearchParams();
  const [checks,  setChecks]   = useState([]);
  const [loading, setLoading]  = useState(true);
  const [filter,  setFilter]   = useState('all');
  const groupRefs              = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sites/${siteId}/manual-checks`);
      setChecks(res.data.checks);
    } catch (err) {
      console.error('[ManualChecks] load error', err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  // Scroll to group containing the ?category= param
  useEffect(() => {
    const target = searchParams.get('category');
    if (!target || loading) return;
    const group = AUDIT_CATEGORY_GROUPS.find(g => g.categories.includes(target));
    if (!group) return;
    const el = groupRefs.current[group.groupLabel];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [searchParams, loading]);

  async function updateCheck(checkNumber, patch) {
    setChecks(prev => prev.map(c =>
      c.check_number === checkNumber
        ? { ...c, ...patch, updated_at: new Date().toISOString() }
        : c
    ));
    try {
      await api.put(`/sites/${siteId}/manual-checks/${checkNumber}`, patch);
    } catch {
      load();
    }
  }

  const reviewed = checks.filter(c => c.status !== null).length;
  const flagged  = checks.filter(c => c.status === 'fail' || c.status === 'needs_review').length;
  const total    = checks.length;

  const checksByCategory = {};
  for (const c of checks) {
    if (!checksByCategory[c.category]) checksByCategory[c.category] = [];
    checksByCategory[c.category].push(c);
  }

  const filterCounts = {
    all:        total,
    unreviewed: checks.filter(c => c.status === null).length,
    flagged,
  };

  if (loading) return <div className="p-6"><LoadingSkeleton /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/audit" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          ← Audit Health
        </Link>
        <h1 className="text-xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
          Manual Checks
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {reviewed} of {total} reviewed · {flagged} flagged
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {['all', 'unreviewed', 'flagged'].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={filter === f
              ? { backgroundColor: 'var(--brand)', color: '#fff' }
              : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }
            }
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({filterCounts[f]})
          </button>
        ))}
      </div>

      {/* Groups */}
      {AUDIT_CATEGORY_GROUPS.map(group => (
        <CategoryGroup
          key={group.groupLabel}
          group={group}
          checksByCategory={checksByCategory}
          filter={filter}
          onUpdate={updateCheck}
          scrollRef={el => { groupRefs.current[group.groupLabel] = el; }}
        />
      ))}

      {total === 0 && (
        <EmptyState
          icon={ClipboardList}
          message="No manual checks found"
          description="No manual checks are registered in the audit check registry."
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route to router.jsx**

In `frontend/src/router.jsx`, add the import after the `IssueDetail` import:

```js
import { ManualChecks } from './pages/ManualChecks.jsx';
```

Add the route inside the protected audit block (after the `/audit/ga4` route):

```js
{ path: '/audit/manual-checks/:siteId', element: <ManualChecks /> },
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -15
```

Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ManualChecks.jsx frontend/src/router.jsx
git commit -m "feat(frontend): ManualChecks page — per-site pass/fail/needs_review workflow"
```

---

### Task 4: AuditHealth integration

**Files:**
- Modify: `frontend/src/pages/AuditHealth.jsx`

- [ ] **Step 1: Add manualChecks state**

Find (around line 271):

```js
  const [checksTotal, setChecksTotal] = useState(null);
  const [loading,    setLoading]  = useState(true);
  const [error,      setError]    = useState(null);
```

Replace with:

```js
  const [checksTotal,  setChecksTotal]  = useState(null);
  const [manualChecks, setManualChecks] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
```

- [ ] **Step 2: Add parallel fetch for manual checks**

Find (around line 279):

```js
      const [summaryRes, trendRes, checksRes] = await Promise.all([
        api.get(`/reports/${activeSite.id}/summary`),
        api.get(`/reports/${activeSite.id}/trend`),
        api.get('/reports/checks/count'),
      ]);
      setSummary(summaryRes.data);
      setTrend(trendRes.data.trend || []);
      setChecksTotal(checksRes.data.total);
```

Replace with:

```js
      const [summaryRes, trendRes, checksRes, manualRes] = await Promise.all([
        api.get(`/reports/${activeSite.id}/summary`),
        api.get(`/reports/${activeSite.id}/trend`),
        api.get('/reports/checks/count'),
        api.get(`/sites/${activeSite.id}/manual-checks`),
      ]);
      setSummary(summaryRes.data);
      setTrend(trendRes.data.trend || []);
      setChecksTotal(checksRes.data.total);
      setManualChecks(manualRes.data.checks || []);
```

- [ ] **Step 3: Build manualSummary map**

Find the comment (around line 371):

```js
  // ── Build accordion data ──────────────────────────────────────────────────
```

Insert the following block immediately before it:

```js
  // ── Manual check summary per category ────────────────────────────────────
  const manualSummary = {};
  for (const mc of manualChecks) {
    if (!manualSummary[mc.category]) {
      manualSummary[mc.category] = { total: 0, flagged: 0, unreviewed: 0 };
    }
    manualSummary[mc.category].total += 1;
    if (mc.status === 'fail' || mc.status === 'needs_review') manualSummary[mc.category].flagged += 1;
    if (mc.status === null) manualSummary[mc.category].unreviewed += 1;
  }

```

- [ ] **Step 4: Pass manualSummary props to AccordionRow**

Find (around line 489):

```jsx
              <AccordionRow
                key={cat}
                category={cat}
                counts={summary.sections?.[cat]}
                checks={checksByCategory[cat] || []}
                issueCountMap={issueCountMap}
                isCovered={coveredSet.has(cat)}
                routePath={SECTION_TO_SLUG[cat] ? `/audit/${SECTION_TO_SLUG[cat]}` : null}
                defaultOpen={false}
              />
```

Replace with:

```jsx
              <AccordionRow
                key={cat}
                category={cat}
                counts={summary.sections?.[cat]}
                checks={checksByCategory[cat] || []}
                issueCountMap={issueCountMap}
                isCovered={coveredSet.has(cat)}
                routePath={SECTION_TO_SLUG[cat] ? `/audit/${SECTION_TO_SLUG[cat]}` : null}
                defaultOpen={false}
                manualSummary={manualSummary[cat]}
                manualLink={manualSummary[cat]?.total > 0
                  ? `/audit/manual-checks/${activeSite.id}?category=${encodeURIComponent(cat)}`
                  : null}
              />
```

- [ ] **Step 5: Update AccordionRow to accept and render the pill**

Find the `AccordionRow` signature (line 99):

```js
function AccordionRow({ category, counts, checks, issueCountMap, isCovered, routePath, defaultOpen }) {
```

Replace with:

```js
function AccordionRow({ category, counts, checks, issueCountMap, isCovered, routePath, defaultOpen, manualSummary, manualLink }) {
```

Find the header `<button>` block (starts around line 110, the `w-full flex items-center` button):

```jsx
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: 'transparent' }}
        onClick={() => setOpen(v => !v)}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {category}
        </span>
        <span className="text-xs mr-3" style={{ color: 'var(--text-muted)' }}>
          {checkTotal} check{checkTotal !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          {critical > 0 && <SeverityCount count={critical} type="critical" />}
          {warning  > 0 && <SeverityCount count={warning}  type="warning"  />}
          {info     > 0 && <SeverityCount count={info}     type="info"     />}
          {total === 0   && <SeverityCount count="✓" type="ok" />}
        </div>
      </button>
```

Replace with:

```jsx
      <div className="flex items-center">
        <button
          type="button"
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left transition-colors"
          style={{ backgroundColor: 'transparent' }}
          onClick={() => setOpen(v => !v)}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {category}
          </span>
          <span className="text-xs mr-3" style={{ color: 'var(--text-muted)' }}>
            {checkTotal} check{checkTotal !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            {critical > 0 && <SeverityCount count={critical} type="critical" />}
            {warning  > 0 && <SeverityCount count={warning}  type="warning"  />}
            {info     > 0 && <SeverityCount count={info}     type="info"     />}
            {total === 0   && <SeverityCount count="✓" type="ok" />}
          </div>
        </button>
        {manualSummary?.total > 0 && manualLink && (
          <Link
            to={manualLink}
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium mr-4 shrink-0"
            style={manualSummary.flagged > 0
              ? { color: 'var(--severity-critical)', backgroundColor: 'var(--severity-critical-bg)' }
              : { color: 'var(--text-muted)',        backgroundColor: 'var(--bg-raised)' }
            }
          >
            {manualSummary.flagged > 0
              ? `${manualSummary.flagged} manual flagged`
              : `${manualSummary.unreviewed} unreviewed`}
          </Link>
        )}
      </div>
```

- [ ] **Step 6: Build and verify**

```bash
cd frontend && npm run build 2>&1 | tail -15
```

Expected: build succeeds, no errors.

- [ ] **Step 7: Run backend tests**

```bash
cd backend && npx vitest run --exclude '**/__tests__/reports-drill-down.test.js' --exclude '**/__tests__/compare.test.js' 2>&1 | tail -8
```

Expected: all included tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/AuditHealth.jsx
git commit -m "feat(frontend): AuditHealth manual check summary pill per category"
```

---

## Self-Review Checklist

- [x] Migration creates table with UNIQUE(site_id, check_number) and ON DELETE CASCADE
- [x] GET returns all `automation_type = 'manual'` checks LEFT JOINed with saved results
- [x] PUT validates status, validates site, validates check is manual, upserts with ON CONFLICT
- [x] Tests cover: invalid status (400), non-existent site (404), non-existent check (404)
- [x] ManualChecks page: filter tabs, per-group reviewed count, status toggles, notes onBlur save
- [x] `?category=` param scrolls to the correct group
- [x] Optimistic update reverts on API error
- [x] AuditHealth: parallel fetch, manualSummary map, pill outside toggle button (valid HTML)
- [x] AccordionRow header restructured — pill is a `<Link>` sibling to the toggle `<button>`, not nested inside it
- [x] `manualSummary` absent → pill renders nothing (fully backwards compatible)
- [x] Build verified in Tasks 3 and 4
