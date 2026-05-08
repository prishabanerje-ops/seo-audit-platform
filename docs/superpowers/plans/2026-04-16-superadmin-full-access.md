# Superadmin Full Company Access — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a superadmin has a company actively selected, they can perform every action a regular admin can — create sites, start crawls, view audits, manage users, configure settings.

**Architecture:** A new `<RequireCompany>` route-level guard (mirrors `<AdminOnly>`) intercepts superadmin before any company-scoped page renders. All company-scoped routes are grouped under it in `router.jsx`. The one broken mutation (`createSite`) is fixed in `SitesContext`. `AdsDashboard` is fixed to use `viewingCompanyId` for Socket.io scoping.

**Tech Stack:** React 18, React Router v7 (`react-router`), CSS vars for all styling. No backend changes needed.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/components/RequireCompany.jsx` | **Create** — route-level guard for superadmin company context |
| `frontend/src/router.jsx` | **Modify** — add `CompanyScoped` wrapper, group all company-scoped routes under it |
| `frontend/src/context/SitesContext.jsx` | **Modify** — `createSite` injects `company_id: viewingCompanyId` for superadmin |
| `frontend/src/pages/AdsDashboard.jsx` | **Modify** — use `viewingCompanyId ?? user.company_id` for Socket.io room |
| `frontend/src/pages/Users.jsx` | **Modify** — remove internal "no company" early-return (router handles it now) |

---

## Key Context

- `useAuth()` returns `{ user, viewingCompanyId, companyId }` from `frontend/src/context/AuthContext.jsx`
- `user.role === 'superadmin'` means `user.company_id` is `null` in the JWT
- `viewingCompanyId` is the company superadmin has selected via the header switcher (persisted in localStorage)
- For regular users, `companyId` comes directly from their JWT — `RequireCompany` is a no-op for them
- CSS vars: `var(--bg-base)`, `var(--text-primary)`, `var(--text-muted)`, `var(--brand)`
- Pattern for route-level guards: see `frontend/src/components/ProtectedRoute.jsx` — `RequireRole` wraps children and calls `ProtectedRoute`; our `RequireCompany` renders `<Outlet />` directly (same net effect, slightly different internal shape)
- `<Outlet />` is imported from `'react-router'`

---

## Task 1: Create `RequireCompany` component

**Files:**
- Create: `frontend/src/components/RequireCompany.jsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/components/RequireCompany.jsx` with this exact content:

```jsx
import { Outlet, Link } from 'react-router';
import { Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function NoCompanySelected() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <Building2
          className="w-10 h-10 mx-auto mb-4"
          style={{ color: 'var(--text-muted)' }}
        />
        <h2
          className="text-base font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          No company selected
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Select a company from the header to continue.
        </p>
        <Link
          to="/companies"
          className="inline-flex items-center h-8 px-4 rounded-md text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--brand)' }}
        >
          Go to Companies
        </Link>
      </div>
    </div>
  );
}

/**
 * Route-level guard for company-scoped pages.
 * - Non-superadmin: always passes through (company_id is in their JWT).
 * - Superadmin + company selected: passes through.
 * - Superadmin + no company selected: shows NoCompanySelected prompt.
 */
export function RequireCompany() {
  const { user, viewingCompanyId } = useAuth();
  if (user?.role !== 'superadmin') return <Outlet />;
  if (viewingCompanyId) return <Outlet />;
  return <NoCompanySelected />;
}
```

- [ ] **Step 2: Verify the dev server accepts the file**

```bash
cd /Users/a39326/Documents/Aakash && npm run dev
```

Open `http://localhost:5173` — no console errors on startup. Kill the server (`Ctrl+C`).

