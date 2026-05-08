# Design Spec: Audit Checks Gap-Map (Phase 2 — Implementation Coverage Analysis)

**Date:** 2026-04-26
**Author:** Claude (brainstorming session with Aakash Srivastava)
**Status:** Approved — pending implementation plan

---

## 1. Overview

Determine, for each of the 204 active CSV-derived canonical checks produced by Phase 1, whether the platform implements that check today — and if so, where.

Output extends [docs/audit-checks/canonical-checks-v1.csv](../../audit-checks/canonical-checks-v1.csv) with 4 new columns (`impl_status`, `impl_location`, `impl_evidence`, `gap_notes`) and produces companion docs.

**No platform code is modified in this phase.** Phase 2 produces an authoritative coverage map that Phase 3 (roadmap sequencing) consumes.

This spec builds on:
- [2026-04-25-audit-checks-canonical-reconciliation-design.md](2026-04-25-audit-checks-canonical-reconciliation-design.md) — produced the canonical CSV consumed here
- Phase 2 prerequisites listed at the bottom of `docs/audit-checks/canonical-checks-v1.md` are addressed by this phase's tooling design

---

## 2. Goals

- Tag each active csv-derived canonical check with `implemented` / `partial` / `missing` / `n-a`
- Record the precise file:line and signal name that supports each `implemented`/`partial` tag
- Surface ambiguous cases for user review via bulk-then-individual triage
- Produce a signal index (~120–180 entries) extracted from the implementation surface for downstream auditing

---

## 3. Non-Goals

- No changes to running platform code: parser, extractors, services, routes, frontend slugs, PRD, migrations
- No effort estimation per missing check (Phase 3)
- No P0/P1/P2 sprint sequencing (Phase 3)
- No modification of canonical rows that fall outside scope (cuts, merges, seed-only)
- No re-running of Phase 1 reconciliation rules
- No automated test execution to verify "implemented" claims (deferred — see §10 risks)

---

## 4. Scope

| Decision | Source | Count | Phase 2 treatment |
|---|---|---|---|
| keep | csv-only | ~202 | **Yes — primary scope** |
| keep | both | 2 | Yes |
| edit | any | 1 | Yes |
| merge | csv-only | 32 | **Skipped** — status follows merge target |
| keep | seed-only | ~257 | **Skipped** — out of canonical author's intent |
| cut | any | 95 | **Skipped** — dropped in Phase 1 |

**Total in scope: 204 rows.**

Automation breakdown of the 204:
- 156 `automated`
- 5 `hybrid`
- 43 `manual` (subject to G-MAN special rule, §6)

---

## 5. Output Spec

### 5.1 Schema additions to canonical CSV

Existing 19 columns are unchanged. Adding 4 columns at the end:

| Column | Values | Purpose |
|---|---|---|
| `impl_status` | `implemented` / `partial` / `missing` / `n-a` | Classification |
| `impl_location` | `path/to/file.js:line` or empty | Primary code location |
| `impl_evidence` | e.g., `issueType: 'Title Too Long'` or `function: getLcpScore` | The literal matched signal |
| `gap_notes` | free-form (e.g., `extractor produces data; parser does not classify`) | Why partial / what's missing |

Final canonical CSV has **23 columns**. Only the 204 in-scope rows have non-empty values in these new columns; other rows retain blanks.

### 5.2 Companion docs

- `docs/audit-checks/gapmap-summary.md` — counts per status, top categories with `missing` rows, classifier rules verbatim, decision log per flag
- `docs/audit-checks/gapmap-signal-index.md` — the extracted signals with `file:line` references

### 5.3 Locked sub-decisions

1. **`n-a` distinct from `missing`** — `missing` means "platform should build this"; `n-a` means "platform shouldn't even try" (genuinely human-only). Keeps Phase 3 roadmap clean.
2. **No new file** — extend the canonical CSV in place rather than creating a parallel gap-map.csv.
3. **23 columns is acceptable width** — confirmed via existing 19-col CSV ergonomics.

---

## 6. The Heuristic Classifier

### 6.1 Tokenization

