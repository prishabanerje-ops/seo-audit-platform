# Design Spec: Audit Checks Canonical Reconciliation (Phase 1 — Curate + Retaxonomy)

**Date:** 2026-04-25
**Author:** Claude (brainstorming session with Aakash Srivastava)
**Status:** Approved — pending implementation plan

---

## 1. Overview

Produce one authoritative reconciled SEO check list by curating the external 321-row CSV (`audit-replan-subchecks-comprehensive.csv`) against the 291-check seed in [backend/db/seed/audit-checks.js](../../../backend/db/seed/audit-checks.js).

Output is a single canonical CSV plus companion docs. **No code, no PRD, no migration changes in this phase.** Phase 1 produces a spec that later phases (gap-map, roadmap, re-seed) can act on with a stable key.

This spec supersedes neither but builds on:
- [2026-04-15-audit-checks-upgrade-design.md](2026-04-15-audit-checks-upgrade-design.md) — produced the current 291-check seed from an earlier CSV
- [2026-04-19-audit-phase2-design.md](2026-04-19-audit-phase2-design.md) — implementation of 13 missing categories

The new 321-row CSV is a fresh external authoritative target. This spec reconciles it against the existing 291-check seed.

---

## 2. Goals

- Produce one canonical, reconciled check list with stable IDs
- Cover decisions for every CSV row: `keep` / `cut` / `merge` / `edit` / `flag`
- Add seed-only checks (any seed entry not in CSV) so the canonical list is complete
- Normalize taxonomy onto the 24 frontend slugs already used in [frontend/src/lib/auditCategories.js](../../../frontend/src/lib/auditCategories.js)
- Three-value `automation_type` (automated / hybrid / manual) matching seed
- Provide audit trail (decision log) for every cut, merge, and rename

---

## 3. Non-Goals

- No changes to [backend/db/seed/audit-checks.js](../../../backend/db/seed/audit-checks.js)
- No changes to [frontend/src/lib/auditCategories.js](../../../frontend/src/lib/auditCategories.js) (the `Local SEO & GEO` rename will be applied in a later phase)
- No changes to [PRD.md](../../../PRD.md) — the "321 / 23" claim will be updated when final numbers are known
- No new database migrations
- No changes to [backend/services/audit-parser.service.js](../../../backend/services/audit-parser.service.js) or any extractor
- No gap analysis against the parser (Phase 2 work)
- No implementation roadmap (Phase 3 work)

---

## 4. Reality Reconciliation (the problem this spec solves)

Five sources currently disagree about how many checks the platform has:

| Source | Checks | Categories | Automation labels |
|---|---|---|---|
| External CSV | 321 | 24 | automated / manual |
| Seed file | 291 | 19 (DB) | automated / hybrid / manual |
| Frontend slugs | — | 24 | — |
| PRD claim | 321 | 23 (incorrect — actual frontend has 24) | — |
| Parser actually firing | ~40 | — | — |

This spec produces one source of truth that downstream phases consume.

---

## 5. Output Spec

### 5.1 Canonical CSV — `docs/audit-checks/canonical-checks-v1.csv`

| Column | Source | Purpose |
|---|---|---|
| `check_id` | new (`C001`–`Cnnn`) | Stable ID, survives renames |
| `csv_row` | input CSV | Original line number, empty if seed-only |
| `seed_check_number` | seed file | 1–291, empty if csv-only |
| `source` | derived | `csv-only` / `seed-only` / `both` |
| `category` | curated | One of the 24 canonical slugs (frontend taxonomy) |
| `subsection` | curated | Optional 2nd-level group |
| `name` | curated | Final check name |
| `original_name` | input | Pre-rename name |
| `severity` | curated | `critical` / `warning` / `info` |
| `automation_type` | curated | `automated` / `hybrid` / `manual` |
| `decision` | rubric output | `keep` / `cut` / `merge` / `edit` / `flag` |
| `merge_into` | rubric output | Target `check_id` if `decision=merge` |
| `rationale` | rubric output | One line citing rule fired |
| `pass_condition` | curated | From CSV |
| `fail_condition` | curated | From CSV |
| `implementation_rule` | seed if linked | Pseudocode from seed |
| `tool_current` | seed if linked | Where it runs today |
| `notes` | free-form | Edge cases, integration requirements |

### 5.2 Companion docs

- `docs/audit-checks/canonical-checks-v1.md` — exec summary, full rubric, decision log, per-category counts
- `docs/audit-checks/category-rename-map.md` — taxonomy migration reference

### 5.3 Locked sub-decisions

