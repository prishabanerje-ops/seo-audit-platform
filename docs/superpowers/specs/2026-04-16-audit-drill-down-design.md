# Audit Drill-Down Design

> Phase 3 completion: audit category pages + issue detail page + per-URL AI recommendations.

**Last updated:** 2026-04-16

---

## Goal

Replace all 20 category stub pages and the `IssueDetail` stub with real, data-driven pages. The navigation flow is:

```
Audit Health (accordion)
  → Category page  (issues grouped by issue_type)
    → Issue Detail  (one URL, check definition, per-URL AI recommendation, prev/next)
```

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Category page layout | Grouped by issue_type (accordion rows), expand to see URL list |
| Issue detail unit | URL-centric — one `audit_results` row per page |
| Navigation from detail | Prev / Next within same issue_type |
| AI recommendation scope | Per URL — uses actual detected `data` (title text, length, etc.) |
| AI trigger | Hybrid: auto-show if cached, "Get AI Recommendation" button if not |
| Architecture | Single `AuditCategory.jsx` component for all 20 category routes (slug → section map) |
| Detail URL structure | `/audit/issue/:resultId?from=<slug>&issueType=<type>&pos=<n>&total=<n>` |

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/pages/AuditCategory.jsx` | Generic category page — reads route slug, maps to DB section, fetches grouped issues, renders accordion |
| `frontend/src/pages/IssueDetail.jsx` | URL-centric detail page — single result row, check definition, AI recommendation, prev/next navigation |
| `backend/routes/ai.js` | `POST /api/ai/suggest` (SSE stream + cached fast-path) and `GET /api/ai/suggest` (cache lookup) and `POST /api/ai/suggest/:id/feedback` |
| `backend/db/migrations/015_ai_suggestions_per_url.js` | Adds `result_id INTEGER UNIQUE` and `feedback INTEGER` columns to `ai_suggestions` |

### Modified files

| File | Change |
|------|--------|
| `backend/routes/reports.js` | Add `GET /:siteId/category`, `GET /:siteId/issues`, `GET /results/:resultId` |
| `backend/server.js` | Register `import aiRoutes` and `app.use('/api/ai', aiRoutes)` |
| `frontend/src/pages/stubs.jsx` | Remove 20 category stub exports + `IssueDetail` stub export |
| `frontend/src/router.jsx` | Wire all 20 category routes to `AuditCategory`, wire `/audit/issue/:resultId` to real `IssueDetail`; remove stub imports |

---

## CATEGORY_SLUG_MAP

Defined in `AuditCategory.jsx`. Maps URL slug → `audit_results.section` value.

```js
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
```

Routes `/audit/custom-extraction` and `/audit/log-file` are NOT in this map — they remain stubs (no DB data).

---

## Backend API

### 1. `GET /api/reports/:siteId/category`

Query params: `section` (required), `job_id` (optional — defaults to latest completed job).

**Response:**
```json
{
  "jobId": "uuid",
  "section": "Title Tags",
  "groups": [
    { "issue_type": "Title Too Long (over 60 chars)", "severity": "warning",  "count": 47 },
    { "issue_type": "Duplicate Title Tag",            "severity": "warning",  "count": 12 },
    { "issue_type": "Missing Title Tag",              "severity": "critical", "count": 3  }
  ]
}
```

SQL:
```sql
SELECT issue_type, severity, COUNT(*) AS count
FROM audit_results
WHERE crawl_job_id = ? AND section = ?
GROUP BY issue_type, severity
ORDER BY
  CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  count DESC
