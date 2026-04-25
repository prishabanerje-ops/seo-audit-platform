import { normalizeName } from '../normalize.js';

const SEV_RANK = { critical: 3, warning: 2, info: 1 };
const PLATFORM_INCAPABLE = new Set(['Backlinks & Authority']);

const INTEGRATION_HINTS = {
  'Backlinks & Authority': 'requires backlink data API (e.g., DataForSEO Backlinks)',
};

function findSeedTwin(row, ctx) {
  if (row.source === 'seed-only') return null;
  const norm = normalizeName(row.name);
  for (const other of ctx.allRows) {
    if (other.check_id === row.check_id) continue;
    if (other.source !== 'seed-only' && other.source !== 'both') continue;
    if (normalizeName(other.name) === norm) return other;
  }
  return null;
}

const R_F1 = {
  id: 'R-F1',
  type: 'flag',
  apply(row, ctx) {
    const twin = findSeedTwin(row, ctx);
    if (!twin) return null;
    const sevDiff = Math.abs((SEV_RANK[row.severity] || 0) - (SEV_RANK[twin.severity] || 0));
    if (sevDiff === 1) {
      return { decision: 'flag', rule_id: 'R-F1', rationale: `csv↔seed severity contradiction (vs ${twin.check_id})` };
    }
    return null;
  },
};

const R_F2 = {
  id: 'R-F2',
  type: 'flag',
  apply(row) {
    if (!PLATFORM_INCAPABLE.has(row.category)) return null;
    if (row.severity !== 'critical' && row.severity !== 'warning') return null;
    return {
      decision: 'flag',
      rule_id: 'R-F2',
      rationale: 'platform-incapable critical/warning — integration decision needed',
      notes: INTEGRATION_HINTS[row.category],
    };
  },
};

const R_F3 = {
  id: 'R-F3',
  type: 'flag',
  apply(row) {
    // Heuristic: name contains tokens for ≥2 canonical categories
    const lower = `${row.name || ''}`.toLowerCase();
    let hits = 0;
    if (/\bschema\b/.test(lower)) hits++;
    if (/\bAI\b/i.test(row.name || '') || /\bllm\b/.test(lower)) hits++;
    if (/\blocal\b/.test(lower) || /\bGBP\b/.test(row.name || '')) hits++;
    if (/\bmobile\b/.test(lower)) hits++;
    if (hits >= 2) {
      return { decision: 'flag', rule_id: 'R-F3', rationale: 'spans ≥2 canonical categories' };
    }
    return null;
  },
};

const R_F4 = {
  id: 'R-F4',
  type: 'flag',
  apply(row, ctx) {
    if (row.source !== 'csv-only') return null;
    const norm = normalizeName(row.name);
    let candidates = 0;
    for (const other of ctx.allRows) {
      if (other.check_id === row.check_id) continue;
      if (other.source === 'csv-only') continue;
      if (normalizeName(other.name) === norm) candidates++;
    }
    if (candidates > 2) {
      return { decision: 'flag', rule_id: 'R-F4', rationale: `>2 merge candidates (${candidates})` };
    }
    return null;
  },
};

const R_F5 = {
  id: 'R-F5',
  type: 'flag',
  apply(row, ctx) {
    const twin = findSeedTwin(row, ctx);
    if (!twin) return null;
    const sevDiff = Math.abs((SEV_RANK[row.severity] || 0) - (SEV_RANK[twin.severity] || 0));
    if (sevDiff > 1) {
      return { decision: 'flag', rule_id: 'R-F5', rationale: `severity gap >1 (vs ${twin.check_id})` };
    }
    return null;
  },
};

export const flagRules = [R_F1, R_F2, R_F3, R_F4, R_F5];
