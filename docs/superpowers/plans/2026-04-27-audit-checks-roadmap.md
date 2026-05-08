# Audit Checks Roadmap (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 3 roadmap tool and execute seven milestones to assign `priority` (P0/P1/P2) and `effort` (S/M/L/XL) to each of 163 in-scope canonical checks (149 missing + 14 partial), extending the canonical CSV with 3 new columns.

**Architecture:** Standalone Node.js CLI at `scripts/audit-checks-roadmap/`. Pipeline: load canonical CSV → filter to in-scope rows → apply two pure-function rubrics (priority + effort) → emit triage artifacts → user reviews bulk groupings + individual outliers → finalize.

**Tech Stack:** Node.js 20+ ESM, vitest, csv-parse, csv-stringify (no other runtime deps).

**Spec:** [docs/superpowers/specs/2026-04-27-audit-checks-roadmap-design.md](../specs/2026-04-27-audit-checks-roadmap-design.md)

---

## File Structure

```
scripts/audit-checks-roadmap/
├── package.json
├── README.md
├── vitest.config.js
├── src/
│   ├── cli.js                       # entry: dryrun | fullpass | applybulk | finalize
│   ├── csv.js                       # parseCsv + writeCsv wrappers
│   ├── canonical.js                 # load canonical CSV + filter to in-scope rows
│   ├── rubric/
│   │   ├── category-tier.js         # static lookup: 23 categories → tier 1/2/3
│   │   ├── priority.js              # Section 5: R-BASE-* + R-PROMO-PARTIAL
│   │   └── effort.js                # Section 6: R-EFF-1..4
│   ├── roadmap.js                   # main pipeline: canonical + rubric → annotated rows
│   └── output/
│       ├── canonical-csv.js         # write extended canonical CSV (26 cols)
│       ├── summary-md.js            # roadmap-summary.md / roadmap-run-summary.md
│       ├── bulk-decisions-md.js     # roadmap-bulk-decisions.md (with parser)
│       ├── individual-md.js         # roadmap-individual.md (with parser)
│       └── dryrun-md.js             # roadmap-dryrun-25rows.md
└── __tests__/
    ├── csv.test.js
    ├── canonical.test.js
    ├── category-tier.test.js
    ├── priority.test.js
    ├── effort.test.js
    ├── roadmap.test.js
    └── output.test.js

docs/audit-checks/                   # outputs
├── canonical-checks-v1.csv          # extended at R7 (existing 23 cols + 3 new = 26)
├── roadmap-summary.md               # R7 final
├── canonical-checks-v1.draft.csv    # R3, deleted at R7
├── roadmap-run-summary.md           # R3, deleted at R7
├── roadmap-bulk-decisions.md        # R3, deleted at R7
├── roadmap-individual.md            # R5, deleted at R7
└── roadmap-dryrun-25rows.md         # R1, deleted at R7
```

**Module boundaries:** `cli.js` orchestrates only. `roadmap.js` is pure pipeline. `rubric/{priority,effort,category-tier}.js` are pure functions/data. Output writers are pure formatters.

**Phase 2 reuse policy:** Per spec §9, this tool does NOT depend on the Phase 2 gap-map tool. Modules with similar names (`csv.js`) are independently authored copies. Each phase tool is independent so they can be re-run separately.

---

## Phase A — Build Tooling (TDD)

### Task 1: Project setup

**Files:**
- Create: `scripts/audit-checks-roadmap/package.json`
- Create: `scripts/audit-checks-roadmap/README.md`
- Create: `scripts/audit-checks-roadmap/vitest.config.js`

- [ ] **Step 1: Create the local package**

Write `scripts/audit-checks-roadmap/package.json`:

```json
{
  "name": "audit-checks-roadmap",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "node src/cli.js"
  },
  "devDependencies": {
    "csv-parse": "^5.5.6",
    "csv-stringify": "^6.5.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create vitest config**

Write `scripts/audit-checks-roadmap/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.js'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Create README**

Write `scripts/audit-checks-roadmap/README.md`:

```markdown
# Audit Checks Roadmap Tool

Phase 3 of audit-checks reconciliation. Assigns priority (P0/P1/P2) and effort (S/M/L/XL) to the 163 in-scope canonical checks (149 missing + 14 partial). Produces docs only; no platform code is modified.

## Setup

    cd scripts/audit-checks-roadmap && npm install

## Milestone subcommands

    npm run cli -- dryrun       # R1: heuristic on first 25 in-scope rows
    npm run cli -- fullpass     # R3: full pass on all 163 rows
    npm run cli -- applybulk    # R5: apply edited bulk-decisions.md, emit individual-flag file
    npm run cli -- finalize     # R7: apply edited individual.md, produce final extended canonical CSV

## Tests

    npm test
```

- [ ] **Step 4: Install deps**

Run: `cd scripts/audit-checks-roadmap && npm install`
Expected: csv-parse, csv-stringify, vitest install without errors.

- [ ] **Step 5: Verify vitest finds zero tests**

Run: `cd scripts/audit-checks-roadmap && npm test`
Expected: vitest exits with "No test files found" (exit code 1 — vitest 2.x behavior; success at scaffolding stage).

- [ ] **Step 6: Commit**

```bash
git add scripts/audit-checks-roadmap/package.json \
        scripts/audit-checks-roadmap/package-lock.json \
        scripts/audit-checks-roadmap/vitest.config.js \
        scripts/audit-checks-roadmap/README.md
git commit -m "chore(roadmap): scaffold audit-checks roadmap tool"
```

---

### Task 2: CSV I/O

**Files:**
- Create: `scripts/audit-checks-roadmap/src/csv.js`
- Test: `scripts/audit-checks-roadmap/__tests__/csv.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/csv.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseCsv, writeCsv } from '../src/csv.js';

describe('parseCsv', () => {
  it('parses header + rows into objects keyed by header', async () => {
    const text = 'a,b,c\n1,2,3\n4,5,6\n';
    const rows = await parseCsv(text);
    expect(rows).toEqual([{ a: '1', b: '2', c: '3' }, { a: '4', b: '5', c: '6' }]);
  });

  it('handles quoted commas inside fields', async () => {
    const text = 'name,note\n"Foo, Bar","baz, qux"\n';
    const rows = await parseCsv(text);
    expect(rows).toEqual([{ name: 'Foo, Bar', note: 'baz, qux' }]);
  });

  it('tolerates malformed rows via relax_quotes/relax_column_count', async () => {
    const text = 'a,b\n1,  "foo"\n';
    const rows = await parseCsv(text);
    expect(rows.length).toBe(1);
  });
});

describe('writeCsv', () => {
  it('writes header + rows preserving column order', async () => {
    const text = await writeCsv(
      [{ a: '1', b: '2' }, { a: '3', b: '4' }],
      ['a', 'b'],
    );
    expect(text).toBe('a,b\n1,2\n3,4\n');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-roadmap && npm test`
Expected: FAIL — "Cannot find module '../src/csv.js'".

- [ ] **Step 3: Implement csv.js**

Write `src/csv.js`:

```js
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export function parseCsv(text) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    relax_quotes: true,
    relax_column_count: true,
  });
}

export function writeCsv(rows, columns) {
  return stringify(rows, { header: true, columns });
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-roadmap && npm test`
Expected: PASS — 4 csv tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-roadmap/src/csv.js \
        scripts/audit-checks-roadmap/__tests__/csv.test.js
