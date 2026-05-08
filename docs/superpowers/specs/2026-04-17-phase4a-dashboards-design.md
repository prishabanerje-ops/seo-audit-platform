# Phase 4a — Dashboards & Task Board Design

> Admin View, SEO View, Developer View, Tasks, TaskDetail with real data.

**Last updated:** 2026-04-17

---

## Goal

Replace 5 stub pages with real, data-driven implementations:
- `AdminView` (`/admin`) — cross-site GSC + GA4 summary + compact Kanban
- `SeoView` (`/seo`) — GA4 Analytics tab + GSC Issues tab
- `DeveloperView` (`/developer`) — Technical health for active site
- `Tasks` (`/tasks`) — Full 4-column Kanban with drag-and-drop
- `TaskDetail` (`/tasks/:id`) — Task detail + comments

**Phase 4b (separate):** GSC Overlay, GA4 Overlay, Core Web Vitals.

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Admin View data strategy | Single `GET /api/dashboard/admin` aggregation endpoint (not N+1 per-site calls) |
| Admin View Kanban | Read-only compact widget (up to 5 cards/column); full drag-and-drop only on `/tasks` |
| SEO View new backend? | No — uses existing `/api/gsc/:siteId/*` and `/api/ga4/:siteId/*` endpoints |
| Developer View new backend? | No — uses existing `/api/reports/:siteId/summary` and audit_results data |
| Tasks backend | New `backend/routes/tasks.js` — `/api/tasks` CRUD + status patch + comments |
| Drag-and-drop | Optimistic UI update on `PATCH /api/tasks/:id`; revert on failure |
| Role guard on Admin View | `RequireRole role="admin"` wrapper in router |
| Tenant scoping for tasks | Via `site_id → sites.company_id` join |

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/pages/AdminView.jsx` | Cross-site dashboard: sites table, task KPI row, compact Kanban |
| `frontend/src/pages/SeoView.jsx` | Two-tab page: GA4 Analytics + GSC Issues |
| `frontend/src/pages/DeveloperView.jsx` | Technical health: crawl stats, response codes, top issues, custom extraction |
| `frontend/src/pages/Tasks.jsx` | Full 4-column Kanban with filters, new task modal, drag-and-drop |
| `frontend/src/pages/TaskDetail.jsx` | Task metadata panel + comments thread |
| `backend/routes/tasks.js` | `/api/tasks` CRUD + status patch + comments |
| `backend/routes/dashboard.js` | `GET /api/dashboard/admin` cross-site aggregation |

### Modified files (backend)

| File | Change |
|------|--------|
| `frontend/src/pages/stubs.jsx` | Remove: AdminView, SeoView, DeveloperView, Tasks, TaskDetail exports |
| `frontend/src/router.jsx` | Wire real components; add `RequireRole role="admin"` on `/admin` route; import from real pages |
| `backend/routes/reports.js` | Add `GET /:siteId/developer-summary` endpoint |
| `backend/server.js` | Register `import tasksRoutes` + `app.use('/api/tasks', tasksRoutes)` and `import dashboardRoutes` + `app.use('/api/dashboard', dashboardRoutes)` |

---

## Backend API

### 1. `GET /api/dashboard/admin`

Admin-only (`requireRole('admin')`). Returns aggregated cross-site summary in one query.

**Response:**
```json
{
  "sites": [
    {
      "id": "site-uuid",
      "label": "bikes24.com",
      "color": "#3b82f6",
      "url": "https://bikes24.com",
      "gsc": {
        "clicks": 1200,
        "impressions": 45000,
        "ctr": 0.027,
        "position": 18.4,
        "clicks_delta": 120,
        "impressions_delta": -500
      },
      "ga4": {
        "sessions": 8400,
        "bounce_rate": 0.42,
        "avg_duration": 134
      },
      "health_score": 74,
      "last_crawl": "2026-04-16T10:23:00Z"
    }
  ],
  "task_summary": {
    "backlog": 12,
    "in_progress": 4,
    "review": 2,
    "done": 28
  }
}
```

**SQL approach:**
1. Fetch all sites for `company_id`.
2. For each site, LEFT JOIN `gsc_cache` WHERE `period='current'` and `period='previous'` to compute deltas.
3. LEFT JOIN `ga4_cache` for sessions/bounce/duration.
4. LEFT JOIN latest completed `crawl_jobs` for `health_score` and `last_crawl`.
5. Separate COUNT query on `task_status` grouped by status for `task_summary`.

Superadmin bypass: return all companies' sites.

**Null handling:** If `gsc` or `ga4` data doesn't exist for a site, return `null` for that object — frontend renders a "Connect GSC" / "Connect GA4" inline notice.

---

### 2. `GET /api/tasks`

Query params: `siteId` (optional), `status` (optional), `assigneeId` (optional).

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Fix missing title tags",
      "description": "...",
      "status": "backlog",
      "priority": "high",
      "due_date": "2026-04-30",
      "site_id": "site-uuid",
      "site_label": "bikes24.com",
      "site_color": "#3b82f6",
      "assignee_id": "user-uuid",
      "assignee_name": "Aakash Srivastava",
      "assignee_email": "aakash@cars24.com",
      "linear_url": "https://linear.app/...",
      "created_at": "2026-04-15T09:00:00Z"
    }
  ],
  "kanban": {
    "backlog": [...],
    "in_progress": [...],
    "review": [...],
    "done": [...]
  }
}
```