1. **Stable IDs (`C001`...)** — not seed numbers. Seed numbers stay in `seed_check_number` for traceability.
2. **24 frontend slugs as canonical taxonomy** — minimizes UX churn vs current frontend. (Note: original brainstorm said "23"; verified actual count is 24 during Task 5 implementation. The PRD will need updating in a later phase to reflect the correct count.)
3. **`hybrid` added to automation_type** — matches seed; CSV `manual` rows with crawler-detectable signal get reclassified.

---

## 6. Autonomous Rubric

Rules apply mechanically. Tie-breaker: **Cut > Merge > Edit > Reclassify > Keep**. A flag stops further rule evaluation on that row.

### 6.1 Cut rules (R-C*)

| ID | Rule |
|---|---|
| R-C1 | Exact-duplicate names (lowercase + punctuation strip) within or across categories → cut duplicate; keep higher-severity; tie-break = more specific category |
| R-C2 | `info` severity check whose `pass_condition` is a strict logical subset of a `warning`/`critical` check elsewhere → cut the info |
| R-C3a | Cut only if **all three** conditions hold: (a) platform-incapable (no crawler/GSC/GA4/PSI signal possible), (b) no PRD or seed `tool_future` commitment, (c) `info` severity |
| R-C4 | Manual-only check that is purely opinion with no measurable threshold → cut |

### 6.2 Merge rules (R-M*)

| ID | Rule |
|---|---|
| R-M1 | CSV row matches seed by semantic name (≥90% token overlap or human-equivalent) → merge into seed entry; carry forward seed's `implementation_rule` and `tool_current` |
| R-M2 | Two CSV checks measure the same signal in different categories → merge into more specific category; keep better-worded name |
| R-M3 | Two known overlap actions. (a) `GEO & LLM Crawlers` ↔ `AI Overviews & AIO Optimization`: **both categories remain** in the canonical 23. Individual checks that semantically duplicate across them are merged into the more specific category (the bot-policy / robots-directive checks belong in `GEO & LLM Crawlers`; visibility/citation/snippet-formatting checks belong in `AI Overviews & AIO Optimization`). (b) Rename `Local SEO & GEO` → `Local SEO` (the "GEO" there means *geographic*, not Generative Engine Optimization, creating a name clash). Net effect: 24 canonical categories preserved, one renamed, no category count change |

### 6.3 Edit/rename rules (R-E*)

| ID | Rule |
|---|---|
| R-E1 | Vague names → actionable specific names |
| R-E2 | Normalize `category` to one of the 24 canonical slugs |
| R-E3 | Severity vocabulary (`critical/warning/info`) already aligned — no change |

### 6.4 Reclassify-automation rules (R-R*)

| ID | Rule |
|---|---|
| R-R1 | CSV `manual` but crawler can produce partial signal → reclassify as `hybrid` |
| R-R2 | CSV `automated` but actually requires GSC/GA4 → keep `automated`, add `notes: "requires GSC"` (or GA4) |
| R-R3 | Genuinely human-judgment-only with no crawler signal → stays `manual` |

### 6.5 Flag rules (R-F*)

| ID | Rule |
|---|---|
| R-F1 | CSV ↔ seed semantic overlap with contradictory severity, threshold, or scope |
| R-F2 (extended) | Platform-incapable check that is **`critical` or `warning` severity** → flag (do not cut). Note required integration in `notes`. Only `info`-severity platform-incapable checks are auto-cut by R-C3a |
| R-F3 | Check could plausibly belong to ≥2 canonical categories |
| R-F4 | A merge target has >2 candidates |
| R-F5 | Severity disagreement between CSV and seed >1 step apart (e.g., critical vs info) |

### 6.6 Default — Keep (R-K)

Any row not matched by R-C / R-M / R-E becomes `decision=keep`, possibly with `automation_type` reclassified by R-R.

### 6.7 Calibration commitment

Dry-run rubric on first 25 CSV rows (rows 2–26) before full pass. If user flips ≥3 decisions on the dry-run, tighten rubric and re-run dry-run.

---

## 7. Ambiguous-Flag Triage

### 7.1 Estimated flag volume

Total expected: **~65–105 flags** out of 321 (real number known after first pass).

| Rule | Estimated flags |
|---|---|
| R-F2-extended | 30–45 |
| R-F1 | 15–25 |
| R-F3 | 10–15 |
| R-F4 | 5–10 |
| R-F5 | 5–10 |

### 7.2 Triage format (one block per flag)

```
FLAG #007  |  csv_row 84  |  rule R-F2  |  category: Backlinks & Authority
Original name : "Toxic / Spammy Links"
Severity      : critical (CSV)
Automation    : manual (CSV)
My suggestion : KEEP, mark requires_integration="DataForSEO Backlinks API"
Why flagged   : Platform-incapable + critical severity → not auto-cut
Alternative   : CUT (defer until integration committed in PRD)
Your call     : [keep] / [cut] / [edit-and-keep] / [comment]
```