Both canonical names and signal names tokenize via:
- Lowercase + strip punctuation (reuse Phase 1's `normalizeName`)
- Remove stopwords
- **Camel-case split** for signal names: `getLcpScore` → `get lcp score`
- **Acronym expansion** for known SEO acronyms:
  - `lcp` → `largest contentful paint`
  - `cls` → `cumulative layout shift`
  - `fid` / `inp` / `tbt` similarly
  - `cwv` → `core web vitals`
  - `gsc` → `search console`
  - `ga4` → `analytics`

### 6.2 Scoring

Per-priority best Jaccard token overlap. The classifier sees scores `{p1Best, p2Best, p3Best, p4Best}` per canonical row.

### 6.3 Classifier rules (applied in order, first match wins)

G-FLAG fires before the IMPL/PARTIAL rules so genuine ambiguity is caught before any auto-classification commits to a status.

| Rule | Condition | Result |
|---|---|---|
| **G-FLAG** | (a) top two priority scores are within 0.1 of each other AND both ≥ 0.4, OR (b) canonical name has tokens that overlap signals across ≥2 *different* signal_types (e.g., one match in `issue-emitter` AND one in `extractor-field` with comparable scores) | `flag` |
| **G-MAN** | `automation_type=manual` AND no signal score ≥ 0.3 | `n-a` |
| **G-IMPL-1** | Best Priority 1 score ≥ 0.6 | `implemented` |
| **G-IMPL-2** | Best Priority 2 score ≥ 0.5 (and G-IMPL-1 didn't fire) | `implemented` |
| **G-PARTIAL-1** | Best Priority 3 score ≥ 0.4 (and G-IMPL-* didn't fire) | `partial` |
| **G-MISS** | No signal score ≥ 0.3 | `missing` |

Default if no rule fires: `missing` (defensive).

**Note:** Originally G-FLAG also had a "best score in 0.3–0.5" criterion, but G-PARTIAL-1 already handles P3 matches ≥ 0.4 as `partial`, and G-MISS handles below 0.3 as `missing`. The 0.3–0.5 criterion was redundant and self-contradictory with G-PARTIAL-1; dropped during spec self-review.

### 6.4 Tie-breaker for `impl_location`

Highest-priority signal wins. Within priority, highest score. Within score, alphabetical file order.

### 6.5 Calibration commitment

Dry-run on first 25 canonical rows before full pass. If user flips ≥3 classifications, tighten thresholds and repeat dry-run.

### 6.6 Excluded from MVP (deferred)

- **G-PARTIAL-2** (severity/threshold mismatch detection — e.g., parser checks `>60` but canonical wants both `<30` AND `>60`) is dropped to reduce tooling complexity. The user-review safety net handles it.

---

## 7. Implementation Surface

Nine file groups scanned, with priority for `impl_location` selection:

| Priority | Source | Signals extracted |
|---|---|---|
| 1 | [backend/services/audit-parser.service.js](../../../backend/services/audit-parser.service.js) | 30 `issueType` strings + `severity` + `section` |
| 2 | [backend/routes/gsc.js](../../../backend/routes/gsc.js) | API endpoint handlers + dimension fields |
| 2 | [backend/routes/ga4.js](../../../backend/routes/ga4.js) | Reporting dimensions |
| 2 | [backend/routes/psi.js](../../../backend/routes/psi.js) | CWV metrics |
| 2 | [backend/services/sitemap-fetcher.js](../../../backend/services/sitemap-fetcher.js) | Sitemap validation outputs |
| 3 | [playwright-crawler/src/extractors/](../../../playwright-crawler/src/extractors/) (9 files) | Exported function names + extracted field names |
| 4 | [playwright-crawler/src/crawler.js](../../../playwright-crawler/src/crawler.js) | Crawl-time signals |
| 4 | [backend/services/crawl-runner.js](../../../backend/services/crawl-runner.js) | Orchestration-level signals |
| 4 | [backend/routes/reports.js](../../../backend/routes/reports.js) | Report aggregation logic |

**Extraction technique:** regex-based, three pass types:
1. String literal extraction: `issueType:\s*['"]([^'"]+)['"]`, `name:\s*['"]([^'"]+)['"]`, `section:\s*['"]([^'"]+)['"]`
2. Exported function names: `export\s+(?:async\s+)?function\s+(\w+)` and `export\s+const\s+(\w+)\s*=`
3. Object field names in returned shapes: keys like `lcp:`, `cls:`, `viewport:`

**Signal data shape:**
```
{
  signal_id: 'P1-S001',
  name: 'Title Too Long (over 60 chars)',
  signal_type: 'issue-emitter' | 'service-function' | 'extractor-field',
  priority: 1 | 2 | 3 | 4,
  file: 'backend/services/audit-parser.service.js',
  line: 152,
  metadata: { severity: 'warning', section: 'Title Tags' }   // signal-type-specific
}
```

Estimated signal count: ~120–180.

---

## 8. Triage / User Review

### 8.1 Estimated flag volume

~40–75 flags out of 204 (20–37%). Higher than Phase 1's flag rate because canonical-name-vs-code-identifier matching is inherently noisier.

| Trigger | Estimated count |
|---|---|
| Ambiguous score (0.3–0.5) | 30–50 |
| Multiple high-scoring candidates | 5–15 |
| Multi-category overlap | 5–10 |

### 8.2 Triage format

```
FLAG #007  |  C147 (Content Quality)  |  rule G-FLAG
Canonical name : "Content Reading Level"
Severity       : warning  |  Automation: auto
Best matches:
  P3 (extractor) : content.js:42 — readabilityScore (Jaccard 0.46)
  P3 (extractor) : content.js:51 — wordCount (Jaccard 0.32)
  P1 (parser)    : <none above threshold>
My suggestion  : PARTIAL — content.js extracts readability but parser doesn't classify
Your call      : [implemented] / [partial] / [missing] / [n-a] / [comment: <text>]
```

### 8.3 Review mode — bulk-then-individual

1. Bulk-decisions file `gapmap-bulk-decisions.md` groups flags by `flag-reason × category`. User answers each group with one line.
2. Remaining ungrouped flags go to `gapmap-individual.md` for per-row review.
3. Final canonical CSV updated with user decisions; audit trail in `gapmap-summary.md`.

### 8.4 Audit trail

Every flag and resolution logged in `gapmap-summary.md` "Decision Log" section: which rule fired, user's call, one-line reasoning.

### 8.5 Estimated user time

- G2 dry-run review: 5–10 min
- G4 bulk review: 10–15 min
- G6 individual review: 15–25 min
- **Total: ~35–55 min**

---

## 9. Sequencing — Seven Milestones

```
G1  Build signal index from implementation surface + dry-run on first 25 rows
G2  ◇ User reviews dry-run table → approve thresholds OR tighten
G3  Full pass on remaining 179 rows
G4  ◇ User reviews bulk-decisions file
G5  Apply bulk decisions, emit individual-flag file
G6  ◇ User reviews individual flags
G7  Finalize: write extended canonical CSV + companion docs + commit
```

### 9.1 Milestone details

**G1 — Signal index + dry-run.** Extracts signals from §7's surface; produces `docs/audit-checks/gapmap-signal-index.md` and `docs/audit-checks/gapmap-dryrun-25rows.md`. Nothing committed yet.

**G2 — User dry-run review** ◇ checkpoint. Acceptance: ≤2 flips → proceed; ≥3 flips → tighten thresholds, repeat G1.

**G3 — Full pass.** Output (uncommitted draft):
- `docs/audit-checks/canonical-checks-v1.draft.csv` (with new columns populated for the 204 in-scope rows)
- `docs/audit-checks/gapmap-bulk-decisions.md`
- `docs/audit-checks/gapmap-run-summary.md`

**G4 — User bulk review** ◇ checkpoint. One-line answers per group.

**G5 — Apply bulk + emit individual file.** Output: `docs/audit-checks/gapmap-individual.md`.

**G6 — User individual review** ◇ checkpoint. Per-flag: `implemented` / `partial` / `missing` / `n-a` / `comment: <text>`.

**G7 — Finalization.**
- Promote draft → `docs/audit-checks/canonical-checks-v1.csv` (replacing existing)
- Generate `gapmap-summary.md` with embedded decision log
- Delete drafts (`canonical-checks-v1.draft.csv`, `gapmap-bulk-decisions.md`, `gapmap-individual.md`, `gapmap-dryrun-25rows.md`, `gapmap-run-summary.md`)
- Single commit: `docs(audit-checks): produce gap-map v1`

### 9.2 Time estimates

- Autonomous processing: ~30–40 min
- User time: ~35–55 min across 3 checkpoints

---

## 10. Risks and Open Questions

- **Risk: regex misses signals in unusual code patterns** (e.g., issueType built via string concatenation, dynamic dispatch). Mitigation: dry-run + spot-check + user-review safety net.
- **Risk: stale signals from dead code** — if a service has signal-emitting code that's never called, it still matches. Mitigation: `impl_evidence` records location for easy audit.
- **Risk: calibration may need multiple iterations** if first dry-run shows ≥3 user flips. Same loop pattern as Phase 1.
- **Risk: 5 `hybrid` rows in scope** — these were partially-detectable in Phase 1's reclassification. Phase 2 may classify them as `partial` via G-PARTIAL-1 (data extracted, not classified). User review confirms.
- **Open: canonical names with multi-clause threshold semantics** (e.g., "Title between 30 and 60 chars") — no automated detection of partial matches per G-PARTIAL-2 being dropped. User catches in review.

---

## 11. Out-of-Scope (Phase 3 / Phase 4 preview)

- **Phase 3 — Roadmap:** sequence the `missing` and `partial` rows into P0/P1/P2 sprint buckets with effort estimates (uses `impl_status` + `severity` + dependencies on integration services)
- **Phase 4 — Re-seed + PRD update:** generate new seed file from canonical CSV; update PRD's "321/23" claim; rename `Local SEO & GEO` in `frontend/src/lib/auditCategories.js`

Each later phase has its own spec.

---

## 12. Tooling Location

`scripts/audit-checks-gapmap/` (new — does NOT extend the Phase 1 `scripts/audit-checks-reconcile/` tool, which has known prerequisites that are out of scope here).

Mirrors Phase 1 structure: `package.json` with vitest devDeps, modular `src/` (signal-extractor, name-matcher, classifier, output-writers, cli), paired `__tests__/`. CLI subcommands: `dryrun`, `fullpass`, `applybulk`, `finalize`.