SQL:
```sql
SELECT t.*,
  u.name AS assignee_name, u.email AS assignee_email,
  s.label AS site_label, s.color AS site_color
FROM task_status t
LEFT JOIN users u ON t.assignee_id = u.id
LEFT JOIN sites s ON t.site_id = s.id
WHERE t.company_id = ?
  [AND t.site_id = ?]
  [AND t.status = ?]
  [AND t.assignee_id = ?]
ORDER BY t.created_at DESC
```

Group into kanban object in JS after fetch.

---

### 3. `POST /api/tasks`

Body: `{ site_id, title, description, priority, assignee_id, due_date }`.

Validates: `site_id` required, `title` required, `priority` one of `low|medium|high|critical`.
Sets `status = 'backlog'`, `company_id = req.user.company_id`, `created_by = req.user.sub`.

Response: `{ task: { ...newTask } }` with 201.

---

### 4. `PATCH /api/tasks/:id`

Body: `{ status }` (for drag-and-drop) or any subset of editable fields.

Validates: task belongs to `req.user.company_id`. Validates `status` if provided.

Response: `{ task: { ...updatedTask } }`

---

### 5. `GET /api/tasks/:id`

Returns single task with comments:
```json
{
  "task": { ...taskFields },
  "comments": [
    { "id": "...", "body": "...", "created_at": "...", "user_name": "Aakash", "user_email": "..." }
  ]
}
```

---

### 6. `POST /api/tasks/:id/comments`

Body: `{ body }`. Validates body non-empty.

Inserts into `task_comments`. Returns `{ comment: { id, body, created_at, user_name, user_email } }`.

---

## Frontend: AdminView.jsx

**Role guard:** `/admin` route wrapped in `<RequireRole role="admin">` in router. Non-admins see access denied.

**State:** `sites` (array), `taskSummary` (object), `loading`, `error`.

**On mount:** `GET /api/dashboard/admin` → populate `sites` and `taskSummary`.

**Layout (3 sections, top to bottom):**

### Section 1 — Sites Table

Columns: Site (label + colour dot + URL) · Health Score (HealthRing mini) · Clicks · Impressions · CTR · Position · Sessions · Bounce Rate · Last Crawl.

- GSC delta values shown as small coloured badges: `+120` (green) / `-500` (red) next to the raw value.
- If `site.gsc === null`: show "Connect GSC" link in GSC columns.
- If `site.ga4 === null`: show "Connect GA4" link in GA4 columns.
- Clicking a row: set `activeSite` to that site, navigate to `/audit`.

### Section 2 — Task KPI Row

4 stat cards: Backlog · In Progress · Review · Done. Each shows count from `taskSummary`. Clicking navigates to `/tasks?status=<status>`.

### Section 3 — Compact Kanban

4 columns. Each column: header with status label + count, up to 5 task cards, "View all →" link to `/tasks`.

Card contents: title (truncated to 1 line), site colour chip + label, priority badge, assignee name.

**Empty state:** If no sites have data, show "Add your first site" CTA. If no tasks, show "No tasks yet — create one in the task board" with link.

---

## Frontend: SeoView.jsx

**State:** `activeTab` ('analytics' | 'issues'), `ga4Pages` (array), `ga4Loading`, `gscQueries` (array), `gscPages` (array), `gscLoading`.

Active site scoped. If no `activeSite`: show EmptyState "Select a site".

**Tab bar:** Analytics · Issues