git commit -m "feat(roadmap): csv parse/write wrappers"
```

---

### Task 3: Canonical CSV loader + scope filter

**Files:**
- Create: `scripts/audit-checks-roadmap/src/canonical.js`
- Test: `scripts/audit-checks-roadmap/__tests__/canonical.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/canonical.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { loadCanonical, filterInScope } from '../src/canonical.js';

describe('loadCanonical', () => {
  it('loads the canonical CSV with all 23 columns from Phase 2', async () => {
    const rows = await loadCanonical();
    expect(rows.length).toBeGreaterThan(500);
    expect(rows[0]).toHaveProperty('check_id');
    expect(rows[0]).toHaveProperty('decision');
    expect(rows[0]).toHaveProperty('source');
    expect(rows[0]).toHaveProperty('category');
    expect(rows[0]).toHaveProperty('impl_status');
  });
});

describe('filterInScope', () => {
  it('returns only rows where decision/source are in-scope AND impl_status ∈ {missing, partial}', () => {
    const all = [
      { check_id: 'C1', decision: 'keep', source: 'csv-only', impl_status: 'missing' },
      { check_id: 'C2', decision: 'cut', source: 'csv-only', impl_status: 'missing' },
      { check_id: 'C3', decision: 'keep', source: 'seed-only', impl_status: 'implemented' },
      { check_id: 'C4', decision: 'edit', source: 'csv-only', impl_status: 'partial' },
      { check_id: 'C5', decision: 'keep', source: 'both', impl_status: 'implemented' },
      { check_id: 'C6', decision: 'keep', source: 'both', impl_status: 'n-a' },
      { check_id: 'C7', decision: 'keep', source: 'both', impl_status: 'missing' },
    ];
    const inScope = filterInScope(all);
    expect(inScope.map(r => r.check_id)).toEqual(['C1', 'C4', 'C7']);
  });

  it('full canonical filters to ~163 in-scope rows (149 missing + 14 partial)', async () => {
    const all = await loadCanonical();
    const inScope = filterInScope(all);
    expect(inScope.length).toBeGreaterThan(155);
    expect(inScope.length).toBeLessThan(175);
    const counts = inScope.reduce((m, r) => { m[r.impl_status] = (m[r.impl_status] || 0) + 1; return m; }, {});
    expect(counts.missing).toBeGreaterThan(140);
    expect(counts.partial).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-roadmap && npm test -- canonical`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement canonical.js**

Write `src/canonical.js`:

```js
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const CANONICAL_CSV = join(PROJECT_ROOT, 'docs', 'audit-checks', 'canonical-checks-v1.csv');

const IN_SCOPE_DECISIONS = new Set(['keep', 'edit']);
const IN_SCOPE_SOURCES = new Set(['csv-only', 'both']);
const IN_SCOPE_IMPL_STATUSES = new Set(['missing', 'partial']);

export async function loadCanonical() {
  const text = await readFile(CANONICAL_CSV, 'utf8');
  return parseCsv(text);
}

export function filterInScope(rows) {
  return rows.filter(r =>
    IN_SCOPE_DECISIONS.has(r.decision) &&
    IN_SCOPE_SOURCES.has(r.source) &&
    IN_SCOPE_IMPL_STATUSES.has(r.impl_status),
  );
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-roadmap && npm test -- canonical`
Expected: PASS — 3 cases. The 163-row check confirms the in-scope count (~149 missing + ~14 partial).

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-roadmap/src/canonical.js \
        scripts/audit-checks-roadmap/__tests__/canonical.test.js
git commit -m "feat(roadmap): canonical loader + in-scope filter (163 rows)"
```

---

### Task 4: Category-tier lookup

**Files:**
- Create: `scripts/audit-checks-roadmap/src/rubric/category-tier.js`
- Test: `scripts/audit-checks-roadmap/__tests__/category-tier.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/category-tier.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { CATEGORY_TIER, getCategoryTier } from '../src/rubric/category-tier.js';

describe('CATEGORY_TIER', () => {
  it('covers all 23 in-scope categories', () => {
    expect(Object.keys(CATEGORY_TIER).length).toBe(23);
  });

  it('partitions into 10 + 7 + 6 = 23', () => {
    const counts = { 'extractor-covered': 0, 'needs-new-infra': 0, 'needs-external-integration': 0 };
    for (const tier of Object.values(CATEGORY_TIER)) counts[tier]++;
    expect(counts['extractor-covered']).toBe(10);
    expect(counts['needs-new-infra']).toBe(7);
    expect(counts['needs-external-integration']).toBe(6);
  });

  it('places known categories in expected tiers', () => {
    expect(CATEGORY_TIER['Title Tags']).toBe('extractor-covered');
    expect(CATEGORY_TIER['Robots & Crawl Directives']).toBe('needs-new-infra');
    expect(CATEGORY_TIER['Local SEO']).toBe('needs-external-integration');
  });
});

describe('getCategoryTier', () => {
  it('returns the tier for a known category', () => {
    expect(getCategoryTier('Title Tags')).toBe('extractor-covered');
    expect(getCategoryTier('Core Web Vitals')).toBe('needs-new-infra');
  });

  it('returns null for an unknown category', () => {
    expect(getCategoryTier('Some Unknown Category')).toBe(null);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-roadmap && npm test -- category-tier`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement category-tier.js**

Write `src/rubric/category-tier.js`:

```js
// Maps each of the 23 in-scope canonical categories to one of three infrastructure tiers.
// See spec §6 for tier definitions.
export const CATEGORY_TIER = {
  // Tier 1: Extractor-covered (default missing → M)
  'Title Tags': 'extractor-covered',
  'Meta Descriptions': 'extractor-covered',
  'Headings': 'extractor-covered',
  'Canonicalisation': 'extractor-covered',
  'Schema & Structured Data': 'extractor-covered',
  'Images': 'extractor-covered',
  'Internal Linking': 'extractor-covered',
  'Response Codes & Redirects': 'extractor-covered',
  'URL Structure': 'extractor-covered',
  'Content Quality': 'extractor-covered',

  // Tier 2: Needs-new-infra (default missing → L)
  'Robots & Crawl Directives': 'needs-new-infra',
  'XML Sitemaps': 'needs-new-infra',
  'Crawlability & Indexability': 'needs-new-infra',
  'Mobile & Usability': 'needs-new-infra',
  'JavaScript Rendering': 'needs-new-infra',
  'Core Web Vitals': 'needs-new-infra',
  'Security & HTTPS': 'needs-new-infra',

  // Tier 3: Needs-external-integration (default missing → L)
  'GEO & LLM Crawlers': 'needs-external-integration',
  'AI Overviews & AIO Optimization': 'needs-external-integration',
  'Local SEO': 'needs-external-integration',
  'International SEO': 'needs-external-integration',
  'E-E-A-T Signals': 'needs-external-integration',
  'Rankings & Traffic': 'needs-external-integration',
};

export function getCategoryTier(category) {
  return Object.prototype.hasOwnProperty.call(CATEGORY_TIER, category)
    ? CATEGORY_TIER[category]
    : null;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-roadmap && npm test -- category-tier`
Expected: PASS — 5 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-roadmap/src/rubric/category-tier.js \
        scripts/audit-checks-roadmap/__tests__/category-tier.test.js
git commit -m "feat(roadmap): category-tier lookup (23 categories)"
```

---

### Task 5: Priority rubric

**Files:**
- Create: `scripts/audit-checks-roadmap/src/rubric/priority.js`
- Test: `scripts/audit-checks-roadmap/__tests__/priority.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/priority.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computePriority } from '../src/rubric/priority.js';

describe('computePriority', () => {
  it('R-BASE-CRITICAL: missing+critical → P0', () => {
    const r = computePriority({ severity: 'critical', impl_status: 'missing' });
    expect(r.priority).toBe('P0');
    expect(r.rule).toBe('R-BASE-CRITICAL');
    expect(r.note).toContain('critical→P0');
  });

  it('R-BASE-WARNING: missing+warning → P1', () => {
    const r = computePriority({ severity: 'warning', impl_status: 'missing' });
    expect(r.priority).toBe('P1');
    expect(r.rule).toBe('R-BASE-WARNING');
  });

  it('R-BASE-INFO: missing+info → P2', () => {
    const r = computePriority({ severity: 'info', impl_status: 'missing' });
    expect(r.priority).toBe('P2');
    expect(r.rule).toBe('R-BASE-INFO');
  });

  it('R-PROMO-PARTIAL: partial+critical → P0 (no change)', () => {
    const r = computePriority({ severity: 'critical', impl_status: 'partial' });
    expect(r.priority).toBe('P0');
    expect(r.rule).toBe('R-PROMO-PARTIAL');
    expect(r.note).toContain('partial+critical→P0');
  });

  it('R-PROMO-PARTIAL: partial+warning → P0', () => {
    const r = computePriority({ severity: 'warning', impl_status: 'partial' });
    expect(r.priority).toBe('P0');
    expect(r.rule).toBe('R-PROMO-PARTIAL');
    expect(r.note).toContain('partial+warning→P0');
  });

  it('R-PROMO-PARTIAL: partial+info → P1', () => {
    const r = computePriority({ severity: 'info', impl_status: 'partial' });
    expect(r.priority).toBe('P1');
    expect(r.rule).toBe('R-PROMO-PARTIAL');
    expect(r.note).toContain('partial+info→P1');
  });

  it('R-BASE-DEFAULT: empty severity → P2 + flag', () => {
    const r = computePriority({ severity: '', impl_status: 'missing' });
    expect(r.priority).toBe('P2');
    expect(r.rule).toBe('R-BASE-DEFAULT');
    expect(r.note).toContain('PRIORITY-FLAG: empty severity');
  });

  it('R-BASE-DEFAULT: unknown severity → P2 + flag', () => {
    const r = computePriority({ severity: 'something-weird', impl_status: 'missing' });
    expect(r.priority).toBe('P2');
    expect(r.rule).toBe('R-BASE-DEFAULT');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-roadmap && npm test -- priority`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement priority.js**

Write `src/rubric/priority.js`:

```js
// See spec §5. Two-step rubric:
//   Step 1: base priority from severity (critical→P0, warning→P1, info→P2, default→P2 with flag)
//   Step 2: if impl_status=partial, promote one tier (warning→P0, info→P1; critical stays P0)
const BASE = {
  critical: { priority: 'P0', rule: 'R-BASE-CRITICAL' },
  warning:  { priority: 'P1', rule: 'R-BASE-WARNING'  },
  info:     { priority: 'P2', rule: 'R-BASE-INFO'     },
};

const PROMOTED = {
  critical: 'P0',  // already top
  warning:  'P0',
  info:     'P1',
};

export function computePriority({ severity, impl_status }) {
  const sev = String(severity || '').trim().toLowerCase();
  const isPartial = impl_status === 'partial';

  if (!BASE[sev]) {
    // Unknown / empty severity → P2 with flag
    return {
      priority: 'P2',
      rule: 'R-BASE-DEFAULT',
      note: `R-BASE-DEFAULT (no severity, defaulted to P2); PRIORITY-FLAG: empty severity`,
    };
  }

  if (isPartial) {
    const promoted = PROMOTED[sev];
    return {
      priority: promoted,
      rule: 'R-PROMO-PARTIAL',
      note: `R-PROMO-PARTIAL (partial+${sev}→${promoted})`,
    };
  }

  const base = BASE[sev];
  return {
    priority: base.priority,
    rule: base.rule,
    note: `${base.rule} (${sev}→${base.priority})`,
  };
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-roadmap && npm test -- priority`
Expected: PASS — 8 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-roadmap/src/rubric/priority.js \
        scripts/audit-checks-roadmap/__tests__/priority.test.js
git commit -m "feat(roadmap): priority rubric (R-BASE-* + R-PROMO-PARTIAL)"
```

---

### Task 6: Effort rubric

**Files:**
- Create: `scripts/audit-checks-roadmap/src/rubric/effort.js`
- Test: `scripts/audit-checks-roadmap/__tests__/effort.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/effort.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeEffort } from '../src/rubric/effort.js';

describe('computeEffort', () => {
  it('R-EFF-1-PARTIAL: partial → S regardless of category', () => {
    const r = computeEffort({ impl_status: 'partial', category: 'Title Tags' });
    expect(r.effort).toBe('S');
    expect(r.rule).toBe('R-EFF-1-PARTIAL');
    expect(r.note).toContain('partial→S');
  });

  it('R-EFF-2-EXTRACTOR: missing in extractor-covered category → M', () => {
    const r = computeEffort({ impl_status: 'missing', category: 'Title Tags' });
    expect(r.effort).toBe('M');
    expect(r.rule).toBe('R-EFF-2-EXTRACTOR');
    expect(r.note).toContain('missing/extractor-covered→M');
  });

  it('R-EFF-3-NEW-INFRA: missing in needs-new-infra → L', () => {
    const r = computeEffort({ impl_status: 'missing', category: 'Robots & Crawl Directives' });
    expect(r.effort).toBe('L');
    expect(r.rule).toBe('R-EFF-3-NEW-INFRA');
    expect(r.note).toContain('missing/needs-new-infra→L');
  });

  it('R-EFF-4-EXTERNAL: missing in needs-external-integration → L', () => {
    const r = computeEffort({ impl_status: 'missing', category: 'Local SEO' });
    expect(r.effort).toBe('L');
    expect(r.rule).toBe('R-EFF-4-EXTERNAL');
    expect(r.note).toContain('missing/needs-external-integration→L');
  });

  it('falls back to L with EFFORT-FLAG when category is unknown', () => {
    const r = computeEffort({ impl_status: 'missing', category: 'Unknown Category' });
    expect(r.effort).toBe('L');
    expect(r.rule).toBe('R-EFF-DEFAULT');
    expect(r.note).toContain('EFFORT-FLAG: unknown category');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-roadmap && npm test -- effort`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement effort.js**

Write `src/rubric/effort.js`:

```js
import { getCategoryTier } from './category-tier.js';

// See spec §6. Two-step rubric:
//   Step 1: if partial → S
//   Step 2: missing → look up category tier
//     extractor-covered → M
//     needs-new-infra → L
//     needs-external-integration → L
//     unknown → L with flag
const TIER_TO_EFFORT = {
  'extractor-covered': { effort: 'M', rule: 'R-EFF-2-EXTRACTOR' },
  'needs-new-infra':   { effort: 'L', rule: 'R-EFF-3-NEW-INFRA' },
  'needs-external-integration': { effort: 'L', rule: 'R-EFF-4-EXTERNAL' },
};

export function computeEffort({ impl_status, category }) {
  if (impl_status === 'partial') {
    return {
      effort: 'S',
      rule: 'R-EFF-1-PARTIAL',
      note: 'R-EFF-1-PARTIAL (partial→S)',
    };
  }

  const tier = getCategoryTier(category);
  if (!tier) {
    return {
      effort: 'L',
      rule: 'R-EFF-DEFAULT',
      note: `R-EFF-DEFAULT (defaulted to L); EFFORT-FLAG: unknown category "${category}"`,
    };
  }

  const m = TIER_TO_EFFORT[tier];
  return {
    effort: m.effort,
    rule: m.rule,
    note: `${m.rule} (missing/${tier}→${m.effort})`,
  };
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-roadmap && npm test -- effort`
Expected: PASS — 5 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-roadmap/src/rubric/effort.js \
        scripts/audit-checks-roadmap/__tests__/effort.test.js
git commit -m "feat(roadmap): effort rubric (R-EFF-1..4 + default)"
```

---

### Task 7: Main pipeline (roadmap)

**Files:**
- Create: `scripts/audit-checks-roadmap/src/roadmap.js`
- Test: `scripts/audit-checks-roadmap/__tests__/roadmap.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/roadmap.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { runRoadmap, annotateRow } from '../src/roadmap.js';

describe('annotateRow', () => {
  it('annotates a row with priority + effort + roadmap_notes', () => {
    const row = {
      check_id: 'C1',
      category: 'Title Tags',
      severity: 'critical',
      impl_status: 'missing',
    };
    const out = annotateRow(row);
    expect(out.priority).toBe('P0');
    expect(out.effort).toBe('M');
    expect(out.roadmap_notes).toContain('R-BASE-CRITICAL');
    expect(out.roadmap_notes).toContain('R-EFF-2-EXTRACTOR');
    expect(out.roadmap_notes).toContain(';');
  });

  it('annotates a partial in needs-new-infra: P0 (warning promo) + S', () => {
    const row = {
      check_id: 'C2',
      category: 'Robots & Crawl Directives',
      severity: 'warning',
      impl_status: 'partial',
    };
    const out = annotateRow(row);
    expect(out.priority).toBe('P0');
    expect(out.effort).toBe('S');
    expect(out.roadmap_notes).toContain('R-PROMO-PARTIAL');
    expect(out.roadmap_notes).toContain('R-EFF-1-PARTIAL');
  });

  it('preserves all original row fields', () => {
    const row = {
      check_id: 'C1', category: 'Title Tags', severity: 'critical',
      impl_status: 'missing', name: 'Foo', custom: 'bar',
    };
    const out = annotateRow(row);
    expect(out.check_id).toBe('C1');
    expect(out.name).toBe('Foo');
    expect(out.custom).toBe('bar');
  });
});

describe('runRoadmap', () => {
  it('returns annotated in-scope rows from canonical', async () => {
    const result = await runRoadmap();
    expect(result.rows.length).toBeGreaterThan(155);
    expect(result.rows.length).toBeLessThan(175);

    for (const r of result.rows) {
      expect(['P0', 'P1', 'P2']).toContain(r.priority);
      expect(['S', 'M', 'L', 'XL']).toContain(r.effort);
      expect(r.roadmap_notes).toBeTruthy();
    }
  });

  it('limits to first N rows when limit option provided (for dry-run)', async () => {
    const result = await runRoadmap({ limit: 25 });
    expect(result.rows.length).toBe(25);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-roadmap && npm test -- roadmap`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement roadmap.js**

Write `src/roadmap.js`:

```js
import { loadCanonical, filterInScope } from './canonical.js';
import { computePriority } from './rubric/priority.js';
import { computeEffort } from './rubric/effort.js';

export function annotateRow(row) {
  const p = computePriority(row);
  const e = computeEffort(row);
  return {
    ...row,
    priority: p.priority,
    effort: e.effort,
    roadmap_notes: `${p.note}; ${e.note}`,
  };
}

export async function runRoadmap({ limit } = {}) {
  const all = await loadCanonical();
  const inScope = filterInScope(all);
  const slice = limit ? inScope.slice(0, limit) : inScope;
  const rows = slice.map(annotateRow);
  return { rows };
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-roadmap && npm test -- roadmap`
Expected: PASS — 5 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-roadmap/src/roadmap.js \
        scripts/audit-checks-roadmap/__tests__/roadmap.test.js
git commit -m "feat(roadmap): main pipeline (canonical + rubrics → annotated rows)"
```

---

### Task 8: Output writers

**Files:**
- Create: `scripts/audit-checks-roadmap/src/output/canonical-csv.js`
- Create: `scripts/audit-checks-roadmap/src/output/summary-md.js`
- Create: `scripts/audit-checks-roadmap/src/output/bulk-decisions-md.js`
- Create: `scripts/audit-checks-roadmap/src/output/individual-md.js`
- Create: `scripts/audit-checks-roadmap/src/output/dryrun-md.js`
- Test: `scripts/audit-checks-roadmap/__tests__/output.test.js`

- [ ] **Step 1: Implement canonical-csv writer**

Write `src/output/canonical-csv.js`:

```js
import { writeCsv } from '../csv.js';

const PHASE2_COLUMNS = [
  'check_id', 'csv_row', 'seed_check_number', 'source',
  'category', 'subsection', 'name', 'original_name',
  'severity', 'automation_type', 'decision', 'rule_id', 'merge_into',
  'rationale', 'pass_condition', 'fail_condition',
  'implementation_rule', 'tool_current', 'notes',
  'impl_status', 'impl_location', 'impl_evidence', 'gap_notes',
];

const NEW_COLUMNS = ['priority', 'effort', 'roadmap_notes'];

export const COLUMNS = [...PHASE2_COLUMNS, ...NEW_COLUMNS];

export function writeExtendedCanonicalCsv(rows) {
  const out = rows.map(r => {
    const o = {};
    for (const c of COLUMNS) o[c] = r[c] ?? '';
    return o;
  });
  return writeCsv(out, COLUMNS);
}
```

- [ ] **Step 2: Implement summary writer**

Write `src/output/summary-md.js`:

```js
function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(r[key] || 'unset', (m.get(r[key] || 'unset') || 0) + 1);
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

function crosstab(rows) {
  const cats = new Map();
  for (const r of rows) {
    const cat = r.category || 'unset';
    if (!cats.has(cat)) cats.set(cat, { P0: 0, P1: 0, P2: 0 });
    cats.get(cat)[r.priority || 'P2']++;
  }
  return cats;
}

function priorityBacklog(rows, priority) {
  const items = rows.filter(r => r.priority === priority);
  const byCategory = new Map();
  for (const r of items) {
    const cat = r.category || 'unset';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(r);
  }
  const lines = [];
  for (const [cat, list] of [...byCategory.entries()].sort()) {
    lines.push(`### ${cat}`);
    for (const r of list) {
      const rule = (r.roadmap_notes || '').split(';')[0].trim();
      const name = r.original_name || r.name || '';
      lines.push(`- ${r.check_id}: ${name} [${r.severity || ''}, ${r.impl_status}, ${r.effort}] — ${rule}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function buildRoadmapSummary(rows, meta = {}) {
  const total = rows.length;
  const byPriority = countBy(rows, 'priority');
  const byEffort = countBy(rows, 'effort');

  const lines = [];
  lines.push('# Audit-Checks Roadmap v1');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  if (meta.label) lines.push(`- Label: ${meta.label}`);
  const missing = rows.filter(r => r.impl_status === 'missing').length;
  const partial = rows.filter(r => r.impl_status === 'partial').length;
  lines.push(`- Total in-scope: ${total} (${missing} missing + ${partial} partial)`);
  lines.push('');

  lines.push('## By priority');
  for (const tier of ['P0', 'P1', 'P2']) lines.push(`- ${tier}: ${byPriority[tier] || 0}`);
  lines.push('');

  lines.push('## By effort');
  for (const eff of ['S', 'M', 'L', 'XL']) lines.push(`- ${eff}: ${byEffort[eff] || 0}`);
  lines.push('');

  lines.push('## Priority × category crosstab');
  lines.push('| Category | P0 | P1 | P2 | Total |');
  lines.push('|---|---|---|---|---|');
  const ct = crosstab(rows);
  const cats = [...ct.entries()].sort((a, b) => (b[1].P0 + b[1].P1) - (a[1].P0 + a[1].P1));
  for (const [cat, counts] of cats) {
    const tot = counts.P0 + counts.P1 + counts.P2;
    lines.push(`| ${cat} | ${counts.P0} | ${counts.P1} | ${counts.P2} | ${tot} |`);
  }
  lines.push('');

  lines.push('## P0 backlog (the build-first list)');
  lines.push('');
  lines.push(priorityBacklog(rows, 'P0'));

  lines.push('## P1 backlog');
  lines.push('');
  lines.push(priorityBacklog(rows, 'P1'));

  lines.push('## P2 backlog');
  lines.push('');
  lines.push(priorityBacklog(rows, 'P2'));

  return lines.join('\n');
}
```

- [ ] **Step 3: Implement bulk-decisions writer + parser**

Write `src/output/bulk-decisions-md.js`:

```js
export function buildBulkDecisions(rows) {
  // Group by (priority × category)
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.priority}|${r.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const lines = [
    '# Roadmap Bulk Triage Decisions',
    '',
    'For each group below, edit the `Decision:` line in place. Allowed values:',
    '`accept` (keep heuristic priority), `reshape: P0` / `reshape: P1` / `reshape: P2` (re-tier the whole group), `flag-individually` (forces per-row review at R6).',
    '',
  ];

  let idx = 1;
  // Sort by (priority asc, count desc)
  const ordered = [...groups.entries()].sort((a, b) => {
    const pa = a[0].split('|')[0];
    const pb = b[0].split('|')[0];
    if (pa !== pb) return pa.localeCompare(pb);
    return b[1].length - a[1].length;
  });

  for (const [key, items] of ordered) {
    const [priority, category] = key.split('|');
    lines.push(`## Group ${idx}: ${priority} / ${category} (${items.length} items)`);
    lines.push('');
    lines.push('Sample names:');
    for (const r of items.slice(0, 5)) {
      const name = r.original_name || r.name;
      lines.push(`- ${name} [${r.severity}]`);
    }
    if (items.length > 5) lines.push(`- ...and ${items.length - 5} more`);
    lines.push('');
    lines.push('> Decision: ___');
    lines.push('');
    idx++;
  }

  if (groups.size === 0) {
    lines.push('_No in-scope rows. Skip R4 and proceed to R5._');
  }
  return lines.join('\n');
}

export function parseBulkDecisions(markdown) {
  const groups = [];
  // Match: ## Group N: <priority> / <category> (<count> items) ... > Decision: <answer>
  const groupRe = /## Group \d+: (P\d) \/ ([^()]+?) \((\d+) items\)[\s\S]*?> Decision:\s*(\S+(?:\s+\S+)*?)\s*$/gm;
  let m;
  while ((m = groupRe.exec(markdown))) {
    groups.push({ priority: m[1], category: m[2].trim(), count: Number(m[3]), decision: m[4].trim() });
  }
  return groups;
}
```

- [ ] **Step 4: Implement individual-md writer + parser**

Write `src/output/individual-md.js`:

```js
export function buildIndividualFlags(rows) {
  const lines = [
    '# Roadmap Individual Triage',
    '',
    'For each item, edit the `Your call:` line in place. Allowed values:',
    '`P0` / `P1` / `P2` (re-priority); `effort: S` / `effort: M` / `effort: L` / `effort: XL` (re-effort);',
    'combined like `P0 effort: L`; or `comment: <free text>` to append a note without changing priority/effort.',
    '',
  ];
  rows.forEach((r, i) => {
    lines.push(`## ROADMAP #${String(i + 1).padStart(3, '0')}  ${r.check_id}`);
    lines.push(`- category: ${r.category}`);
    lines.push(`- name:     ${r.original_name || r.name}`);
    lines.push(`- severity: ${r.severity}`);
    lines.push(`- impl_status: ${r.impl_status}`);
    lines.push(`- current_priority: ${r.priority}`);
    lines.push(`- current_effort: ${r.effort}`);
    lines.push(`- roadmap_notes: ${r.roadmap_notes}`);
    lines.push('');
    lines.push('> Your call: ___');
    lines.push('');
  });
  if (rows.length === 0) {
    lines.push('_No items flagged for individual review._');
  }
  return lines.join('\n');
}

export function parseIndividualFlags(markdown) {
  const blocks = markdown.split(/\n## ROADMAP /).slice(1);
  return blocks.map(block => {
    const idMatch = block.match(/^#?\d+\s+(C\d+)/);
    const callMatch = block.match(/> Your call:\s*(.+?)\s*$/m);
    const raw = callMatch ? callMatch[1].trim() : null;
    const out = { check_id: idMatch ? idMatch[1] : null, raw };
    if (!raw || raw === '___') return out;

    if (raw.startsWith('comment:')) {
      out.comment = raw.slice('comment:'.length).trim();
      return out;
    }
    // Match patterns like "P0", "P0 effort: L", "effort: M"
    const pMatch = raw.match(/\b(P[012])\b/);
    const eMatch = raw.match(/effort:\s*(S|M|L|XL)\b/i);
    if (pMatch) out.priority = pMatch[1];
    if (eMatch) out.effort = eMatch[1].toUpperCase();
    return out;
  });
}
```

- [ ] **Step 5: Implement dryrun-md writer**

Write `src/output/dryrun-md.js`:

```js
export function buildDryrunTable(rows) {
  const header = '| check_id | category | name | impl_status | priority | effort | rule |\n|---|---|---|---|---|---|---|';
  const body = rows.map(r => {
    const rule = (r.roadmap_notes || '').split(';')[0].trim();
    const name = String(r.name || '').replace(/\|/g, '\\|');
    return `| ${r.check_id} | ${r.category} | ${name} | ${r.impl_status} | ${r.priority} | ${r.effort} | ${rule} |`;
  }).join('\n');
  return `# Roadmap Dry-Run Decision Table (first 25 in-scope rows)\n\n${header}\n${body}\n`;
}
```

- [ ] **Step 6: Smoke-test the writers**

Write `__tests__/output.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { writeExtendedCanonicalCsv, COLUMNS } from '../src/output/canonical-csv.js';
import { buildRoadmapSummary } from '../src/output/summary-md.js';
import { buildBulkDecisions, parseBulkDecisions } from '../src/output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from '../src/output/individual-md.js';
import { buildDryrunTable } from '../src/output/dryrun-md.js';

const fakeRows = [
  { check_id: 'C001', category: 'Title Tags', name: 'Title length', original_name: 'Title length', severity: 'critical', impl_status: 'missing', priority: 'P0', effort: 'M', roadmap_notes: 'R-BASE-CRITICAL (critical→P0); R-EFF-2-EXTRACTOR (missing/extractor-covered→M)' },
  { check_id: 'C002', category: 'Robots & Crawl Directives', name: 'Robots.txt Exists', original_name: 'Robots.txt Exists', severity: 'critical', impl_status: 'missing', priority: 'P0', effort: 'L', roadmap_notes: 'R-BASE-CRITICAL; R-EFF-3-NEW-INFRA' },
  { check_id: 'C003', category: 'Title Tags', name: 'Title length partial', original_name: 'Title length partial', severity: 'info', impl_status: 'partial', priority: 'P1', effort: 'S', roadmap_notes: 'R-PROMO-PARTIAL (partial+info→P1); R-EFF-1-PARTIAL (partial→S)' },
];

describe('output writers smoke', () => {
  it('extended canonical CSV has 26 columns', () => {
    expect(COLUMNS.length).toBe(26);
    const csv = writeExtendedCanonicalCsv(fakeRows);
    expect(csv.split('\n')[0]).toContain('priority');
    expect(csv.split('\n')[0]).toContain('effort');
    expect(csv.split('\n')[0]).toContain('roadmap_notes');
  });

  it('summary contains totals + by-priority + by-effort + crosstab + backlogs', () => {
    const md = buildRoadmapSummary(fakeRows);
    expect(md).toContain('Total in-scope: 3');
    expect(md).toContain('## By priority');
    expect(md).toContain('## By effort');
    expect(md).toContain('## Priority × category crosstab');
    expect(md).toContain('## P0 backlog');
    expect(md).toContain('## P1 backlog');
    expect(md).toContain('## P2 backlog');
  });

  it('bulk decisions group items by (priority × category)', () => {
    const md = buildBulkDecisions(fakeRows);
    expect(md).toContain('Group 1');
    // C001 + C003 are both Title Tags but different priorities → 2 separate groups
    expect(md).toMatch(/## Group \d+: P0 \/ Title Tags \(1 items\)/);
    expect(md).toMatch(/## Group \d+: P1 \/ Title Tags \(1 items\)/);
    expect(md).toMatch(/## Group \d+: P0 \/ Robots & Crawl Directives \(1 items\)/);
  });

  it('bulk decisions round-trip', () => {
    const md = buildBulkDecisions(fakeRows);
    const filled = md.replace(/Decision: ___/, 'Decision: reshape: P1');
    const parsed = parseBulkDecisions(filled);
    expect(parsed[0].decision).toBe('reshape: P1');
  });

  it('individual flags round-trip with priority + effort combined', () => {
    const md = buildIndividualFlags([fakeRows[1]]);  // C002 only
    expect(md).toContain('ROADMAP #001');
    const filled = md.replace('Your call: ___', 'Your call: P1 effort: XL');
    const parsed = parseIndividualFlags(filled);
    expect(parsed[0]).toMatchObject({ check_id: 'C002', priority: 'P1', effort: 'XL' });
  });

  it('individual flags round-trip with comment-only', () => {
    const md = buildIndividualFlags([fakeRows[0]]);
    const filled = md.replace('Your call: ___', 'Your call: comment: depends on robots fetcher');
    const parsed = parseIndividualFlags(filled);
    expect(parsed[0].comment).toBe('depends on robots fetcher');
    expect(parsed[0].priority).toBeUndefined();
    expect(parsed[0].effort).toBeUndefined();
  });

  it('dryrun table renders all priority + effort fields', () => {
    const md = buildDryrunTable(fakeRows);
    expect(md).toContain('| C001 |');
    expect(md).toContain('| C002 |');
    expect(md).toContain('| C003 |');
    expect(md).toContain('P0');
    expect(md).toContain('P1');
    expect(md).toContain('M');
    expect(md).toContain('L');
    expect(md).toContain('S');
  });
});
```

- [ ] **Step 7: Run tests, verify PASS**

Run: `cd scripts/audit-checks-roadmap && npm test -- output`
Expected: PASS — 7 cases.

- [ ] **Step 8: Commit**

```bash
git add scripts/audit-checks-roadmap/src/output/ \
        scripts/audit-checks-roadmap/__tests__/output.test.js
git commit -m "feat(roadmap): output writers (csv + summary + bulk + individual + dryrun)"
```

---

### Task 9: CLI entry point

**Files:**
- Create: `scripts/audit-checks-roadmap/src/cli.js`

- [ ] **Step 1: Implement CLI**

Write `src/cli.js`:

```js
#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from './csv.js';
import { runRoadmap } from './roadmap.js';
import { writeExtendedCanonicalCsv } from './output/canonical-csv.js';
import { buildRoadmapSummary } from './output/summary-md.js';
import { buildBulkDecisions, parseBulkDecisions } from './output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from './output/individual-md.js';
import { buildDryrunTable } from './output/dryrun-md.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = join(PROJECT_ROOT, 'docs', 'audit-checks');
const CANONICAL_CSV = join(OUT_DIR, 'canonical-checks-v1.csv');

async function ensureOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function dryrun() {
  await ensureOutDir();
  const { rows } = await runRoadmap({ limit: 25 });
  await writeFile(join(OUT_DIR, 'roadmap-dryrun-25rows.md'), buildDryrunTable(rows));
  console.log('Dry-run table written to docs/audit-checks/roadmap-dryrun-25rows.md');
}

async function fullpass() {
  await ensureOutDir();
  const { rows } = await runRoadmap();

  // Merge annotated rows back into the full canonical CSV
  const allText = await readFile(CANONICAL_CSV, 'utf8');
  const allRows = parseCsv(allText);
  const byId = new Map(rows.map(r => [r.check_id, r]));
  const merged = allRows.map(r => {
    const upd = byId.get(r.check_id);
    return upd ? { ...r, priority: upd.priority, effort: upd.effort, roadmap_notes: upd.roadmap_notes } : r;
  });

  await writeFile(join(OUT_DIR, 'canonical-checks-v1.draft.csv'), writeExtendedCanonicalCsv(merged));
  await writeFile(join(OUT_DIR, 'roadmap-run-summary.md'), buildRoadmapSummary(rows, { label: 'R3 full pass' }));
  await writeFile(join(OUT_DIR, 'roadmap-bulk-decisions.md'), buildBulkDecisions(rows));
  console.log('Full-pass artifacts written to docs/audit-checks/.');
  console.log('NEXT: edit roadmap-bulk-decisions.md (fill `Decision:` lines), then run `applybulk`.');
}

async function applybulk() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const bulkPath = join(OUT_DIR, 'roadmap-bulk-decisions.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const bulkText = await readFile(bulkPath, 'utf8');
  const draftRows = parseCsv(draftCsvText);
  const bulkAnswers = parseBulkDecisions(bulkText);

  // Track which rows were flagged for individual review
  const flaggedIds = new Set();

  for (const ans of bulkAnswers) {
    if (!ans.decision || ans.decision === '___') continue;

    for (const row of draftRows) {
      if (row.priority !== ans.priority || row.category !== ans.category) continue;
      if (!row.priority || !row.effort) continue;  // skip out-of-scope rows

      if (ans.decision === 'accept') {
        // No-op; keep heuristic values
        continue;
      }
      if (ans.decision.startsWith('reshape:')) {
        const newP = ans.decision.split(':')[1].trim();
        if (['P0', 'P1', 'P2'].includes(newP)) {
          row.roadmap_notes = `${row.roadmap_notes}; bulk reshape: ${row.priority}→${newP} (${ans.category} group)`;
          row.priority = newP;
        }
        continue;
      }
      if (ans.decision === 'flag-individually') {
        flaggedIds.add(row.check_id);
        row.roadmap_notes = `${row.roadmap_notes}; bulk flag-individually`;
      }
    }
  }

  // Determine which rows go into individual.md: flagged ones, OR rows with PRIORITY-FLAG/EFFORT-FLAG
  const individualRows = draftRows.filter(r => {
    if (flaggedIds.has(r.check_id)) return true;
    const notes = r.roadmap_notes || '';
    return notes.includes('PRIORITY-FLAG') || notes.includes('EFFORT-FLAG');
  });

  await writeFile(draftCsvPath, writeExtendedCanonicalCsv(draftRows));
  await writeFile(join(OUT_DIR, 'roadmap-individual.md'), buildIndividualFlags(individualRows));
  console.log(`Bulk decisions applied. ${individualRows.length} items routed to individual review.`);
  console.log('NEXT: edit roadmap-individual.md (fill `Your call:` lines), then run `finalize`.');
}

async function finalize() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const individualPath = join(OUT_DIR, 'roadmap-individual.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const individualText = await readFile(individualPath, 'utf8');
  const draftRows = parseCsv(draftCsvText);
  const indivAnswers = parseIndividualFlags(individualText);

  for (const ans of indivAnswers) {
    if (!ans.check_id || !ans.raw || ans.raw === '___') continue;
    const row = draftRows.find(r => r.check_id === ans.check_id);
    if (!row) continue;

    if (ans.comment !== undefined) {
      row.roadmap_notes = `${row.roadmap_notes}; comment: ${ans.comment}`;
      continue;
    }
    if (ans.priority) {
      row.roadmap_notes = `${row.roadmap_notes}; individual override: ${row.priority}→${ans.priority}`;
      row.priority = ans.priority;
    }
    if (ans.effort) {
      row.roadmap_notes = `${row.roadmap_notes}; individual override: effort ${row.effort}→${ans.effort}`;
      row.effort = ans.effort;
    }
  }

  // Promote draft to final canonical CSV
  await writeFile(CANONICAL_CSV, writeExtendedCanonicalCsv(draftRows));
  // Generate final summary (only the in-scope rows for the summary stats)
  const inScopeRows = draftRows.filter(r => r.priority && r.priority !== '');
  await writeFile(join(OUT_DIR, 'roadmap-summary.md'), buildRoadmapSummary(inScopeRows, { label: 'R7 finalized' }));
  console.log('Finalized canonical CSV + roadmap-summary.md written.');
  console.log('NEXT: review, then `git rm` drafts and commit per plan Task 16.');
}

const cmd = process.argv[2];
const handlers = { dryrun, fullpass, applybulk, finalize };
if (!handlers[cmd]) {
  console.error(`Usage: node src/cli.js <dryrun|fullpass|applybulk|finalize>`);
  process.exit(1);
}
handlers[cmd]().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Smoke-run dryrun**

Run: `cd scripts/audit-checks-roadmap && npm run cli -- dryrun`
Expected: writes `docs/audit-checks/roadmap-dryrun-25rows.md`.

- [ ] **Step 3: Verify output looks reasonable**

Run: `head -30 "docs/audit-checks/roadmap-dryrun-25rows.md"` (from project root)
Expected: header line + 25 rows of priority/effort decisions.

- [ ] **Step 4: Commit (CLI only — not the dryrun output yet, that's R1)**

```bash
git add scripts/audit-checks-roadmap/src/cli.js
git commit -m "feat(roadmap): cli entry with dryrun/fullpass/applybulk/finalize"
```

---

## Phase B — Execute Milestones

### Task 10: R1 — Dry-run on first 25 in-scope rows (autonomous)

**Files touched:**
- `docs/audit-checks/roadmap-dryrun-25rows.md`

- [ ] **Step 1: Run dryrun**

Run: `cd scripts/audit-checks-roadmap && npm run cli -- dryrun`
Expected: file written.

- [ ] **Step 2: Hand off to user for R2 review (do NOT commit yet)**

Stage the artifact but wait for user approval before committing. The user reviews `roadmap-dryrun-25rows.md` to calibrate the rubrics.

---

### Task 11: ◇ R2 — User dry-run review (CHECKPOINT)

**HALT execution and wait for user.**

> "Dry-run complete on the first 25 in-scope canonical rows. Review `docs/audit-checks/roadmap-dryrun-25rows.md`. If you'd flip ≥3 priorities or efforts, tell me which rubric needs tightening (e.g., 'partial promotion is too aggressive', 'category-tier for X is wrong') and I'll revise + re-run R1. Otherwise reply 'proceed' and I'll start the full pass."

**Do not proceed until the user replies "proceed" or provides rubric edits.**

If user requests rubric edits:
- Apply the edit to the appropriate file (`src/rubric/priority.js`, `src/rubric/effort.js`, or `src/rubric/category-tier.js`)
- Update the affected unit test
- Re-run Task 10 dryrun
- Loop R2 until user accepts

Once user replies "proceed":

```bash
git add docs/audit-checks/roadmap-dryrun-25rows.md
git commit -m "docs(audit-checks): R1 roadmap dry-run"
```

---

### Task 12: R3 — Full pass on all 163 rows (autonomous)

**Files touched:**
- `docs/audit-checks/canonical-checks-v1.draft.csv`
- `docs/audit-checks/roadmap-bulk-decisions.md`
- `docs/audit-checks/roadmap-run-summary.md`

- [ ] **Step 1: Run fullpass**

Run: `cd scripts/audit-checks-roadmap && npm run cli -- fullpass`
Expected: 3 files written. Console prints "NEXT: edit ... bulk-decisions.md".

- [ ] **Step 2: Sanity-check counts**

Run: `head -25 "docs/audit-checks/roadmap-run-summary.md"` (from project root)
Expected:
- Total in-scope: 163 (149 missing + 14 partial)
- "By priority" includes P0/P1/P2 with non-zero counts
- "By effort" includes S/M/L (XL likely 0 from heuristic)

- [ ] **Step 3: Sanity-check the draft CSV**

Run: `head -1 docs/audit-checks/canonical-checks-v1.draft.csv | tr ',' '\n' | wc -l`
Expected: 26 columns.

- [ ] **Step 4: Commit R3 artifacts**

```bash
git add docs/audit-checks/canonical-checks-v1.draft.csv \
        docs/audit-checks/roadmap-run-summary.md \
        docs/audit-checks/roadmap-bulk-decisions.md
git commit -m "docs(audit-checks): R3 full-pass artifacts (draft canonical + bulk-triage)"
```

---

### Task 13: ◇ R4 — User bulk-decisions review (CHECKPOINT)

**HALT execution and wait for user.**

> "Bulk-decisions file ready. Edit `> Decision: ___` lines in `docs/audit-checks/roadmap-bulk-decisions.md` in place. Allowed values: `accept`, `reshape: P0` / `reshape: P1` / `reshape: P2`, `flag-individually`. Reply when done."

**Do not proceed until user replies "done" (or equivalent).**

---

### Task 14: R5 — Apply bulk + emit individual flags (autonomous)

**Files touched:**
- `docs/audit-checks/canonical-checks-v1.draft.csv` (updated)
- `docs/audit-checks/roadmap-individual.md` (created)

- [ ] **Step 1: Run applybulk**

Run: `cd scripts/audit-checks-roadmap && npm run cli -- applybulk`
Expected:
- draft CSV updated in place with bulk reshape decisions baked in
- `roadmap-individual.md` lists items flagged for individual review (`flag-individually` items + items with PRIORITY-FLAG/EFFORT-FLAG)

- [ ] **Step 2: Sanity-check individual count**

Run: `grep -c "^## ROADMAP" "docs/audit-checks/roadmap-individual.md"`
Expected: 0–30 items. If much higher, the bulk reshape was too coarse; if 0 with no PRIORITY-FLAG items, no individual triage needed.

- [ ] **Step 3: Commit**

```bash
git add docs/audit-checks/canonical-checks-v1.draft.csv \
        docs/audit-checks/roadmap-individual.md
git commit -m "docs(audit-checks): R5 apply bulk decisions, emit individual triage"
```

---

### Task 15: ◇ R6 — User individual-flags review (CHECKPOINT)

**HALT execution and wait for user.**

> "Individual triage ready. For each item, edit the `Your call: ___` line in `docs/audit-checks/roadmap-individual.md`. Allowed values: `P0` / `P1` / `P2` (re-priority), `effort: S/M/L/XL` (re-effort), combined like `P0 effort: L`, or `comment: <text>` (free-text note only). Reply when done."

**Do not proceed until user replies "done".**

---

### Task 16: R7 — Finalize + companion docs (autonomous)

**Files touched:**
- Updated: `docs/audit-checks/canonical-checks-v1.csv` (now 26 columns; 163 in-scope rows have priority/effort/roadmap_notes populated)
- Created: `docs/audit-checks/roadmap-summary.md`
- Deleted: `docs/audit-checks/canonical-checks-v1.draft.csv`
- Deleted: `docs/audit-checks/roadmap-bulk-decisions.md`
- Deleted: `docs/audit-checks/roadmap-individual.md`
- Deleted: `docs/audit-checks/roadmap-run-summary.md`
- Deleted: `docs/audit-checks/roadmap-dryrun-25rows.md`

- [ ] **Step 1: Run finalize**

Run: `cd scripts/audit-checks-roadmap && npm run cli -- finalize`
Expected: final files written.

- [ ] **Step 2: Embed Decision Log into roadmap-summary.md**

Append the individual triage answers as an audit trail:

```bash
echo "" >> docs/audit-checks/roadmap-summary.md
echo "## Decision log (individual triage answers)" >> docs/audit-checks/roadmap-summary.md
echo "" >> docs/audit-checks/roadmap-summary.md
cat docs/audit-checks/roadmap-individual.md >> docs/audit-checks/roadmap-summary.md
```

- [ ] **Step 3: Verify final canonical CSV**

Run: `head -1 docs/audit-checks/canonical-checks-v1.csv | awk -F',' '{print NF}'`
Expected: 26 columns.

Run: `wc -l docs/audit-checks/canonical-checks-v1.csv`
Expected: 611 lines (1 header + 610 rows — same row count as Phase 2; only the 163 in-scope rows have non-empty new columns).

- [ ] **Step 4: Delete drafts**

```bash
git rm docs/audit-checks/canonical-checks-v1.draft.csv \
       docs/audit-checks/roadmap-bulk-decisions.md \
       docs/audit-checks/roadmap-individual.md \
       docs/audit-checks/roadmap-run-summary.md \
       docs/audit-checks/roadmap-dryrun-25rows.md
```

- [ ] **Step 5: Commit final artifacts**

```bash
git add docs/audit-checks/canonical-checks-v1.csv \
        docs/audit-checks/roadmap-summary.md
git commit -m "docs(audit-checks): produce roadmap v1"
```

- [ ] **Step 6: Final sanity check**

Run: `git log --oneline -10`
Expected: spec commit, plan commit, Task 1–9 build commits, R1/R3/R5 milestone commits, final R7 commit.

---

## Verification Checklist (run after Task 16)

- [ ] All 7 test files pass: `cd scripts/audit-checks-roadmap && npm test` (~30 tests expected: csv 4 + canonical 3 + category-tier 5 + priority 8 + effort 5 + roadmap 5 + output 7 = 37)
- [ ] `docs/audit-checks/canonical-checks-v1.csv` has 26 columns
- [ ] In-scope 163 rows all have non-empty `priority` and `effort`
- [ ] Out-of-scope rows have empty `priority`/`effort`/`roadmap_notes` columns (untouched)
- [ ] `docs/audit-checks/roadmap-summary.md` includes by-priority, by-effort, crosstab, P0/P1/P2 backlogs, and decision log
- [ ] All draft files deleted
- [ ] No changes to `backend/services/audit-parser.service.js` or any platform code
- [ ] No changes to `backend/db/seed/audit-checks.js`
- [ ] No changes to `frontend/src/lib/auditCategories.js`
- [ ] No changes to `PRD.md`
- [ ] No new database migrations
- [ ] No imports from `scripts/audit-checks-gapmap/` or `scripts/audit-checks-reconcile/`

---

## Out of Scope (Phase 4 preview)

After this spec is realized, Phase 4 picks up:

- Implement P0 cluster (or whichever cluster the human ops decision points to first).
- Calibrate S/M/L/XL labels against actual implementation velocity from the first few P0 tickets.
- Re-seed `backend/db/seed/audit-checks.js` from canonical CSV.
- Update `PRD.md` to reflect the canonical 610-row count and 24-category taxonomy.
- Decide whether `Local SEO & GEO` rename in `frontend/src/lib/auditCategories.js` is still needed.
- Manual-check workflow doc for the 38 n-a items (separate effort).

## Known v1 Limitations

- **Re-running `fullpass` after R7 finalize loses prior user overrides.** The merge in `cli.js fullpass()` overwrites `priority`, `effort`, and `roadmap_notes` from freshly-computed heuristics. Spec §10's claim about "preserves any user `comment:` notes" is aspirational — it would require parsing existing notes and re-attaching `comment:` / `individual override:` / `bulk reshape:` fragments. This complexity is deferred to Phase 4+ if re-runs become a real workflow. For the first Phase 3 run (current scope), the canonical CSV starts with empty priority/effort columns, so re-run idempotency does not apply.
