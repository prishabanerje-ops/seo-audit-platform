# Audit Checks Canonical Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reconciliation tooling and execute six milestones to produce one canonical, reconciled SEO check list (CSV + companion docs) that merges the external 321-row CSV with the 291-check seed.

**Architecture:** A standalone Node.js CLI in `scripts/audit-checks-reconcile/` that loads the input CSV and seed module, applies a rule pipeline (flag → cut → merge → edit → keep, with reclassify as post-processor), assigns stable IDs, and emits markdown + CSV artifacts under `docs/audit-checks/`. No platform code is modified. Each milestone is a CLI subcommand the user runs at a checkpoint; user answers are captured by editing the markdown the previous milestone emitted.

**Tech Stack:** Node.js 20+ ESM, vitest for tests, `csv-parse` + `csv-stringify` for CSV I/O, no other runtime deps.

**Spec:** [docs/superpowers/specs/2026-04-25-audit-checks-canonical-reconciliation-design.md](../specs/2026-04-25-audit-checks-canonical-reconciliation-design.md)

---

## File Structure

```
scripts/audit-checks-reconcile/
├── package.json                       # local devDeps: csv-parse, csv-stringify, vitest
├── README.md                          # how to run each milestone
├── src/
│   ├── cli.js                         # entry: dryrun | fullpass | applybulk | finalize
│   ├── csv.js                         # parseCsv() + writeCsv() wrappers
│   ├── seed.js                        # loadSeed() — imports backend AUDIT_CHECKS
│   ├── normalize.js                   # normalizeName() — lowercase + punct strip
│   ├── taxonomy.js                    # CANONICAL_CATEGORIES (23) + CATEGORY_RENAMES
│   ├── match.js                       # semanticMatch() — token overlap heuristic
│   ├── id.js                          # allocateIds() — assigns C001..Cnnn
│   ├── reconcile.js                   # main pipeline orchestration
│   ├── rules/
│   │   ├── flag.js                    # R-F1..R-F5 (run first, short-circuit)
│   │   ├── cut.js                     # R-C1, R-C2, R-C3a, R-C4
│   │   ├── merge.js                   # R-M1, R-M2, R-M3-part-a
│   │   ├── edit.js                    # R-E1 (R-E2/E3 are preprocessing)
│   │   ├── reclassify.js              # R-R1, R-R2, R-R3 (post-decision)
│   │   └── apply.js                   # orchestrator with tie-breaker
│   └── output/
│       ├── canonical-csv.js           # emit canonical-checks-v1[.draft].csv
│       ├── summary-md.js              # emit run-summary.md / canonical-checks-v1.md
│       ├── bulk-decisions-md.js       # emit triage-bulk-decisions.md
│       ├── individual-md.js           # emit triage-individual.md
│       └── rename-map-md.js           # emit category-rename-map.md
└── __tests__/
    ├── csv.test.js
    ├── seed.test.js
    ├── normalize.test.js
    ├── taxonomy.test.js
    ├── match.test.js
    ├── id.test.js
    ├── rules-flag.test.js
    ├── rules-cut.test.js
    ├── rules-merge.test.js
    ├── rules-edit.test.js
    ├── rules-reclassify.test.js
    ├── rules-apply.test.js
    └── reconcile.test.js

docs/audit-checks/                     # outputs (created on first run)
├── dryrun-25rows.md                   # M1
├── canonical-checks-v1.draft.csv      # M3
├── triage-bulk-decisions.md           # M3 (user edits in place)
├── run-summary.md                     # M3
├── triage-individual.md               # M5 (user edits in place)
├── canonical-checks-v1.csv            # M7 (final)
├── canonical-checks-v1.md             # M7 (final, with decision log)
└── category-rename-map.md             # M7 (final)
```

**Module boundaries.** Each `src/` file has one responsibility. `cli.js` orchestrates subcommands but contains no logic. `reconcile.js` is the pure pipeline. `rules/*` are pure predicates. `output/*` are pure writers. This separation keeps tests focused and lets future phases (gap-map) reuse `seed.js`, `csv.js`, `normalize.js`, `taxonomy.js`.

---

## Phase A — Build Tooling (TDD)

### Task 1: Project setup

**Files:**
- Create: `scripts/audit-checks-reconcile/package.json`
- Create: `scripts/audit-checks-reconcile/README.md`
- Create: `scripts/audit-checks-reconcile/vitest.config.js`

- [ ] **Step 1: Create the local package**

Write `scripts/audit-checks-reconcile/package.json`:

```json
{
  "name": "audit-checks-reconcile",
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

Write `scripts/audit-checks-reconcile/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.js'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Create README with run instructions**

Write `scripts/audit-checks-reconcile/README.md`:

```markdown
# Audit Checks Reconciliation Tool

One-shot tooling for Phase 1 of the canonical reconciliation. Produces docs only, no platform code is modified.

## Setup

    cd scripts/audit-checks-reconcile && npm install

## Milestone subcommands

    npm run cli -- dryrun       # M1: rubric on first 25 CSV rows
    npm run cli -- fullpass     # M3: full pass + seed reconciliation
    npm run cli -- applybulk    # M5: apply edited bulk-decisions.md, emit individual-flag file
    npm run cli -- finalize     # M7: apply edited individual.md, produce final CSV + companion docs

## Tests

    npm test
```

- [ ] **Step 4: Install deps**

Run: `cd scripts/audit-checks-reconcile && npm install`
Expected: `csv-parse`, `csv-stringify`, `vitest` install without errors.

- [ ] **Step 5: Verify vitest finds zero tests**

Run: `cd scripts/audit-checks-reconcile && npm test`
Expected: vitest exits 0 with "No test files found" or similar.

- [ ] **Step 6: Commit**

```bash
git add scripts/audit-checks-reconcile/package.json \
        scripts/audit-checks-reconcile/package-lock.json \
        scripts/audit-checks-reconcile/vitest.config.js \
        scripts/audit-checks-reconcile/README.md
git commit -m "chore(reconcile): scaffold audit-checks reconciliation tool"
```

---

### Task 2: CSV I/O module

**Files:**
- Create: `scripts/audit-checks-reconcile/src/csv.js`
- Test: `scripts/audit-checks-reconcile/__tests__/csv.test.js`

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
});

