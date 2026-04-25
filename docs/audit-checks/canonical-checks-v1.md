# Run Summary

- Generated: 2026-04-25T19:45:32.810Z
- Label: M7 finalized
- Total rows: 610

## By decision
- keep: 482
- cut: 95
- merge: 32
- edit: 1

## By source
- csv-only: 319
- seed-only: 289
- both: 2

## By severity
- warning: 311
- info: 170
- critical: 129

## By automation_type
- automated: 289
- manual: 168
- hybrid: 153

## By category
- Content Quality: 57
- Response Codes & Redirects: 40
- Security & HTTPS: 35
- Schema & Structured Data: 35
- Core Web Vitals: 34
- Canonicalisation: 30
- Images: 29
- Internal Linking: 27
- Rankings & Traffic: 26
- XML Sitemaps: 25
- Backlinks & Authority: 25
- Local SEO: 25
- Mobile & Usability: 24
- Crawlability & Indexability: 23
- GEO & LLM Crawlers: 23
- E-E-A-T Signals: 22
- JavaScript Rendering: 20
- AI Overviews & AIO Optimization: 19
- URL Structure: 18
- International SEO: 17
- Title Tags: 16
- Meta Descriptions: 15
- Headings: 15
- Robots & Crawl Directives: 10

---

## Decision Log

### M2 — dry-run review (2026-04-25)
- Discovered csv↔seed exact-name match rate was only 2/321 rows.
- User accepted option B (category-aware matching).
- R-M1 thresholds revised: same canonical category → 0.5; cross-category → 0.9 (unchanged).
- Result: 32 csv rows merged with seed equivalents (vs 0 before).

### M4 — bulk-decisions review (2026-04-25)
- **Group 1: R-F2 in Backlinks & Authority (7 flags)** — `cut-all`
  Reason: platform has no backlink data integration; defer until DataForSEO Backlinks API committed in PRD.
- **Group 2: R-F3 in AI Overviews & AIO Optimization (1 flag)** — `cut-all`
  Reason: bulk-cut applied to the single multi-category-overlap row.

### M6 — individual-flags review (2026-04-25)
- No individual flags remained after bulk cut-all. M6 was a no-op.

### Pre-existing taxonomy correction
- Original brainstorm said "23 frontend slugs"; verified actual count is 24 in `frontend/src/lib/auditCategories.js`.
- E-E-A-T Signals retained as its own canonical category (not aliased to Backlinks & Authority).

### Threshold corrections during implementation
- R-M1 cross-category threshold: kept at 0.9 per spec; one Task 9 implementer tried to lower it to 0.8 — reverted.

### Known scope deviation
- Spec estimated 220–280 final rows; actual canonical has **610 rows** (515 active after cuts).
- Cause: csv and seed have very different naming conventions; even with category-aware matching, only 32 merges occurred. 289 seed entries remain as standalone rows.
- Phase 2 gap-mapping should reconcile these further by matching against parser output.