### Analytics tab

On tab activate (lazy): `GET /api/ga4/:siteId/pages` → `ga4Pages`.

Table columns: URL · Sessions · Bounce Rate · Avg Duration. Sortable. 50 rows, load more button.

If GA4 not connected: inline notice with link to `/settings`.

### Issues tab

On tab activate (lazy): parallel fetch:
- `GET /api/gsc/:siteId/queries` → `gscQueries`
- `GET /api/gsc/:siteId/summary` → extract top pages data → `gscPages`

**Audit summary card:** HealthRing (mini) + Critical/Warning/Info counts + "View full audit →" link to `/audit`. Reads from existing context or `GET /api/reports/:siteId/summary`.

**"Top GSC Queries" collapsible section:**
Table: Query · Clicks · Impressions · CTR · Position. Collapsed by default. Toggle to expand.

**"Top Pages by Clicks" collapsible section:**
Table: URL · Clicks · Impressions · CTR. Collapsed by default.

If GSC not connected: inline notice with link to `/settings`.

---

## Frontend: DeveloperView.jsx

**State:** `summary` (from reports API), `loading`, `error`.

Active site scoped. If no `activeSite`: EmptyState "Select a site".

**On mount:** `GET /api/reports/:siteId/summary` → populate all sections.

**Layout (4 cards):**

### Card 1 — Crawl Health

Stats row: Total URLs · Errors · JS-Rendered URLs · Duration · Avg Response Time.

Data source: `summary.job` (latest crawl job metadata). If no crawl: "Run a crawl first" empty state.

### Card 2 — Response Code Breakdown

Horizontal bar chart (Recharts BarChart): 2xx (green) / 3xx (amber) / 4xx (red) / 5xx (red-dark).

Data source: `summary.sections` filtered for `section = 'Response Codes'` issue counts grouped by HTTP status range. If no data: "No response code data" empty state.

### Card 3 — Top Issues by Severity

Table: Issue Type · Severity badge · Count · Category link.

Top 10 rows ordered: critical first, then warning, then info. Each row links to the relevant `/audit/:slug`.

Data source: `summary.topIssues` or similar aggregation from reports endpoint.

### Card 4 — Custom Extraction Results

Table: Label · Selector · Sample Value · Count.

Data source: `audit_results WHERE section = 'Custom Extraction'` for latest job. If empty: "No custom extractions configured — add them in Crawl Config."

**Note:** `GET /api/reports/:siteId/summary` returns health score, KPI counts, and trend data — it does NOT return response code breakdowns or top issues grouped by type. The plan must add `GET /api/reports/:siteId/developer-summary` to `backend/routes/reports.js`.

**`GET /api/reports/:siteId/developer-summary` response shape:**
```json
{
  "job": {
    "id": "uuid",
    "total_urls": 1204,
    "health_score": 74,
    "started_at": "2026-04-16T10:00:00Z",
    "completed_at": "2026-04-16T10:23:00Z",
    "duration_seconds": 1380
  },
  "response_codes": {
    "2xx": 1100, "3xx": 52, "4xx": 44, "5xx": 8
  },
  "top_issues": [
    { "issue_type": "Title Too Long", "section": "Title Tags", "severity": "warning", "count": 47, "slug": "title-tags" }
  ],
  "custom_extraction": [
    { "issue_type": "Custom: H1 Text", "url": "https://...", "data": "{\"value\":\"...\"}" }
  ]
}
```

SQL for `response_codes`: `SELECT issue_type, COUNT(*) FROM audit_results WHERE crawl_job_id = ? AND section = 'Response Codes' GROUP BY issue_type` — parse HTTP status from issue_type string.

SQL for `top_issues`: `SELECT issue_type, section, severity, COUNT(*) AS count FROM audit_results WHERE crawl_job_id = ? GROUP BY issue_type ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, count DESC LIMIT 10`.

SQL for `custom_extraction`: `SELECT issue_type, url, data FROM audit_results WHERE crawl_job_id = ? AND section = 'Custom Extraction' LIMIT 50`.

---

## Frontend: Tasks.jsx

**State:** `kanban` (object with 4 arrays), `loading`, `filters` (siteId, assigneeId, priority), `allSites` (array), `allUsers` (array), `showNewTaskModal` (bool), `dragging` (taskId | null).

**On mount:** `GET /api/tasks` (with active site filter if site selected) → `kanban`.

