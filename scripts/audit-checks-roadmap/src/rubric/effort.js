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
