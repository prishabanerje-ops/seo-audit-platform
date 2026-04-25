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