- [ ] **Step 3: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/components/RequireCompany.jsx
git commit -m "feat(auth): RequireCompany route guard for superadmin company context"
```

---

## Task 2: Fix `SitesContext.createSite`

**Files:**
- Modify: `frontend/src/context/SitesContext.jsx:50-55`

This is the only backend mutation that actually breaks for superadmin today. The backend (`POST /api/sites`) returns `403` when `company_id` is missing from the body. `createSite` must inject `company_id: viewingCompanyId` when the caller is superadmin.

Current code (lines 50–55):
```js
const createSite = async (data) => {
  const res = await api.post('/sites', data);
  await reload();
  handleSetActiveSite(res.data);
  return res.data;
};
```

- [ ] **Step 1: Read `SitesContext.jsx` to confirm line numbers haven't shifted**

Open `frontend/src/context/SitesContext.jsx`. Confirm `createSite` starts at approximately line 50 and calls `api.post('/sites', data)` directly.

- [ ] **Step 2: Update `createSite`**

Replace the `createSite` function with:

```js
const createSite = async (data) => {
  const body = (user.role === 'superadmin' && viewingCompanyId)
    ? { ...data, company_id: viewingCompanyId }
    : data;
  const res = await api.post('/sites', body);
  await reload();
  handleSetActiveSite(res.data);
  return res.data;
};
```

`user` and `viewingCompanyId` are already in scope at the top of `SitesProvider` (line 8: `const { user, viewingCompanyId } = useAuth();`). No new imports needed.

- [ ] **Step 3: Verify the file looks correct**

```bash
grep -A 7 "const createSite" /Users/a39326/Documents/Aakash/frontend/src/context/SitesContext.jsx
```

Expected output:
```
const createSite = async (data) => {
  const body = (user.role === 'superadmin' && viewingCompanyId)
    ? { ...data, company_id: viewingCompanyId }
    : data;
  const res = await api.post('/sites', body);
  await reload();
  handleSetActiveSite(res.data);
  return res.data;
};
```

- [ ] **Step 4: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/context/SitesContext.jsx
git commit -m "fix(sites): inject company_id in createSite for superadmin"
```

---

## Task 3: Fix `AdsDashboard` Socket.io scoping

**Files:**
- Modify: `frontend/src/pages/AdsDashboard.jsx:558-581`

The Socket.io effect uses `user.company_id` which is `null` for superadmin. It must use `viewingCompanyId ?? user.company_id` so the superadmin joins the correct company room.

Current code (lines 557–581):
```js
// Socket.io — listen for real-time sync progress
useEffect(() => {
  if (!user?.company_id) return;
  const socket = socketIo('http://localhost:3001', { withCredentials: true });
  socket.emit('join:company', user.company_id);
  // ...
  return () => {
    socket.emit('leave:company', user.company_id);
    socket.disconnect();
  };
}, [user?.company_id]);
```

- [ ] **Step 1: Read the top of `AdsDashboard.jsx` to confirm `useAuth` imports**

```bash
head -20 /Users/a39326/Documents/Aakash/frontend/src/pages/AdsDashboard.jsx
```

Check that `useAuth` is already imported and that `user` is already destructured. If `viewingCompanyId` is not yet destructured from `useAuth()`, note where to add it.

- [ ] **Step 2: Add `viewingCompanyId` to the `useAuth()` destructure**

Find the line like:
```js
const { user, ... } = useAuth();
```

Add `viewingCompanyId` to it:
```js
const { user, viewingCompanyId, ... } = useAuth();
```

(Keep all existing destructured values — just add `viewingCompanyId` to the list.)

- [ ] **Step 3: Update the Socket.io effect**

Replace the Socket.io `useEffect` block with:

```js
// Socket.io — listen for real-time sync progress
useEffect(() => {
  const companyId = viewingCompanyId ?? user?.company_id;
  if (!companyId) return;
  const socket = socketIo('http://localhost:3001', { withCredentials: true });
  socket.emit('join:company', companyId);

  socket.on('ads:sync:progress', ({ platform, status, data: platformData }) => {
    if (status === 'done' && platformData) {
      setData(prev => {
        if (!prev) return prev;
        const updated = (prev.platforms || []).filter(p => p.platform !== platform);
        return { ...prev, platforms: [...updated, platformData] };
      });
    }
  });

  socket.on('ads:sync:complete', () => {
    setSyncing(false);
  });

  return () => {
    socket.emit('leave:company', companyId);
    socket.disconnect();
  };
}, [user?.company_id, viewingCompanyId]);
```

Key changes:
- `const companyId = viewingCompanyId ?? user?.company_id;` — uses the viewing context for superadmin, falls back to JWT company_id for regular users
- Guard changed from `if (!user?.company_id)` to `if (!companyId)`
- Both `join:company` and `leave:company` use `companyId`
- Dependency array includes both `user?.company_id` and `viewingCompanyId`

- [ ] **Step 4: Verify no other references to `user.company_id` for socket scoping**

```bash
grep -n "company_id" /Users/a39326/Documents/Aakash/frontend/src/pages/AdsDashboard.jsx
```

Confirm the only remaining `company_id` references are inside the updated effect or unrelated to socket room management.

