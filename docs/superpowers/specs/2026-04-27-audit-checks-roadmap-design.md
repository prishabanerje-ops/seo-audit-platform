# Audit-Checks Roadmap (Phase 3) — Design

**Date:** 2026-04-27
**Status:** Design — pre-implementation
**Owner:** Aakash Srivastava (aakash.srivastava@cars24.com)

This is Phase 3 of the audit-checks reconciliation project.

## 1. Context & References

This spec builds on:
- [2026-04-25-audit-checks-canonical-reconciliation-design.md](2026-04-25-audit-checks-canonical-reconciliation-design.md) — Phase 1 (curate + retaxonomy). Produced `docs/audit-checks/canonical-checks-v1.csv` (610 rows, 19 cols).
- [2026-04-26-audit-checks-gap-map-design.md](2026-04-26-audit-checks-gap-map-design.md) — Phase 2 (gap-map). Extended canonical CSV to 23 cols with `impl_status` for the 204 in-scope rows.

**Phase 1 spec preview of Phase 3:** _"sequence missing checks into P0/P1/P2 with effort estimates"_ — this spec realises that.

**Phase 2 outputs Phase 3 consumes:**
- `docs/audit-checks/canonical-checks-v1.csv` — the 23-col canonical with `impl_status` populated.
- `docs/audit-checks/gapmap-summary.md` — current breakdown: 149 missing + 38 n-a + 14 partial + 3 implemented = 204 in-scope rows.

---

## 2. Goals

