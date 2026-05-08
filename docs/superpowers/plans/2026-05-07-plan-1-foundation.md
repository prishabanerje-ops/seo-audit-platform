# Check System Rewrite — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all new database tables, the CheckResult scoring service, and the v2 audit-checks seed so that Plans 2–5 have a stable foundation to build on.

**Architecture:** Five new SQLite tables (site_settings, schema_rules, keyword_mappings, backlink_uploads, backlinks) added via individual migration files. Two new columns added to audit_results (check_id, passed, message, details) for the CheckResult contract. The audit_checks table gains a string check_id column and is reseeded with 349 new checks generated from check-catalog.md. scoring.service.js is added with pure functions and unit tests.

**Tech Stack:** better-sqlite3 (synchronous — no async/await anywhere), Vitest (test runner), Node.js ESM (all files use `import`/`export`)

**Key constraint:** better-sqlite3 is fully synchronous. Never use `async`/`await` or `Promise` in any migration file or DB call. Use `db.prepare(sql).run()` for single statements (matches existing migration pattern in the repo).

---

## File Map

| Action | File |
|---|---|
| Create | `backend/db/migrations/024_site_settings.js` |
| Create | `backend/db/migrations/025_schema_rules.js` |
| Create | `backend/db/migrations/026_keyword_mappings.js` |
| Create | `backend/db/migrations/027_backlinks.js` |
| Create | `backend/db/migrations/028_audit_results_v2.js` |
| Create | `backend/db/migrations/029_audit_checks_v2.js` |
| Modify | `backend/db/sqlite.js` (register migrations 024–029) |
| Create | `backend/services/scoring.service.js` |
| Create | `backend/__tests__/scoring.service.test.js` |
| Modify | `scripts/generate-audit-checks-seed.js` (rewrite for v2 format) |
| Modify | `backend/db/seed/audit-checks.js` (replace with 349 new checks) |
| Modify | `backend/__tests__/audit-checks-seed.test.js` (update for new schema) |

---

## Task 1: Migration 024 — site_settings table

**Files:**
- Create: `backend/db/migrations/024_site_settings.js`

- [ ] **Step 1: Write the migration file**

Follow the same pattern as `backend/db/migrations/020_manual_check_results.js` — use `db.prepare(...).run()`, no `async`.

```js
// backend/db/migrations/024_site_settings.js
/**
 * Migration 024 — site_settings
 *
 * Generic per-site key-value store for check configuration.
 * Keys used by the check engine:
 *   trusted_authority_domains  TEXT  newline-separated domain list
 *   ymyl_url_patterns          TEXT  newline-separated path patterns
 *   ymyl_disclaimer_patterns   TEXT  newline-separated regex strings
 *   brand_name                 TEXT  site brand name (title_brand check)
 *   site_topic                 TEXT  e.g. "insurance comparison"
 *   crux_api_key               TEXT  falls back to global settings key
 */
export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id    INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      key        TEXT    NOT NULL,
      value      TEXT    NOT NULL DEFAULT '',
      updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site_id, key)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_site_settings_site ON site_settings(site_id)
  `).run();
}
```

- [ ] **Step 2: Dry-run verify the migration against an in-memory DB**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
node --input-type=module <<'EOF'
import { up } from './db/migrations/024_site_settings.js';
import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.prepare('CREATE TABLE sites (id INTEGER PRIMARY KEY)').run();
up(db);
const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_settings'").get();
console.log('site_settings OK:', result);
EOF
```

Expected: `site_settings OK: { name: 'site_settings' }`

---

## Task 2: Migration 025 — schema_rules table

**Files:**
- Create: `backend/db/migrations/025_schema_rules.js`

- [ ] **Step 1: Write the migration file**

