# Audit Checks Upgrade (291 Checks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 204-check flat seed with a 291-check registry sourced from `AI Soft - Rule - Sheet4.csv`, adding `subsection`, `implementation_rule`, and `automation_type` columns to `audit_checks`, and keeping all dependent code consistent.

**Architecture:** Additive DB migration (3 new columns, no drops) → seed file full replacement → one parser string fix → frontend route map expansion. No crawl logic changes. New checks are catalog-only. Old `audit_results` rows are left as-is.

**Tech Stack:** Node.js 20+, better-sqlite3 (synchronous), Vitest for tests, Express backend, React 18 frontend.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `PRD.md` | Modify | Update check count, schema table, category list |
| `README.md` | Modify | Update check count, DB section, category list |
| `backend/db/migrations/010_audit_checks_v2.js` | Create | Add 3 columns to `audit_checks` |
| `backend/db/seed/audit-checks.js` | Rewrite | 291-check `AUDIT_CHECKS` array + updated `seedAuditChecks()` |
| `backend/services/audit-parser.service.js` | Modify | Fix one section string: `'Structured Data'` → `'Schema / Structured Data'` |
| `frontend/src/pages/AuditHealth.jsx` | Modify | Expand `CATEGORY_ROUTES` for 19 categories |
| `backend/__tests__/audit-checks-seed.test.js` | Create | Verify seed produces 291 rows with correct columns |

---

## Severity Mapping (CSV Priority → seed `severity_default`)

| CSV Priority | `severity_default` |
|---|---|
| Critical | `critical` |
| High | `warning` |
| Medium | `warning` |
| Low | `info` |

## Automation Mapping (CSV → seed fields)

| CSV Value | `automation_type` | `is_automated` |
|---|---|---|
| Automated | `'automated'` | `1` |
| Manual | `'manual'` | `0` |
| Hybrid | `'hybrid'` | `0` |

---

## Task 1: Update PRD.md and README.md

**Files:**
- Modify: `PRD.md`
- Modify: `README.md`

- [ ] **Step 1: Update PRD.md product overview (line 32)**

Change:
```
runs 204 custom SEO checks
```
to:
```
runs 291 custom SEO checks across 19 categories
```

- [ ] **Step 2: Update PRD.md audit_checks schema table**

Find the `audit_checks` table section (around line 347). Replace the columns table with:

```markdown
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `check_number` | INTEGER UNIQUE | 1–291 |
| `name` | TEXT | Unique check name (from CSV Issue column) |
| `category` | TEXT | Top-level section, Title Case (19 categories) |
| `subsection` | TEXT | Second-level grouping (e.g. "HTTP Status Codes") |
| `description` | TEXT | Human-readable explanation |
| `implementation_rule` | TEXT | Pseudocode detection logic from CSV |
| `automation_type` | TEXT | `'automated'` \| `'manual'` \| `'hybrid'` |
| `is_automated` | INTEGER | `1` = automated, `0` = manual or hybrid (legacy compat) |
| `severity_default` | TEXT | `'critical'` \| `'warning'` \| `'info'` |
| `created_at` | TIMESTAMP | Auto |
```

- [ ] **Step 3: Update PRD.md category list**

Replace any reference to the old category list with:

```markdown
**19 categories (291 checks total):**
Response Codes · Canonical · Robots / Indexability · Sitemap · URL Structure ·
Title Tags · Meta Description · Headings · Internal Linking · Images ·
Schema / Structured Data · Content · Speed & Performance · Mobile SEO ·
JavaScript Rendering · International SEO · Rankings & Traffic Drops ·
Monitoring & Operations · LLM / AI Crawlers
```

- [ ] **Step 4: Update README.md — replace all occurrences of "204" with "291"**

Lines to update (grep first to find all):
```bash
grep -n '204' README.md
```

Change each occurrence of `204 audit checks` / `204 SEO checks` / `1–204` to the 291 equivalent.

- [ ] **Step 5: Commit**

```bash
git add PRD.md README.md
git commit -m "docs: update PRD and README for 291-check audit registry upgrade"
```

---

## Task 2: Write Migration 010

**Files:**
- Create: `backend/db/migrations/010_audit_checks_v2.js`

- [ ] **Step 1: Create the migration file**

