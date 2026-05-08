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