```js
// backend/db/migrations/025_schema_rules.js
/**
 * Migration 025 — schema_rules
 *
 * Per-site URL-glob → required schema @type mapping.
 * Evaluated top-to-bottom at check time; first matching pattern wins.
 * A catch-all { pattern: '*', required_types: '["WebPage"]' } is always
 * appended by the API PUT handler if missing.
 */
export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_rules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id        INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      pattern        TEXT    NOT NULL,
      required_types TEXT    NOT NULL DEFAULT '["WebPage"]',
      sort_order     INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_schema_rules_site ON schema_rules(site_id, sort_order)
  `).run();
}
```

- [ ] **Step 2: Dry-run verify**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
node --input-type=module <<'EOF'
import { up } from './db/migrations/025_schema_rules.js';
import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.prepare('CREATE TABLE sites (id INTEGER PRIMARY KEY)').run();
up(db);
console.log('schema_rules OK:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_rules'").get());
EOF
```

Expected: `schema_rules OK: { name: 'schema_rules' }`

---

## Task 3: Migration 026 — keyword_mappings table

**Files:**
- Create: `backend/db/migrations/026_keyword_mappings.js`

- [ ] **Step 1: Write the migration file**

```js
// backend/db/migrations/026_keyword_mappings.js
/**
 * Migration 026 — keyword_mappings
 *
 * Per-site URL → primary keyword mapping. Populated via CSV upload.
 * Enables all KW-UPLOAD feasibility checks.
 * CSV format: url, primary_keyword, search_volume, secondary_keywords, is_pillar
 * Duplicate URLs: last row wins (upsert on site_id + url).
 */
export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS keyword_mappings (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id            INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      url                TEXT    NOT NULL,
      primary_keyword    TEXT    NOT NULL,
      search_volume      INTEGER,
      secondary_keywords TEXT,
      is_pillar          INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site_id, url)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_keyword_mappings_site ON keyword_mappings(site_id)
  `).run();
}
```

- [ ] **Step 2: Dry-run verify**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
node --input-type=module <<'EOF'
import { up } from './db/migrations/026_keyword_mappings.js';
import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.prepare('CREATE TABLE sites (id INTEGER PRIMARY KEY)').run();
up(db);
console.log('keyword_mappings OK:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='keyword_mappings'").get());
EOF
```

Expected: `keyword_mappings OK: { name: 'keyword_mappings' }`

---

## Task 4: Migration 027 — backlinks tables

**Files:**
- Create: `backend/db/migrations/027_backlinks.js`

- [ ] **Step 1: Write the migration file**

```js
// backend/db/migrations/027_backlinks.js
/**
 * Migration 027 — backlink_uploads + backlinks
 *
 * Stores Semrush/Ahrefs backlink export CSVs per site.
 * backlink_uploads: one row per CSV upload (for history + lost_backlinks diff).
 * backlinks: individual link rows from the upload.
 * Enables all BL-UPLOAD feasibility checks.
 * link_type values: editorial | guest_post | pr | directory | other
 */
export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS backlink_uploads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      filename    TEXT    NOT NULL,
      row_count   INTEGER NOT NULL,
      uploaded_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS backlinks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id         INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      upload_id       INTEGER NOT NULL REFERENCES backlink_uploads(id) ON DELETE CASCADE,
      source_url      TEXT    NOT NULL,
      target_url      TEXT    NOT NULL,
      anchor_text     TEXT,
      domain_rating   INTEGER,
      is_dofollow     INTEGER NOT NULL DEFAULT 1,
      first_seen_date TEXT,
      link_type       TEXT    NOT NULL DEFAULT 'other',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_backlinks_site ON backlinks(site_id, target_url)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_backlinks_upload ON backlinks(upload_id)
  `).run();
}
```

- [ ] **Step 2: Dry-run verify**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
node --input-type=module <<'EOF'
import { up } from './db/migrations/027_backlinks.js';
import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.prepare('CREATE TABLE sites (id INTEGER PRIMARY KEY)').run();
up(db);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('backlink_uploads','backlinks')").all();
console.log('backlinks tables:', tables.map(t => t.name));
EOF
```