- Produce a prioritised roadmap of every missing or partial check, with `priority` (P0/P1/P2) and `effort` (S/M/L/XL) annotations.
- Use a **hybrid workflow**: heuristic auto-suggests, user reviews bulk groupings, user overrides individual outliers (mirrors Phase 2's G1–G7 milestone pattern).
- Extend the canonical CSV in place from 23 cols to 26 cols (`priority`, `effort`, `roadmap_notes`).
- Emit a companion `roadmap-summary.md` for human-readable scanning.
- **No platform code is modified.** This phase produces docs only. Implementation of any priority bucket is Phase 4.

---

## 3. Scope

### In scope (163 rows)

Every canonical row where:
- `decision ∈ {keep, edit}` AND
- `source ∈ {csv-only, both}` AND
- `impl_status ∈ {missing, partial}`

This is the **149 missing + 14 partial** subset from Phase 2's gap-map.

### Out of scope

- The **38 n-a manual** rows — belong in a separate "manual workflow" doc (different audience: SEO operator, not engineer).
- The **3 already-implemented** rows — not roadmap items.
- The **406 out-of-scope rows** (decision = cut/merge OR source = seed-only) — already filtered in Phase 2.
- **Implementation of any priority bucket** — Phase 4.
- **Re-seed** of `backend/db/seed/audit-checks.js` — Phase 4.
- **PRD update** to correct the 291/321-check claim — Phase 4.
- **Cross-check dependency tracking** — Phase 4 sequencer task.

---

## 4. Inputs

Phase 3 reads exactly one input file:

```
docs/audit-checks/canonical-checks-v1.csv
```

23 columns (Phase 2's output). The relevant fields for Phase 3 are:

| field | role |
|---|---|
| `check_id` | row identity |
| `category` | feeds the effort rubric (category-tier lookup) |
| `severity` | feeds the priority rubric (base tier) |
| `automation_type` | already filtered by Phase 2 — not used in Phase 3 rubric |
| `impl_status` | feeds both rubrics (partial → S, partial → priority promotion) |
| `decision`, `source` | filter inputs |

---

## 5. Priority Rubric

For each in-scope row, priority is computed in two steps.

### Step 1: base priority from `severity`

| severity | base priority | rule ID |
|---|---|---|
| `critical` | P0 | `R-BASE-CRITICAL` |
| `warning` | P1 | `R-BASE-WARNING` |
| `info` | P2 | `R-BASE-INFO` |
| empty / unknown | P2 (with flag) | `R-BASE-DEFAULT` |

### Step 2: ease promotion (only when `impl_status = partial`)

| severity | base | promoted |
|---|---|---|
| critical | P0 | P0 (unchanged) |
| warning | P1 | **P0** |
| info | P2 | **P1** |

Rule ID: `R-PROMO-PARTIAL`.

### Auditability

Every row gets a fragment in `roadmap_notes` recording the rule that fired, e.g.:
- `"R-BASE-WARNING (warning→P1)"` for missing/warning items
- `"R-PROMO-PARTIAL (partial+warning→P0)"` for promoted partials

### Edge cases

- Empty `severity` falls through to `R-BASE-DEFAULT → P2` and is appended `; PRIORITY-FLAG: empty severity` so it surfaces at R6 individual triage.
- No P3 tier exists — overrides at triage edit the cell directly to P0/P1/P2.

---

## 6. Effort Rubric

### Step 1: by `impl_status`

| impl_status | effort | rule ID |
|---|---|---|
| `partial` | **S** | `R-EFF-1-PARTIAL` |
| `missing` | continue to Step 2 | — |

### Step 2: by category infrastructure tier (only for `missing`)

| Tier | Default effort | Rule ID | Categories (23 in-scope total) |
|---|---|---|---|
| **Extractor-covered** (10) | **M** | `R-EFF-2-EXTRACTOR` | Title Tags, Meta Descriptions, Headings, Canonicalisation, Schema & Structured Data, Images, Internal Linking, Response Codes & Redirects, URL Structure, Content Quality |
| **Needs-new-infra** (7) | **L** | `R-EFF-3-NEW-INFRA` | Robots & Crawl Directives, XML Sitemaps, Crawlability & Indexability, Mobile & Usability, JavaScript Rendering, Core Web Vitals, Security & HTTPS |
| **Needs-external-integration** (6) | **L** | `R-EFF-4-EXTERNAL` | GEO & LLM Crawlers, AI Overviews & AIO Optimization, Local SEO, International SEO, E-E-A-T Signals, Rankings & Traffic |

### Definitions

- **S** = hours
- **M** = 1–2 days
- **L** = 3–5 days
- **XL** = 1–2 weeks (reserved — never auto-assigned; only user override at R6)

### Why the two L tiers map to the same effort label

Tier 2 (new internal infra) and Tier 3 (external integration) both represent ~3–5 days of work. The kind of work differs; the duration estimate doesn't. The kind shows up in `roadmap_notes` via the rule ID, surfacing it at bulk-review without auto-inflating the label.

### XL escalation

The user explicitly bumps an item to XL at R6 individual triage when:
- It needs major new UX surface (e.g., manual Local SEO data entry per location), OR
- It needs a novel external integration with non-trivial auth/quotas (e.g., new SERP API, new third-party signal aggregator).

---

## 7. Workflow Milestones (R1–R7)

Mirrors Phase 2's G1–G7 (proven pattern, three user checkpoints).

| ID | Type | What happens |
|---|---|---|
| **R1** | autonomous | `npm run cli -- dryrun` — heuristic on first 25 in-scope rows. Writes `docs/audit-checks/roadmap-dryrun-25rows.md`. |
| **R2** | ◇ user checkpoint | User reviews dry-run table. If ≥3 priorities or efforts feel wrong, user requests rubric edits. Loop until "proceed". |
| **R3** | autonomous | `npm run cli -- fullpass` on all 163 in-scope rows. Writes `canonical-checks-v1.draft.csv`, `roadmap-run-summary.md`, `roadmap-bulk-decisions.md`. |
| **R4** | ◇ user checkpoint | User edits `> Decision: ___` lines in `roadmap-bulk-decisions.md`. Bulk decisions are scoped per (priority × category) group. Allowed values: `accept` / `reshape: P0` / `reshape: P1` / `reshape: P2` / `flag-individually`. |
| **R5** | autonomous | `npm run cli -- applybulk`. Bulk decisions applied to draft CSV. `flag-individually` items routed into `roadmap-individual.md`. |
| **R6** | ◇ user checkpoint | User edits `> Your call: ___` lines in `roadmap-individual.md`. Allowed values: `P0` / `P1` / `P2`, optional effort override `S` / `M` / `L` / `XL`, `comment: <text>`. |
| **R7** | autonomous | `npm run cli -- finalize`. Apply individual decisions, promote draft to final canonical CSV (26 cols), emit `roadmap-summary.md`, embed individual triage as decision log, delete drafts, commit. |

### R3 bulk-decisions group format

Items are grouped by `(priority × category)`, each group showing up to 5 sample names + count:

```
## Group 1: P0 / Title Tags (3 items)

Sample names:
- Title Tag Missing [critical]
- Title Length [warning]
- Title in URL Match [warning]

> Decision: ___
```

Allowed `Decision:` values: `accept` (no change), `reshape: P0` / `reshape: P1` / `reshape: P2` (re-tier the whole group), `flag-individually` (forces per-row review at R6).

### R5 individual block format

```
## ROADMAP #001  C123
- category: Title Tags
- name:     Title Tag Missing
- severity: critical
- impl_status: missing
- current_priority: P0
- current_effort: M
- roadmap_notes: R-BASE-CRITICAL (critical→P0); R-EFF-2-EXTRACTOR (missing/extractor-covered→M)

> Your call: ___
```

Allowed `Your call:` values:
- `P0` / `P1` / `P2` — re-priority only
- `P0 effort: L` — re-priority + override effort (any combination)
- `effort: XL` — effort override only
- `comment: <free text>` — append to `roadmap_notes`, leave priority/effort unchanged

---

## 8. Output Spec

### Extended canonical CSV

`docs/audit-checks/canonical-checks-v1.csv` grows from 23 to **26 columns**.

| # | column | values | populated for |
|---|---|---|---|
| 24 | `priority` | `P0` / `P1` / `P2` | the 163 in-scope rows |
| 25 | `effort` | `S` / `M` / `L` / `XL` | the 163 in-scope rows |
| 26 | `roadmap_notes` | rule trace + optional free-text | the 163 in-scope rows |

The other 447 rows (out-of-scope per Phase 2) keep these 3 cells empty — same convention as Phase 2's `impl_status` for out-of-scope rows.

### `roadmap_notes` format

Semicolon-separated fragments. **Accumulation rule:** rule traces are written first (left), user overrides appended last (right). The tool never deletes prior fragments; R6 individual triage and R4 bulk reshape both append rather than replace.

Examples:

- `"R-BASE-WARNING (warning→P1); R-EFF-2-EXTRACTOR (missing/extractor-covered→M)"`
- `"R-PROMO-PARTIAL (partial+warning→P0); R-EFF-1-PARTIAL (partial→S)"`
- `"R-BASE-CRITICAL; R-EFF-3-NEW-INFRA; user override: bumped to XL — needs new robots-fetcher service"`
- `"R-BASE-DEFAULT (no severity, defaulted to P2); R-EFF-2-EXTRACTOR; PRIORITY-FLAG: empty severity"`
- `"R-BASE-WARNING; R-EFF-2-EXTRACTOR; bulk reshape: P1→P0 (Title Tags group)"` — after R4 reshape
- `"R-BASE-WARNING; R-EFF-2-EXTRACTOR; bulk reshape: P1→P0; individual override: P0→P1"` — after R4 then R6 disagreement

### Companion summary doc

`docs/audit-checks/roadmap-summary.md`:

```markdown
# Audit-Checks Roadmap v1

- Generated: <ISO timestamp>
- Total in-scope: 163 (149 missing + 14 partial)

## By priority
- P0: <count>
- P1: <count>
- P2: <count>

## By effort
- S: <count>
- M: <count>
- L: <count>
- XL: <count>

## Priority × category crosstab
| Category | P0 | P1 | P2 | Total |
|---|---|---|---|---|
| Title Tags | … | … | … | … |
| …

## P0 backlog (the build-first list)
### Title Tags
- C123: Title Tag Missing [critical, missing, M] — R-BASE-CRITICAL
- …

### Robots & Crawl Directives
- …

## P1 backlog
…

## P2 backlog
…

## Decision log (individual triage answers)
[content of roadmap-individual.md, appended verbatim]
```

### Files lifecycle

| File | Created at | Kept until | Final disposition |
|---|---|---|---|
| `roadmap-dryrun-25rows.md` | R1 | R2 | deleted at R7 |
| `canonical-checks-v1.draft.csv` | R3 | R7 | deleted at R7 |
| `roadmap-run-summary.md` | R3 | R7 | deleted at R7 |
| `roadmap-bulk-decisions.md` | R3 | R7 | deleted at R7 |
| `roadmap-individual.md` | R5 | R7 | deleted at R7 (content embedded into roadmap-summary.md) |
| `canonical-checks-v1.csv` (updated to 26 cols) | R7 | persistent | **final** |
| `roadmap-summary.md` | R7 | persistent | **final** |

---

## 9. Tool Architecture

**Location:** `scripts/audit-checks-roadmap/` (sibling to `scripts/audit-checks-gapmap/`).

### File structure

```
scripts/audit-checks-roadmap/
├── package.json           # csv-parse, csv-stringify, vitest
├── README.md
├── vitest.config.js
├── src/
│   ├── cli.js             # entry: dryrun | fullpass | applybulk | finalize
│   ├── csv.js             # parseCsv + writeCsv wrappers
│   ├── canonical.js       # load canonical CSV + filter to in-scope
│   ├── rubric/
│   │   ├── priority.js    # Section 5 rubric
│   │   ├── effort.js      # Section 6 rubric
│   │   └── category-tier.js  # static lookup: 23 categories → tier 1/2/3
│   ├── roadmap.js         # main pipeline: canonical → rubric → annotated rows
│   └── output/
│       ├── canonical-csv.js     # write extended canonical CSV (26 cols)
│       ├── summary-md.js        # roadmap-summary.md
│       ├── bulk-decisions-md.js # roadmap-bulk-decisions.md (+ parser)
│       ├── individual-md.js     # roadmap-individual.md (+ parser)
│       └── dryrun-md.js         # roadmap-dryrun-25rows.md
└── __tests__/
    ├── csv.test.js
    ├── canonical.test.js
    ├── priority.test.js
    ├── effort.test.js
    ├── category-tier.test.js
    ├── roadmap.test.js
    └── output.test.js
```

### Module boundaries

- `cli.js` orchestrates only — no logic.
- `roadmap.js` is pure pipeline: canonical → rubric → annotated rows.
- `rubric/priority.js` and `rubric/effort.js` are pure functions (no I/O).
- `category-tier.js` is a static `Map<category, tier>` — testable independently.
- Output writers are pure formatters.

### Why fewer modules than Phase 2

Phase 2 (`audit-checks-gapmap/`) needed signal extractors and a classifier because it inspected platform code via regex. Phase 3 only reads the canonical CSV — no platform code inspection — so 7 src + 7 tests cover it (vs Phase 2's 14 + 14).

### Phase 2 reuse policy

Phase 3 does **not** import from `audit-checks-gapmap/`. Each tool is independent so Phase 1 / 2 / 3 can be re-run separately. `csv.js` (~15 LOC) is duplicated.

### Tech stack

Node.js 20+ ESM, vitest, csv-parse, csv-stringify. Same as Phase 2.

---

## 10. Re-runnability

Phase 3 is fully re-runnable.

If Phase 4 ships a chunk of P0 items and re-runs Phase 2 → impl_status flips from `missing` (or `partial`) → `implemented` for those rows. Re-running Phase 3 then:

1. Filters re-runs to the new in-scope set (now 163 minus shipped count).
2. Re-applies priority + effort heuristics.
3. Preserves any user `comment:` notes captured in `roadmap_notes` from prior runs (the tool reads existing values when present and merges new rule output with prior free-text comments).

The tool is idempotent on unchanged input: running it on an already-finalized canonical CSV produces byte-identical output (modulo timestamps in summary.md).

---

## 11. Out of Scope (Phase 4 preview)

After this spec is realized, Phase 4 picks up:

- Implement P0 cluster (or whichever cluster the human ops decision points to first).
- Calibrate S/M/L/XL labels against actual implementation velocity from the first few P0 tickets.
- Re-seed `backend/db/seed/audit-checks.js` from canonical CSV.
- Update `PRD.md` to reflect the canonical 610-row count and 24-category taxonomy.
- Decide whether `Local SEO & GEO` rename in `frontend/src/lib/auditCategories.js` is still needed.
- Manual-check workflow doc for the 38 n-a items (separate effort).

### Prerequisites flagged into Phase 4

These are noted in `roadmap-summary.md` so the Phase 4 reader sees them:

1. **Effort labels are uncalibrated.** First 1–2 P0 tickets should ground-truth the S/M/L/XL definitions.
2. **No cross-check dependency model.** Phase 4 sequencer may need to manually re-shuffle adjacent items where one depends on another.
3. **Category-tier mapping is static.** If `backend/services/audit-parser.service.js` or the extractor surface is extended in Phase 4, tier assignments may drift. Re-run Phase 3 after meaningful platform changes.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Effort estimates anchor stakeholders to incorrect timelines | `roadmap-summary.md` carries an "uncalibrated" disclaimer; first P0 batch validates |
| Bulk-review groups too coarse — user has to re-tier dozens of items individually | R5 routes any `flag-individually` group into `roadmap-individual.md`; users can opt out of bulk for any single group |
| Heuristic produces too few P0 items (everything mid-tier) → roadmap useless | Calibration knob: drop `R-PROMO-PARTIAL` or strengthen it; user requests rubric edits at R2 |
| Phase 3 re-runs lose user `comment:` notes | Tool merges prior `roadmap_notes` free-text fragments with newly-computed rule traces (re-runnability §10) |
| Category-tier mapping wrong for one category, all items in that category mis-effort'd | Tier overrides handled at bulk-review (R4) by reshape decision |

---

## 13. Open Questions

None at design time. All Q1–Q6 brainstorming questions resolved:

- **Q1:** Pure prioritization artifact (no implementation specs).
- **Q2:** 149 missing + 14 partial = 163 items.
- **Q3:** Hybrid workflow (auto → bulk → individual).
- **Q4:** Severity × ease-of-implementation rubric (B).
- **Q5:** impl_status × category-infrastructure rubric (B).
- **Q6:** Extended canonical CSV (26 cols) + roadmap-summary.md (C).
- **Architecture:** Standalone tool at `scripts/audit-checks-roadmap/` (A).