```js
/**
 * Migration 010 — Audit Checks v2
 *
 * Adds three columns to audit_checks to support the 291-check CSV-sourced registry:
 *   subsection         — second-level grouping within a category
 *   implementation_rule — pseudocode detection logic from the CSV rule sheet
 *   automation_type    — 'automated' | 'manual' | 'hybrid'
 *
 * is_automated (INTEGER) is kept for backward compatibility.
 * ALTER TABLE in SQLite ignores IF NOT EXISTS, so this migration is safe to
 * run only once — the migration runner (run.js) guards against re-runs.
 */

export function up(db) {
  db.prepare('ALTER TABLE audit_checks ADD COLUMN subsection TEXT').run();
  db.prepare('ALTER TABLE audit_checks ADD COLUMN implementation_rule TEXT').run();
  db.prepare("ALTER TABLE audit_checks ADD COLUMN automation_type TEXT DEFAULT 'automated'").run();
}
```

- [ ] **Step 2: Verify migration runs (check columns exist)**

```bash
cd backend && node --input-type=module <<'EOF'
import db from './db/sqlite.js';
const cols = db.prepare('PRAGMA table_info(audit_checks)').all().map(c => c.name);
const needed = ['subsection','implementation_rule','automation_type'];
const ok = needed.every(c => cols.includes(c));
console.log(ok ? 'PASS — all 3 columns present' : 'FAIL — ' + needed.filter(c => !cols.includes(c)));
EOF
```