Expected: `backlinks tables: [ 'backlink_uploads', 'backlinks' ]`

---

## Task 5: Migration 028 — audit_results v2 columns

**Files:**
- Create: `backend/db/migrations/028_audit_results_v2.js`

The live `audit_results` table (confirmed by `PRAGMA table_info`) has `issue_type` and `data` but is missing `check_id`, `passed`, `message`, `details`. These are required by the CheckResult contract. This migration adds them, preserving all existing rows.

- [ ] **Step 1: Write the migration file**

```js
// backend/db/migrations/028_audit_results_v2.js
/**
 * Migration 028 — audit_results v2
 *
 * Adds columns required by the CheckResult contract.
 * Existing rows keep their old issue_type/data values — both coexist.
 * New crawl results populate both old and new columns.
 *
 * New columns:
 *   check_id  TEXT     — string ID from check-catalog.md (e.g. 'http_status')
 *   passed    INTEGER  — 1 = passed, 0 = failed
 *   message   TEXT     — human-readable one-line result summary
 *   details   TEXT     — specific value/element that failed; NULL if passed
 */
export function up(db) {
  const cols = db.prepare('PRAGMA table_info(audit_results)').all().map(c => c.name);

  if (!cols.includes('check_id')) {
    db.prepare('ALTER TABLE audit_results ADD COLUMN check_id TEXT').run();
  }
  if (!cols.includes('passed')) {
    db.prepare('ALTER TABLE audit_results ADD COLUMN passed INTEGER').run();
  }
  if (!cols.includes('message')) {
    db.prepare('ALTER TABLE audit_results ADD COLUMN message TEXT').run();
  }
  if (!cols.includes('details')) {
    db.prepare('ALTER TABLE audit_results ADD COLUMN details TEXT').run();
  }

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_audit_results_check_id
      ON audit_results(site_id, crawl_job_id, check_id)
  `).run();
}
```

- [ ] **Step 2: Dry-run verify**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
node --input-type=module <<'EOF'
import { up } from './db/migrations/028_audit_results_v2.js';
import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.prepare(`
  CREATE TABLE audit_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crawl_job_id TEXT NOT NULL, site_id TEXT NOT NULL,
    section TEXT NOT NULL, url TEXT NOT NULL,
    data TEXT, severity TEXT NOT NULL, issue_type TEXT NOT NULL
  )
`).run();
up(db);
const cols = db.prepare('PRAGMA table_info(audit_results)').all().map(c => c.name);
console.log('new cols:', cols.filter(c => ['check_id','passed','message','details'].includes(c)));
EOF
```

Expected: `new cols: [ 'check_id', 'passed', 'message', 'details' ]`

---

## Task 6: Register migrations 024–028 in sqlite.js

**Files:**
- Modify: `backend/db/sqlite.js`

- [ ] **Step 1: Add imports after the existing migration023 import**

In `backend/db/sqlite.js`, after the line:
```js
import { up as migration023 } from './migrations/023_reset_test_credentials.js';
```

Add:
```js
import { up as migration024 } from './migrations/024_site_settings.js';
import { up as migration025 } from './migrations/025_schema_rules.js';
import { up as migration026 } from './migrations/026_keyword_mappings.js';
import { up as migration027 } from './migrations/027_backlinks.js';
import { up as migration028 } from './migrations/028_audit_results_v2.js';
```

- [ ] **Step 2: Add entries to the MIGRATIONS array**

In `backend/db/sqlite.js`, after the line:
```js
  { id: 23, fn: migration023, name: '023_reset_test_credentials' },
```

Add:
```js
  { id: 24, fn: migration024, name: '024_site_settings' },
  { id: 25, fn: migration025, name: '025_schema_rules' },
  { id: 26, fn: migration026, name: '026_keyword_mappings' },
  { id: 27, fn: migration027, name: '027_backlinks' },
  { id: 28, fn: migration028, name: '028_audit_results_v2' },
```