**"All Sites" toggle:** When active site is set, shows "This site / All sites" toggle. Toggling re-fetches without siteId.

**Filter bar:** Site dropdown · Assignee dropdown · Priority dropdown. Each change re-fetches with updated params.

**Drag-and-drop:**
- `draggable` attribute on cards, `onDragStart` / `onDrop` / `onDragOver` on columns.
- On drop: immediately update `kanban` state (optimistic), then `PATCH /api/tasks/:id { status }`.
- On PATCH failure: revert `kanban` state, show error toast.
- No external DnD library — native HTML5 drag-and-drop.

**"+ New Task" button:** Opens modal with fields: Title (required) · Site (required dropdown) · Description (textarea) · Priority (select: low/medium/high/critical) · Assignee (user dropdown) · Due Date.
On submit: `POST /api/tasks` → on success close modal, prepend new card to `kanban.backlog`.

**Card contents:**
- Title (1-line truncated)
- Site colour chip + label
- Priority badge (colour-coded: critical=red, high=orange, medium=amber, low=slate)
- Assignee name (if set)
- Due date (if set, red if past due)
- Linear icon link if `linear_url` set

**Click card:** Navigate to `/tasks/:id`.

**Empty state per column:** "Nothing here" with no CTA (user creates tasks via the "+ New Task" button).

---

## Frontend: TaskDetail.jsx

**URL params:** `id` from `useParams()`.

**State:** `task`, `comments` (array), `newComment` (string), `submitting`, `saving`.

**On mount:** `GET /api/tasks/:id` → `task` + `comments`.

**Layout — two panels:**

### Left panel — Task metadata

- Title (editable inline — click to edit, blur to save via `PATCH /api/tasks/:id`)
- Status dropdown → `PATCH /api/tasks/:id { status }` on change
- Priority dropdown → `PATCH` on change
- Assignee display (read-only in this phase)
- Site chip (read-only)
- Due date display
- Linear URL — if set, show "View in Linear →" external link
- Created by + created at

### Right panel — Comments

Chronological list of comments: avatar (initials fallback) · author name · timestamp · body.

Textarea at bottom + "Post Comment" button → `POST /api/tasks/:id/comments` → append to `comments` array.

**Breadcrumb:** `← Tasks` links back to `/tasks`.

**Empty state:** If `task` not found (404): "Task not found" with back link.

---

## Router Changes

In `frontend/src/router.jsx`:

```js
import { AdminView }     from './pages/AdminView.jsx';
import { SeoView }       from './pages/SeoView.jsx';
import { DeveloperView } from './pages/DeveloperView.jsx';
import { Tasks }         from './pages/Tasks.jsx';
import { TaskDetail }    from './pages/TaskDetail.jsx';
```

- `/admin` route: wrap element in `<RequireRole role="admin"><AdminView /></RequireRole>`
- `/seo` route: `element: <SeoView />`
- `/developer` route: `element: <DeveloperView />`
- `/tasks` route: `element: <Tasks />`
- `/tasks/:id` route: `element: <TaskDetail />`

Remove from `stubs.jsx`: `AdminView`, `SeoView`, `DeveloperView`, `Tasks`, `TaskDetail` exports.

---

## Error States

| Scenario | Behaviour |
|----------|-----------|
| Non-admin visits `/admin` | RequireRole shows access denied |
| No sites in company | Admin View: "Add your first site" empty state |
| GSC not connected for a site | Admin View: inline "Connect GSC" in table row; SEO View: inline notice |
| GA4 not connected | Same pattern as GSC |
| No completed crawl | Developer View: "Run a crawl first" per section |
| Task drag PATCH fails | Revert optimistic update, toast error |
| No tasks exist | Kanban: empty columns, "Create your first task" CTA |
| Task not found (404) | TaskDetail: "Task not found" with back link |
| Comment body empty | Inline validation, button disabled |

---

## Out of Scope (Phase 4a)

- Linear ticket creation from tasks (DB field exists, UI to create tickets not built)
- Task due date notifications / email reminders
- Bulk task operations (bulk status change, bulk delete)
- Task attachment uploads
- Assignee management from TaskDetail (read-only in this phase)
- GSC/GA4 date range picker (fixed current/previous period from cache)
- Admin View cross-company view for superadmin (out of scope)
- Developer View: CWV scores (in Phase 4b)
- Custom Extraction data endpoint (reuse reports summary; if data not in shape, add `developer-summary` endpoint in plan)
