# Audit Checks Gap-Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the gap-map tooling and execute seven milestones to classify each of 204 active csv-derived canonical checks as `implemented` / `partial` / `missing` / `n-a` against the platform implementation surface, extending the canonical CSV with 4 new columns.

**Architecture:** Standalone Node.js CLI at `scripts/audit-checks-gapmap/`. Pipeline: load canonical CSV → filter to in-scope rows → extract signals from implementation surface (parser + integration services + extractors via regex) → tokenize and Jaccard-score each canonical against signals per priority → apply 6-rule classifier → emit triage artifacts → user reviews flags → finalize.

**Tech Stack:** Node.js 20+ ESM, vitest for tests, `csv-parse` + `csv-stringify` for CSV I/O, no other runtime deps.

**Spec:** [docs/superpowers/specs/2026-04-26-audit-checks-gap-map-design.md](../specs/2026-04-26-audit-checks-gap-map-design.md)

---

## File Structure

```
scripts/audit-checks-gapmap/
├── package.json
├── README.md
├── vitest.config.js
├── src/
│   ├── cli.js                       # entry: dryrun | fullpass | applybulk | finalize
│   ├── csv.js                       # parseCsv + writeCsv wrappers
│   ├── normalize.js                 # name normalization (lowercase + punct strip + stopwords)
│   ├── acronym.js                   # SEO acronym expansion + camelCase split
│   ├── tokenize.js                  # combine normalize + acronym for unified tokenization
│   ├── jaccard.js                   # tokenOverlap scoring
│   ├── canonical.js                 # load canonical CSV + filter to in-scope rows
│   ├── extract/
│   │   ├── parser.js                # P1: audit-parser.service.js → 30 issueType signals
│   │   ├── integration.js           # P2: gsc.js + ga4.js + psi.js + sitemap-fetcher.js
│   │   ├── crawler-extractors.js    # P3: playwright-crawler/src/extractors/*.js
│   │   └── misc.js                  # P4: crawler.js + crawl-runner.js + reports.js
│   ├── signal-index.js              # orchestrates all extractors → unified signal list
│   ├── classifier.js                # 6 rules (G-FLAG/G-MAN/G-IMPL-1/G-IMPL-2/G-PARTIAL-1/G-MISS)
│   ├── gapmap.js                    # main pipeline: canonical + signal-index → classified rows
│   └── output/
│       ├── canonical-csv.js         # write extended canonical CSV (23 cols)
│       ├── summary-md.js            # gapmap-summary.md / gapmap-run-summary.md
│       ├── signal-index-md.js       # gapmap-signal-index.md
│       ├── bulk-decisions-md.js     # gapmap-bulk-decisions.md (with parser)
│       ├── individual-md.js         # gapmap-individual.md (with parser)
│       └── dryrun-md.js             # gapmap-dryrun-25rows.md
└── __tests__/
    ├── csv.test.js
    ├── normalize.test.js
    ├── acronym.test.js
    ├── tokenize.test.js
    ├── jaccard.test.js
    ├── canonical.test.js
    ├── extract-parser.test.js
    ├── extract-integration.test.js
    ├── extract-crawler-extractors.test.js
    ├── extract-misc.test.js
    ├── signal-index.test.js
    ├── classifier.test.js
    ├── gapmap.test.js
    └── output.test.js

docs/audit-checks/                   # outputs (canonical CSV updated, drafts created/deleted)
├── canonical-checks-v1.csv          # extended at G7 (existing 19 cols + 4 new)
├── gapmap-summary.md                # G7 final
├── gapmap-signal-index.md           # G7 final
├── gapmap-dryrun-25rows.md          # G1, deleted at G7
├── canonical-checks-v1.draft.csv    # G3, deleted at G7
├── gapmap-run-summary.md            # G3, deleted at G7
├── gapmap-bulk-decisions.md         # G3, deleted at G7
└── gapmap-individual.md             # G5, deleted at G7
```

**Module boundaries:** `cli.js` orchestrates only. `gapmap.js` is pure pipeline. `signal-index.js` orchestrates the four extractors. `classifier.js` is pure rules. Output writers are pure formatters.

**Phase 1 reuse policy:** Per spec §12, this tool does NOT depend on the Phase 1 reconciliation tool (which has known prerequisites). Modules with similar names (csv, normalize, jaccard) are independently authored copies — they share interfaces but Phase 2 does not import from Phase 1.

---

## Phase A — Build Tooling (TDD)

### Task 1: Project setup

**Files:**
- Create: `scripts/audit-checks-gapmap/package.json`
- Create: `scripts/audit-checks-gapmap/README.md`
- Create: `scripts/audit-checks-gapmap/vitest.config.js`

- [ ] **Step 1: Create the local package**

Write `scripts/audit-checks-gapmap/package.json`:

```json
{
  "name": "audit-checks-gapmap",
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

Write `scripts/audit-checks-gapmap/vitest.config.js`:

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

Write `scripts/audit-checks-gapmap/README.md`:

```markdown
# Audit Checks Gap-Map Tool

Phase 2 of audit-checks reconciliation. Classifies the 204 active csv-derived canonical checks as implemented / partial / missing / n-a against the platform implementation surface. Produces docs only, no platform code is modified.

## Setup

    cd scripts/audit-checks-gapmap && npm install

## Milestone subcommands

    npm run cli -- dryrun       # G1: heuristic on first 25 canonical rows
    npm run cli -- fullpass     # G3: full pass on remaining 179 rows
    npm run cli -- applybulk    # G5: apply edited bulk-decisions.md, emit individual-flag file
    npm run cli -- finalize     # G7: apply edited individual.md, produce final extended canonical CSV

## Tests

    npm test
```

- [ ] **Step 4: Install deps**

Run: `cd scripts/audit-checks-gapmap && npm install`
Expected: `csv-parse`, `csv-stringify`, `vitest` install without errors.

- [ ] **Step 5: Verify vitest finds zero tests**

Run: `cd scripts/audit-checks-gapmap && npm test`
Expected: vitest exits with "No test files found" message (exit code 1 is the documented vitest 2.x behavior — this is success at scaffolding stage).

- [ ] **Step 6: Commit**

```bash
git add scripts/audit-checks-gapmap/package.json \
        scripts/audit-checks-gapmap/package-lock.json \
        scripts/audit-checks-gapmap/vitest.config.js \
        scripts/audit-checks-gapmap/README.md
git commit -m "chore(gapmap): scaffold audit-checks gap-map tool"
```

---

### Task 2: CSV I/O

**Files:**
- Create: `scripts/audit-checks-gapmap/src/csv.js`
- Test: `scripts/audit-checks-gapmap/__tests__/csv.test.js`

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
    const text = 'a,b\n1,  "foo"\n';  // whitespace before quote — would fail strict parse
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

Run: `cd scripts/audit-checks-gapmap && npm test`
Expected: FAIL with "Cannot find module '../src/csv.js'".

- [ ] **Step 3: Implement csv.js**

Write `src/csv.js`:

```js
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export async function parseCsv(text) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    relax_quotes: true,
    relax_column_count: true,
  });
}