- [ ] **Step 3: Run migrations against the live DB**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
node db/sqlite.js
```

Expected output (only the new migrations print — earlier ones are already applied):
```
[db] Running migration: 024_site_settings
[db] Migration applied: 024_site_settings
[db] Running migration: 025_schema_rules
[db] Migration applied: 025_schema_rules
[db] Running migration: 026_keyword_mappings
[db] Migration applied: 026_keyword_mappings
[db] Running migration: 027_backlinks
[db] Migration applied: 027_backlinks
[db] Running migration: 028_audit_results_v2
[db] Migration applied: 028_audit_results_v2
[db] Migrations complete.
```

- [ ] **Step 4: Verify all 5 new tables exist in the live DB**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
sqlite3 seo-automation.db "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('site_settings','schema_rules','keyword_mappings','backlink_uploads','backlinks') ORDER BY name;"
```

Expected (5 lines):
```
backlink_uploads
backlinks
keyword_mappings
schema_rules
site_settings
```

- [ ] **Step 5: Commit**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main
git add backend/db/migrations/024_site_settings.js \
        backend/db/migrations/025_schema_rules.js \
        backend/db/migrations/026_keyword_mappings.js \
        backend/db/migrations/027_backlinks.js \
        backend/db/migrations/028_audit_results_v2.js \
        backend/db/sqlite.js
git commit -m "feat: add foundation migrations 024-028

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Scoring service

**Files:**
- Create: `backend/services/scoring.service.js`

- [ ] **Step 1: Write the service**

```js
// backend/services/scoring.service.js
/**
 * Scoring model for the check engine.
 * Deduction-based: start at 100, subtract per failed check by severity.
 * Score is floored at 0.
 *
 * @typedef {Object} CheckResult
 * @property {string}  check_id
 * @property {boolean} passed
 * @property {'critical'|'warning'|'info'} severity
 * @property {string}  section
 * @property {string}  message
 * @property {string|null} details
 */

const WEIGHTS = { critical: 25, warning: 10, info: 1 };

/**
 * @param {CheckResult[]} checkResults
 * @returns {number} integer 0–100
 */
export function computePageScore(checkResults) {
  const deductions = checkResults
    .filter(r => !r.passed)
    .reduce((sum, r) => sum + (WEIGHTS[r.severity] ?? 0), 0);
  return Math.max(0, 100 - deductions);
}

/**
 * @param {CheckResult[]} checkResults
 * @param {string} section
 * @returns {number} integer 0–100
 */
export function computeSectionScore(checkResults, section) {
  return computePageScore(checkResults.filter(r => r.section === section));
}

/**
 * @param {CheckResult[]} checkResults
 * @returns {Record<string, number>} section name → score
 */
export function computeAllSectionScores(checkResults) {
  const sections = [...new Set(checkResults.map(r => r.section))];
  return Object.fromEntries(
    sections.map(s => [s, computeSectionScore(checkResults, s)])
  );
}
```

---

## Task 8: Scoring service tests

**Files:**
- Create: `backend/__tests__/scoring.service.test.js`

- [ ] **Step 1: Write the test file**