```

Returns `{ jobId: null, section, groups: [] }` if no completed job exists.

Access control: verify `sites.company_id = req.user.company_id` (superadmin bypass).

---

### 2. `GET /api/reports/:siteId/issues`

Query params: `section` (required), `issue_type` (required), `job_id` (optional), `limit` (default 50, max 200), `offset` (default 0).

**Response:**
```json
{
  "results": [
    { "id": 131817, "url": "https://bikes24.com/", "severity": "warning", "data": "{\"title\":\"...\",\"length\":63}" }
  ],
  "total": 47,
  "limit": 50,
  "offset": 0
}
```

SQL:
```sql
SELECT id, url, severity, data
FROM audit_results
WHERE crawl_job_id = ? AND section = ? AND issue_type = ?
ORDER BY url
LIMIT ? OFFSET ?
```

---

### 3. `GET /api/reports/results/:resultId`

Returns a single `audit_results` row joined with the matching `audit_checks` record.

**Match logic:** `audit_checks.name = audit_results.issue_type` (exact string match).

**Response:**
```json
{
  "result": {
    "id": 131817,
    "url": "https://bikes24.com/",
    "issue_type": "Title Too Long (over 60 chars)",
    "section": "Title Tags",
    "severity": "warning",
    "data": "{\"title\":\"...\",\"length\":63}"
  },
  "check": {
    "id": 5,
    "name": "Title Too Long (over 60 chars)",
    "description": "...",
    "seo_impact": "...",
    "implementation_rule": "...",
    "subsection": "Length"
  }
}
```

If no matching `audit_checks` row exists (unrecognised issue_type), `check` is `null` — the frontend renders the result without a check definition panel.

Access control: verify `audit_results.company_id = req.user.company_id` (superadmin bypass).

---

### 4. `POST /api/ai/suggest`

Rate-limited: 10 req/min per IP.

Request body: `{ result_id: 131817 }`

**Fast path (cached):** If `ai_suggestions` has a row with `result_id = ?`, return immediately:
```json
{ "cached": true, "id": "uuid", "suggestion": "..." }
```
No SSE, no Claude call.

**Stream path (not cached):**
1. Fetch `audit_results` row by `result_id`. 404 if missing, 403 if wrong company.
2. Fetch matching `audit_checks` row (by `name = issue_type`). Proceed even if null — prompt degrades gracefully.
3. Resolve Anthropic API key: `process.env.ANTHROPIC_API_KEY` → fallback `settings` table key `anthropic_api_key`.
4. If no key found: return `503 { error: 'AI recommendations require an Anthropic API key. Configure it in Settings.' }`
5. Set `Content-Type: text/event-stream`, stream `claude-sonnet-4-6` (max 1024 tokens).
6. On stream end: INSERT into `ai_suggestions`.

**Claude prompt:**
```
You are an SEO expert reviewing a specific page issue found by an automated audit.

Issue type: {check.name}
Description: {check.description}
Why it matters: {check.seo_impact}
How to fix: {check.implementation_rule}

Affected page URL: {result.url}
Detected data: {JSON.stringify(parsedData)}

Give a concise, actionable recommendation (3–5 sentences) to fix this issue on this exact page.
Use the detected data values — do not give generic advice.
```

Where `parsedData = JSON.parse(result.data)` (catch parse errors, fall back to raw string).

**SSE event format** (same as existing streaming pattern in the codebase):
```
data: {"type":"delta","text":"The title..."}
data: {"type":"done","id":"<suggestion-id>"}
data: [DONE]
```

**INSERT on completion:**
```sql
INSERT INTO ai_suggestions
  (id, result_id, check_id, job_id, site_id, section, response_text, company_id, created_at)