describe('writeCsv', () => {
  it('writes header + rows preserving column order from `columns`', async () => {
    const text = await writeCsv(
      [{ a: '1', b: '2' }, { a: '3', b: '4' }],
      ['a', 'b'],
    );
    expect(text).toBe('a,b\n1,2\n3,4\n');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test`
Expected: FAIL with "Cannot find module '../src/csv.js'".

- [ ] **Step 3: Implement csv.js**

Write `src/csv.js`:

```js
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export async function parseCsv(text) {
  return parse(text, { columns: true, skip_empty_lines: true, trim: false });
}

export async function writeCsv(rows, columns) {
  return stringify(rows, { header: true, columns });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test`
Expected: PASS — both `parseCsv` and `writeCsv` tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/csv.js \
        scripts/audit-checks-reconcile/__tests__/csv.test.js
git commit -m "feat(reconcile): csv parse/write wrappers with quoted-comma test"
```

---

### Task 3: Seed loader

**Files:**
- Create: `scripts/audit-checks-reconcile/src/seed.js`
- Test: `scripts/audit-checks-reconcile/__tests__/seed.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/seed.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { loadSeed } from '../src/seed.js';

describe('loadSeed', () => {
  it('returns array with check_number 1..N and required fields', async () => {
    const seed = await loadSeed();
    expect(Array.isArray(seed)).toBe(true);
    expect(seed.length).toBeGreaterThan(280);
    expect(seed.length).toBeLessThan(310);
    const first = seed[0];
    expect(first.check_number).toBe(1);
    for (const key of ['name', 'category', 'severity_default', 'automation_type']) {
      expect(typeof first[key]).toBe('string');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement seed.js**

Write `src/seed.js`:

```js
import { AUDIT_CHECKS } from '../../../backend/db/seed/audit-checks.js';

export async function loadSeed() {
  return AUDIT_CHECKS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test`
Expected: PASS — seed length ~291.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/seed.js \
        scripts/audit-checks-reconcile/__tests__/seed.test.js
git commit -m "feat(reconcile): seed loader sourcing backend AUDIT_CHECKS"
```

---

### Task 4: Name normalization

**Files:**
- Create: `scripts/audit-checks-reconcile/src/normalize.js`
- Test: `scripts/audit-checks-reconcile/__tests__/normalize.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/normalize.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeName } from '../src/normalize.js';

describe('normalizeName', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeName('Toxic / Spammy Links')).toBe('toxic spammy links');
    expect(normalizeName('301 vs 302 Usage')).toBe('301 vs 302 usage');
    expect(normalizeName('Hreflang vs. Canonical Conflict')).toBe('hreflang vs canonical conflict');
  });

  it('collapses repeated whitespace and trims', () => {
    expect(normalizeName('  Foo   Bar  ')).toBe('foo bar');
  });

  it('returns empty string for nullish input', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement normalize.js**

Write `src/normalize.js`:

```js
export function normalizeName(input) {
  if (input == null) return '';
  return String(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/normalize.js \
        scripts/audit-checks-reconcile/__tests__/normalize.test.js
git commit -m "feat(reconcile): name normalization for cross-source matching"
```

---

### Task 5: Canonical taxonomy

**Files:**
- Create: `scripts/audit-checks-reconcile/src/taxonomy.js`
- Test: `scripts/audit-checks-reconcile/__tests__/taxonomy.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/taxonomy.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { CANONICAL_CATEGORIES, mapCategory, recategorizeBotPolicy } from '../src/taxonomy.js';

describe('CANONICAL_CATEGORIES', () => {
  it('contains exactly 23 unique slugs including Local SEO (renamed)', () => {
    expect(CANONICAL_CATEGORIES.length).toBe(23);
    expect(new Set(CANONICAL_CATEGORIES).size).toBe(23);
    expect(CANONICAL_CATEGORIES).toContain('Local SEO');
    expect(CANONICAL_CATEGORIES).not.toContain('Local SEO & GEO');
  });
});

describe('mapCategory', () => {
  it('renames Local SEO & GEO to Local SEO (R-M3 part b)', () => {
    expect(mapCategory('Local SEO & GEO')).toBe('Local SEO');
  });

  it('passes through canonical names unchanged', () => {
    expect(mapCategory('Title Tags')).toBe('Title Tags');
    expect(mapCategory('GEO & LLM Crawlers')).toBe('GEO & LLM Crawlers');
  });

  it('maps seed-style category names (DB taxonomy) to canonical slugs', () => {
    expect(mapCategory('Mobile SEO')).toBe('Mobile & Usability');
    expect(mapCategory('Schema / Structured Data')).toBe('Schema & Structured Data');
    expect(mapCategory('Robots / Indexability')).toBe('Crawlability & Indexability');
  });

  it('returns null for unrecognized category to surface taxonomy gaps', () => {
    expect(mapCategory('Made-Up Category')).toBe(null);
  });
});

describe('recategorizeBotPolicy (R-M3 part a)', () => {
  it('moves bot-policy checks from AI Overviews to GEO & LLM Crawlers', () => {
    const moved = recategorizeBotPolicy({
      name: 'AI Bot Access in Robots.txt',
      category: 'AI Overviews & AIO Optimization',
    });
    expect(moved.category).toBe('GEO & LLM Crawlers');
  });

  it('leaves rows in other categories unchanged', () => {
    const row = { name: 'AI Bot Access in Robots.txt', category: 'Robots & Crawl Directives' };
    expect(recategorizeBotPolicy(row).category).toBe('Robots & Crawl Directives');
  });

  it('leaves non-bot-policy AI Overviews rows unchanged', () => {
    const row = { name: 'Citation Audit on Perplexity', category: 'AI Overviews & AIO Optimization' };
    expect(recategorizeBotPolicy(row).category).toBe('AI Overviews & AIO Optimization');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- taxonomy`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement taxonomy.js**

Write `src/taxonomy.js`:

```js
export const CANONICAL_CATEGORIES = [
  'Response Codes & Redirects',
  'Canonicalisation',
  'Robots & Crawl Directives',
  'XML Sitemaps',
  'Crawlability & Indexability',
  'URL Structure',
  'JavaScript Rendering',
  'Mobile & Usability',
  'Security & HTTPS',
  'Core Web Vitals',
  'Title Tags',
  'Meta Descriptions',
  'Headings',
  'Content Quality',
  'Images',
  'Schema & Structured Data',
  'Internal Linking',
  'International SEO',
  'Rankings & Traffic',
  'Backlinks & Authority',
  'E-E-A-T Signals',
  'AI Overviews & AIO Optimization',
  'GEO & LLM Crawlers',
  'Local SEO',
];

const ALIASES = {
  // CSV → canonical (R-M3 rename)
  'Local SEO & GEO': 'Local SEO',
  // Seed DB categories → canonical (frontend slugs)
  'Mobile SEO': 'Mobile & Usability',
  'Schema / Structured Data': 'Schema & Structured Data',
  'Robots / Indexability': 'Crawlability & Indexability',
  'Speed & Performance': 'Core Web Vitals',
  'Monitoring & Operations': 'Security & HTTPS',
  'Sitemap': 'XML Sitemaps',
  'LLM / AI Crawlers': 'GEO & LLM Crawlers',
  'Rankings & Traffic Drops': 'Rankings & Traffic',
  'Canonical': 'Canonicalisation',
  'Response Codes': 'Response Codes & Redirects',
  'Meta Description': 'Meta Descriptions',
  'Content': 'Content Quality',
};

const CANONICAL_SET = new Set(CANONICAL_CATEGORIES);

export function mapCategory(input) {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (CANONICAL_SET.has(trimmed)) return trimmed;
  if (ALIASES[trimmed]) return ALIASES[trimmed];
  return null;
}

export function getRenameLog() {
  return Object.entries(ALIASES).map(([from, to]) => ({ from, to }));
}

// R-M3 part a: bot-policy checks placed in "AI Overviews & AIO Optimization"
// belong in "GEO & LLM Crawlers". This is preprocessing, not a decision rule —
// it mutates category before the rule pipeline runs.
const BOT_POLICY_KEYWORDS = [
  /\bbot\b/i, /\brobots\.txt\b/i, /\bllms?\.txt\b/i, /\bcrawler\b/i,
  /\bgoogle-extended\b/i, /\bgptbot\b/i, /\bclaudebot\b/i, /\bperplexitybot\b/i,
];

export function recategorizeBotPolicy(row) {
  if (row.category !== 'AI Overviews & AIO Optimization') return row;
  if (!BOT_POLICY_KEYWORDS.some(rx => rx.test(row.name || ''))) return row;
  return { ...row, category: 'GEO & LLM Crawlers', notes: appendNote(row.notes, 'recategorized by R-M3a (bot-policy → GEO & LLM Crawlers)') };
}

function appendNote(notes, addition) {
  return notes ? `${notes}; ${addition}` : addition;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- taxonomy`
Expected: PASS — all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/taxonomy.js \
        scripts/audit-checks-reconcile/__tests__/taxonomy.test.js
git commit -m "feat(reconcile): canonical 23-category taxonomy with rename map"
```

---

### Task 6: Semantic match heuristic

**Files:**
- Create: `scripts/audit-checks-reconcile/src/match.js`
- Test: `scripts/audit-checks-reconcile/__tests__/match.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/match.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { semanticMatch, tokenOverlap } from '../src/match.js';

describe('tokenOverlap', () => {
  it('returns 1.0 for identical tokens', () => {
    expect(tokenOverlap('foo bar baz', 'foo bar baz')).toBe(1);
  });

  it('returns Jaccard similarity for partial overlap', () => {
    // {foo,bar,baz} vs {foo,bar,qux} — intersection 2, union 4 = 0.5
    expect(tokenOverlap('foo bar baz', 'foo bar qux')).toBeCloseTo(0.5, 2);
  });

  it('returns 0 for disjoint sets', () => {
    expect(tokenOverlap('foo bar', 'baz qux')).toBe(0);
  });

  it('ignores stopwords', () => {
    // "the page" vs "page" → after stopwords, both = {page} → 1.0
    expect(tokenOverlap('the page', 'page')).toBe(1);
  });
});

describe('semanticMatch', () => {
  it('returns the seed entry whose normalized name overlaps >= threshold', () => {
    const seed = [
      { check_number: 1, name: 'All internal links return 200 status' },
      { check_number: 2, name: '404 pages return proper 404 status code' },
    ];
    const result = semanticMatch('Internal links return 200 status', seed, 0.7);
    expect(result?.check_number).toBe(1);
  });

  it('returns null when nothing meets threshold', () => {
    const seed = [{ check_number: 1, name: 'Hreflang configured correctly' }];
    expect(semanticMatch('Title tag length under 60 chars', seed, 0.9)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- match`
Expected: FAIL.

- [ ] **Step 3: Implement match.js**

Write `src/match.js`:

```js
import { normalizeName } from './normalize.js';

const STOPWORDS = new Set([
  'a','an','the','and','or','of','for','to','in','on','at','is','be','with','by',
]);

function tokenize(s) {
  return new Set(
    normalizeName(s)
      .split(' ')
      .filter(t => t && !STOPWORDS.has(t)),
  );
}

export function tokenOverlap(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function semanticMatch(name, seedEntries, threshold = 0.9) {
  let best = null;
  let bestScore = 0;
  for (const entry of seedEntries) {
    const score = tokenOverlap(name, entry.name);
    if (score > bestScore && score >= threshold) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- match`
Expected: PASS — all overlap and match cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/match.js \
        scripts/audit-checks-reconcile/__tests__/match.test.js
git commit -m "feat(reconcile): semantic match via Jaccard token overlap"
```

---

### Task 7: ID allocator

**Files:**
- Create: `scripts/audit-checks-reconcile/src/id.js`
- Test: `scripts/audit-checks-reconcile/__tests__/id.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/id.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { allocateIds } from '../src/id.js';

describe('allocateIds', () => {
  it('assigns C001..Cnnn padded to 3 digits', () => {
    const rows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    const out = allocateIds(rows);
    expect(out[0].check_id).toBe('C001');
    expect(out[1].check_id).toBe('C002');
    expect(out[2].check_id).toBe('C003');
  });

  it('preserves input order (stable sort by source priority is caller-driven)', () => {
    const rows = [{ name: 'first' }, { name: 'second' }];
    expect(allocateIds(rows).map(r => r.name)).toEqual(['first', 'second']);
  });

  it('does not overwrite existing check_id', () => {
    const rows = [{ name: 'a', check_id: 'C999' }, { name: 'b' }];
    const out = allocateIds(rows);
    expect(out[0].check_id).toBe('C999');
    expect(out[1].check_id).toBe('C001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- id`
Expected: FAIL.

- [ ] **Step 3: Implement id.js**

Write `src/id.js`:

```js
export function allocateIds(rows) {
  let counter = 1;
  return rows.map(row => {
    if (row.check_id) return row;
    const id = `C${String(counter).padStart(3, '0')}`;
    counter++;
    return { ...row, check_id: id };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- id`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/id.js \
        scripts/audit-checks-reconcile/__tests__/id.test.js
git commit -m "feat(reconcile): stable C001+ id allocator"
```

---

### Task 8: Cut rules (R-C1, R-C2, R-C3a, R-C4)

**Files:**
- Create: `scripts/audit-checks-reconcile/src/rules/cut.js`
- Test: `scripts/audit-checks-reconcile/__tests__/rules-cut.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/rules-cut.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { cutRules } from '../src/rules/cut.js';

const SEV = { critical: 3, warning: 2, info: 1 };
const ctx = (rows) => ({ allRows: rows });

describe('R-C1 exact-duplicate name', () => {
  it('cuts the lower-severity duplicate', () => {
    const a = { check_id: 'C001', name: 'Sitemap Exists', severity: 'info' };
    const b = { check_id: 'C002', name: 'Sitemap Exists', severity: 'critical' };
    const result = cutRules.find(r => r.id === 'R-C1').apply(a, ctx([a, b]));
    expect(result?.decision).toBe('cut');
  });

  it('does not cut when current row has higher severity', () => {
    const a = { check_id: 'C001', name: 'Sitemap Exists', severity: 'critical' };
    const b = { check_id: 'C002', name: 'Sitemap Exists', severity: 'info' };
    const result = cutRules.find(r => r.id === 'R-C1').apply(a, ctx([a, b]));
    expect(result).toBe(null);
  });
});

describe('R-C2 info subset of higher-severity check', () => {
  it('cuts an info row whose pass_condition is a substring of a warning row', () => {
    const a = { check_id: 'C001', severity: 'info', pass_condition: 'sitemap exists' };
    const b = { check_id: 'C002', severity: 'warning', pass_condition: 'sitemap exists and is valid xml' };
    const result = cutRules.find(r => r.id === 'R-C2').apply(a, ctx([a, b]));
    expect(result?.decision).toBe('cut');
  });
});

describe('R-C3a platform-incapable + info + no PRD commit', () => {
  it('cuts info-severity, manual, no integration', () => {
    const row = {
      check_id: 'C001',
      severity: 'info',
      automation_type: 'manual',
      category: 'Backlinks & Authority',
    };
    const result = cutRules.find(r => r.id === 'R-C3a').apply(row, ctx([row]));
    expect(result?.decision).toBe('cut');
  });

  it('does NOT cut critical/warning even if platform-incapable (those flag instead)', () => {
    const row = {
      check_id: 'C001',
      severity: 'critical',
      automation_type: 'manual',
      category: 'Backlinks & Authority',
    };
    const result = cutRules.find(r => r.id === 'R-C3a').apply(row, ctx([row]));
    expect(result).toBe(null);
  });
});

describe('R-C4 manual + opinion-only', () => {
  it('cuts when pass_condition is opinion-phrased and no measurable threshold', () => {
    const row = {
      check_id: 'C001',
      automation_type: 'manual',
      pass_condition: 'Brand voice is consistent',
      fail_condition: 'Brand voice is inconsistent',
    };
    const result = cutRules.find(r => r.id === 'R-C4').apply(row, ctx([row]));
    expect(result?.decision).toBe('cut');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-cut`
Expected: FAIL.

- [ ] **Step 3: Implement cut.js**

Write `src/rules/cut.js`:

```js
import { normalizeName } from '../normalize.js';

const SEV_RANK = { critical: 3, warning: 2, info: 1 };

const PLATFORM_INCAPABLE_CATEGORIES = new Set([
  'Backlinks & Authority',
]);

const OPINION_MARKERS = [
  /\bconsistent\b/i,
  /\bappropriate\b/i,
  /\bquality\b/i,
  /\bvoice\b/i,
  /\bsentiment\b/i,
];

function hasMeasurableThreshold(row) {
  const text = `${row.pass_condition || ''} ${row.fail_condition || ''}`;
  return /\d|\b(less than|greater than|<=?|>=?|≤|≥|min|max|count|ratio|percent|%)\b/i.test(text);
}

const R_C1 = {
  id: 'R-C1',
  type: 'cut',
  apply(row, ctx) {
    const norm = normalizeName(row.name);
    for (const other of ctx.allRows) {
      if (other.check_id === row.check_id) continue;
      if (normalizeName(other.name) !== norm) continue;
      const cur = SEV_RANK[row.severity] || 0;
      const oth = SEV_RANK[other.severity] || 0;
      if (cur < oth) {
        return { decision: 'cut', rule_id: 'R-C1', rationale: `duplicate of ${other.check_id}` };
      }
    }
    return null;
  },
};

const R_C2 = {
  id: 'R-C2',
  type: 'cut',
  apply(row, ctx) {
    if (row.severity !== 'info' || !row.pass_condition) return null;
    const cur = String(row.pass_condition).toLowerCase();
    for (const other of ctx.allRows) {
      if (other.check_id === row.check_id) continue;
      if ((SEV_RANK[other.severity] || 0) <= 1) continue;
      const oth = String(other.pass_condition || '').toLowerCase();
      if (oth.includes(cur) && oth !== cur) {
        return { decision: 'cut', rule_id: 'R-C2', rationale: `info subset of ${other.check_id}` };
      }
    }
    return null;
  },
};

const R_C3a = {
  id: 'R-C3a',
  type: 'cut',
  apply(row) {
    const incapable = PLATFORM_INCAPABLE_CATEGORIES.has(row.category) || row.automation_type === 'manual';
    if (!incapable) return null;
    if (row.severity !== 'info') return null;
    if (row.tool_future && row.tool_future !== 'Manual Review') return null;
    return { decision: 'cut', rule_id: 'R-C3a', rationale: 'platform-incapable + info + no PRD commit' };
  },
};

const R_C4 = {
  id: 'R-C4',
  type: 'cut',
  apply(row) {
    if (row.automation_type !== 'manual') return null;
    if (hasMeasurableThreshold(row)) return null;
    const text = `${row.pass_condition || ''} ${row.fail_condition || ''}`;
    if (!OPINION_MARKERS.some(rx => rx.test(text))) return null;
    return { decision: 'cut', rule_id: 'R-C4', rationale: 'manual opinion-only, no measurable threshold' };
  },
};

export const cutRules = [R_C1, R_C2, R_C3a, R_C4];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-cut`
Expected: PASS — all 4 rules.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/rules/cut.js \
        scripts/audit-checks-reconcile/__tests__/rules-cut.test.js
git commit -m "feat(reconcile): cut rules R-C1/C2/C3a/C4"
```

---

### Task 9: Merge rules (R-M1, R-M2)

**Files:**
- Create: `scripts/audit-checks-reconcile/src/rules/merge.js`
- Test: `scripts/audit-checks-reconcile/__tests__/rules-merge.test.js`

> **Note:** R-M3 part (a) — AI-bot-policy recategorization — is preprocessing implemented in `taxonomy.js#recategorizeBotPolicy` (Task 5), not a merge rule. R-M3 part (b) — `Local SEO & GEO` rename — is preprocessing via the `ALIASES` map in `taxonomy.js`. Only R-M1 and R-M2 are decision-changing merge rules.

- [ ] **Step 1: Write the failing test**

Write `__tests__/rules-merge.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mergeRules } from '../src/rules/merge.js';

const ctx = (rows) => ({ allRows: rows });

describe('R-M1 csv↔seed semantic match', () => {
  it('merges csv-only row into a both/seed-only row whose names match >=0.9', () => {
    const csvRow = { check_id: 'C001', source: 'csv-only', name: 'All internal links return 200' };
    const seedRow = { check_id: 'C002', source: 'seed-only', name: 'All internal links return 200 status' };
    const result = mergeRules.find(r => r.id === 'R-M1').apply(csvRow, ctx([csvRow, seedRow]));
    expect(result?.decision).toBe('merge');
    expect(result.merge_into).toBe('C002');
  });
});

describe('R-M2 same-signal across different categories', () => {
  it('merges into more specific category when names normalize equal but categories differ', () => {
    const a = { check_id: 'C001', name: 'HTTPS used', category: 'Security & HTTPS' };
    const b = { check_id: 'C002', name: 'HTTPS used', category: 'GEO & LLM Crawlers' };
    const result = mergeRules.find(r => r.id === 'R-M2').apply(b, ctx([a, b]));
    expect(result?.decision).toBe('merge');
    expect(result.merge_into).toBe('C001');
  });
});

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-merge`
Expected: FAIL.

- [ ] **Step 3: Implement merge.js**

Write `src/rules/merge.js`:

```js
import { normalizeName } from '../normalize.js';
import { tokenOverlap } from '../match.js';

const SPECIFICITY_RANK = {
  'Security & HTTPS': 5,
  'Schema & Structured Data': 5,
  'Core Web Vitals': 5,
  'GEO & LLM Crawlers': 4,
  'AI Overviews & AIO Optimization': 3,
};

function specificity(category) {
  return SPECIFICITY_RANK[category] ?? 1;
}

const R_M1 = {
  id: 'R-M1',
  type: 'merge',
  apply(row, ctx) {
    if (row.source !== 'csv-only') return null;
    let best = null;
    let bestScore = 0;
    for (const other of ctx.allRows) {
      if (other.check_id === row.check_id) continue;
      if (other.source === 'csv-only') continue;
      const score = tokenOverlap(row.name, other.name);
      if (score >= 0.9 && score > bestScore) {
        best = other;
        bestScore = score;
      }
    }
    if (!best) return null;
    return { decision: 'merge', rule_id: 'R-M1', merge_into: best.check_id, rationale: `semantic match seed ${best.seed_check_number || ''}` };
  },
};

const R_M2 = {
  id: 'R-M2',
  type: 'merge',
  apply(row, ctx) {
    const norm = normalizeName(row.name);
    for (const other of ctx.allRows) {
      if (other.check_id === row.check_id) continue;
      if (normalizeName(other.name) !== norm) continue;
      if (other.category === row.category) continue;
      if (specificity(other.category) > specificity(row.category)) {
        return { decision: 'merge', rule_id: 'R-M2', merge_into: other.check_id, rationale: 'cross-category same-signal; kept in more specific category' };
      }
    }
    return null;
  },
};

export const mergeRules = [R_M1, R_M2];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-merge`
Expected: PASS — all 3 rules.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/rules/merge.js \
        scripts/audit-checks-reconcile/__tests__/rules-merge.test.js
git commit -m "feat(reconcile): merge rules R-M1/M2/M3a"
```

---

### Task 10: Edit rules (R-E1)

**Files:**
- Create: `scripts/audit-checks-reconcile/src/rules/edit.js`
- Test: `scripts/audit-checks-reconcile/__tests__/rules-edit.test.js`

> **Note:** R-E2 (taxonomy normalization) and R-E3 (severity vocabulary) are preprocessing steps applied in `reconcile.js`, not decision rules. Only R-E1 (vague-name rewrite) lives here.

- [ ] **Step 1: Write the failing test**

Write `__tests__/rules-edit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { editRules } from '../src/rules/edit.js';

describe('R-E1 vague-name rewrite', () => {
  it('renames "Set If Needed" patterns to declarative form', () => {
    const row = { check_id: 'C001', name: 'Crawl-Delay Set If Needed' };
    const result = editRules.find(r => r.id === 'R-E1').apply(row);
    expect(result?.decision).toBe('edit');
    expect(result.revised_name).toMatch(/declared/i);
    expect(result.revised_name).not.toMatch(/if needed/i);
  });

  it('returns null for already-actionable names', () => {
    const row = { check_id: 'C001', name: 'All internal links return 200 status' };
    const result = editRules.find(r => r.id === 'R-E1').apply(row);
    expect(result).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-edit`
Expected: FAIL.

- [ ] **Step 3: Implement edit.js**

Write `src/rules/edit.js`:

```js
const VAGUE_PATTERNS = [
  { rx: /\bset if needed\b/i, replacement: 'declared where applicable' },
  { rx: /\bif relevant\b/i, replacement: 'where applicable' },
  { rx: /\bwhere appropriate\b/i, replacement: 'where applicable' },
  { rx: /\b(?:reviewed|review) regularly\b/i, replacement: 'reviewed on a defined cadence' },
];

const R_E1 = {
  id: 'R-E1',
  type: 'edit',
  apply(row) {
    if (!row.name) return null;
    let revised = row.name;
    let changed = false;
    for (const { rx, replacement } of VAGUE_PATTERNS) {
      if (rx.test(revised)) {
        revised = revised.replace(rx, replacement);
        changed = true;
      }
    }
    if (!changed) return null;
    return { decision: 'edit', rule_id: 'R-E1', revised_name: revised, rationale: 'vague phrasing rewritten' };
  },
};

export const editRules = [R_E1];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-edit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/rules/edit.js \
        scripts/audit-checks-reconcile/__tests__/rules-edit.test.js
git commit -m "feat(reconcile): edit rule R-E1 vague-name rewrite"
```

---

### Task 11: Reclassify rules (R-R1, R-R2, R-R3)

**Files:**
- Create: `scripts/audit-checks-reconcile/src/rules/reclassify.js`
- Test: `scripts/audit-checks-reconcile/__tests__/rules-reclassify.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/rules-reclassify.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { reclassify } from '../src/rules/reclassify.js';

describe('R-R1 manual → hybrid for crawler-detectable signals', () => {
  it('reclassifies CSV manual rows whose name matches a crawler-detectable signal', () => {
    const row = { name: 'Privacy Policy Present', automation_type: 'manual' };
    expect(reclassify(row).automation_type).toBe('hybrid');
  });
});

describe('R-R2 GSC/GA4 dependency note', () => {
  it('keeps automated but adds notes for GSC-dependent checks', () => {
    const row = { name: 'Search Console Coverage Errors', automation_type: 'automated' };
    const out = reclassify(row);
    expect(out.automation_type).toBe('automated');
    expect(out.notes).toMatch(/GSC/);
  });
});

describe('R-R3 genuinely human-only stays manual', () => {
  it('does not reclassify rows with no crawler-detectable signal', () => {
    const row = { name: 'Brand Voice Sentiment Review', automation_type: 'manual' };
    expect(reclassify(row).automation_type).toBe('manual');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-reclassify`
Expected: FAIL.

- [ ] **Step 3: Implement reclassify.js**

Write `src/rules/reclassify.js`:

```js
const HYBRID_DETECTABLE = [
  /\bprivacy policy\b/i,
  /\bcontact (page|us)\b/i,
  /\babout (page|us)\b/i,
  /\bauthor (schema|page|byline|sameAs)\b/i,
  /\bphysical address\b/i,
  /\bterms of service\b/i,
  /\bsecure payment\b/i,
];

const GSC_KEYWORDS = [/\bsearch console\b/i, /\bGSC\b/i, /\bcoverage\b/i, /\bimpressions?\b/i, /\bpositions?\b/i, /\bclicks\b/i];
const GA4_KEYWORDS = [/\bGA4\b/i, /\borganic traffic\b/i, /\bsessions?\b/i, /\bbounce rate\b/i];

function appendNote(notes, addition) {
  return notes ? `${notes}; ${addition}` : addition;
}

export function reclassify(row) {
  const next = { ...row };
  // R-R1
  if (next.automation_type === 'manual' && HYBRID_DETECTABLE.some(rx => rx.test(next.name || ''))) {
    next.automation_type = 'hybrid';
    next.notes = appendNote(next.notes, 'reclassified manual→hybrid (crawler can detect presence)');
  }
  // R-R2
  if (next.automation_type === 'automated') {
    if (GSC_KEYWORDS.some(rx => rx.test(next.name || ''))) {
      next.notes = appendNote(next.notes, 'requires GSC');
    }
    if (GA4_KEYWORDS.some(rx => rx.test(next.name || ''))) {
      next.notes = appendNote(next.notes, 'requires GA4');
    }
  }
  // R-R3 is implicit: rows that don't match R-R1/R-R2 stay as-is.
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-reclassify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/rules/reclassify.js \
        scripts/audit-checks-reconcile/__tests__/rules-reclassify.test.js
git commit -m "feat(reconcile): reclassify rules R-R1/R2/R3"
```

---

### Task 12: Flag rules (R-F1–R-F5)

**Files:**
- Create: `scripts/audit-checks-reconcile/src/rules/flag.js`
- Test: `scripts/audit-checks-reconcile/__tests__/rules-flag.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/rules-flag.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { flagRules } from '../src/rules/flag.js';

const find = (id) => flagRules.find(r => r.id === id);
const ctx = (rows) => ({ allRows: rows });

describe('R-F1 csv↔seed contradiction', () => {
  it('flags when severity differs between csv-only and a seed-only twin', () => {
    const a = { check_id: 'C001', source: 'csv-only', name: 'X', severity: 'info' };
    const b = { check_id: 'C002', source: 'seed-only', name: 'X', severity: 'critical' };
    const result = find('R-F1').apply(a, ctx([a, b]));
    expect(result?.decision).toBe('flag');
  });
});

describe('R-F2-extended platform-incapable critical/warning', () => {
  it('flags critical Backlinks rows for integration decision', () => {
    const row = { check_id: 'C001', category: 'Backlinks & Authority', severity: 'critical' };
    const result = find('R-F2').apply(row, ctx([row]));
    expect(result?.decision).toBe('flag');
    expect(result.notes).toMatch(/integration/i);
  });

  it('does NOT flag info-severity (R-C3a will cut)', () => {
    const row = { check_id: 'C001', category: 'Backlinks & Authority', severity: 'info' };
    expect(find('R-F2').apply(row, ctx([row]))).toBe(null);
  });
});

describe('R-F5 severity disagreement >1 step', () => {
  it('flags critical-vs-info pair', () => {
    const a = { check_id: 'C001', source: 'csv-only', name: 'X', severity: 'critical' };
    const b = { check_id: 'C002', source: 'seed-only', name: 'X', severity: 'info' };
    expect(find('R-F5').apply(a, ctx([a, b]))?.decision).toBe('flag');
  });

  it('does NOT flag adjacent severity (warning-info)', () => {
    const a = { check_id: 'C001', source: 'csv-only', name: 'Y', severity: 'warning' };
    const b = { check_id: 'C002', source: 'seed-only', name: 'Y', severity: 'info' };
    expect(find('R-F5').apply(a, ctx([a, b]))).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-flag`
Expected: FAIL.

- [ ] **Step 3: Implement flag.js**

Write `src/rules/flag.js`:

```js
import { normalizeName } from '../normalize.js';

const SEV_RANK = { critical: 3, warning: 2, info: 1 };
const PLATFORM_INCAPABLE = new Set(['Backlinks & Authority']);

const INTEGRATION_HINTS = {
  'Backlinks & Authority': 'requires backlink data API (e.g., DataForSEO Backlinks)',
};

function findSeedTwin(row, ctx) {
  if (row.source === 'seed-only') return null;
  const norm = normalizeName(row.name);
  for (const other of ctx.allRows) {
    if (other.check_id === row.check_id) continue;
    if (other.source !== 'seed-only' && other.source !== 'both') continue;
    if (normalizeName(other.name) === norm) return other;
  }
  return null;
}

const R_F1 = {
  id: 'R-F1',
  type: 'flag',
  apply(row, ctx) {
    const twin = findSeedTwin(row, ctx);
    if (!twin) return null;
    const sevDiff = Math.abs((SEV_RANK[row.severity] || 0) - (SEV_RANK[twin.severity] || 0));
    if (sevDiff === 1) {
      return { decision: 'flag', rule_id: 'R-F1', rationale: `csv↔seed severity contradiction (vs ${twin.check_id})` };
    }
    return null;
  },
};

const R_F2 = {
  id: 'R-F2',
  type: 'flag',
  apply(row) {
    if (!PLATFORM_INCAPABLE.has(row.category)) return null;
    if (row.severity !== 'critical' && row.severity !== 'warning') return null;
    return {
      decision: 'flag',
      rule_id: 'R-F2',
      rationale: 'platform-incapable critical/warning — integration decision needed',
      notes: INTEGRATION_HINTS[row.category],
    };
  },
};

const R_F3 = {
  id: 'R-F3',
  type: 'flag',
  apply(row) {
    // Heuristic: name contains tokens for ≥2 canonical categories
    const lower = `${row.name || ''}`.toLowerCase();
    let hits = 0;
    if (/\bschema\b/.test(lower)) hits++;
    if (/\bAI\b/i.test(row.name || '') || /\bllm\b/.test(lower)) hits++;
    if (/\blocal\b/.test(lower) || /\bGBP\b/.test(row.name || '')) hits++;
    if (/\bmobile\b/.test(lower)) hits++;
    if (hits >= 2) {
      return { decision: 'flag', rule_id: 'R-F3', rationale: 'spans ≥2 canonical categories' };
    }
    return null;
  },
};

const R_F4 = {
  id: 'R-F4',
  type: 'flag',
  apply(row, ctx) {
    if (row.source !== 'csv-only') return null;
    const norm = normalizeName(row.name);
    let candidates = 0;
    for (const other of ctx.allRows) {
      if (other.check_id === row.check_id) continue;
      if (other.source === 'csv-only') continue;
      if (normalizeName(other.name) === norm) candidates++;
    }
    if (candidates > 2) {
      return { decision: 'flag', rule_id: 'R-F4', rationale: `>2 merge candidates (${candidates})` };
    }
    return null;
  },
};

const R_F5 = {
  id: 'R-F5',
  type: 'flag',
  apply(row, ctx) {
    const twin = findSeedTwin(row, ctx);
    if (!twin) return null;
    const sevDiff = Math.abs((SEV_RANK[row.severity] || 0) - (SEV_RANK[twin.severity] || 0));
    if (sevDiff > 1) {
      return { decision: 'flag', rule_id: 'R-F5', rationale: `severity gap >1 (vs ${twin.check_id})` };
    }
    return null;
  },
};

export const flagRules = [R_F1, R_F2, R_F3, R_F4, R_F5];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-flag`
Expected: PASS — F1, F2, F5 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/rules/flag.js \
        scripts/audit-checks-reconcile/__tests__/rules-flag.test.js
git commit -m "feat(reconcile): flag rules R-F1..R-F5"
```

---

### Task 13: Rule orchestrator with tie-breaker

**Files:**
- Create: `scripts/audit-checks-reconcile/src/rules/apply.js`
- Test: `scripts/audit-checks-reconcile/__tests__/rules-apply.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/rules-apply.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { applyRules } from '../src/rules/apply.js';

describe('applyRules tie-breaker', () => {
  it('flag short-circuits cut/merge/edit', () => {
    const row = {
      check_id: 'C001',
      source: 'csv-only',
      name: 'Toxic Spammy Links',
      category: 'Backlinks & Authority',
      severity: 'critical',
      automation_type: 'manual',
    };
    const result = applyRules(row, { allRows: [row] });
    expect(result.decision).toBe('flag');
    expect(result.rule_id).toBe('R-F2');
  });

  it('cut beats merge when both could fire', () => {
    const a = { check_id: 'C001', name: 'X', severity: 'info' };
    const b = { check_id: 'C002', name: 'X', severity: 'critical' };
    const result = applyRules(a, { allRows: [a, b] });
    expect(result.decision).toBe('cut');
  });

  it('default keep when no rule matches', () => {
    const row = {
      check_id: 'C001',
      name: 'All internal links return 200',
      category: 'Response Codes & Redirects',
      severity: 'critical',
      automation_type: 'automated',
    };
    const result = applyRules(row, { allRows: [row] });
    expect(result.decision).toBe('keep');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-apply`
Expected: FAIL.

- [ ] **Step 3: Implement apply.js**

Write `src/rules/apply.js`:

```js
import { flagRules } from './flag.js';
import { cutRules } from './cut.js';
import { mergeRules } from './merge.js';
import { editRules } from './edit.js';

const ORDERED = [
  ...flagRules,    // F: short-circuit
  ...cutRules,     // C
  ...mergeRules,   // M
  ...editRules,    // E
];

export function applyRules(row, ctx) {
  for (const rule of ORDERED) {
    const result = rule.apply(row, ctx);
    if (result) return result;
  }
  return { decision: 'keep', rule_id: 'R-K', rationale: 'default' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- rules-apply`
Expected: PASS — flag short-circuit, cut beats merge, default keep.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/rules/apply.js \
        scripts/audit-checks-reconcile/__tests__/rules-apply.test.js
git commit -m "feat(reconcile): rule orchestrator with tie-breaker"
```

---

### Task 14: Reconciliation pipeline

**Files:**
- Create: `scripts/audit-checks-reconcile/src/reconcile.js`
- Test: `scripts/audit-checks-reconcile/__tests__/reconcile.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/reconcile.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { reconcile } from '../src/reconcile.js';

describe('reconcile', () => {
  it('tags csv-seed overlap as both, csv-unmatched as csv-only, seed-unmatched as seed-only', () => {
    const csvRows = [
      { group: 'Title Tags', sub_check_name: 'Title under 60 chars', severity: 'warning', automation_type: 'automated', pass_condition: '', fail_condition: '' },
      { group: 'Backlinks & Authority', sub_check_name: 'Toxic Spammy Links', severity: 'critical', automation_type: 'manual', pass_condition: '', fail_condition: '' },
    ];
    const seed = [
      { check_number: 1, name: 'Title under 60 characters', category: 'Title Tags', severity_default: 'warning', automation_type: 'automated' },
      { check_number: 99, name: 'Some seed-only check', category: 'Mobile SEO', severity_default: 'info', automation_type: 'automated' },
    ];
    const result = reconcile({ csvRows, seed });
    const sources = result.rows.map(r => r.source).sort();
    expect(sources).toEqual(['both', 'csv-only', 'seed-only']);
    const both = result.rows.find(r => r.source === 'both');
    expect(both.seed_check_number).toBe(1);
  });

  it('applies category mapping and rename', () => {
    const csvRows = [{ group: 'Local SEO & GEO', sub_check_name: 'GBP exists', severity: 'critical', automation_type: 'manual', pass_condition: '', fail_condition: '' }];
    const seed = [];
    const result = reconcile({ csvRows, seed });
    expect(result.rows[0].category).toBe('Local SEO');
  });

  it('limits to first N rows when limit option provided (for dry-run)', () => {
    const csvRows = Array.from({ length: 50 }, (_, i) => ({
      group: 'Title Tags', sub_check_name: `t${i}`, severity: 'info', automation_type: 'automated', pass_condition: '', fail_condition: '',
    }));
    const result = reconcile({ csvRows, seed: [], limit: 25 });
    expect(result.rows.filter(r => r.source !== 'seed-only').length).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/audit-checks-reconcile && npm test -- reconcile`
Expected: FAIL.

- [ ] **Step 3: Implement reconcile.js**

Write `src/reconcile.js`:

```js
import { mapCategory, recategorizeBotPolicy } from './taxonomy.js';
import { normalizeName } from './normalize.js';
import { applyRules } from './rules/apply.js';
import { reclassify } from './rules/reclassify.js';
import { allocateIds } from './id.js';

function csvRowToCanonical(csvRow, idx) {
  const mapped = mapCategory(csvRow.group);
  const base = {
    csv_row: idx + 2, // +1 for header, +1 for 1-indexed line number
    source: 'csv-only',
    category: mapped || csvRow.group,
    name: csvRow.sub_check_name,
    original_name: csvRow.sub_check_name,
    severity: csvRow.severity,
    automation_type: csvRow.automation_type,
    pass_condition: csvRow.pass_condition,
    fail_condition: csvRow.fail_condition,
    notes: csvRow.notes || '',
    _category_unmapped: !mapped,
  };
  return recategorizeBotPolicy(base); // R-M3 part a (preprocessing)
}

function seedRowToCanonical(seedRow) {
  const base = {
    seed_check_number: seedRow.check_number,
    source: 'seed-only',
    category: mapCategory(seedRow.category) || seedRow.category,
    name: seedRow.name,
    original_name: seedRow.name,
    severity: seedRow.severity_default,
    automation_type: seedRow.automation_type,
    implementation_rule: seedRow.implementation_rule || '',
    tool_current: seedRow.tool_current || '',
    tool_future: seedRow.tool_future || '',
    pass_condition: '',
    fail_condition: '',
    notes: '',
  };
  return recategorizeBotPolicy(base); // R-M3 part a (preprocessing)
}

export function reconcile({ csvRows, seed, limit }) {
  const csvSlice = limit ? csvRows.slice(0, limit) : csvRows;
  const csvCanonical = csvSlice.map(csvRowToCanonical);

  // Match csv→seed
  const seedByName = new Map();
  for (const s of seed) seedByName.set(normalizeName(s.name), s);
  const matchedSeedNumbers = new Set();
  for (const row of csvCanonical) {
    const seedHit = seedByName.get(normalizeName(row.name));
    if (seedHit) {
      row.source = 'both';
      row.seed_check_number = seedHit.check_number;
      row.implementation_rule = seedHit.implementation_rule || '';
      row.tool_current = seedHit.tool_current || '';
      row.tool_future = seedHit.tool_future || '';
      matchedSeedNumbers.add(seedHit.check_number);
    }
  }

  // Add seed-only rows
  const seedOnlyRows = limit
    ? []
    : seed
        .filter(s => !matchedSeedNumbers.has(s.check_number))
        .map(seedRowToCanonical);

  let allRows = [...csvCanonical, ...seedOnlyRows];
  allRows = allocateIds(allRows);

  // Apply decision rules
  const ctx = { allRows };
  for (const row of allRows) {
    const decision = applyRules(row, ctx);
    Object.assign(row, decision);
  }

  // Apply reclassify post-processor
  for (let i = 0; i < allRows.length; i++) {
    allRows[i] = reclassify(allRows[i]);
  }

  return { rows: allRows };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/audit-checks-reconcile && npm test -- reconcile`
Expected: PASS — all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-reconcile/src/reconcile.js \
        scripts/audit-checks-reconcile/__tests__/reconcile.test.js
git commit -m "feat(reconcile): reconciliation pipeline with rule + reclassify passes"
```

---

### Task 15: Output writers

**Files:**
- Create: `scripts/audit-checks-reconcile/src/output/canonical-csv.js`
- Create: `scripts/audit-checks-reconcile/src/output/summary-md.js`
- Create: `scripts/audit-checks-reconcile/src/output/bulk-decisions-md.js`
- Create: `scripts/audit-checks-reconcile/src/output/individual-md.js`
- Create: `scripts/audit-checks-reconcile/src/output/rename-map-md.js`

These are pure formatters. No tests beyond a smoke test confirming non-empty output — the real validation is the user reviewing the M1/M3/M5/M7 artifacts.

- [ ] **Step 1: Implement canonical CSV writer**

Write `src/output/canonical-csv.js`:

```js
import { writeCsv } from '../csv.js';

const COLUMNS = [
  'check_id', 'csv_row', 'seed_check_number', 'source',
  'category', 'subsection', 'name', 'original_name',
  'severity', 'automation_type', 'decision', 'merge_into',
  'rationale', 'pass_condition', 'fail_condition',
  'implementation_rule', 'tool_current', 'notes',
];

export async function writeCanonicalCsv(rows) {
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

export function buildRunSummary(rows, meta = {}) {
  const total = rows.length;
  const byDecision = countBy(rows, 'decision');
  const byCategory = countBy(rows, 'category');
  const bySeverity = countBy(rows, 'severity');
  const byAutomation = countBy(rows, 'automation_type');
  const bySource = countBy(rows, 'source');

  const lines = [];
  lines.push('# Run Summary');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  if (meta.label) lines.push(`- Label: ${meta.label}`);
  lines.push(`- Total rows: ${total}`);
  lines.push('');
  lines.push('## By decision');
  for (const [k, v] of Object.entries(byDecision)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By source');
  for (const [k, v] of Object.entries(bySource)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By severity');
  for (const [k, v] of Object.entries(bySeverity)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By automation_type');
  for (const [k, v] of Object.entries(byAutomation)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By category');
  for (const [k, v] of Object.entries(byCategory)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  return lines.join('\n');
}

export function buildDryrunTable(rows) {
  const header = '| csv_row | category | original_name | rule_fired | decision | revised_name | rationale |\n|---|---|---|---|---|---|---|';
  const body = rows.map(r => `| ${r.csv_row || ''} | ${r.category || ''} | ${r.original_name || ''} | ${r.rule_id || ''} | ${r.decision || ''} | ${r.revised_name || ''} | ${r.rationale || ''} |`).join('\n');
  return `# Dry-Run Decision Table (first 25 CSV rows)\n\n${header}\n${body}\n`;
}
```

- [ ] **Step 3: Implement bulk-decisions writer**

Write `src/output/bulk-decisions-md.js`:

```js
export function buildBulkDecisions(rows) {
  const flagged = rows.filter(r => r.decision === 'flag');
  const groups = new Map();
  for (const r of flagged) {
    const key = `${r.rule_id}|${r.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const lines = ['# Bulk Triage Decisions', '', 'For each group below, edit the `Decision:` line in place. Allowed values: `keep-all`, `cut-all`, `flag-individually` (forces per-row review in M5).', ''];
  let idx = 1;
  for (const [key, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const [rule, category] = key.split('|');
    lines.push(`## Group ${idx}: ${rule} in ${category} (${items.length} flags)`);
    lines.push('');
    lines.push('Sample names:');
    for (const r of items.slice(0, 5)) lines.push(`- ${r.original_name} [${r.severity}]`);
    if (items.length > 5) lines.push(`- ...and ${items.length - 5} more`);
    lines.push('');
    lines.push(`> Decision: ___`);
    lines.push('');
    idx++;
  }
  if (groups.size === 0) {
    lines.push('_No flag rules fired. Skip M4 and proceed to M5._');
  }
  return lines.join('\n');
}

export function parseBulkDecisions(markdown) {
  const groups = [];
  const groupRe = /## Group \d+: (\S+) in ([^()]+?) \((\d+) flags\)[\s\S]*?> Decision:\s*(\S+)/g;
  let m;
  while ((m = groupRe.exec(markdown))) {
    groups.push({ rule: m[1], category: m[2].trim(), count: Number(m[3]), decision: m[4] });
  }
  return groups;
}
```

- [ ] **Step 4: Implement individual-flag writer**

Write `src/output/individual-md.js`:

```js
export function buildIndividualFlags(rows) {
  const flagged = rows.filter(r => r.decision === 'flag');
  const lines = ['# Individual Flag Triage', '', 'For each flag, edit the `Your call:` line in place. Allowed values: `keep`, `cut`, `edit-and-keep`, `comment: <text>`.', ''];
  flagged.forEach((r, i) => {
    lines.push(`## FLAG #${String(i + 1).padStart(3, '0')}  ${r.check_id}`);
    lines.push(`- csv_row: ${r.csv_row || '(seed-only)'}`);
    lines.push(`- rule:   ${r.rule_id}`);
    lines.push(`- category: ${r.category}`);
    lines.push(`- name:   ${r.original_name}`);
    lines.push(`- severity: ${r.severity}`);
    lines.push(`- automation: ${r.automation_type}`);
    lines.push(`- rationale: ${r.rationale}`);
    if (r.notes) lines.push(`- notes:  ${r.notes}`);
    lines.push('');
    lines.push('> Your call: ___');
    lines.push('');
  });
  return lines.join('\n');
}

export function parseIndividualFlags(markdown) {
  const blocks = markdown.split(/\n## FLAG /).slice(1);
  return blocks.map(block => {
    const idMatch = block.match(/^#?\d+\s+(C\d+)/);
    const callMatch = block.match(/> Your call:\s*(.+?)\s*$/m);
    return {
      check_id: idMatch ? idMatch[1] : null,
      decision: callMatch ? callMatch[1].trim() : null,
    };
  });
}
```

- [ ] **Step 5: Implement rename-map writer**

Write `src/output/rename-map-md.js`:

```js
import { getRenameLog } from '../taxonomy.js';

export function buildRenameMap() {
  const log = getRenameLog();
  const lines = ['# Category Rename Map', '', 'Mappings applied in Phase 1 reconciliation. Frontend slugs and DB seed must be updated in a later phase.', '', '| From | To |', '|---|---|'];
  for (const { from, to } of log) lines.push(`| ${from} | ${to} |`);
  return lines.join('\n');
}
```

- [ ] **Step 6: Smoke-test the writers**

Write `__tests__/output.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { writeCanonicalCsv } from '../src/output/canonical-csv.js';
import { buildRunSummary, buildDryrunTable } from '../src/output/summary-md.js';
import { buildBulkDecisions, parseBulkDecisions } from '../src/output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from '../src/output/individual-md.js';
import { buildRenameMap } from '../src/output/rename-map-md.js';

describe('output writers smoke', () => {
  const rows = [
    { check_id: 'C001', csv_row: 2, source: 'csv-only', category: 'Title Tags', name: 'X', original_name: 'X', severity: 'warning', automation_type: 'automated', decision: 'keep', rule_id: 'R-K', rationale: 'default' },
    { check_id: 'C002', csv_row: 3, source: 'csv-only', category: 'Backlinks & Authority', name: 'Toxic', original_name: 'Toxic', severity: 'critical', automation_type: 'manual', decision: 'flag', rule_id: 'R-F2', rationale: 'platform-incapable' },
  ];

  it('writes csv with all required columns', async () => {
    const csv = await writeCanonicalCsv(rows);
    expect(csv).toContain('check_id,csv_row,seed_check_number,source');
    expect(csv).toContain('C001');
  });

  it('builds run summary with totals', () => {
    const md = buildRunSummary(rows);
    expect(md).toContain('Total rows: 2');
    expect(md).toContain('## By decision');
  });

  it('builds dry-run table', () => {
    expect(buildDryrunTable(rows)).toContain('| C001 |') // not in default cols, but rule_fired present
      || expect(buildDryrunTable(rows)).toContain('R-K');
  });

  it('round-trips bulk decisions parse', () => {
    const md = buildBulkDecisions(rows);
    expect(md).toContain('Group 1');
    // Simulate user filling in
    const filled = md.replace('Decision: ___', 'Decision: keep-all');
    const parsed = parseBulkDecisions(filled);
    expect(parsed[0].decision).toBe('keep-all');
  });

  it('round-trips individual flags parse', () => {
    const md = buildIndividualFlags(rows);
    expect(md).toContain('FLAG #001');
    const filled = md.replace('Your call: ___', 'Your call: keep');
    const parsed = parseIndividualFlags(filled);
    expect(parsed[0]).toEqual({ check_id: 'C002', decision: 'keep' });
  });

  it('builds rename map with at least one row', () => {
    const md = buildRenameMap();
    expect(md).toContain('| From | To |');
    expect(md).toContain('Local SEO');
  });
});
```

- [ ] **Step 7: Run tests**

Run: `cd scripts/audit-checks-reconcile && npm test -- output`
Expected: PASS — all writer smoke tests.

- [ ] **Step 8: Commit**

```bash
git add scripts/audit-checks-reconcile/src/output/ \
        scripts/audit-checks-reconcile/__tests__/output.test.js
git commit -m "feat(reconcile): output writers (csv + summary + bulk + individual + rename map)"
```

---

### Task 16: CLI entry point

**Files:**
- Create: `scripts/audit-checks-reconcile/src/cli.js`

The CLI is thin: parse a subcommand, read inputs, call `reconcile`, write outputs. Subcommands: `dryrun`, `fullpass`, `applybulk`, `finalize`.

- [ ] **Step 1: Implement CLI**

Write `src/cli.js`:

```js
#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from './csv.js';
import { loadSeed } from './seed.js';
import { reconcile } from './reconcile.js';
import { writeCanonicalCsv } from './output/canonical-csv.js';
import { buildRunSummary, buildDryrunTable } from './output/summary-md.js';
import { buildBulkDecisions, parseBulkDecisions } from './output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from './output/individual-md.js';
import { buildRenameMap } from './output/rename-map-md.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const INPUT_CSV = join(PROJECT_ROOT, 'audit-replan-subchecks-comprehensive.csv');
const OUT_DIR = join(PROJECT_ROOT, 'docs', 'audit-checks');

async function ensureOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function loadInputs() {
  const csvText = await readFile(INPUT_CSV, 'utf8');
  const csvRows = await parseCsv(csvText);
  const seed = await loadSeed();
  return { csvRows, seed };
}

async function dryrun() {
  await ensureOutDir();
  const { csvRows, seed } = await loadInputs();
  const { rows } = reconcile({ csvRows, seed, limit: 25 });
  await writeFile(join(OUT_DIR, 'dryrun-25rows.md'), buildDryrunTable(rows));
  console.log('Dry-run table written to docs/audit-checks/dryrun-25rows.md');
}

async function fullpass() {
  await ensureOutDir();
  const { csvRows, seed } = await loadInputs();
  const { rows } = reconcile({ csvRows, seed });
  await writeFile(join(OUT_DIR, 'canonical-checks-v1.draft.csv'), await writeCanonicalCsv(rows));
  await writeFile(join(OUT_DIR, 'run-summary.md'), buildRunSummary(rows, { label: 'M3 full pass' }));
  await writeFile(join(OUT_DIR, 'triage-bulk-decisions.md'), buildBulkDecisions(rows));
  console.log('Full-pass artifacts written to docs/audit-checks/.');
  console.log('NEXT: edit triage-bulk-decisions.md (fill `Decision:` lines), then run `applybulk`.');
}

async function applybulk() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const bulkPath = join(OUT_DIR, 'triage-bulk-decisions.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const bulkText = await readFile(bulkPath, 'utf8');
  const draftRows = await parseCsv(draftCsvText);
  const bulkAnswers = parseBulkDecisions(bulkText);

  // Apply bulk answers
  for (const ans of bulkAnswers) {
    if (ans.decision === '___' || !ans.decision) continue;
    for (const row of draftRows) {
      if (row.decision !== 'flag') continue;
      if (row.rule_id !== ans.rule || row.category !== ans.category) continue;
      if (ans.decision === 'keep-all') { row.decision = 'keep'; row.rationale = `bulk-keep (${ans.rule})`; }
      else if (ans.decision === 'cut-all') { row.decision = 'cut'; row.rationale = `bulk-cut (${ans.rule})`; }
      // flag-individually keeps decision=flag for individual review
    }
  }

  // Re-write draft with bulk decisions applied
  await writeFile(draftCsvPath, await writeCanonicalCsv(draftRows));
  await writeFile(join(OUT_DIR, 'triage-individual.md'), buildIndividualFlags(draftRows));
  console.log('Bulk decisions applied. Individual-flag file written.');
  console.log('NEXT: edit triage-individual.md (fill `Your call:` lines), then run `finalize`.');
}

async function finalize() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const individualPath = join(OUT_DIR, 'triage-individual.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const individualText = await readFile(individualPath, 'utf8');
  const draftRows = await parseCsv(draftCsvText);
  const indivAnswers = parseIndividualFlags(individualText);

  for (const ans of indivAnswers) {
    if (!ans.check_id || !ans.decision || ans.decision === '___') continue;
    const row = draftRows.find(r => r.check_id === ans.check_id);
    if (!row) continue;
    if (ans.decision.startsWith('comment:')) {
      row.notes = (row.notes ? row.notes + '; ' : '') + ans.decision;
      row.decision = 'keep';
    } else if (['keep', 'cut', 'edit-and-keep'].includes(ans.decision)) {
      row.decision = ans.decision === 'edit-and-keep' ? 'edit' : ans.decision;
    }
    row.rationale = `individual triage (${ans.decision})`;
  }

  await writeFile(join(OUT_DIR, 'canonical-checks-v1.csv'), await writeCanonicalCsv(draftRows));
  await writeFile(join(OUT_DIR, 'canonical-checks-v1.md'), buildRunSummary(draftRows, { label: 'M7 finalized' }));
  await writeFile(join(OUT_DIR, 'category-rename-map.md'), buildRenameMap());
  console.log('Finalized canonical CSV + companion docs written.');
  console.log('NEXT: review, then `git rm` drafts and commit per plan Task 21.');
}

const cmd = process.argv[2];
const handlers = { dryrun, fullpass, applybulk, finalize };
if (!handlers[cmd]) {
  console.error(`Usage: node src/cli.js <dryrun|fullpass|applybulk|finalize>`);
  process.exit(1);
}
handlers[cmd]().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Smoke-test by running `dryrun`**

Run: `cd scripts/audit-checks-reconcile && npm run cli -- dryrun`
Expected: writes `docs/audit-checks/dryrun-25rows.md` containing a 25-row markdown table.

- [ ] **Step 3: Verify output exists and looks reasonable**

Run: `head -30 "docs/audit-checks/dryrun-25rows.md"` from project root.
Expected: header line, then table rows for csv_row 2..26.

- [ ] **Step 4: Commit (CLI only, NOT the dryrun output yet — that's M1)**

```bash
git add scripts/audit-checks-reconcile/src/cli.js
git commit -m "feat(reconcile): cli entry with dryrun/fullpass/applybulk/finalize"
```

---

## Phase B — Execute Milestones

### Task 17: M1 — Dry-run on first 25 CSV rows (autonomous)

**Files touched:** `docs/audit-checks/dryrun-25rows.md`

- [ ] **Step 1: Run dry-run subcommand**

Run: `cd scripts/audit-checks-reconcile && npm run cli -- dryrun`
Expected: `docs/audit-checks/dryrun-25rows.md` (re)created with 25 decision rows.

- [ ] **Step 2: Stage the dry-run artifact (do NOT commit yet — M2 review precedes commit)**

Do NOT commit. Hand off to user for M2 checkpoint review.

---

### Task 18: ◇ M2 — User dry-run review (CHECKPOINT)

**HALT execution and wait for user.**

Present `docs/audit-checks/dryrun-25rows.md` to the user with this message:

> "Dry-run complete on the first 25 CSV rows. Review `docs/audit-checks/dryrun-25rows.md`. If you'd flip ≥3 decisions, tell me which rules need tightening and I'll revise + re-run. Otherwise reply 'proceed' and I'll start the full pass."

**Do not proceed until the user replies "proceed" or provides rule edits.**

If user requests rule edits:
- Apply the edit to the relevant `src/rules/*.js` file(s)
- Re-run Task 17 dry-run
- Loop M2 until user accepts

Once user replies "proceed":
- Commit the dry-run artifact:

```bash
git add docs/audit-checks/dryrun-25rows.md
git commit -m "docs(audit-checks): M1 dry-run table on first 25 CSV rows"
```

---

### Task 19: M3 — Full pass + seed reconciliation (autonomous)

**Files touched:**
- `docs/audit-checks/canonical-checks-v1.draft.csv`
- `docs/audit-checks/triage-bulk-decisions.md`
- `docs/audit-checks/run-summary.md`

- [ ] **Step 1: Run full pass**

Run: `cd scripts/audit-checks-reconcile && npm run cli -- fullpass`
Expected: three files written under `docs/audit-checks/`. Console prints final counts.

- [ ] **Step 2: Sanity-check counts**

Run: `head -50 "docs/audit-checks/run-summary.md"`
Expected:
- Total rows in roughly 320–360 range (321 csv + ~30 seed-only that didn't match)
- "By decision" includes `keep`, `cut`, `merge`, `edit`, `flag` with non-zero counts
- "By category" lists the 23 canonical slugs

- [ ] **Step 3: Commit M3 artifacts**

```bash
git add docs/audit-checks/canonical-checks-v1.draft.csv \
        docs/audit-checks/run-summary.md \
        docs/audit-checks/triage-bulk-decisions.md
git commit -m "docs(audit-checks): M3 full-pass artifacts (draft canonical csv + bulk-triage)"
```

---

### Task 20: ◇ M4 — User bulk-decisions review (CHECKPOINT)

**HALT execution and wait for user.**

Present `docs/audit-checks/triage-bulk-decisions.md` to the user:

> "Bulk-decision file ready. Edit `> Decision: ___` lines in place. Allowed values: `keep-all`, `cut-all`, `flag-individually`. Reply when done."

**Do not proceed until user replies "done" (or equivalent).**

---

### Task 21: M5 — Apply bulk + emit individual flags (autonomous)

**Files touched:**
- `docs/audit-checks/canonical-checks-v1.draft.csv` (updated)
- `docs/audit-checks/triage-individual.md` (created)

- [ ] **Step 1: Run applybulk**

Run: `cd scripts/audit-checks-reconcile && npm run cli -- applybulk`
Expected:
- draft CSV updated in place with bulk decisions baked in
- `triage-individual.md` lists remaining flags (those marked `flag-individually` plus any flags in non-bulkable groups)

- [ ] **Step 2: Sanity-check individual count**

Run: `grep -c "^## FLAG" "docs/audit-checks/triage-individual.md"`
Expected: 15–30 flags. If >50, the bulk decisions were too narrow; if 0, may indicate over-cutting.

- [ ] **Step 3: Commit**

```bash
git add docs/audit-checks/canonical-checks-v1.draft.csv \
        docs/audit-checks/triage-individual.md
git commit -m "docs(audit-checks): M5 apply bulk decisions, emit individual triage"
```

---

### Task 22: ◇ M6 — User individual-flags review (CHECKPOINT)

**HALT execution and wait for user.**

Present `docs/audit-checks/triage-individual.md`:

> "Individual flags ready. For each flag, edit the `Your call: ___` line. Allowed values: `keep`, `cut`, `edit-and-keep`, `comment: <free text>`. Reply when done."

**Do not proceed until user replies "done".**

---

### Task 23: M7 — Finalize + companion docs (autonomous)

**Files touched:**
- Created: `docs/audit-checks/canonical-checks-v1.csv`
- Created: `docs/audit-checks/canonical-checks-v1.md`
- Created: `docs/audit-checks/category-rename-map.md`
- Deleted: `docs/audit-checks/canonical-checks-v1.draft.csv`
- Deleted: `docs/audit-checks/triage-bulk-decisions.md`
- Deleted: `docs/audit-checks/triage-individual.md`
- Deleted: `docs/audit-checks/run-summary.md`
- Deleted: `docs/audit-checks/dryrun-25rows.md`

- [ ] **Step 1: Run finalize**

Run: `cd scripts/audit-checks-reconcile && npm run cli -- finalize`
Expected: final files written to `docs/audit-checks/`.

- [ ] **Step 2: Embed Decision Log into canonical-checks-v1.md**

Manually append (or the `summary-md.js` writer can be extended) a "Decision Log" section listing per-flag user decisions. For now, run:

```bash
cat docs/audit-checks/triage-individual.md >> docs/audit-checks/canonical-checks-v1.md
```

This preserves the audit trail inside the final doc as required by spec §7.4.

- [ ] **Step 3: Verify final CSV row count**

Run: `wc -l docs/audit-checks/canonical-checks-v1.csv`
Expected: between 220 and 280 lines (header + 219–279 final rows after cuts/merges).

- [ ] **Step 4: Delete drafts**

```bash
git rm docs/audit-checks/canonical-checks-v1.draft.csv \
       docs/audit-checks/triage-bulk-decisions.md \
       docs/audit-checks/triage-individual.md \
       docs/audit-checks/run-summary.md \
       docs/audit-checks/dryrun-25rows.md
```

- [ ] **Step 5: Commit final artifacts**

```bash
git add docs/audit-checks/canonical-checks-v1.csv \
        docs/audit-checks/canonical-checks-v1.md \
        docs/audit-checks/category-rename-map.md
git commit -m "docs(audit-checks): produce canonical reconciled check list v1"
```

- [ ] **Step 6: Final sanity check**

Run: `git log --oneline -10`
Expected: spec commit, plan commit (if applicable), Task 1–16 commits, M1/M3/M5 commits, final M7 commit.

---

## Verification Checklist (run after Task 23)

- [ ] All 14 test files pass: `cd scripts/audit-checks-reconcile && npm test`
- [ ] `docs/audit-checks/canonical-checks-v1.csv` exists, has the 18 columns from spec §5.1
- [ ] `docs/audit-checks/canonical-checks-v1.md` includes rubric, decision log, summary stats
- [ ] `docs/audit-checks/category-rename-map.md` lists all category aliases
- [ ] All draft files (`*.draft.csv`, `triage-*.md`, `dryrun-*.md`, `run-summary.md`) are deleted
- [ ] No changes to `backend/db/seed/audit-checks.js`
- [ ] No changes to `frontend/src/lib/auditCategories.js`
- [ ] No changes to `PRD.md`
- [ ] No new database migrations
- [ ] No changes to `backend/services/audit-parser.service.js` or extractors

---

## Out of Scope (Phase 2/3/4 preview)

- **Phase 2 — Gap-map:** for each kept canonical check, mark `implemented / partial / missing` against `audit-parser.service.js`
- **Phase 3 — Roadmap:** sequence missing checks into P0/P1/P2 with effort estimates
- **Phase 4 — Re-seed + PRD update:** generate new seed file from canonical CSV; update PRD; rename `Local SEO & GEO` in `frontend/src/lib/auditCategories.js`

Each later phase has its own spec.