```js
// backend/__tests__/scoring.service.test.js
import { describe, it, expect } from 'vitest';
import {
  computePageScore,
  computeSectionScore,
  computeAllSectionScores,
} from '../services/scoring.service.js';

const pass = (check_id, severity, section) => ({
  check_id, passed: true, severity, section, message: 'ok', details: null,
});
const fail = (check_id, severity, section) => ({
  check_id, passed: false, severity, section, message: 'fail', details: 'x',
});

describe('computePageScore', () => {
  it('returns 100 when all checks pass', () => {
    expect(computePageScore([
      pass('http_status', 'critical', 'S1'),
      pass('title_present', 'warning', 'S11'),
    ])).toBe(100);
  });

  it('deducts 25 per critical failure', () => {
    expect(computePageScore([fail('http_status', 'critical', 'S1')])).toBe(75);
  });

  it('deducts 10 per warning failure', () => {
    expect(computePageScore([fail('title_unique', 'warning', 'S11')])).toBe(90);
  });

  it('deducts 1 per info failure', () => {
    expect(computePageScore([fail('url_length', 'info', 'S6')])).toBe(99);
  });

  it('floors at 0 with many critical failures', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      fail(`check_${i}`, 'critical', 'S1')
    );
    expect(computePageScore(results)).toBe(0);
  });

  it('stacks deductions across severities — 25+10+1=36, score=64', () => {
    expect(computePageScore([
      fail('a', 'critical', 'S1'),
      fail('b', 'warning',  'S1'),
      fail('c', 'info',     'S1'),
    ])).toBe(64);
  });

  it('ignores unknown severity (no deduction)', () => {
    const results = [{ check_id: 'x', passed: false, severity: 'unknown', section: 'S1', message: '', details: null }];
    expect(computePageScore(results)).toBe(100);
  });

  it('returns 100 for empty array', () => {
    expect(computePageScore([])).toBe(100);
  });
});

describe('computeSectionScore', () => {
  it('scores only checks belonging to the requested section', () => {
    // S1 fails critical (-25), S2 fails critical (ignored)
    expect(computeSectionScore([
      fail('a', 'critical', 'S1'),
      fail('b', 'critical', 'S2'),
      pass('c', 'warning',  'S1'),
    ], 'S1')).toBe(75);
  });

  it('returns 100 for section with no matching results', () => {
    expect(computeSectionScore([], 'S1')).toBe(100);
  });
});

describe('computeAllSectionScores', () => {
  it('returns a score per unique section', () => {
    const results = [
      fail('a', 'critical', 'Response Codes'),
      pass('b', 'warning',  'Response Codes'),
      fail('c', 'warning',  'Title Tags'),
    ];
    const scores = computeAllSectionScores(results);
    expect(scores['Response Codes']).toBe(75);
    expect(scores['Title Tags']).toBe(90);
  });

  it('returns empty object for empty input', () => {
    expect(computeAllSectionScores([])).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
npx vitest run __tests__/scoring.service.test.js
```

Expected: all 11 tests pass. If any fail, check that `passed` in test fixtures is a boolean (`true`/`false`), not 0/1 integer.

- [ ] **Step 3: Commit**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main
git add backend/services/scoring.service.js backend/__tests__/scoring.service.test.js
git commit -m "feat: add scoring service (computePageScore, computeSectionScore, computeAllSectionScores)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Rewrite the seed generator script

**Files:**
- Modify: `scripts/generate-audit-checks-seed.js`

The current generator reads from `canonical-checks-v1.csv`. The new version reads from `check-catalog.md` and outputs the v2 format (string `check_id`, `section`, `feasibility`).

- [ ] **Step 1: Rewrite the generator**