### 7.3 Review mode — bulk-then-individual

1. Produce `triage-bulk-decisions.md` with 4–8 bulk-decision groups (e.g., "All R-F2 Backlinks flags — keep with integration note? [yes/no]")
2. User answers each bulk question with one line
3. Remaining flags (~15–30) go into `triage-individual.md` for per-row review
4. Total user review time: ~15–25 minutes

### 7.4 Audit trail

Every flag and resolution logged in `canonical-checks-v1.md` under "Decision Log" with timestamp, rule fired, user's call, one-line reasoning.

---

## 8. Sequencing — Six Milestones

```
M1  Dry-run rubric on first 25 CSV rows           (autonomous, ~5 min)
M2  ◇ User reviews dry-run table                  (~5–10 min)
M3  Full rubric pass on remaining 296 rows
    + seed reconciliation                          (autonomous, ~15–25 min)
M4  ◇ User reviews bulk-decisions file             (~10 min)
M5  Apply bulk decisions, produce individual file (autonomous, ~5–10 min)
M6  ◇ User reviews individual flags                (~10–15 min)
M7  Finalization: canonical CSV + companion docs
    + single git commit                            (autonomous, ~5 min)
```

### 8.1 Milestone details

**M1 — Dry-run.** Output: `docs/audit-checks/dryrun-25rows.md`. Nothing committed.

**M2 — User dry-run review.** Acceptance: ≤2 flips → proceed; ≥3 flips → tighten rubric, repeat M1.

**M3 — Full pass.** Process:
1. Parse seed `AUDIT_CHECKS` into in-memory map keyed by normalized name
2. Apply rubric to every CSV row
3. Add seed-only checks as new rows (`source=seed-only`)
4. Assign stable `C001`–`Cnnn` IDs
5. Apply R-E2 + R-M3 taxonomy normalization
- Outputs (uncommitted draft):
  - `docs/audit-checks/canonical-checks-v1.draft.csv`
  - `docs/audit-checks/triage-bulk-decisions.md`
  - `docs/audit-checks/run-summary.md`

**M4 — User bulk review.** One-line answers per group.

**M5 — Apply bulk + emit individual file.** Output: `docs/audit-checks/triage-individual.md`.

**M6 — User individual review.** Per-flag: `keep` / `cut` / `edit-and-keep` / `comment`.

**M7 — Finalization.**
- Promote draft → `docs/audit-checks/canonical-checks-v1.csv`
- Generate `canonical-checks-v1.md` + `category-rename-map.md`
- Delete drafts (`*.draft.csv`, `triage-*.md`, `dryrun-25rows.md`) — audit trail lives in `canonical-checks-v1.md`
- Single commit: `docs(audit-checks): produce canonical reconciled check list v1`

### 8.2 Time estimates

- User time: ~30–40 minutes across 3 checkpoints
- Autonomous processing: ~30–40 minutes total
- Calendar time: depends on user response cadence

---

## 9. Deliverables

1. `docs/audit-checks/canonical-checks-v1.csv` — single source of truth (estimated 220–270 final rows after cuts/merges, plus seed-only additions)
2. `docs/audit-checks/canonical-checks-v1.md` — rubric, decision log, summary stats
3. `docs/audit-checks/category-rename-map.md` — taxonomy migration reference
4. One git commit, no code changes

---

## 10. Risks and Open Questions

- **Risk:** seed parsing — the seed file is JS not JSON. Need to evaluate it as a module or regex-extract the array. Will be confirmed in implementation plan.
- **Risk:** CSV value escaping — some CSV cells contain commas inside quoted strings. The implementation must use a proper CSV parser, not naive split.
- **Risk:** semantic-match heuristic for R-M1 (≥90% token overlap) is approximate; some genuinely-equivalent checks may not match by tokens. Mitigation: dry-run + R-F4 (multi-candidate flag).
- **Open:** the migration 018 comment claims "354 old → 321 new" but seed has 291. The 30-row gap between seed and CSV may not all be cuts; some may be reclassifications never applied. Spec treats them as `csv-only` and lets the rubric decide.

---

## 11. Out-of-scope (Phase 2 / Phase 3 preview)

After this spec is realized:
- **Phase 2 — Gap-map:** for every kept canonical check, mark `implemented / partial / missing` against [audit-parser.service.js](../../../backend/services/audit-parser.service.js) and the extractor set
- **Phase 3 — Roadmap:** sequence missing checks into P0/P1/P2 with effort estimates
- **Phase 4 — Re-seed + PRD update:** generate new seed file from canonical CSV; update PRD claim; rename `Local SEO & GEO` in frontend slugs

Each later phase has its own spec.
