# Phase 4b — PRD Re-sync & Seed Comment Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all "24 categories" stale references across PRD.md, CLAUDE.md, seed header, and generator script — making every file agree on 23 categories and removing migration-018 "pending" notices that are now stale.

**Architecture:** Pure text edits to four files. No code logic changes, no migrations, no new files. The category count discrepancy (24 vs 23) was introduced when the generator script hardcoded the count at generation time rather than computing it dynamically.

**Tech Stack:** Node.js ESM (generator script fix), Markdown (PRD.md, CLAUDE.md)

**Spec:** `docs/superpowers/specs/2026-04-27-prd-resync-design.md`

---

## Files Touched

| File | Change |
|------|--------|
| `PRD.md` | Fix lines 7, 32, 364, 373 — "24 categories" → "23 categories"; remove stale migration-018 pending notices |
| `CLAUDE.md` | Add generator command to Dev Commands; add source-of-truth note to Current State |
| `backend/db/seed/audit-checks.js` | Header comment: "24 categories" → "23 categories" |
| `scripts/generate-audit-checks-seed.js` | Compute category count dynamically instead of hardcoding "24" |

---

### Task 1: Fix `PRD.md` — "Last Updated" blurb (line 7)

**Files:**
- Modify: `PRD.md:7`

Current text on line 7 (excerpt to replace):
```
across **24 categories** at `backend/db/seed/audit-checks.js`. DB still on old 291-check set pending migration 018 (see `docs/audit-phase2-prd.md`). Migration 018 adds `issue_name` column + clears old checks; wire into `backend/db/sqlite.js` then run `node scripts/seed-checks.js`.
```

- [ ] **Step 1: Verify the stale text exists**

```bash
grep -n "24 categories\|pending migration 018\|291-check set" PRD.md
```

Expected: lines 7 and 32 show up.

- [ ] **Step 2: Edit line 7**

In `PRD.md`, find this exact substring on line 7:

```
across **24 categories** at `backend/db/seed/audit-checks.js`. DB still on old 291-check set pending migration 018 (see `docs/audit-phase2-prd.md`). Migration 018 adds `issue_name` column + clears old checks; wire into `backend/db/sqlite.js` then run `node scripts/seed-checks.js`.
```

Replace with:

```
across **23 categories** at `backend/db/seed/audit-checks.js` (migration 018 applied; regenerate seed: `node scripts/generate-audit-checks-seed.js`).
```

- [ ] **Step 3: Verify**

```bash
grep -n "24 categories\|pending migration 018\|291-check set" PRD.md
```

Expected: line 7 no longer appears in results. Only line 32 (if not yet edited) should remain.

---

### Task 2: Fix `PRD.md` — Summary paragraph (line 32) and schema table (lines 364, 373)

**Files:**
- Modify: `PRD.md:32`, `PRD.md:364`, `PRD.md:373`

- [ ] **Step 1: Edit line 32**

Find this exact substring on line 32:

```
runs 483 canonical SEO checks across 24 categories against crawl output (291 old checks active pending migration 018),
```

Replace with:

```
runs 483 canonical SEO checks across 23 categories against crawl output,
```

- [ ] **Step 2: Edit line 364**

Find this exact cell in the DB schema table:

```
| `category` | TEXT | Top-level section, Title Case (24 canonical categories) |
```

Replace with:

```
| `category` | TEXT | Top-level section, Title Case (23 categories) |
```

- [ ] **Step 3: Edit line 373**

Find this exact header line:

```
**24 canonical categories (483 active checks — post migration 018):**
```

Replace with:

```
**23 categories (483 active checks):**
```

- [ ] **Step 4: Verify all PRD changes**

```bash
grep -n "24 categor\|291 old checks\|pending migration 018" PRD.md
```

Expected: no output (all four stale references gone).

- [ ] **Step 5: Commit**

```bash
git add PRD.md
git commit -m "docs(phase4b): fix stale category count and migration-018 pending notices in PRD"
```

---

### Task 3: Fix `CLAUDE.md` — add generator command and source-of-truth note

**Files:**
- Modify: `CLAUDE.md` (Dev Commands section ~line 158, Current State section ~line 183)