VALUES (uuid, ?, ?, ?, ?, ?, ?, ?, ?)
```

---

### 5. `GET /api/ai/suggest`

Query param: `result_id`.

**Response:**
```json
{ "suggestion": "...", "id": "uuid", "feedback": null }
```
or `{ "suggestion": null }` if not cached.

---

### 6. `POST /api/ai/suggest/:id/feedback`

Body: `{ value: 1 }` (thumbs up) or `{ value: -1 }` (thumbs down).

Updates `ai_suggestions.feedback = value` for the given suggestion id.

Verify `ai_suggestions.company_id = req.user.company_id` before updating.

Response: `{ ok: true }`

---

## Migration 015

File: `backend/db/migrations/015_ai_suggestions_per_url.js`

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

Register in `backend/db/sqlite.js` as `{ id: 15, fn: migration015, name: '015_ai_suggestions_per_url' }`.

---

## Frontend: AuditCategory.jsx

**State:** `groups` (array), `expanded` (Set of issue_types), `urlMap` (Map: issue_type → { results, total, loading }), `jobId`.

**On mount:**
1. Map route slug → section name via `CATEGORY_SLUG_MAP`. If slug not in map → render "Unknown category" empty state.
2. `GET /api/reports/:siteId/category?section=...` → populate `groups` and `jobId`.

**On accordion expand (lazy):**
- If `urlMap` doesn't have results for this `issue_type` yet: `GET /api/reports/:siteId/issues?section=...&issue_type=...&limit=50`
- Show inline loading spinner while fetching
- Render URL rows with parsed `data` key-value pairs

**URL row click:** Navigate to:
```
/audit/issue/{resultId}?from={slug}&issueType={encodeURIComponent(issue_type)}&pos={index}&total={group.count}
```

**"Load more" button:** Increments offset by 50, appends results to `urlMap[issue_type].results`.

**Empty state:** "No {sectionName} issues found in the latest crawl. Run a new crawl to check again." with link to `/crawl`.

**No site selected:** Delegate to `EmptyState` component (same pattern as AuditHealth).

**No crawl:** "No completed crawl for {site.label}. Start one to see results." with link to `/crawl`.

---

## Frontend: IssueDetail.jsx

**URL params:** `resultId` from `useParams()`. Query params: `from` (slug), `issueType`, `pos` (0-indexed), `total`.

**State:** `result`, `check`, `siblingIds` (array of result IDs for same issue_type), `suggestion` (string|null), `suggestionId`, `feedback` (1|-1|null), `streaming`, `streamError`.

**On mount — three parallel fetches:**
1. `GET /api/reports/results/:resultId` → `{ result, check }`
2. `GET /api/ai/suggest?result_id=:resultId` → populate `suggestion` if cached
3. `GET /api/reports/:siteId/issues?section=...&issue_type=...&limit=200` → `siblingIds` (IDs only, for prev/next)

Sibling fetch uses `activeSite.id` + `issueType` + `section` from `result.section` (available after fetch 1 resolves). Use sequential fetch: wait for result, then fetch siblings.

**Prev / Next:** Derive sibling index from `pos` query param. Prev navigates to `siblingIds[pos-1]`, Next to `siblingIds[pos+1]`, preserving all query params with updated `pos`.

**AI button click:**
1. Set `streaming = true`
2. Open fetch to `POST /api/ai/suggest` with `result_id`
3. If response is `cached: true` (plain JSON): set `suggestion`, `streaming = false`
4. If SSE stream: read `delta` events, append to `suggestion` string as tokens arrive; on `done` event set `suggestionId`, set `streaming = false`
5. On error: set `streamError`, `streaming = false`

**Feedback buttons:** Shown only after `suggestionId` is set. `POST /api/ai/suggest/:id/feedback`. On success: set `feedback` state, disable both buttons.

**Data panel:** `JSON.parse(result.data)` rendered as a two-column key→value table. If parse fails, render raw string in a `<pre>`.

**Check panel:** Shown only if `check` is non-null. Fields: Description, SEO Impact, How to fix (`implementation_rule`). Null fields are omitted.

**Breadcrumb:** `← {CATEGORY_SLUG_MAP inverse lookup for 'from' param}` links back to `/audit/{from}`.

---

## Router changes

In `frontend/src/router.jsx`:

```js
import { AuditCategory } from './pages/AuditCategory.jsx';
import { IssueDetail }   from './pages/IssueDetail.jsx';
```

Replace all 20 individual audit category stub imports with `AuditCategory`. Replace `IssueDetail` stub import with the real component.

All 20 category route `element` values become `<AuditCategory />`. The `/audit/issue/:resultId` route element becomes `<IssueDetail />`.

Remove from stubs.jsx: all 20 `AuditXxx` exports + `IssueDetail` export.

---

## Error states

| Scenario | Behaviour |
|----------|-----------|
| Unknown slug | "Unknown category" empty state with link back to `/audit` |
| Site has no completed crawl | Empty state: "Run a crawl first" |
| `result_id` not found | "Issue not found" with back link |
| `result_id` belongs to another company | 403 → show access denied |
| No Anthropic API key | Inline notice with link to `/settings` |
| AI stream error | Inline error banner with Retry button |
| `data` field not valid JSON | Render raw string in `<pre>` block |

---

## Out of scope

- Bulk AI generation (generate for all URLs in a category at once)
- CSV export from category page
- Filtering by severity on the category page
- Sorting the URL list within an expanded accordion row
- GSC / GA4 data overlay on the issue detail page
