# Phase 4b — PRD Re-sync & Seed Comment Fix

**Date:** 2026-04-27
**Status:** Approved
**Scope:** Targeted text corrections only — no migrations, no new files

---

## Background

Phase 2 (gap-map) and Phase 3 (roadmap) produced a canonical check registry at
`docs/audit-checks/canonical-checks-v1.csv` with 610 rows and 483 active checks
(decision: keep or edit) across 23 categories.

The seed file (`backend/db/seed/audit-checks.js`) was already regenerated in commit
`d324cbf` using `scripts/generate-audit-checks-seed.js`. Phase 4a is therefore
**already complete**.

Phase 4b updates documentation to match the new numbers and records the generator
command as a dev workflow.

---

## What Is Changing

### 1. `PRD.md` — 7 targeted line edits

| Line | Field | From | To |
|------|-------|------|----|
| 7 | Last Updated blurb | "321 new checks across 23 categories" | "483 active checks across 23 categories (canonical re-seed from `docs/audit-checks/canonical-checks-v1.csv`)" |
| 32 | Summary paragraph | "321 custom SEO checks across 23 categories" | "483 custom SEO checks across 23 categories" |
| 361 | DB schema comment | `1–321` | `1–610` |
| 373 | Category header | "321 checks total" | "483 checks total" |
| 1350 | Brand panel copy | "321 checks" | "483 checks" |
| 1703 | File tree comment | "Seeds 321 audit checks into DB" | "Seeds 483 audit checks into DB" |

Note: Line 364 ("23 categories") is already correct — no change needed.

### 2. `CLAUDE.md` — Dev Commands section

Add the following block to the existing dev commands:

```bash
# Regenerate audit checks seed from canonical CSV
# Run after editing docs/audit-checks/canonical-checks-v1.csv
node scripts/generate-audit-checks-seed.js
```

Also add one sentence to the Current State section:
> `docs/audit-checks/canonical-checks-v1.csv` is the source of truth for the check
> registry. After editing it, run `node scripts/generate-audit-checks-seed.js` to
> regenerate the seed file.

### 3. `backend/db/seed/audit-checks.js` — Header comment fix

```
- * 483 active checks (decision: keep or edit) across 24 categories.
+ * 483 active checks (decision: keep or edit) across 23 categories.
```

### 4. `scripts/generate-audit-checks-seed.js` — Fix hardcoded category count

Line 109 in the generator hardcodes `"24 categories"` as a string literal, so
re-running the generator would reproduce the same bug. Fix by computing the unique
category count at runtime:

```js
// Before:
* ${active.length} active checks (decision: keep or edit) across 24 categories.

// After:
const categoryCount = new Set(active.map(r => r.category)).size;
// …then in template:
* ${active.length} active checks (decision: keep or edit) across ${categoryCount} categories.
```

---

## What Is NOT Changing

- No DB migrations
- No schema changes
- No frontend changes
- No new files
- PRD Phase table does not get a new row for the scripts tooling (it tracks product
  features, not dev tooling)

---

## Approach

Approach 1 (targeted manual edits). All changes are mechanical text replacements.
The generator script already owns the seed; PRD/CLAUDE.md are updated manually because
they contain prose context that should not be automated.

---

## Implementation Checklist

1. Edit `PRD.md` — 6 targeted replacements (line 7, 32, 361, 373, 1350, 1703)
2. Edit `CLAUDE.md` — add dev command + Current State sentence
3. Edit `backend/db/seed/audit-checks.js` — fix "24 categories" → "23 categories" in header
4. Edit `scripts/generate-audit-checks-seed.js` — compute category count dynamically (line 109)
5. Commit all four files together