```js
// scripts/generate-audit-checks-seed.js
/**
 * Generates backend/db/seed/audit-checks.js from docs/audit-checks/check-catalog.md.
 *
 * Run after editing the catalog:
 *   node scripts/generate-audit-checks-seed.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT         = join(__dirname, '..');
const CATALOG_PATH = join(ROOT, 'docs/audit-checks/check-catalog.md');
const OUTPUT_PATH  = join(ROOT, 'backend/db/seed/audit-checks.js');

const FEASIBILITY_MAP = {
  '✅':           'automated',
  '⚠️ GSC':       'gsc',
  '⚠️ GA4':       'ga4',
  '⚠️ PSI':       'psi',
  '⚠️ CrUX':      'crux',
  '⚠️ KW-UPLOAD': 'kw_upload',
  '⚠️ BL-UPLOAD': 'bl_upload',
  '🤖':           'ai',
  '📋':           'manual',
};

const catalog = readFileSync(CATALOG_PATH, 'utf8');
const lines   = catalog.split('\n');
const checks  = [];
let currentSection = null;
let inAiChecks     = false;

for (const line of lines) {
  // Level-2 section headers only (## Section N — Name)
  const secMatch = line.match(/^## Section \d+ — (.+)/);
  if (secMatch) {
    currentSection = secMatch[1].trim();
    inAiChecks = false;
    continue;
  }

  // AI Checks section
  if (line.startsWith('## AI Checks')) {
    currentSection = 'AI Checks';
    inAiChecks = true;
    continue;
  }

  if (!currentSection) continue;

  // Skip table header rows and separator rows
  if (line.includes('check_id') || /^\|[-\s|:]+$/.test(line.trim())) continue;

  if (!inAiChecks) {
    // Standard check row: | `check_id` | Name | feasibility | severity | ...
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*(✅|⚠️ GSC|⚠️ GA4|⚠️ PSI|⚠️ CrUX|⚠️ KW-UPLOAD|⚠️ BL-UPLOAD|🤖|📋)\s*\|\s*(critical|warning|info)\s*\|/);
    if (m) {
      checks.push({
        check_id:    m[1].trim(),
        name:        m[2].trim(),
        section:     currentSection,
        severity:    m[4].trim(),
        feasibility: FEASIBILITY_MAP[m[3].trim()] ?? 'automated',
      });
    }
  } else {
    // AI Checks table rows — 4 columns, no severity column (default info)
    // | `check_id` | Name | Input | Key Output Fields |
    const aim = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/);
    if (aim && aim[1] !== 'check_id' && aim[1] !== '---') {
      checks.push({
        check_id:    aim[1].trim(),
        name:        aim[2].trim(),
        section:     'AI Checks',
        severity:    'info',
        feasibility: 'ai',
      });
    }
  }
}

// Validate
if (checks.length < 300) {
  console.error(`ERROR: Only ${checks.length} checks parsed — expected >= 300.`);
  console.error('Check that the catalog table row format matches the regex.');
  process.exit(1);
}

const ids = checks.map(c => c.check_id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length > 0) {
  console.error('ERROR: Duplicate check_ids found:', [...new Set(dupes)]);
  process.exit(1);
}

const output = `/**
 * Audit checks seed — v2.
 * Auto-generated from docs/audit-checks/check-catalog.md
 * Regenerate: node scripts/generate-audit-checks-seed.js
 * DO NOT EDIT MANUALLY.
 *
 * ${checks.length} checks across all sections.
 */

export const AUDIT_CHECKS = ${JSON.stringify(checks, null, 2)};

/**
 * Seeds audit_checks table. Idempotent — INSERT OR IGNORE.
 * @param {import('better-sqlite3').Database} db
 */
