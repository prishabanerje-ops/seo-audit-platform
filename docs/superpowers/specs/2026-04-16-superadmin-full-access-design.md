# Superadmin Full Company Access — Design Spec

## Goal

When a superadmin has a company actively selected (via the company switcher in the header), they must be able to perform every action a regular admin can — create sites, start crawls, view audits, manage users, configure settings, etc. Currently, superadmin's JWT has `company_id: null`, so any frontend mutation that doesn't forward `viewingCompanyId` hits a 403.

---

## Architecture

Three targeted changes, following patterns already in the codebase:

1. **`<RequireCompany>` guard** — a new route-level wrapper, mirroring `<AdminOnly>` and `<SuperAdminOnly>` in `router.jsx`. Intercepts superadmin before any company-scoped page renders; shows a "select a company" prompt if no company is selected. No-op for regular users (they always have `company_id` in their JWT).

2. **Route grouping in `router.jsx`** — all company-scoped pages move into the `<RequireCompany>` group. New pages added in the future get the guard for free by placing them in this group.

3. **`SitesContext.createSite` fix** — the only broken mutation today. Injects `company_id: viewingCompanyId` into the POST body when the caller is superadmin.

4. **`AdsDashboard` fix** — uses `user.company_id` directly from JWT for Socket.io room joining; superadmin's JWT has `company_id: null`. Fix: use `viewingCompanyId ?? user.company_id`.

5. **`Users.jsx` cleanup** — internal "Select a company from the header" guard removed; the router now owns this responsibility.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `frontend/src/components/RequireCompany.jsx` | Route-level guard — blocks superadmin from company-scoped pages until a company is selected |

### Modified files
| File | Change |
|------|--------|
| `frontend/src/router.jsx` | Add `CompanyScoped` wrapper function; group all company-scoped routes under it |
| `frontend/src/context/SitesContext.jsx` | `createSite` injects `company_id: viewingCompanyId` for superadmin |
| `frontend/src/pages/AdsDashboard.jsx` | Replace `user.company_id` with `viewingCompanyId ?? user.company_id` for Socket.io room |
| `frontend/src/pages/Users.jsx` | Remove internal "no company" early-return guard (now redundant) |

---

## Detailed Design

### RequireCompany component (`frontend/src/components/RequireCompany.jsx`)

```jsx
import { Outlet, Link } from 'react-router';
import { Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

function NoCompanySelected() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <Building2 className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
        <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          No company selected
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Select a company from the header to continue.
        </p>
        <Link to="/companies"
          className="inline-flex items-center h-8 px-4 rounded-md text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--brand)' }}>
          Go to Companies
        </Link>
      </div>
    </div>
  );
}

export function RequireCompany() {
  const { user, viewingCompanyId } = useAuth();
  if (user?.role !== 'superadmin') return <Outlet />;
  if (viewingCompanyId) return <Outlet />;
  return <NoCompanySelected />;
}
```

**Behaviour:**
- Non-superadmin: always passes through (`company_id` is in their JWT)
- Superadmin + company selected: passes through
- Superadmin + no company selected: renders `NoCompanySelected` — centered prompt with link to `/companies`

### Route grouping (`frontend/src/router.jsx`)

Add a `CompanyScoped` wrapper function alongside `AdminOnly` and `SuperAdminOnly`:

```jsx
function CompanyScoped() {
  return <RequireCompany />;
}
```

`RequireCompany` renders `<Outlet />` internally (rather than accepting children), so no wrapping is needed.

Routes inside `RequireCompany` (the `CompanyScoped` group):

```
/sites, /sites/new
/crawl, /crawl/status, /crawl/:jobId/live
/audit + all 23 audit sub-routes
/ads
/tasks, /tasks/:id
/schedules, /exports
AdminOnly group: /integrations, /system, /users, /settings, /errors
```

Routes that stay **outside** `RequireCompany` (global or superadmin-only):

```
/admin, /developer, /seo    — dashboards (cross-company for superadmin in future)
/notifications               — stub, no company-scoped data
/companies, /audit-log       — superadmin-only, no company context by definition
```

### SitesContext fix (`frontend/src/context/SitesContext.jsx`)

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

No other mutations in `SitesContext` need changes:
- `updateSite` / `deleteSite` use `site_id`; backend skips company check for superadmin ✅
- `reload` already passes `?company_id=${viewingCompanyId}` ✅

### AdsDashboard fix (`frontend/src/pages/AdsDashboard.jsx`)

Find the line that emits `join:company` using `user.company_id` and replace with:

```js
const companyId = viewingCompanyId ?? user?.company_id;
socket.emit('join:company', companyId);
```

Also update the corresponding `leave:company` emit and any other references to `user.company_id` for Socket.io scoping.

### Users.jsx cleanup (`frontend/src/pages/Users.jsx`)

Remove the early-return guard at the top of the `Users` component:

```jsx
// DELETE this block — now handled by RequireCompany at route level:
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

---

## Route Grouping Summary

| Status | Routes |
|--------|--------|
| **Outside RequireCompany** | `/admin`, `/developer`, `/seo`, `/notifications`, `/companies`, `/audit-log` |
| **Inside RequireCompany** | `/sites`, `/sites/new`, `/crawl`, `/crawl/status`, `/crawl/:jobId/live`, `/audit` + 22 sub-routes, `/ads`, `/tasks`, `/tasks/:id`, `/schedules`, `/exports`, and the `AdminOnly` group |

---

## What Does NOT Change

- Backend routes — all already handle superadmin correctly via `role === 'superadmin'` guards
- `SitesContext.reload` — already passes `?company_id=` for superadmin
- All site edit/delete/update operations — backend uses `site_id`, skips company check for superadmin
- Crawl creation — backend derives `company_id` from the site record, not from the user's JWT
- Auth middleware and JWT structure

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Superadmin navigates to `/sites/new` with no company selected | `RequireCompany` intercepts — shows prompt |
| Superadmin selects company, creates site | `createSite` injects `company_id: viewingCompanyId` → backend accepts |
| Superadmin switches company mid-session | `SitesContext.reload` re-fires (already reactive to `viewingCompanyId`) — sites update |
| Superadmin ends impersonation session | `setViewingCompany(null)` already called in `endImpersonation` — guard activates until they pick a company |
| Regular admin hits `/sites/new` | `RequireCompany` no-ops — `user.role !== 'superadmin'` |
| Superadmin navigates to `/companies` | Outside `RequireCompany` — always accessible |

---

## Testing

- Log in as superadmin, don't select a company → navigate to `/sites` → see `NoCompanySelected` prompt
- Select a company → `/sites` loads, shows sites for that company
- Click "New Site" → form submits → site created under selected company
- Switch company → sites list updates to new company's sites
- Log in as regular admin → `/sites/new` works without any guard prompts
- Superadmin navigates to `/companies` (outside guard) → always accessible regardless of company selection