export async function writeCsv(rows, columns) {
  return stringify(rows, { header: true, columns });
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test`
Expected: PASS — 4 csv tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/csv.js \
        scripts/audit-checks-gapmap/__tests__/csv.test.js
git commit -m "feat(gapmap): csv parse/write wrappers"
```

---

### Task 3: Name normalization

**Files:**
- Create: `scripts/audit-checks-gapmap/src/normalize.js`
- Test: `scripts/audit-checks-gapmap/__tests__/normalize.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/normalize.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeName } from '../src/normalize.js';

describe('normalizeName', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeName('Title Too Long (over 60 chars)')).toBe('title too long over 60 chars');
    expect(normalizeName('301 vs 302 Usage')).toBe('301 vs 302 usage');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeName('  Foo   Bar  ')).toBe('foo bar');
  });

  it('returns empty string for nullish input', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- normalize`
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

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- normalize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/normalize.js \
        scripts/audit-checks-gapmap/__tests__/normalize.test.js
git commit -m "feat(gapmap): name normalization"
```

---

### Task 4: Acronym expansion + camelCase splitting

**Files:**
- Create: `scripts/audit-checks-gapmap/src/acronym.js`
- Test: `scripts/audit-checks-gapmap/__tests__/acronym.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/acronym.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { splitCamelCase, expandAcronyms } from '../src/acronym.js';

describe('splitCamelCase', () => {
  it('splits camelCase to space-separated words', () => {
    expect(splitCamelCase('getLcpScore')).toBe('get Lcp Score');
    expect(splitCamelCase('isHttpsRedirect')).toBe('is Https Redirect');
  });

  it('preserves all-lowercase strings', () => {
    expect(splitCamelCase('foo')).toBe('foo');
  });

  it('handles consecutive caps (acronyms)', () => {
    expect(splitCamelCase('parseHTMLTag')).toBe('parse HTMLTag');
  });
});

describe('expandAcronyms', () => {
  it('expands known SEO acronyms', () => {
    expect(expandAcronyms('lcp')).toBe('largest contentful paint');
    expect(expandAcronyms('cls')).toBe('cumulative layout shift');
    expect(expandAcronyms('cwv')).toBe('core web vitals');
    expect(expandAcronyms('gsc')).toBe('search console');
    expect(expandAcronyms('ga4')).toBe('analytics');
  });

  it('expands acronyms inside multi-word strings', () => {
    expect(expandAcronyms('lcp score under 2.5s')).toBe('largest contentful paint score under 2.5s');
  });

  it('does not expand non-acronyms', () => {
    expect(expandAcronyms('title length')).toBe('title length');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- acronym`
Expected: FAIL.

- [ ] **Step 3: Implement acronym.js**

Write `src/acronym.js`:

```js
const SEO_ACRONYMS = {
  lcp: 'largest contentful paint',
  cls: 'cumulative layout shift',
  fid: 'first input delay',
  inp: 'interaction to next paint',
  tbt: 'total blocking time',
  fcp: 'first contentful paint',
  ttfb: 'time to first byte',
  cwv: 'core web vitals',
  gsc: 'search console',
  ga4: 'analytics',
  psi: 'pagespeed insights',
  seo: 'search engine optimization',
};

export function splitCamelCase(s) {
  if (!s) return s;
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function expandAcronyms(s) {
  if (!s) return s;
  // Replace whole-word acronyms (case-insensitive) with their expansions
  return s.split(/\b/).map(token => {
    const lower = token.toLowerCase();
    return SEO_ACRONYMS[lower] || token;
  }).join('');
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- acronym`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/acronym.js \
        scripts/audit-checks-gapmap/__tests__/acronym.test.js
git commit -m "feat(gapmap): camelCase split + SEO acronym expansion"
```

---

### Task 5: Unified tokenization

**Files:**
- Create: `scripts/audit-checks-gapmap/src/tokenize.js`
- Test: `scripts/audit-checks-gapmap/__tests__/tokenize.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/tokenize.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenize.js';

describe('tokenize', () => {
  it('tokenizes a canonical-style name', () => {
    const tokens = tokenize('Title Too Long (over 60 chars)');
    expect(tokens).toEqual(new Set(['title', 'too', 'long', 'over', '60', 'chars']));
  });

  it('tokenizes a code-style identifier (camelCase split + acronym expand)', () => {
    const tokens = tokenize('getLcpScore');
    expect(tokens.has('get')).toBe(true);
    expect(tokens.has('largest')).toBe(true);
    expect(tokens.has('contentful')).toBe(true);
    expect(tokens.has('paint')).toBe(true);
    expect(tokens.has('score')).toBe(true);
  });

  it('removes stopwords', () => {
    const tokens = tokenize('the title of a page');
    expect(tokens.has('the')).toBe(false);
    expect(tokens.has('of')).toBe(false);
    expect(tokens.has('a')).toBe(false);
    expect(tokens.has('title')).toBe(true);
    expect(tokens.has('page')).toBe(true);
  });

  it('returns empty set for nullish input', () => {
    expect(tokenize(null)).toEqual(new Set());
    expect(tokenize(undefined)).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- tokenize`
Expected: FAIL.

- [ ] **Step 3: Implement tokenize.js**

Write `src/tokenize.js`:

```js
import { normalizeName } from './normalize.js';
import { splitCamelCase, expandAcronyms } from './acronym.js';

const STOPWORDS = new Set([
  'a','an','the','and','or','of','for','to','in','on','at','is','be','with','by',
]);

export function tokenize(s) {
  if (s == null) return new Set();
  // Order matters: split camelCase BEFORE normalizing, so case info is preserved
  const split = splitCamelCase(String(s));
  const expanded = expandAcronyms(split);
  const normalized = normalizeName(expanded);
  return new Set(
    normalized.split(' ').filter(t => t && !STOPWORDS.has(t)),
  );
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- tokenize`
Expected: PASS — 4 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/tokenize.js \
        scripts/audit-checks-gapmap/__tests__/tokenize.test.js
git commit -m "feat(gapmap): unified tokenization (camelCase + acronyms + stopwords)"
```

---

### Task 6: Jaccard scoring

**Files:**
- Create: `scripts/audit-checks-gapmap/src/jaccard.js`
- Test: `scripts/audit-checks-gapmap/__tests__/jaccard.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/jaccard.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { jaccardScore } from '../src/jaccard.js';

describe('jaccardScore', () => {
  it('returns 1.0 for identical names', () => {
    expect(jaccardScore('Title Too Long', 'Title Too Long')).toBe(1);
  });

  it('returns Jaccard similarity', () => {
    // {title,long} vs {title,short} → intersection 1, union 3 → 1/3
    expect(jaccardScore('title long', 'title short')).toBeCloseTo(1/3, 2);
  });

  it('returns 0 for disjoint tokens', () => {
    expect(jaccardScore('foo', 'bar')).toBe(0);
  });

  it('matches code identifier to canonical name via tokenization', () => {
    // 'getLcpScore' -> {get, largest, contentful, paint, score}
    // 'LCP score under 2.5s' (after acronym + tokenize) -> {largest, contentful, paint, score, under, 2, 5s}
    // intersection: {largest, contentful, paint, score} = 4
    // union: 8
    expect(jaccardScore('getLcpScore', 'LCP score under 2.5s')).toBeGreaterThan(0.4);
  });

  it('returns 1 when both inputs reduce to empty token sets', () => {
    expect(jaccardScore('', '')).toBe(1);
    expect(jaccardScore('the', 'a')).toBe(1); // both reduce to empty
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- jaccard`
Expected: FAIL.

- [ ] **Step 3: Implement jaccard.js**

Write `src/jaccard.js`:

```js
import { tokenize } from './tokenize.js';

export function jaccardScore(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- jaccard`
Expected: PASS — 5 cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/jaccard.js \
        scripts/audit-checks-gapmap/__tests__/jaccard.test.js
git commit -m "feat(gapmap): Jaccard token-overlap scoring"
```

---

### Task 7: Canonical CSV loader + scope filter

**Files:**
- Create: `scripts/audit-checks-gapmap/src/canonical.js`
- Test: `scripts/audit-checks-gapmap/__tests__/canonical.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/canonical.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { loadCanonical, filterInScope } from '../src/canonical.js';

describe('loadCanonical', () => {
  it('loads the canonical CSV with all 19 columns', async () => {
    const rows = await loadCanonical();
    expect(rows.length).toBeGreaterThan(500);
    expect(rows[0]).toHaveProperty('check_id');
    expect(rows[0]).toHaveProperty('decision');
    expect(rows[0]).toHaveProperty('source');
    expect(rows[0]).toHaveProperty('category');
  });
});

describe('filterInScope', () => {
  it('returns only rows where decision is keep/edit and source is csv-only/both', () => {
    const all = [
      { check_id: 'C1', decision: 'keep', source: 'csv-only' },
      { check_id: 'C2', decision: 'cut', source: 'csv-only' },
      { check_id: 'C3', decision: 'keep', source: 'seed-only' },
      { check_id: 'C4', decision: 'edit', source: 'csv-only' },
      { check_id: 'C5', decision: 'merge', source: 'csv-only' },
      { check_id: 'C6', decision: 'keep', source: 'both' },
    ];
    const inScope = filterInScope(all);
    expect(inScope.map(r => r.check_id)).toEqual(['C1', 'C4', 'C6']);
  });

  it('full canonical filters to ~204 in-scope rows', async () => {
    const all = await loadCanonical();
    const inScope = filterInScope(all);
    expect(inScope.length).toBeGreaterThan(195);
    expect(inScope.length).toBeLessThan(215);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- canonical`
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

export async function loadCanonical() {
  const text = await readFile(CANONICAL_CSV, 'utf8');
  return parseCsv(text);
}

export function filterInScope(rows) {
  return rows.filter(r =>
    IN_SCOPE_DECISIONS.has(r.decision) && IN_SCOPE_SOURCES.has(r.source),
  );
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- canonical`
Expected: PASS — 3 cases. The 204-row check confirms the in-scope count.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/canonical.js \
        scripts/audit-checks-gapmap/__tests__/canonical.test.js
git commit -m "feat(gapmap): canonical loader + in-scope filter (204 rows)"
```

---

### Task 8: Parser signal extractor (Priority 1)

**Files:**
- Create: `scripts/audit-checks-gapmap/src/extract/parser.js`
- Test: `scripts/audit-checks-gapmap/__tests__/extract-parser.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/extract-parser.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { extractParserSignals } from '../src/extract/parser.js';

describe('extractParserSignals', () => {
  it('extracts issueType strings + section + severity', async () => {
    const signals = await extractParserSignals();
    // The parser emits exactly 30 issue types as confirmed in Phase 1 exploration
    expect(signals.length).toBeGreaterThanOrEqual(28);
    expect(signals.length).toBeLessThanOrEqual(35);

    // Every signal has the expected shape
    for (const s of signals) {
      expect(s.priority).toBe(1);
      expect(s.signal_type).toBe('issue-emitter');
      expect(s.file).toContain('audit-parser.service.js');
      expect(typeof s.line).toBe('number');
      expect(typeof s.name).toBe('string');
    }

    // Some specific issue types are known to be present
    const names = signals.map(s => s.name);
    expect(names).toContain('Missing Title Tag');
    expect(names).toContain('Title Too Long (over 60 chars)');
    expect(names).toContain('H1 Missing');
    expect(names).toContain('Redirect Loops');
  });

  it('attaches metadata.severity and metadata.section when present near the issueType', () => {
    // Smoke: at least some signals carry severity/section
    return extractParserSignals().then(signals => {
      const withSev = signals.filter(s => s.metadata?.severity);
      const withSection = signals.filter(s => s.metadata?.section);
      expect(withSev.length).toBeGreaterThan(20);
      expect(withSection.length).toBeGreaterThan(20);
    });
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- extract-parser`
Expected: FAIL.

- [ ] **Step 3: Implement parser.js**

Write `src/extract/parser.js`:

```js
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PARSER_FILE = join(PROJECT_ROOT, 'backend', 'services', 'audit-parser.service.js');

// Look back this many lines from each issueType for nearest section/severity
const CONTEXT_WINDOW = 5;

export async function extractParserSignals() {
  const text = await readFile(PARSER_FILE, 'utf8');
  const lines = text.split('\n');
  const signals = [];
  let counter = 1;

  for (let i = 0; i < lines.length; i++) {
    const m = /issueType:\s*['"]([^'"]+)['"]/.exec(lines[i]);
    if (!m) continue;

    // Walk back up to CONTEXT_WINDOW lines to find severity/section
    let severity, section;
    for (let j = i; j >= Math.max(0, i - CONTEXT_WINDOW); j--) {
      const sevM = /severity:\s*['"]([^'"]+)['"]/.exec(lines[j]);
      if (sevM && !severity) severity = sevM[1];
      const secM = /section:\s*['"]([^'"]+)['"]/.exec(lines[j]);
      if (secM && !section) section = secM[1];
    }

    signals.push({
      signal_id: `P1-S${String(counter).padStart(3, '0')}`,
      name: m[1],
      signal_type: 'issue-emitter',
      priority: 1,
      file: 'backend/services/audit-parser.service.js',
      line: i + 1,
      metadata: { severity, section },
    });
    counter++;
  }

  return signals;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- extract-parser`
Expected: PASS — confirms ~30 signals with metadata.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/extract/parser.js \
        scripts/audit-checks-gapmap/__tests__/extract-parser.test.js
git commit -m "feat(gapmap): parser signal extractor (P1)"
```

---

### Task 9: Integration service signal extractor (Priority 2)

**Files:**
- Create: `scripts/audit-checks-gapmap/src/extract/integration.js`
- Test: `scripts/audit-checks-gapmap/__tests__/extract-integration.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/extract-integration.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { extractIntegrationSignals } from '../src/extract/integration.js';

describe('extractIntegrationSignals', () => {
  it('extracts signals from gsc.js, ga4.js, psi.js, sitemap-fetcher.js', async () => {
    const signals = await extractIntegrationSignals();
    expect(signals.length).toBeGreaterThan(10);

    // Every signal has the expected shape
    for (const s of signals) {
      expect(s.priority).toBe(2);
      expect(s.signal_type).toBe('service-function');
      expect(s.file).toMatch(/(gsc|ga4|psi|sitemap-fetcher)/);
      expect(typeof s.line).toBe('number');
      expect(typeof s.name).toBe('string');
    }

    // Should have signals from all four services
    const files = new Set(signals.map(s => s.file));
    expect(files.size).toBeGreaterThanOrEqual(2);  // at least 2 of the 4 yield signals
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- extract-integration`
Expected: FAIL.

- [ ] **Step 3: Implement integration.js**

Write `src/extract/integration.js`:

```js
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');

const TARGETS = [
  { file: 'backend/routes/gsc.js', label: 'gsc' },
  { file: 'backend/routes/ga4.js', label: 'ga4' },
  { file: 'backend/routes/psi.js', label: 'psi' },
  { file: 'backend/services/sitemap-fetcher.js', label: 'sitemap-fetcher' },
];

// Patterns that indicate a check-like signal
const SIGNAL_PATTERNS = [
  // exported functions
  { rx: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function' },
  // exported const arrows
  { rx: /export\s+const\s+(\w+)\s*=/g, kind: 'const' },
  // route definitions: router.get/post/...('/path', ...)
  { rx: /router\.(?:get|post|put|delete)\(\s*['"]([^'"]+)['"]/g, kind: 'route' },
  // returned object keys at function-return depth (heuristic)
  { rx: /^\s*([a-z_]\w*):\s*[a-zA-Z0-9_'"\[{]/gm, kind: 'field' },
];

let counter = 1;

function extractFromText(text, file, label) {
  const out = [];
  const lines = text.split('\n');

  for (const { rx, kind } of SIGNAL_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const name = m[1];
      // skip very common JS keywords / noise
      if (['if', 'for', 'while', 'return', 'const', 'let', 'var', 'function'].includes(name)) continue;
      if (name.length < 3) continue;

      // Find the line number from the match index
      const upTo = text.slice(0, m.index);
      const line = upTo.split('\n').length;

      out.push({
        signal_id: `P2-S${String(counter++).padStart(3, '0')}`,
        name: kind === 'route' ? `${label} route ${name}` : name,
        signal_type: 'service-function',
        priority: 2,
        file,
        line,
        metadata: { kind, label },
      });
    }
  }
  return out;
}

export async function extractIntegrationSignals() {
  counter = 1;
  const all = [];
  for (const { file, label } of TARGETS) {
    try {
      const text = await readFile(join(PROJECT_ROOT, file), 'utf8');
      all.push(...extractFromText(text, file, label));
    } catch (err) {
      // File may not exist (e.g., feature not yet built); skip silently
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return all;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- extract-integration`
Expected: PASS — confirms multiple signals from at least 2 of the 4 service files.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/extract/integration.js \
        scripts/audit-checks-gapmap/__tests__/extract-integration.test.js
git commit -m "feat(gapmap): integration service signal extractor (P2)"
```

---

### Task 10: Crawler-extractor signal extractor (Priority 3)

**Files:**
- Create: `scripts/audit-checks-gapmap/src/extract/crawler-extractors.js`
- Test: `scripts/audit-checks-gapmap/__tests__/extract-crawler-extractors.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/extract-crawler-extractors.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { extractCrawlerExtractorSignals } from '../src/extract/crawler-extractors.js';

describe('extractCrawlerExtractorSignals', () => {
  it('extracts signals from all 9 extractor files', async () => {
    const signals = await extractCrawlerExtractorSignals();
    expect(signals.length).toBeGreaterThan(15);

    for (const s of signals) {
      expect(s.priority).toBe(3);
      expect(s.signal_type).toBe('extractor-field');
      expect(s.file).toContain('playwright-crawler/src/extractors/');
    }

    const files = new Set(signals.map(s => s.file));
    // Should hit at least most of the 9 extractor files
    expect(files.size).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- extract-crawler-extractors`
Expected: FAIL.

- [ ] **Step 3: Implement crawler-extractors.js**

Write `src/extract/crawler-extractors.js`:

```js
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const EXTRACTORS_DIR = join(PROJECT_ROOT, 'playwright-crawler', 'src', 'extractors');

const SIGNAL_PATTERNS = [
  // exported functions: export function extractFoo(...) { ... }
  { rx: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function' },
  // exported const arrows: export const fooBar = ...
  { rx: /export\s+const\s+(\w+)\s*=/g, kind: 'const' },
  // returned object field keys: foo: ..., bar: ...
  { rx: /^\s*([a-z_]\w*):\s*[a-zA-Z0-9_'"\[{]/gm, kind: 'field' },
];

const NOISE_NAMES = new Set([
  'if', 'for', 'while', 'return', 'const', 'let', 'var', 'function',
  'log', 'debug', 'info', 'warn', 'error',
]);

export async function extractCrawlerExtractorSignals() {
  const files = await readdir(EXTRACTORS_DIR);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  const all = [];
  let counter = 1;

  for (const fname of jsFiles) {
    const fullPath = join(EXTRACTORS_DIR, fname);
    const relPath = relative(PROJECT_ROOT, fullPath);
    const text = await readFile(fullPath, 'utf8');

    for (const { rx, kind } of SIGNAL_PATTERNS) {
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(text))) {
        const name = m[1];
        if (NOISE_NAMES.has(name) || name.length < 3) continue;

        const upTo = text.slice(0, m.index);
        const line = upTo.split('\n').length;

        all.push({
          signal_id: `P3-S${String(counter++).padStart(3, '0')}`,
          name,
          signal_type: 'extractor-field',
          priority: 3,
          file: relPath,
          line,
          metadata: { kind, extractor: fname.replace('.js', '') },
        });
      }
    }
  }
  return all;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- extract-crawler-extractors`
Expected: PASS — multiple signals across most of the 9 extractor files.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/extract/crawler-extractors.js \
        scripts/audit-checks-gapmap/__tests__/extract-crawler-extractors.test.js
git commit -m "feat(gapmap): crawler-extractor signal extractor (P3)"
```

---

### Task 11: Misc signal extractor (Priority 4)

**Files:**
- Create: `scripts/audit-checks-gapmap/src/extract/misc.js`
- Test: `scripts/audit-checks-gapmap/__tests__/extract-misc.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/extract-misc.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { extractMiscSignals } from '../src/extract/misc.js';

describe('extractMiscSignals', () => {
  it('extracts signals from crawler.js, crawl-runner.js, reports.js', async () => {
    const signals = await extractMiscSignals();
    // These files may have few clean signals — assert a non-empty result
    expect(signals.length).toBeGreaterThan(0);

    for (const s of signals) {
      expect(s.priority).toBe(4);
      expect(s.file).toMatch(/(crawler\.js|crawl-runner\.js|reports\.js)/);
    }
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- extract-misc`
Expected: FAIL.

- [ ] **Step 3: Implement misc.js**

Write `src/extract/misc.js`:

```js
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');

const TARGETS = [
  'playwright-crawler/src/crawler.js',
  'backend/services/crawl-runner.js',
  'backend/routes/reports.js',
];

const SIGNAL_PATTERNS = [
  { rx: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function', signal_type: 'service-function' },
  { rx: /export\s+const\s+(\w+)\s*=/g, kind: 'const', signal_type: 'service-function' },
];

const NOISE_NAMES = new Set([
  'if', 'for', 'while', 'return', 'const', 'let', 'var', 'function',
  'log', 'debug', 'info', 'warn', 'error',
]);

export async function extractMiscSignals() {
  const all = [];
  let counter = 1;

  for (const file of TARGETS) {
    try {
      const text = await readFile(join(PROJECT_ROOT, file), 'utf8');

      for (const { rx, kind, signal_type } of SIGNAL_PATTERNS) {
        rx.lastIndex = 0;
        let m;
        while ((m = rx.exec(text))) {
          const name = m[1];
          if (NOISE_NAMES.has(name) || name.length < 3) continue;

          const upTo = text.slice(0, m.index);
          const line = upTo.split('\n').length;

          all.push({
            signal_id: `P4-S${String(counter++).padStart(3, '0')}`,
            name,
            signal_type,
            priority: 4,
            file,
            line,
            metadata: { kind },
          });
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return all;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- extract-misc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/extract/misc.js \
        scripts/audit-checks-gapmap/__tests__/extract-misc.test.js
git commit -m "feat(gapmap): misc signal extractor (P4)"
```

---

### Task 12: Signal index orchestrator

**Files:**
- Create: `scripts/audit-checks-gapmap/src/signal-index.js`
- Test: `scripts/audit-checks-gapmap/__tests__/signal-index.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/signal-index.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildSignalIndex } from '../src/signal-index.js';

describe('buildSignalIndex', () => {
  it('combines all 4 priority extractors into a unified list', async () => {
    const index = await buildSignalIndex();
    expect(index.length).toBeGreaterThan(50);

    // All 4 priorities are represented
    const priorities = new Set(index.map(s => s.priority));
    expect(priorities.has(1)).toBe(true);
    expect(priorities.has(2)).toBe(true);
    expect(priorities.has(3)).toBe(true);
  });

  it('all signals have signal_id, name, file, line', async () => {
    const index = await buildSignalIndex();
    for (const s of index) {
      expect(typeof s.signal_id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(typeof s.file).toBe('string');
      expect(typeof s.line).toBe('number');
    }
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- signal-index`
Expected: FAIL.

- [ ] **Step 3: Implement signal-index.js**

Write `src/signal-index.js`:

```js
import { extractParserSignals } from './extract/parser.js';
import { extractIntegrationSignals } from './extract/integration.js';
import { extractCrawlerExtractorSignals } from './extract/crawler-extractors.js';
import { extractMiscSignals } from './extract/misc.js';

export async function buildSignalIndex() {
  const [p1, p2, p3, p4] = await Promise.all([
    extractParserSignals(),
    extractIntegrationSignals(),
    extractCrawlerExtractorSignals(),
    extractMiscSignals(),
  ]);
  return [...p1, ...p2, ...p3, ...p4];
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- signal-index`
Expected: PASS — all 4 priorities present, signals well-formed.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/signal-index.js \
        scripts/audit-checks-gapmap/__tests__/signal-index.test.js
git commit -m "feat(gapmap): signal index orchestrator (P1-P4)"
```

---

### Task 13: Classifier (G-FLAG, G-MAN, G-IMPL-1, G-IMPL-2, G-PARTIAL-1, G-MISS)

**Files:**
- Create: `scripts/audit-checks-gapmap/src/classifier.js`
- Test: `scripts/audit-checks-gapmap/__tests__/classifier.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/classifier.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { classifyRow } from '../src/classifier.js';

const sig = (overrides) => ({
  signal_id: 'X',
  name: '',
  signal_type: 'issue-emitter',
  priority: 1,
  file: 'f.js',
  line: 1,
  metadata: {},
  ...overrides,
});

describe('classifyRow', () => {
  it('G-IMPL-1: P1 score >= 0.6 → implemented', () => {
    const row = { check_id: 'C1', name: 'Title Too Long over 60 chars', automation_type: 'automated' };
    const signals = [sig({ name: 'Title Too Long (over 60 chars)', priority: 1 })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('implemented');
    expect(result.gap_notes).toContain('G-IMPL-1');
    expect(result.impl_evidence).toContain('Title Too Long');
  });

  it('G-IMPL-2: P2 score >= 0.5 (no qualifying P1) → implemented', () => {
    const row = { check_id: 'C2', name: 'Largest Contentful Paint Score', automation_type: 'automated' };
    const signals = [sig({ name: 'getLcpScore', priority: 2, signal_type: 'service-function', file: 'backend/routes/psi.js' })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('implemented');
    expect(result.gap_notes).toContain('G-IMPL-2');
  });

  it('G-PARTIAL-1: P3 score >= 0.4 (no qualifying P1/P2) → partial', () => {
    const row = { check_id: 'C3', name: 'Heading h1 count', automation_type: 'automated' };
    const signals = [sig({ name: 'h1Count', priority: 3, signal_type: 'extractor-field' })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('partial');
    expect(result.gap_notes).toContain('G-PARTIAL-1');
  });

  it('G-MAN: manual + no signal score >= 0.3 → n-a', () => {
    const row = { check_id: 'C4', name: 'Brand Voice Consistency', automation_type: 'manual' };
    const signals = [sig({ name: 'unrelatedThing', priority: 1 })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('n-a');
    expect(result.gap_notes).toContain('G-MAN');
  });

  it('G-MISS: no signal score >= 0.3 → missing', () => {
    const row = { check_id: 'C5', name: 'Some Truly Unique Check', automation_type: 'automated' };
    const signals = [sig({ name: 'totallyUnrelated', priority: 1 })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('missing');
    expect(result.gap_notes).toContain('G-MISS');
  });

  it('G-FLAG: top two priority scores within 0.1 AND both >= 0.4 → flag', () => {
    const row = { check_id: 'C6', name: 'Title Length', automation_type: 'automated' };
    const signals = [
      sig({ name: 'titleLength', priority: 1 }),         // P1 score ~0.5
      sig({ name: 'titleLength validate', priority: 3 }), // P3 score ~0.5
    ];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('flag');
    expect(result.gap_notes).toContain('G-FLAG');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- classifier`
Expected: FAIL.

- [ ] **Step 3: Implement classifier.js**

Write `src/classifier.js`:

```js
import { jaccardScore } from './jaccard.js';

const FLAG_GAP = 0.1;        // top two priorities within this gap
const FLAG_MIN = 0.4;        // ...AND both above this threshold
const IMPL_P1 = 0.6;
const IMPL_P2 = 0.5;
const PARTIAL_P3 = 0.4;
const MISS_THRESHOLD = 0.3;

export function classifyRow(row, signals) {
  const canonicalName = row.name;
  // Best score per priority + the matching signal
  const bestPerPriority = {};
  for (const sig of signals) {
    const score = jaccardScore(canonicalName, sig.name);
    const cur = bestPerPriority[sig.priority];
    if (!cur || score > cur.score) {
      bestPerPriority[sig.priority] = { score, signal: sig };
    }
  }

  const get = (p) => bestPerPriority[p]?.score ?? 0;
  const sigOf = (p) => bestPerPriority[p]?.signal;

  const p1 = get(1);
  const p2 = get(2);
  const p3 = get(3);
  const p4 = get(4);
  const allScores = [p1, p2, p3, p4];
  const maxScore = Math.max(...allScores);

  // G-FLAG (a): top two priorities within 0.1 of each other and both ≥ 0.4
  // Compute top two distinct priorities
  const sortedPriorities = [1, 2, 3, 4]
    .map(p => ({ p, score: get(p) }))
    .sort((a, b) => b.score - a.score);
  if (
    sortedPriorities[0].score >= FLAG_MIN &&
    sortedPriorities[1].score >= FLAG_MIN &&
    Math.abs(sortedPriorities[0].score - sortedPriorities[1].score) <= FLAG_GAP
  ) {
    const top = sigOf(sortedPriorities[0].p);
    return {
      impl_status: 'flag',
      impl_location: top ? `${top.file}:${top.line}` : '',
      impl_evidence: top ? formatEvidence(top) : '',
      gap_notes: `G-FLAG: top two priorities within ${FLAG_GAP} (P${sortedPriorities[0].p}=${sortedPriorities[0].score.toFixed(2)}, P${sortedPriorities[1].p}=${sortedPriorities[1].score.toFixed(2)})`,
    };
  }

  // G-FLAG (b): canonical tokens overlap signals across ≥2 different signal_types
  // (only count when scores are comparable, i.e. each signal_type's best ≥ FLAG_MIN)
  const bestPerType = {};
  for (const sig of signals) {
    const score = jaccardScore(canonicalName, sig.name);
    if (score < FLAG_MIN) continue;
    const cur = bestPerType[sig.signal_type];
    if (!cur || score > cur.score) bestPerType[sig.signal_type] = { score, signal: sig };
  }
  if (Object.keys(bestPerType).length >= 2) {
    const types = Object.keys(bestPerType).join(',');
    const top = Object.values(bestPerType).sort((a, b) => b.score - a.score)[0].signal;
    return {
      impl_status: 'flag',
      impl_location: `${top.file}:${top.line}`,
      impl_evidence: formatEvidence(top),
      gap_notes: `G-FLAG: cross-type ambiguity (${types})`,
    };
  }

  // G-MAN: manual + no signal ≥ 0.3
  if (row.automation_type === 'manual' && maxScore < MISS_THRESHOLD) {
    return { impl_status: 'n-a', impl_location: '', impl_evidence: '', gap_notes: 'G-MAN: manual canonical, no signal match' };
  }

  // G-IMPL-1: P1 ≥ 0.6
  if (p1 >= IMPL_P1) {
    const s = sigOf(1);
    return {
      impl_status: 'implemented',
      impl_location: `${s.file}:${s.line}`,
      impl_evidence: formatEvidence(s),
      gap_notes: `G-IMPL-1: P1 score ${p1.toFixed(2)}`,
    };
  }

  // G-IMPL-2: P2 ≥ 0.5
  if (p2 >= IMPL_P2) {
    const s = sigOf(2);
    return {
      impl_status: 'implemented',
      impl_location: `${s.file}:${s.line}`,
      impl_evidence: formatEvidence(s),
      gap_notes: `G-IMPL-2: P2 score ${p2.toFixed(2)}`,
    };
  }

  // G-PARTIAL-1: P3 ≥ 0.4
  if (p3 >= PARTIAL_P3) {
    const s = sigOf(3);
    return {
      impl_status: 'partial',
      impl_location: `${s.file}:${s.line}`,
      impl_evidence: formatEvidence(s),
      gap_notes: `G-PARTIAL-1: P3 score ${p3.toFixed(2)} — extractor produces signal, no parser/service classifies`,
    };
  }

  // G-MISS: nothing above 0.3
  return { impl_status: 'missing', impl_location: '', impl_evidence: '', gap_notes: `G-MISS: max score ${maxScore.toFixed(2)} below threshold` };
}

function formatEvidence(sig) {
  const kind = sig.signal_type === 'issue-emitter' ? 'issueType' :
               sig.signal_type === 'service-function' ? 'function' :
               sig.signal_type === 'extractor-field' ? 'field' : 'signal';
  return `${kind}: '${sig.name}'`;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- classifier`
Expected: PASS — all 6 rule cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/classifier.js \
        scripts/audit-checks-gapmap/__tests__/classifier.test.js
git commit -m "feat(gapmap): 6-rule classifier (G-FLAG/G-MAN/G-IMPL-1/G-IMPL-2/G-PARTIAL-1/G-MISS)"
```

---

### Task 14: Main pipeline (gapmap)

**Files:**
- Create: `scripts/audit-checks-gapmap/src/gapmap.js`
- Test: `scripts/audit-checks-gapmap/__tests__/gapmap.test.js`

- [ ] **Step 1: Write the failing test**

Write `__tests__/gapmap.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { runGapmap } from '../src/gapmap.js';

describe('runGapmap', () => {
  it('classifies the in-scope canonical rows against the signal index', async () => {
    const result = await runGapmap();
    expect(result.rows.length).toBeGreaterThan(195);
    expect(result.rows.length).toBeLessThan(215);

    for (const r of result.rows) {
      expect(['implemented', 'partial', 'missing', 'n-a', 'flag']).toContain(r.impl_status);
    }
  });

  it('limits to first N rows when limit option provided (for dry-run)', async () => {
    const result = await runGapmap({ limit: 25 });
    expect(result.rows.length).toBe(25);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `cd scripts/audit-checks-gapmap && npm test -- gapmap`
Expected: FAIL.

- [ ] **Step 3: Implement gapmap.js**

Write `src/gapmap.js`:

```js
import { loadCanonical, filterInScope } from './canonical.js';
import { buildSignalIndex } from './signal-index.js';
import { classifyRow } from './classifier.js';

export async function runGapmap({ limit } = {}) {
  const all = await loadCanonical();
  const inScope = filterInScope(all);
  const slice = limit ? inScope.slice(0, limit) : inScope;
  const signals = await buildSignalIndex();

  const rows = slice.map(r => {
    const decision = classifyRow(r, signals);
    return { ...r, ...decision };
  });

  return { rows, signals };
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `cd scripts/audit-checks-gapmap && npm test -- gapmap`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-checks-gapmap/src/gapmap.js \
        scripts/audit-checks-gapmap/__tests__/gapmap.test.js
git commit -m "feat(gapmap): main pipeline (canonical + signals → classified rows)"
```

---

### Task 15: Output writers

**Files:**
- Create: `scripts/audit-checks-gapmap/src/output/canonical-csv.js`
- Create: `scripts/audit-checks-gapmap/src/output/summary-md.js`
- Create: `scripts/audit-checks-gapmap/src/output/signal-index-md.js`
- Create: `scripts/audit-checks-gapmap/src/output/bulk-decisions-md.js`
- Create: `scripts/audit-checks-gapmap/src/output/individual-md.js`
- Create: `scripts/audit-checks-gapmap/src/output/dryrun-md.js`
- Test: `scripts/audit-checks-gapmap/__tests__/output.test.js`

- [ ] **Step 1: Implement canonical-csv writer**

Write `src/output/canonical-csv.js`:

```js
import { writeCsv } from '../csv.js';

const ORIGINAL_COLUMNS = [
  'check_id', 'csv_row', 'seed_check_number', 'source',
  'category', 'subsection', 'name', 'original_name',
  'severity', 'automation_type', 'decision', 'rule_id', 'merge_into',
  'rationale', 'pass_condition', 'fail_condition',
  'implementation_rule', 'tool_current', 'notes',
];

const NEW_COLUMNS = ['impl_status', 'impl_location', 'impl_evidence', 'gap_notes'];

export const COLUMNS = [...ORIGINAL_COLUMNS, ...NEW_COLUMNS];

export async function writeExtendedCanonicalCsv(rows) {
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

export function buildGapmapSummary(rows, meta = {}) {
  const total = rows.length;
  const byStatus = countBy(rows, 'impl_status');
  const byCategory = countBy(rows, 'category');

  const lines = [];
  lines.push('# Gap-Map Summary');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  if (meta.label) lines.push(`- Label: ${meta.label}`);
  lines.push(`- Total in-scope rows: ${total}`);
  lines.push('');
  lines.push('## By impl_status');
  for (const [k, v] of Object.entries(byStatus)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By category');
  for (const [k, v] of Object.entries(byCategory)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## Top categories with `missing` rows');
  const missingByCategory = countBy(rows.filter(r => r.impl_status === 'missing'), 'category');
  for (const [k, v] of Object.entries(missingByCategory)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  return lines.join('\n');
}
```

- [ ] **Step 3: Implement signal-index-md writer**

Write `src/output/signal-index-md.js`:

```js
export function buildSignalIndexMarkdown(signals) {
  const byPriority = new Map();
  for (const s of signals) {
    const p = s.priority;
    if (!byPriority.has(p)) byPriority.set(p, []);
    byPriority.get(p).push(s);
  }

  const lines = ['# Gap-Map Signal Index', ''];
  lines.push(`Total signals extracted: **${signals.length}**`);
  lines.push('');

  for (const [priority, items] of [...byPriority.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`## Priority ${priority} (${items.length} signals)`);
    lines.push('');
    lines.push('| signal_id | name | type | file:line |');
    lines.push('|---|---|---|---|');
    for (const s of items) {
      const name = String(s.name).replace(/\|/g, '\\|');
      lines.push(`| ${s.signal_id} | ${name} | ${s.signal_type} | ${s.file}:${s.line} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Implement bulk-decisions writer + parser**

Write `src/output/bulk-decisions-md.js`:

```js
export function buildBulkDecisions(rows) {
  const flagged = rows.filter(r => r.impl_status === 'flag');
  const groups = new Map();
  for (const r of flagged) {
    // Group by flag-reason × category. The reason is encoded in gap_notes.
    const reason = (r.gap_notes || '').split(':')[0].trim() || 'G-FLAG';
    const key = `${reason}|${r.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const lines = [
    '# Gap-Map Bulk Triage Decisions',
    '',
    'For each group below, edit the `Decision:` line in place. Allowed values:',
    '`accept-implemented`, `accept-partial`, `accept-missing`, `flag-individually` (forces per-row review at G6).',
    '',
  ];

  let idx = 1;
  for (const [key, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const [reason, category] = key.split('|');
    lines.push(`## Group ${idx}: ${reason} in ${category} (${items.length} flags)`);
    lines.push('');
    lines.push('Sample names:');
    for (const r of items.slice(0, 5)) lines.push(`- ${r.original_name || r.name} [${r.severity}]`);
    if (items.length > 5) lines.push(`- ...and ${items.length - 5} more`);
    lines.push('');
    lines.push('> Decision: ___');
    lines.push('');
    idx++;
  }

  if (groups.size === 0) {
    lines.push('_No flag rows. Skip G4 and proceed to G5._');
  }
  return lines.join('\n');
}

export function parseBulkDecisions(markdown) {
  const groups = [];
  const groupRe = /## Group \d+: (\S+) in ([^()]+?) \((\d+) flags\)[\s\S]*?> Decision:\s*(\S+)/g;
  let m;
  while ((m = groupRe.exec(markdown))) {
    groups.push({ reason: m[1], category: m[2].trim(), count: Number(m[3]), decision: m[4] });
  }
  return groups;
}
```

- [ ] **Step 5: Implement individual-md writer + parser**

Write `src/output/individual-md.js`:

```js
export function buildIndividualFlags(rows) {
  const flagged = rows.filter(r => r.impl_status === 'flag');
  const lines = [
    '# Gap-Map Individual Flag Triage',
    '',
    'For each flag, edit the `Your call:` line in place. Allowed values:',
    '`implemented`, `partial`, `missing`, `n-a`, `comment: <text>`.',
    '',
  ];
  flagged.forEach((r, i) => {
    lines.push(`## FLAG #${String(i + 1).padStart(3, '0')}  ${r.check_id}`);
    lines.push(`- category: ${r.category}`);
    lines.push(`- name:    ${r.original_name || r.name}`);
    lines.push(`- severity: ${r.severity}  |  automation: ${r.automation_type}`);
    lines.push(`- gap_notes: ${r.gap_notes}`);
    if (r.impl_evidence) lines.push(`- evidence: ${r.impl_evidence}`);
    if (r.impl_location) lines.push(`- location: ${r.impl_location}`);
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

- [ ] **Step 6: Implement dryrun-md writer**

Write `src/output/dryrun-md.js`:

```js
export function buildDryrunTable(rows) {
  const header = '| check_id | category | name | impl_status | rule | evidence |\n|---|---|---|---|---|---|';
  const body = rows.map(r => {
    const rule = (r.gap_notes || '').split(':')[0].trim() || '';
    const evidence = (r.impl_evidence || '').replace(/\|/g, '\\|');
    const name = String(r.name || '').replace(/\|/g, '\\|');
    return `| ${r.check_id} | ${r.category} | ${name} | ${r.impl_status} | ${rule} | ${evidence} |`;
  }).join('\n');
  return `# Gap-Map Dry-Run Decision Table (first 25 in-scope rows)\n\n${header}\n${body}\n`;
}
```

- [ ] **Step 7: Smoke-test the writers**

Write `__tests__/output.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { writeExtendedCanonicalCsv, COLUMNS } from '../src/output/canonical-csv.js';
import { buildGapmapSummary } from '../src/output/summary-md.js';
import { buildSignalIndexMarkdown } from '../src/output/signal-index-md.js';
import { buildBulkDecisions, parseBulkDecisions } from '../src/output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from '../src/output/individual-md.js';
import { buildDryrunTable } from '../src/output/dryrun-md.js';

const fakeRows = [
  { check_id: 'C001', category: 'Title Tags', name: 'Title length', original_name: 'Title length', severity: 'warning', automation_type: 'automated', impl_status: 'implemented', gap_notes: 'G-IMPL-1: P1 score 0.80', impl_evidence: "issueType: 'Title Too Long'", impl_location: 'backend/services/audit-parser.service.js:152' },
  { check_id: 'C002', category: 'Schema', name: 'Schema check', original_name: 'Schema check', severity: 'critical', automation_type: 'automated', impl_status: 'flag', gap_notes: 'G-FLAG: cross-type ambiguity', impl_evidence: "issueType: 'Schema X'", impl_location: 'backend/services/audit-parser.service.js:300' },
];

const fakeSignals = [
  { signal_id: 'P1-S001', name: 'Title Too Long', signal_type: 'issue-emitter', priority: 1, file: 'backend/services/audit-parser.service.js', line: 152 },
  { signal_id: 'P3-S001', name: 'h1Count', signal_type: 'extractor-field', priority: 3, file: 'playwright-crawler/src/extractors/headings.js', line: 5 },
];

describe('output writers smoke', () => {
  it('extended canonical CSV has 23 columns', async () => {
    expect(COLUMNS.length).toBe(23);
    const csv = await writeExtendedCanonicalCsv(fakeRows);
    expect(csv.split('\n')[0]).toContain('impl_status');
    expect(csv.split('\n')[0]).toContain('gap_notes');
  });

  it('summary contains totals + by-status + by-category', () => {
    const md = buildGapmapSummary(fakeRows);
    expect(md).toContain('Total in-scope rows: 2');
    expect(md).toContain('## By impl_status');
    expect(md).toContain('## By category');
  });

  it('signal index markdown includes priority sections', () => {
    const md = buildSignalIndexMarkdown(fakeSignals);
    expect(md).toContain('Total signals extracted: **2**');
    expect(md).toContain('Priority 1');
    expect(md).toContain('Priority 3');
  });

  it('bulk decisions round-trip', () => {
    const md = buildBulkDecisions(fakeRows);
    expect(md).toContain('Group 1');
    const filled = md.replace('Decision: ___', 'Decision: accept-missing');
    const parsed = parseBulkDecisions(filled);
    expect(parsed[0].decision).toBe('accept-missing');
  });

  it('individual flags round-trip', () => {
    const md = buildIndividualFlags(fakeRows);
    expect(md).toContain('FLAG #001');
    const filled = md.replace('Your call: ___', 'Your call: missing');
    const parsed = parseIndividualFlags(filled);
    expect(parsed[0]).toEqual({ check_id: 'C002', decision: 'missing' });
  });

  it('dryrun table renders all status types', () => {
    const md = buildDryrunTable(fakeRows);
    expect(md).toContain('| C001 |');
    expect(md).toContain('| C002 |');
    expect(md).toContain('implemented');
    expect(md).toContain('flag');
  });
});
```

- [ ] **Step 8: Run tests**

Run: `cd scripts/audit-checks-gapmap && npm test -- output`
Expected: PASS — 6 writer smoke tests.

- [ ] **Step 9: Commit**

```bash
git add scripts/audit-checks-gapmap/src/output/ \
        scripts/audit-checks-gapmap/__tests__/output.test.js
git commit -m "feat(gapmap): output writers (csv + summary + signal-index + bulk + individual + dryrun)"
```

---

### Task 16: CLI entry point

**Files:**
- Create: `scripts/audit-checks-gapmap/src/cli.js`

- [ ] **Step 1: Implement CLI**

Write `src/cli.js`:

```js
#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from './csv.js';
import { runGapmap } from './gapmap.js';
import { writeExtendedCanonicalCsv } from './output/canonical-csv.js';
import { buildGapmapSummary } from './output/summary-md.js';
import { buildSignalIndexMarkdown } from './output/signal-index-md.js';
import { buildBulkDecisions, parseBulkDecisions } from './output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from './output/individual-md.js';
import { buildDryrunTable } from './output/dryrun-md.js';
import { loadCanonical } from './canonical.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_DIR = join(PROJECT_ROOT, 'docs', 'audit-checks');
const CANONICAL_CSV = join(OUT_DIR, 'canonical-checks-v1.csv');

async function ensureOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function dryrun() {
  await ensureOutDir();
  const { rows, signals } = await runGapmap({ limit: 25 });
  await writeFile(join(OUT_DIR, 'gapmap-dryrun-25rows.md'), buildDryrunTable(rows));
  await writeFile(join(OUT_DIR, 'gapmap-signal-index.md'), buildSignalIndexMarkdown(signals));
  console.log('Dry-run table written to docs/audit-checks/gapmap-dryrun-25rows.md');
  console.log('Signal index written to docs/audit-checks/gapmap-signal-index.md');
}

async function fullpass() {
  await ensureOutDir();
  const { rows, signals } = await runGapmap();

  // Merge in-scope classified rows back into the full canonical CSV
  const allText = await readFile(CANONICAL_CSV, 'utf8');
  const allRows = await parseCsv(allText);
  const byId = new Map(rows.map(r => [r.check_id, r]));
  const merged = allRows.map(r => {
    const upd = byId.get(r.check_id);
    return upd ? { ...r, impl_status: upd.impl_status, impl_location: upd.impl_location, impl_evidence: upd.impl_evidence, gap_notes: upd.gap_notes } : r;
  });

  await writeFile(join(OUT_DIR, 'canonical-checks-v1.draft.csv'), await writeExtendedCanonicalCsv(merged));
  await writeFile(join(OUT_DIR, 'gapmap-run-summary.md'), buildGapmapSummary(rows, { label: 'G3 full pass' }));
  await writeFile(join(OUT_DIR, 'gapmap-bulk-decisions.md'), buildBulkDecisions(rows));
  await writeFile(join(OUT_DIR, 'gapmap-signal-index.md'), buildSignalIndexMarkdown(signals));
  console.log('Full-pass artifacts written to docs/audit-checks/.');
  console.log('NEXT: edit gapmap-bulk-decisions.md (fill `Decision:` lines), then run `applybulk`.');
}

async function applybulk() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const bulkPath = join(OUT_DIR, 'gapmap-bulk-decisions.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const bulkText = await readFile(bulkPath, 'utf8');
  const draftRows = await parseCsv(draftCsvText);
  const bulkAnswers = parseBulkDecisions(bulkText);

  for (const ans of bulkAnswers) {
    if (ans.decision === '___' || !ans.decision) continue;
    for (const row of draftRows) {
      if (row.impl_status !== 'flag') continue;
      const reason = (row.gap_notes || '').split(':')[0].trim() || 'G-FLAG';
      if (reason !== ans.reason || row.category !== ans.category) continue;
      if (ans.decision === 'accept-implemented') { row.impl_status = 'implemented'; row.gap_notes = `bulk-implemented (${ans.reason})`; }
      else if (ans.decision === 'accept-partial') { row.impl_status = 'partial'; row.gap_notes = `bulk-partial (${ans.reason})`; }
      else if (ans.decision === 'accept-missing') { row.impl_status = 'missing'; row.gap_notes = `bulk-missing (${ans.reason})`; }
      // flag-individually keeps impl_status=flag for individual review
    }
  }

  await writeFile(draftCsvPath, await writeExtendedCanonicalCsv(draftRows));
  await writeFile(join(OUT_DIR, 'gapmap-individual.md'), buildIndividualFlags(draftRows));
  console.log('Bulk decisions applied. Individual-flag file written.');
  console.log('NEXT: edit gapmap-individual.md (fill `Your call:` lines), then run `finalize`.');
}

async function finalize() {
  await ensureOutDir();
  const draftCsvPath = join(OUT_DIR, 'canonical-checks-v1.draft.csv');
  const individualPath = join(OUT_DIR, 'gapmap-individual.md');
  const draftCsvText = await readFile(draftCsvPath, 'utf8');
  const individualText = await readFile(individualPath, 'utf8');
  const draftRows = await parseCsv(draftCsvText);
  const indivAnswers = parseIndividualFlags(individualText);

  for (const ans of indivAnswers) {
    if (!ans.check_id || !ans.decision || ans.decision === '___') continue;
    const row = draftRows.find(r => r.check_id === ans.check_id);
    if (!row) continue;
    if (ans.decision.startsWith('comment:')) {
      row.gap_notes = (row.gap_notes ? row.gap_notes + '; ' : '') + ans.decision;
      // leave impl_status at its prior value (don't auto-change on comment)
    } else if (['implemented', 'partial', 'missing', 'n-a'].includes(ans.decision)) {
      row.impl_status = ans.decision;
      row.gap_notes = `individual triage (${ans.decision})`;
    }
  }

  // Promote draft to final canonical CSV
  await writeFile(CANONICAL_CSV, await writeExtendedCanonicalCsv(draftRows));
  // Generate final summary (only the in-scope rows for the summary stats)
  const inScopeRows = draftRows.filter(r => r.impl_status && r.impl_status !== '');
  await writeFile(join(OUT_DIR, 'gapmap-summary.md'), buildGapmapSummary(inScopeRows, { label: 'G7 finalized' }));
  console.log('Finalized canonical CSV + gapmap-summary.md written.');
  console.log('NEXT: review, then `git rm` drafts and commit per plan Task 22.');
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

Run: `cd scripts/audit-checks-gapmap && npm run cli -- dryrun`
Expected: writes `docs/audit-checks/gapmap-dryrun-25rows.md` and `gapmap-signal-index.md`.

- [ ] **Step 3: Verify output looks reasonable**

Run: `head -30 "docs/audit-checks/gapmap-dryrun-25rows.md"`
Expected: header line + 25 rows of decision data.

- [ ] **Step 4: Commit (CLI only — not the dryrun output yet, that's G1)**

```bash
git add scripts/audit-checks-gapmap/src/cli.js
git commit -m "feat(gapmap): cli entry with dryrun/fullpass/applybulk/finalize"
```

---

## Phase B — Execute Milestones

### Task 17: G1 — Dry-run on first 25 in-scope rows (autonomous)

**Files touched:**
- `docs/audit-checks/gapmap-dryrun-25rows.md`
- `docs/audit-checks/gapmap-signal-index.md`

- [ ] **Step 1: Run dryrun**

Run: `cd scripts/audit-checks-gapmap && npm run cli -- dryrun`
Expected: both files written.

- [ ] **Step 2: Hand off to user for G2 review (do NOT commit yet)**

Stage the artifacts but wait for user approval before committing. The user reviews `gapmap-dryrun-25rows.md` to calibrate the 0.6/0.5/0.4/0.3 thresholds.

---

### Task 18: ◇ G2 — User dry-run review (CHECKPOINT)

**HALT execution and wait for user.**

> "Dry-run complete on the first 25 in-scope canonical rows. Review `docs/audit-checks/gapmap-dryrun-25rows.md`. If you'd flip ≥3 classifications, tell me which thresholds need tightening (e.g., 'G-IMPL-1 is too aggressive') and I'll revise + re-run G1. Otherwise reply 'proceed' and I'll start the full pass."

**Do not proceed until the user replies "proceed" or provides threshold edits.**

If user requests threshold edits:
- Apply the edit to `src/classifier.js` constants (`IMPL_P1`, `IMPL_P2`, `PARTIAL_P3`, `MISS_THRESHOLD`, `FLAG_GAP`, `FLAG_MIN`)
- Re-run Task 17 dryrun
- Loop G2 until user accepts

Once user replies "proceed":

```bash
git add docs/audit-checks/gapmap-dryrun-25rows.md \
        docs/audit-checks/gapmap-signal-index.md
git commit -m "docs(audit-checks): G1 dry-run + signal index"
```

---

### Task 19: G3 — Full pass on remaining 179 rows (autonomous)

**Files touched:**
- `docs/audit-checks/canonical-checks-v1.draft.csv`
- `docs/audit-checks/gapmap-bulk-decisions.md`
- `docs/audit-checks/gapmap-run-summary.md`
- `docs/audit-checks/gapmap-signal-index.md` (regenerated)

- [ ] **Step 1: Run fullpass**

Run: `cd scripts/audit-checks-gapmap && npm run cli -- fullpass`
Expected: 4 files written. Console prints final counts.

- [ ] **Step 2: Sanity-check counts**

Run: `head -25 "docs/audit-checks/gapmap-run-summary.md"`
Expected:
- Total in-scope rows: ~204
- "By impl_status" includes `implemented`, `partial`, `missing`, `n-a`, `flag` with non-zero counts
- "By category" lists the 23 in-scope categories

- [ ] **Step 3: Sanity-check the draft CSV**

Run: `head -1 docs/audit-checks/canonical-checks-v1.draft.csv | tr ',' '\n' | wc -l`
Expected: 23 columns.

- [ ] **Step 4: Commit G3 artifacts**

```bash
git add docs/audit-checks/canonical-checks-v1.draft.csv \
        docs/audit-checks/gapmap-run-summary.md \
        docs/audit-checks/gapmap-bulk-decisions.md \
        docs/audit-checks/gapmap-signal-index.md
git commit -m "docs(audit-checks): G3 full-pass artifacts (draft canonical + bulk-triage)"
```

---

### Task 20: ◇ G4 — User bulk-decisions review (CHECKPOINT)

**HALT execution and wait for user.**

> "Bulk-decisions file ready. Edit `> Decision: ___` lines in `docs/audit-checks/gapmap-bulk-decisions.md` in place. Allowed values: `accept-implemented`, `accept-partial`, `accept-missing`, `flag-individually`. Reply when done."

**Do not proceed until user replies "done" (or equivalent).**

---

### Task 21: G5 — Apply bulk + emit individual flags (autonomous)

**Files touched:**
- `docs/audit-checks/canonical-checks-v1.draft.csv` (updated)
- `docs/audit-checks/gapmap-individual.md` (created)

- [ ] **Step 1: Run applybulk**

Run: `cd scripts/audit-checks-gapmap && npm run cli -- applybulk`
Expected:
- draft CSV updated in place with bulk decisions baked in
- `gapmap-individual.md` lists remaining flags (those marked `flag-individually` plus any flags in non-bulkable groups)

- [ ] **Step 2: Sanity-check individual count**

Run: `grep -c "^## FLAG" "docs/audit-checks/gapmap-individual.md"`
Expected: 0–30 flags. If much higher, the bulk decisions were too narrow; if 0, may indicate over-classification.

- [ ] **Step 3: Commit**

```bash
git add docs/audit-checks/canonical-checks-v1.draft.csv \
        docs/audit-checks/gapmap-individual.md
git commit -m "docs(audit-checks): G5 apply bulk decisions, emit individual triage"
```

---

### Task 22: ◇ G6 — User individual-flags review (CHECKPOINT)

**HALT execution and wait for user.**

> "Individual flags ready. For each flag, edit the `Your call: ___` line in `docs/audit-checks/gapmap-individual.md`. Allowed values: `implemented`, `partial`, `missing`, `n-a`, `comment: <free text>`. Reply when done."

**Do not proceed until user replies "done".**

---

### Task 23: G7 — Finalize + companion docs (autonomous)

**Files touched:**
- Updated: `docs/audit-checks/canonical-checks-v1.csv` (now 23 columns, 204 in-scope rows have new column values populated)
- Created: `docs/audit-checks/gapmap-summary.md`
- Kept: `docs/audit-checks/gapmap-signal-index.md`
- Deleted: `docs/audit-checks/canonical-checks-v1.draft.csv`
- Deleted: `docs/audit-checks/gapmap-bulk-decisions.md`
- Deleted: `docs/audit-checks/gapmap-individual.md`
- Deleted: `docs/audit-checks/gapmap-run-summary.md`
- Deleted: `docs/audit-checks/gapmap-dryrun-25rows.md`

- [ ] **Step 1: Run finalize**

Run: `cd scripts/audit-checks-gapmap && npm run cli -- finalize`
Expected: final files written.

- [ ] **Step 2: Embed Decision Log into gapmap-summary.md**

Append the individual triage answers as an audit trail:

```bash
cat docs/audit-checks/gapmap-individual.md >> docs/audit-checks/gapmap-summary.md
```

- [ ] **Step 3: Verify final canonical CSV**

Run: `head -1 docs/audit-checks/canonical-checks-v1.csv | awk -F',' '{print NF}'`
Expected: 23 columns.

Run: `wc -l docs/audit-checks/canonical-checks-v1.csv`
Expected: 611 lines (1 header + 610 rows — same row count as before; only the in-scope 204 rows have non-empty new columns).

- [ ] **Step 4: Delete drafts**

```bash
git rm docs/audit-checks/canonical-checks-v1.draft.csv \
       docs/audit-checks/gapmap-bulk-decisions.md \
       docs/audit-checks/gapmap-individual.md \
       docs/audit-checks/gapmap-run-summary.md \
       docs/audit-checks/gapmap-dryrun-25rows.md
```

- [ ] **Step 5: Commit final artifacts**

```bash
git add docs/audit-checks/canonical-checks-v1.csv \
        docs/audit-checks/gapmap-summary.md \
        docs/audit-checks/gapmap-signal-index.md
git commit -m "docs(audit-checks): produce gap-map v1"
```

- [ ] **Step 6: Final sanity check**

Run: `git log --oneline -10`
Expected: spec commit, plan commit, Task 1–16 build commits, G1/G3/G5 milestone commits, final G7 commit.

---

## Verification Checklist (run after Task 23)

- [ ] All 14 test files pass: `cd scripts/audit-checks-gapmap && npm test`
- [ ] `docs/audit-checks/canonical-checks-v1.csv` has 23 columns
- [ ] In-scope 204 rows all have non-empty `impl_status`
- [ ] Out-of-scope rows have empty `impl_*`/`gap_notes` columns (untouched)
- [ ] `docs/audit-checks/gapmap-summary.md` includes by-status counts + decision log
- [ ] `docs/audit-checks/gapmap-signal-index.md` lists all extracted signals with file:line
- [ ] All draft files deleted
- [ ] No changes to `backend/services/audit-parser.service.js` or any platform code
- [ ] No changes to `backend/db/seed/audit-checks.js`
- [ ] No changes to `frontend/src/lib/auditCategories.js`
- [ ] No changes to `PRD.md`
- [ ] No new database migrations

---

## Out of Scope (Phase 3 / Phase 4 preview)

- **Phase 3 — Roadmap:** sequence the `missing` and `partial` rows into P0/P1/P2 sprint buckets with effort estimates
- **Phase 4 — Re-seed + PRD update:** generate new seed file from canonical CSV; update PRD claim; rename `Local SEO & GEO` in `frontend/src/lib/auditCategories.js`

Each later phase has its own spec.