export function seedAuditChecks(db) {
  const insert = db.prepare(\`
    INSERT OR IGNORE INTO audit_checks (check_id, name, section, severity_default, feasibility)
    VALUES (@check_id, @name, @section, @severity, @feasibility)
  \`);
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertAll(AUDIT_CHECKS);
}
`;

writeFileSync(OUTPUT_PATH, output, 'utf8');
console.log(`Generated ${checks.length} checks -> ${OUTPUT_PATH}`);
```

- [ ] **Step 2: Run the generator**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main
node scripts/generate-audit-checks-seed.js
```

Expected output: `Generated 349 checks -> .../backend/db/seed/audit-checks.js`

If fewer than 300 checks are parsed: the table row regex didn't match. Open `check-catalog.md` and inspect a failing row — the pattern requires columns 3 and 4 to be the feasibility icon and severity word respectively. Check for any extra whitespace or special characters in those columns.

---

## Task 10: Migration 029 — audit_checks v2 seed

**Files:**
- Create: `backend/db/migrations/029_audit_checks_v2.js`

Adds `check_id`, `section`, `feasibility` columns to `audit_checks`, clears old data, seeds the 349 new checks.

- [ ] **Step 1: Write the migration file**

```js
// backend/db/migrations/029_audit_checks_v2.js
/**
 * Migration 029 — audit_checks v2 seed
 *
 * Adds check_id, section, feasibility columns to audit_checks.
 * Clears old 482-check seed. Seeds 349 new checks from v2 seed file.
 *
 * check_number (old auto-increment PK) is preserved for backward compat.
 * check_id (new string column) is the canonical identifier going forward.
 */
import { AUDIT_CHECKS } from '../seed/audit-checks.js';

export function up(db) {
  const cols = db.prepare('PRAGMA table_info(audit_checks)').all().map(c => c.name);

  if (!cols.includes('check_id')) {
    db.prepare('ALTER TABLE audit_checks ADD COLUMN check_id TEXT').run();
  }
  if (!cols.includes('section')) {
    db.prepare('ALTER TABLE audit_checks ADD COLUMN section TEXT').run();
  }
  if (!cols.includes('feasibility')) {
    db.prepare('ALTER TABLE audit_checks ADD COLUMN feasibility TEXT').run();
  }

  // Clear all existing rows (old seed)
  db.prepare('DELETE FROM audit_checks').run();

  // Seed new checks
  const insert = db.prepare(`
    INSERT INTO audit_checks (check_id, name, section, severity_default, feasibility)
    VALUES (@check_id, @name, @section, @severity, @feasibility)
  `);
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertAll(AUDIT_CHECKS);

  console.log('[migration 029] Seeded', AUDIT_CHECKS.length, 'audit checks');
}
```

- [ ] **Step 2: Register migration 029 in sqlite.js**

In `backend/db/sqlite.js`, add the import after migration028:

```js
import { up as migration029 } from './migrations/029_audit_checks_v2.js';
```

Add to the MIGRATIONS array after `{ id: 28, ... }`:

```js
  { id: 29, fn: migration029, name: '029_audit_checks_v2' },
```

- [ ] **Step 3: Run the migration against the live DB**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
node db/sqlite.js
```

Expected output includes:
```
[db] Running migration: 029_audit_checks_v2
[migration 029] Seeded 349 audit checks
[db] Migration applied: 029_audit_checks_v2
[db] Migrations complete.
```

- [ ] **Step 4: Verify seed data in the live DB**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
sqlite3 seo-automation.db "SELECT COUNT(*) as total, COUNT(check_id) as with_check_id FROM audit_checks;"
sqlite3 seo-automation.db "SELECT check_id, name, section, severity_default, feasibility FROM audit_checks LIMIT 5;"
```

Expected:
- First query: `total = 349`, `with_check_id = 349`
- Second query: 5 rows with no NULL values in any column

---

## Task 11: Update the audit-checks-seed test

**Files:**
- Modify: `backend/__tests__/audit-checks-seed.test.js`

The existing test expects 483 checks with the old schema. Replace the entire file.

- [ ] **Step 1: Rewrite the test file**

```js
// backend/__tests__/audit-checks-seed.test.js
/**
 * Audit checks seed v2 tests.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { AUDIT_CHECKS, seedAuditChecks } from '../db/seed/audit-checks.js';

const VALID_FEASIBILITY = ['automated','gsc','ga4','psi','crux','kw_upload','bl_upload','ai','manual'];
const VALID_SEVERITY    = ['critical','warning','info'];

let db;

beforeAll(() => {
  db = new BetterSqlite3(':memory:');
  db.prepare(`
    CREATE TABLE audit_checks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      check_id         TEXT,
      name             TEXT NOT NULL,
      section          TEXT,
      severity_default TEXT DEFAULT 'warning',
      feasibility      TEXT,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  seedAuditChecks(db);
});