Expected: `PASS — all 3 columns present`

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/010_audit_checks_v2.js
git commit -m "feat: add subsection, implementation_rule, automation_type to audit_checks"
```

---

## Task 3: Write the Seed Test First (TDD)

**Files:**
- Create: `backend/__tests__/audit-checks-seed.test.js`

- [ ] **Step 1: Create the test file**

```js
/**
 * Audit checks seed tests.
 * Verifies the seed produces exactly 291 rows with correct schema.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { AUDIT_CHECKS, seedAuditChecks } from '../db/seed/audit-checks.js';

let db;

beforeAll(() => {
  db = new BetterSqlite3(':memory:');
  db.prepare(`
    CREATE TABLE audit_checks (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      check_number      INTEGER NOT NULL UNIQUE,
      name              TEXT NOT NULL,
      category          TEXT NOT NULL,
      subsection        TEXT,
      description       TEXT,
      implementation_rule TEXT,
      logic_summary     TEXT,
      seo_impact        TEXT,
      tool_source       TEXT    DEFAULT 'screaming-frog',
      severity_default  TEXT    DEFAULT 'warning',
      is_automated      INTEGER DEFAULT 1,
      automation_type   TEXT    DEFAULT 'automated',
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  seedAuditChecks(db);
});

describe('AUDIT_CHECKS array', () => {
  it('exports exactly 291 checks', () => {
    expect(AUDIT_CHECKS).toHaveLength(291);
  });

  it('has no duplicate check_numbers', () => {
    const nums = AUDIT_CHECKS.map(c => c.check_number);
    expect(new Set(nums).size).toBe(291);
  });

  it('has no duplicate names', () => {
    const names = AUDIT_CHECKS.map(c => c.name);
    expect(new Set(names).size).toBe(291);
  });

  it('every check has required fields', () => {
    for (const c of AUDIT_CHECKS) {
      expect(c.check_number,     `check_number missing on: ${c.name}`).toBeTruthy();
      expect(c.name,             `name missing on check ${c.check_number}`).toBeTruthy();
      expect(c.category,         `category missing on: ${c.name}`).toBeTruthy();
      expect(c.subsection,       `subsection missing on: ${c.name}`).toBeTruthy();
      expect(c.severity_default, `severity_default missing on: ${c.name}`).toBeTruthy();
      expect(c.automation_type,  `automation_type missing on: ${c.name}`).toBeTruthy();
    }
  });

  it('every severity_default is one of: critical, warning, info', () => {
    const valid = new Set(['critical', 'warning', 'info']);
    for (const c of AUDIT_CHECKS) {
      expect(valid.has(c.severity_default), `invalid severity "${c.severity_default}" on: ${c.name}`).toBe(true);
    }
  });

  it('every automation_type is one of: automated, manual, hybrid', () => {
    const valid = new Set(['automated', 'manual', 'hybrid']);
    for (const c of AUDIT_CHECKS) {
      expect(valid.has(c.automation_type), `invalid automation_type "${c.automation_type}" on: ${c.name}`).toBe(true);
    }
  });

  it('covers all 19 expected categories', () => {
    const expected = [
      'Response Codes', 'Canonical', 'Robots / Indexability', 'Sitemap',
      'URL Structure', 'Title Tags', 'Meta Description', 'Headings',
      'Internal Linking', 'Images', 'Schema / Structured Data', 'Content',
      'Speed & Performance', 'Mobile SEO', 'JavaScript Rendering',
      'International SEO', 'Rankings & Traffic Drops',
      'Monitoring & Operations', 'LLM / AI Crawlers',
    ];
    const actual = new Set(AUDIT_CHECKS.map(c => c.category));
    for (const cat of expected) {
      expect(actual.has(cat), `missing category: ${cat}`).toBe(true);
    }
    expect(actual.size).toBe(19);
  });
});

describe('seedAuditChecks()', () => {
  it('inserts exactly 291 rows into the DB', () => {
    const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM audit_checks').get();
    expect(cnt).toBe(291);
  });

  it('stores subsection on every row', () => {
    const { cnt } = db.prepare(
      "SELECT COUNT(*) AS cnt FROM audit_checks WHERE subsection IS NULL OR subsection = ''"
    ).get();
    expect(cnt).toBe(0);
  });

  it('stores automation_type on every row', () => {
    const { cnt } = db.prepare(
      "SELECT COUNT(*) AS cnt FROM audit_checks WHERE automation_type IS NULL OR automation_type = ''"
    ).get();
    expect(cnt).toBe(0);
  });

  it('is idempotent — calling again returns 0 new inserts', () => {
    const second = seedAuditChecks(db);
    expect(second).toBe(0);
    const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM audit_checks').get();
    expect(cnt).toBe(291);
  });
});
```

- [ ] **Step 2: Run test and confirm it fails (expected at this stage)**

```bash
cd backend && npm test -- __tests__/audit-checks-seed.test.js
```

Expected: Fails because `AUDIT_CHECKS` still has 204 entries and is missing new fields.

---

## Task 4: Rewrite the Seed File

**Files:**
- Rewrite: `backend/db/seed/audit-checks.js`

The file has two parts. Write them in order.

- [ ] **Step 1: Write the new `AUDIT_CHECKS` array (291 entries)**

Each entry follows this exact shape:

```js
{
  check_number:        <integer 1–291>,
  name:                '<Issue column from CSV verbatim>',
  category:            '<Section column, Title Case>',
  subsection:          '<Subsection column, Title Case>',
  description:         '<Description column from CSV verbatim>',
  implementation_rule: '<Implementation Rule column from CSV verbatim>',
  severity_default:    '<critical|warning|info — see mapping table>',
  automation_type:     '<automated|manual|hybrid — see mapping table>',
  logic_summary:       '',
  seo_impact:          '',
}
```

Group by category. Within each category, follow CSV row order.
Check number ranges per category:

| Category | check_number range | Count |
|---|---|---|
| Response Codes | 1–30 | 30 |
| Canonical | 31–50 | 20 |
| Robots / Indexability | 51–64 | 14 |
| Sitemap | 65–74 | 10 |
| URL Structure | 75–82 | 8 |
| Title Tags | 83–88 | 6 |
| Meta Description | 89–93 | 5 |
| Headings | 94–98 | 5 |
| Internal Linking | 99–115 | 17 |
| Images | 116–130 | 15 |
| Schema / Structured Data | 131–150 | 20 |
| Content | 151–192 | 42 |
| Speed & Performance | 193–216 | 24 |
| Mobile SEO | 217–229 | 13 |
| JavaScript Rendering | 230–239 | 10 |
| International SEO | 240–246 | 7 |
| Rankings & Traffic Drops | 247–259 | 13 |
| Monitoring & Operations | 260–283 | 24 |
| LLM / AI Crawlers | 284–291 | 8 |

First 5 entries (copy these exactly as a pattern anchor):

```js
export const AUDIT_CHECKS = [
  // ── RESPONSE CODES / HTTP Status Codes (1–9) ─────────────────────────────
  {
    check_number: 1,
    name: 'All internal links return 200 status',
    category: 'Response Codes',
    subsection: 'HTTP Status Codes',
    description: 'Crawl internal URLs and flag any final status other than 200 because non-200 destinations waste crawl budget and break UX. Validate on both mobile and desktop.',
    implementation_rule: 'if status_code != 200 → flag',
    severity_default: 'critical',
    automation_type: 'automated',
    logic_summary: '',
    seo_impact: '',
  },
  {
    check_number: 2,
    name: '404 pages return proper 404 status code',
    category: 'Response Codes',
    subsection: 'HTTP Status Codes',
    description: 'Detect pages showing not-found behavior and confirm the server returns a real 404 instead of a misleading 200. Validate on both mobile and desktop.',
    implementation_rule: 'if page_shows_not_found_content AND status_code == 200 → flag (soft 404); if page_shows_not_found_content AND status_code == 404 → pass',
    severity_default: 'critical',
    automation_type: 'automated',
    logic_summary: '',
    seo_impact: '',
  },
  {
    check_number: 3,
    name: '5xx errors detected and resolved',
    category: 'Response Codes',
    subsection: 'HTTP Status Codes',
    description: 'Flag URLs returning 5xx responses because server instability can block crawling, indexing, and user access. Validate on both mobile and desktop.',
    implementation_rule: 'if status_code >= 500 AND status_code <= 599 → flag',
    severity_default: 'critical',
    automation_type: 'automated',
    logic_summary: '',
    seo_impact: '',
  },
  {
    check_number: 4,
    name: 'Soft 404s identified',
    category: 'Response Codes',
    subsection: 'HTTP Status Codes',
    description: 'Detect thin or error-pattern pages that return 200 but behave like missing pages, then review because false positives are possible. Validate on both mobile and desktop.',
    implementation_rule: 'if status_code == 200 AND (word_count < 50 OR page_title matches error_patterns[]) → warn; if status_code == 200 AND word_count < 10 → flag',
    severity_default: 'warning',
    automation_type: 'hybrid',
    logic_summary: '',
    seo_impact: '',
  },
  {
    check_number: 5,
    name: '410 status used for permanently deleted pages',
    category: 'Response Codes',
    subsection: 'HTTP Status Codes',
    description: 'Check retired URLs and flag cases where 410 may be more appropriate than 404 for faster deindexation of intentionally removed pages. Validate on both mobile and desktop.',
    implementation_rule: 'if url in permanently_deleted_urls[] AND status_code == 404 → warn (consider 410); if url in permanently_deleted_urls[] AND status_code != 410 AND status_code != 404 → flag',
    severity_default: 'warning',
    automation_type: 'hybrid',
    logic_summary: '',
    seo_impact: '',
  },
  // ... continue for all 291 checks following the same shape
  // using CSV rows in exact order within each category/subsection block
];
```

- [ ] **Step 2: Write the updated `seedAuditChecks()` function**

Append this after the `AUDIT_CHECKS` array closes:

```js
/**
 * Seeds audit_checks with the full 291-check registry.
 * Force-replaces all existing rows so upgrades from 204 → 291 work correctly.
 * Idempotent: returns 0 if DB already has exactly 291 checks.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {number} rows inserted (0 if already up to date)
 */