- [ ] **Step 1: Add generator command to Dev Commands**

In `CLAUDE.md`, find this exact closing of the dev commands block:

```
# Tests
cd backend && npm test
cd frontend && npm test
```

Replace with:

```
# Tests
cd backend && npm test
cd frontend && npm test

# Regenerate audit checks seed from canonical CSV
# Run after editing docs/audit-checks/canonical-checks-v1.csv
node scripts/generate-audit-checks-seed.js
```

- [ ] **Step 2: Add source-of-truth note to Current State**

Find this exact line in the Current State section:

```
- AI recommendations: manual trigger only (bulk pre-generation is a future roadmap item)
```

Replace with:

```
- AI recommendations: manual trigger only (bulk pre-generation is a future roadmap item)
- `docs/audit-checks/canonical-checks-v1.csv` is the source of truth for the check registry. After editing it, run `node scripts/generate-audit-checks-seed.js` to regenerate `backend/db/seed/audit-checks.js`.
```

- [ ] **Step 3: Verify**

```bash
grep -n "generate-audit-checks-seed\|canonical-checks-v1" CLAUDE.md
```

Expected: at least 3 lines — one in Dev Commands, two in Current State (file path + script path).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(phase4b): add generate-audit-checks-seed command to CLAUDE.md dev commands"
```

---

### Task 4: Fix seed header comment and generator script hardcoded count

**Files:**
- Modify: `backend/db/seed/audit-checks.js:4`
- Modify: `scripts/generate-audit-checks-seed.js:84,109`

- [ ] **Step 1: Fix seed header comment**

In `backend/db/seed/audit-checks.js`, find this exact line (line 4):

```
 * 483 active checks (decision: keep or edit) across 24 categories.
```

Replace with:

```
 * 483 active checks (decision: keep or edit) across 23 categories.
```

- [ ] **Step 2: Fix generator script — compute category count dynamically**

In `scripts/generate-audit-checks-seed.js`, find this exact block (around line 84):

```js
const entries = active.map(r => {
  const checkNumber  = parseInt(r.check_id.slice(1), 10);
```

Replace with:

```js
const categoryCount = new Set(active.map(r => r.category)).size;

const entries = active.map(r => {
  const checkNumber  = parseInt(r.check_id.slice(1), 10);
```

- [ ] **Step 3: Fix generator script — use dynamic count in template string**

In `scripts/generate-audit-checks-seed.js`, find this exact line in the template (around line 109):

```
 * ${active.length} active checks (decision: keep or edit) across 24 categories.
```

Replace with:

```
 * ${active.length} active checks (decision: keep or edit) across ${categoryCount} categories.
```

- [ ] **Step 4: Verify generator produces correct output**

```bash
node scripts/generate-audit-checks-seed.js
```

Expected output (first two console.log lines):
```
Total rows in canonical CSV : 610
Active checks (keep / edit) : 483
```

Then verify the header comment in the regenerated seed:

```bash
head -6 backend/db/seed/audit-checks.js
```

Expected:
```
/**
 * Canonical audit-checks seed.
 * Auto-generated from docs/audit-checks/canonical-checks-v1.csv (Phase 3 output).
 * 483 active checks (decision: keep or edit) across 23 categories.
 *
 * Regenerate: node scripts/generate-audit-checks-seed.js
```

- [ ] **Step 5: Commit**

```bash
git add backend/db/seed/audit-checks.js scripts/generate-audit-checks-seed.js
git commit -m "fix(seed): compute category count dynamically in generator; fix 24→23 in seed header"
```

---

## Self-Review Checklist

- [x] All 4 "24 categories" occurrences in PRD.md covered (lines 7, 32, 364, 373)
- [x] Both stale "pending migration 018" / "291 old checks" notices removed
- [x] CLAUDE.md dev command added
- [x] CLAUDE.md current state note added
- [x] Seed header comment fixed
- [x] Generator script no longer hardcodes category count
- [x] Generator output verified (Step 4 in Task 4)
- [x] No TBDs or placeholders in plan
- [x] Line 1657 in PRD (Phase 3 historical row "291 checks across 19 categories") intentionally left unchanged — it describes the original Phase 3 build state, not current data