describe('AUDIT_CHECKS array', () => {
  it('exports at least 300 checks', () => {
    expect(AUDIT_CHECKS.length).toBeGreaterThanOrEqual(300);
  });

  it('has no duplicate check_ids', () => {
    const ids = AUDIT_CHECKS.map(c => c.check_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every check has check_id, name, section, severity, feasibility', () => {
    for (const c of AUDIT_CHECKS) {
      expect(c.check_id,    `check_id missing on: ${c.name}`).toBeTruthy();
      expect(c.name,        `name missing on: ${c.check_id}`).toBeTruthy();
      expect(c.section,     `section missing on: ${c.check_id}`).toBeTruthy();
      expect(c.severity,    `severity missing on: ${c.check_id}`).toBeTruthy();
      expect(c.feasibility, `feasibility missing on: ${c.check_id}`).toBeTruthy();
    }
  });

  it('every severity is critical, warning, or info', () => {
    const invalid = AUDIT_CHECKS.filter(c => !VALID_SEVERITY.includes(c.severity));
    expect(invalid.map(c => c.check_id)).toHaveLength(0);
  });

  it('every feasibility is a known tier', () => {
    const invalid = AUDIT_CHECKS.filter(c => !VALID_FEASIBILITY.includes(c.feasibility));
    expect(invalid.map(c => c.check_id)).toHaveLength(0);
  });

  it('has at least 200 automated checks', () => {
    expect(AUDIT_CHECKS.filter(c => c.feasibility === 'automated').length).toBeGreaterThanOrEqual(200);
  });

  it('has at least 40 manual checks', () => {
    expect(AUDIT_CHECKS.filter(c => c.feasibility === 'manual').length).toBeGreaterThanOrEqual(40);
  });
});

describe('seedAuditChecks', () => {
  it('inserts all checks into the DB', () => {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM audit_checks').get();
    expect(n).toBe(AUDIT_CHECKS.length);
  });

  it('is idempotent — INSERT OR IGNORE prevents duplicates', () => {
    seedAuditChecks(db); // run a second time
    const { n } = db.prepare('SELECT COUNT(*) as n FROM audit_checks').get();
    expect(n).toBe(AUDIT_CHECKS.length);
  });

  it('all rows in DB have non-null check_id', () => {
    const nullRows = db.prepare('SELECT check_id FROM audit_checks WHERE check_id IS NULL').all();
    expect(nullRows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the updated tests**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
npx vitest run __tests__/audit-checks-seed.test.js
```

Expected: all 10 tests pass.

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main/backend
npx vitest run
```

Expected: all tests pass. If other tests fail, check whether they depend on the `AUDIT_CHECKS.length === 483` assumption — update those assertions to use `>= 300` or the new exact count.

- [ ] **Step 4: Final commit**

```bash
cd /Users/aakash/Documents/seo-audit-platform-main
git add backend/db/migrations/029_audit_checks_v2.js \
        backend/db/sqlite.js \
        backend/db/seed/audit-checks.js \
        backend/__tests__/audit-checks-seed.test.js \
        scripts/generate-audit-checks-seed.js
git commit -m "feat: audit_checks v2 — 349 checks with string check_id, section, feasibility

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- ✅ Spec §7a: all 5 new tables → Tasks 1–4
- ✅ Spec §7b: audit_results v2 columns → Task 5
- ✅ Spec §5: scoring.service.js (computePageScore, computeSectionScore, computeAllSectionScores) → Tasks 7–8
- ✅ Spec §13: seed replacement (349 checks, string check_id) → Tasks 9–10
- ✅ Spec §15: migration files registered in sqlite.js → Tasks 6 + 10

**Out of scope (handled in other plans):**
- New extractors → Plan 2
- Check engine / audit-parser.service.js → Plan 3
- Schema rules, keyword upload, backlink upload, site settings routes + frontend → Plan 4
- AI Checks (migration 030, skills system, routes, frontend) → Plan 5

**No placeholders:** Every step has complete, runnable code.

**Type consistency:** The `CheckResult` typedef in `scoring.service.js` (`check_id`, `passed`, `severity`, `section`, `message`, `details`) matches the shape used in test fixtures and in Spec §5 exactly.