export function seedAuditChecks(db) {
  const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM audit_checks').get();
  if (cnt === AUDIT_CHECKS.length) return 0;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO audit_checks
      (check_number, name, category, subsection, description, implementation_rule,
       severity_default, is_automated, automation_type, logic_summary, seo_impact)
    VALUES
      (@check_number, @name, @category, @subsection, @description, @implementation_rule,
       @severity_default, @is_automated, @automation_type, @logic_summary, @seo_impact)
  `);

  const runAll = db.transaction((checks) => {
    db.prepare('DELETE FROM audit_checks').run();
    let inserted = 0;
    for (const c of checks) {
      stmt.run({
        check_number:        c.check_number,
        name:                c.name,
        category:            c.category,
        subsection:          c.subsection,
        description:         c.description         ?? '',
        implementation_rule: c.implementation_rule ?? '',
        severity_default:    c.severity_default,
        is_automated:        c.automation_type === 'automated' ? 1 : 0,
        automation_type:     c.automation_type,
        logic_summary:       c.logic_summary        ?? '',
        seo_impact:          c.seo_impact           ?? '',
      });
      inserted++;
    }
    return inserted;
  });

  return runAll(AUDIT_CHECKS);
}
```

- [ ] **Step 3: Run seed test and confirm all tests pass**

```bash
cd backend && npm test -- __tests__/audit-checks-seed.test.js
```

Expected:
```
✓ exports exactly 291 checks
✓ has no duplicate check_numbers
✓ has no duplicate names
✓ every check has required fields
✓ every severity_default is one of: critical, warning, info
✓ every automation_type is one of: automated, manual, hybrid
✓ covers all 19 expected categories
✓ inserts exactly 291 rows into the DB
✓ stores subsection on every row
✓ stores automation_type on every row
✓ is idempotent — calling again returns 0 new inserts
```

- [ ] **Step 4: Commit**

```bash
git add backend/db/seed/audit-checks.js backend/__tests__/audit-checks-seed.test.js
git commit -m "feat: expand audit check registry to 291 checks across 19 categories"
```

---

## Task 5: Fix audit-parser.service.js Section String

**Files:**
- Modify: `backend/services/audit-parser.service.js`

- [ ] **Step 1: Fix the one changed section string**

In `backend/services/audit-parser.service.js`, find every occurrence of `'Structured Data'` used as a `section:` value (inside `checkStructuredData` around line 402 and `checkStructuredDataValidation` around line 430). Change all 4 occurrences:

```js
// Before:
section: 'Structured Data',

// After:
section: 'Schema / Structured Data',
```

- [ ] **Step 2: Verify only correct section strings remain**

```bash
grep -n "section: '" backend/services/audit-parser.service.js
```

Expected — exactly these 7 values, nothing else:
```
section: 'Response Codes'
section: 'Title Tags'
section: 'Meta Description'
section: 'Headings'
section: 'Canonical'
section: 'URL Structure'
section: 'Schema / Structured Data'
```

- [ ] **Step 3: Run full test suite — confirm no regressions**

```bash
cd backend && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/services/audit-parser.service.js
git commit -m "fix: align structured data section string to 'Schema / Structured Data'"
```

---

## Task 6: Update Frontend CATEGORY_ROUTES

**Files:**
- Modify: `frontend/src/pages/AuditHealth.jsx` (lines 28–56)

- [ ] **Step 1: Replace the `CATEGORY_ROUTES` constant entirely**

```js
const CATEGORY_ROUTES = {
  // Core technical
  'Response Codes':           '/audit/response-codes',
  'Canonical':                '/audit/canonicals',
  'Robots / Indexability':    '/audit/robots',
  'Sitemap':                  '/audit/sitemap',
  'URL Structure':            '/audit/crawl-depth',

  // On-page
  'Title Tags':               '/audit/title-tags',
  'Meta Description':         '/audit/meta-desc',
  'Headings':                 '/audit/headings',
  'Internal Linking':         '/audit/links',
  'Images':                   '/audit/images',
  'Schema / Structured Data': '/audit/structured-data',
  'Content':                  '/audit/content',

  // Performance & rendering
  'Speed & Performance':      '/audit/page-speed',
  'Mobile SEO':               '/audit/mobile',
  'JavaScript Rendering':     '/audit/custom',

  // Advanced (no dedicated detail page yet)
  'International SEO':        '/audit/custom',
  'Rankings & Traffic Drops': '/audit/custom',
  'Monitoring & Operations':  '/audit/custom',
  'LLM / AI Crawlers':        '/audit/custom',
};
```

- [ ] **Step 2: Confirm stale category names are gone**

```bash
grep -n "Image Optimisation\|M-Site vs Desktop\|Page Experience\|Core Web Vitals\|Log File\|Backlink\|Indexation\|Meta Robots\|HTML Structure\|404 Errors" frontend/src/pages/AuditHealth.jsx
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AuditHealth.jsx
git commit -m "feat: update AuditHealth route map for 19-category check registry"
```

---

## Task 7: End-to-End Verification

- [ ] **Step 1: Run the full backend test suite**

```bash
cd backend && npm test
```

Expected: All tests pass, no failures.

- [ ] **Step 2: Verify check count via API**

Start server, log in, hit the endpoint:

```bash
cd backend && npm start &
sleep 3
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"aakash.srivastava@cars24.com","password":"YOUR_PASSWORD"}' \
  -c /tmp/seo-cookies.txt

curl -s http://localhost:3001/api/reports/checks/count -b /tmp/seo-cookies.txt
```

Expected:
```json
{"total":291,"seeded":true}
```

- [ ] **Step 3: Open Audit Health page in browser**

Navigate to `http://localhost:5173` → select a site → Audit Health.

Verify visually:
- Badge reads **"291 checks loaded"**
- Accordion shows **19 category rows**
- New rows present: "LLM / AI Crawlers", "Rankings & Traffic Drops", "Monitoring & Operations", "Content", "Speed & Performance", "International SEO"
- Old rows absent: "Image Optimisation", "M-Site vs Desktop", "Page Experience", "Core Web Vitals"

- [ ] **Step 4: Final cleanup commit**

```bash
git status
# Add any remaining unstaged files, then:
git add docs/
git commit -m "chore: finalize audit checks upgrade — spec and plan docs"
```