- [ ] **Step 5: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/AdsDashboard.jsx
git commit -m "fix(ads): use viewingCompanyId for socket room — superadmin support"
```

---

## Task 4: Remove internal guard from `Users.jsx`

**Files:**
- Modify: `frontend/src/pages/Users.jsx:143-151`

The `Users` component has an early-return guard that shows "Select a company from the header". Once `RequireCompany` is wired into the router, this guard is redundant — `Users` will never render without a company context.

Also: the `load` callback has its own early-return (`if (!targetCompanyId) { setLoading(false); return; }`). Keep that one — it's a data-fetch guard, not a UI guard, and is harmless defensive code.

Current code to **remove** (lines 143–151):
```jsx
if (!targetCompanyId) {
  return (
    <div className="p-6 flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Select a company from the header to manage its users.
      </p>
    </div>
  );
}
```

- [ ] **Step 1: Delete the early-return guard**

Remove the block above from `frontend/src/pages/Users.jsx`. The `return (` for the main render starts immediately after.

- [ ] **Step 2: Verify the file structure is still valid**

```bash
grep -n "targetCompanyId" /Users/a39326/Documents/Aakash/frontend/src/pages/Users.jsx
```

Expected: lines referencing `targetCompanyId` should only be the `load` callback early-return (`if (!targetCompanyId) { setLoading(false); return; }`) and data fetch (`api.get(...?company_id=${targetCompanyId})`). The UI early-return block should be gone.

- [ ] **Step 3: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/pages/Users.jsx
git commit -m "refactor(users): remove internal no-company guard (now handled by router)"
```

---

## Task 5: Wire `RequireCompany` into the router

**Files:**
- Modify: `frontend/src/router.jsx`

This is the main wiring task. Add `CompanyScoped` wrapper function, import `RequireCompany`, and move all company-scoped routes under it.

**Routes that go INSIDE `CompanyScoped`:**
- `/sites`, `/sites/new`
- `/crawl`, `/crawl/status`, `/crawl/:jobId/live`
- `/audit` + all 22 audit sub-routes
- `/ads`
- `/tasks`, `/tasks/:id`
- `/schedules`, `/exports`
- The entire `AdminOnly` group (`/integrations`, `/system`, `/users`, `/settings`, `/errors`)

**Routes that stay OUTSIDE `CompanyScoped`:**
- `/admin`, `/developer`, `/seo` — dashboards, cross-company for superadmin
- `/notifications` — stub with no company-scoped data
- The `SuperAdminOnly` group (`/companies`, `/audit-log`) — superadmin operates without a company here by definition

- [ ] **Step 1: Add the `RequireCompany` import**

At the top of `frontend/src/router.jsx`, add alongside the other component imports:

```js
import { RequireCompany } from './components/RequireCompany.jsx';
```

- [ ] **Step 2: Add the `CompanyScoped` wrapper function**

Add this function after `SuperAdminOnly` (around line 67):

```jsx
/* Company-scoped wrapper — superadmin must have a company selected */
function CompanyScoped() {
  return <RequireCompany />;
}
```

- [ ] **Step 3: Rewrite the router children**

Replace the entire `children` array inside the `AuthedShell` route with the following. Read the current `router.jsx` first to make sure you have the latest imports, then replace the `children: [...]` block:

```js
children: [
  /* Dashboards — global, no company context required */
  { path: '/admin',       element: <AdminView /> },
  { path: '/developer',   element: <DeveloperView /> },
  { path: '/seo',         element: <SeoView /> },
  { path: '/notifications', element: <Notifications /> },

  /* Superadmin-only — no company context required */
  {
    element: <SuperAdminOnly />,
    children: [
      { path: '/companies',  element: <Companies /> },
      { path: '/audit-log',  element: <AuditLog /> },
    ],
  },

  /* Company-scoped — superadmin must have a company selected */
  {
    element: <CompanyScoped />,
    children: [
      /* Sites */
      { path: '/sites',     element: <Sites /> },
      { path: '/sites/new', element: <NewSiteWizard /> },

      /* Crawls */
      { path: '/crawl',               element: <CrawlStart /> },
      { path: '/crawl/status',        element: <CrawlStatus /> },
      { path: '/crawl/:jobId/live',   element: <LiveRun /> },

      /* Audit */
      { path: '/audit',                  element: <AuditHealth /> },
      { path: '/audit/issue/:id',        element: <IssueDetail /> },
      { path: '/audit/cwv',              element: <CoreWebVitals /> },
      { path: '/audit/compare',          element: <CompareView /> },
      { path: '/audit/gsc',              element: <GscOverlay /> },
      { path: '/audit/ga4',              element: <Ga4Overlay /> },

      /* Audit categories */
      { path: '/audit/indexability',      element: <AuditIndexability /> },
      { path: '/audit/title-tags',        element: <AuditTitleTags /> },
      { path: '/audit/meta-desc',         element: <AuditMetaDesc /> },
      { path: '/audit/headings',          element: <AuditHeadings /> },
      { path: '/audit/canonicals',        element: <AuditCanonicals /> },
      { path: '/audit/hreflang',          element: <AuditHreflang /> },
      { path: '/audit/images',            element: <AuditImages /> },
      { path: '/audit/links',             element: <AuditLinks /> },
      { path: '/audit/redirects',         element: <AuditRedirects /> },
      { path: '/audit/response-codes',    element: <AuditResponseCodes /> },
      { path: '/audit/page-speed',        element: <AuditPageSpeed /> },
      { path: '/audit/structured-data',   element: <AuditStructuredData /> },
      { path: '/audit/security',          element: <AuditSecurity /> },
      { path: '/audit/mobile',            element: <AuditMobile /> },
      { path: '/audit/crawl-depth',       element: <AuditCrawlDepth /> },
      { path: '/audit/sitemap',           element: <AuditSitemap /> },
      { path: '/audit/robots',            element: <AuditRobots /> },
      { path: '/audit/international',     element: <AuditInternational /> },
      { path: '/audit/content',           element: <AuditContent /> },
      { path: '/audit/custom',            element: <AuditCustom /> },
      { path: '/audit/custom-extraction', element: <AuditCustomExtraction /> },
      { path: '/audit/log-file',          element: <AuditLogFile /> },

      /* Paid Ads */
      { path: '/ads', element: <AdsDashboard /> },

      /* Tasks */
      { path: '/tasks',     element: <Tasks /> },
      { path: '/tasks/:id', element: <TaskDetail /> },

      /* Platform */
      { path: '/schedules', element: <ScheduledCrawls /> },
      { path: '/exports',   element: <Exports /> },

      /* System — admin-only, still company-scoped */
      {
        element: <AdminOnly />,
        children: [
          { path: '/integrations', element: <Integrations /> },
          { path: '/system',       element: <SystemHealth /> },
          { path: '/users',        element: <Users /> },
          { path: '/settings',     element: <Settings /> },
          { path: '/errors',       element: <ErrorLog /> },
        ],
      },
    ],
  },
],
```

- [ ] **Step 4: Start the dev server and check for errors**

```bash
cd /Users/a39326/Documents/Aakash && npm run dev
```

Open `http://localhost:5173` — no console errors, no blank screens.

- [ ] **Step 5: Smoke test as regular admin**

Log in as `aakash.srivastava@cars24.com`. Navigate to `/sites` — sites list loads normally. Navigate to `/users` — users list loads normally. Navigate to `/companies` — companies page loads (superadmin-only, redirect expected for admin). Confirm no regressions.

- [ ] **Step 6: Smoke test as superadmin without a company selected**

While logged in as superadmin, clear `viewingCompany` from localStorage:

```js
// In browser console:
localStorage.removeItem('viewingCompany');
location.reload();
```

Navigate to `/sites` → should see `NoCompanySelected` prompt with "Go to Companies" button.
Navigate to `/admin` → should load normally (outside `CompanyScoped`).
Navigate to `/companies` → should load normally.

- [ ] **Step 7: Smoke test as superadmin with a company selected**

Select a company via the header switcher. Navigate to `/sites` → sites list for that company loads. Click "New Site" → wizard renders. Complete the form and submit → site is created under the selected company (check the network tab: POST body should include `company_id`). Navigate to `/users` → user list loads without "no company" prompt.

- [ ] **Step 8: Commit**

```bash
cd /Users/a39326/Documents/Aakash
git add frontend/src/router.jsx
git commit -m "feat(router): group company-scoped routes under RequireCompany guard"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| `RequireCompany` component — blocks superadmin without company, no-op for others | Task 1 |
| `SitesContext.createSite` injects `company_id` for superadmin | Task 2 |
| `AdsDashboard` uses `viewingCompanyId` for Socket.io | Task 3 |
| `Users.jsx` internal guard removed | Task 4 |
| All company-scoped routes grouped under `CompanyScoped` | Task 5 |
| Dashboards, `/notifications`, `/companies`, `/audit-log` stay outside | Task 5 |
| `AdminOnly` group nested inside `CompanyScoped` | Task 5 |

### Placeholder scan

No TBDs, no "add appropriate X", no incomplete steps. All code blocks are complete.

### Naming consistency

- `RequireCompany` — used as export name in Task 1, import in Task 5 ✅
- `CompanyScoped` — wrapper function name, used only in Task 5 ✅
- `viewingCompanyId` — destructured from `useAuth()` in Tasks 2, 3; matches `AuthContext.jsx` export ✅
- `companyId` local variable in Task 3 — only used within that effect's closure, no conflict ✅
