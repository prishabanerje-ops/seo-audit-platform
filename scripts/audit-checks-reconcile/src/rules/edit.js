const VAGUE_PATTERNS = [
  { rx: /\bset if needed\b/i, replacement: 'declared where applicable' },
  { rx: /\bif relevant\b/i, replacement: 'where applicable' },
  { rx: /\bwhere appropriate\b/i, replacement: 'where applicable' },
  { rx: /\b(?:reviewed|review) regularly\b/i, replacement: 'reviewed on a defined cadence' },
];

const R_E1 = {
  id: 'R-E1',
  type: 'edit',
  apply(row) {
    if (!row.name) return null;
    let revised = row.name;
    let changed = false;
    for (const { rx, replacement } of VAGUE_PATTERNS) {
      if (rx.test(revised)) {
        revised = revised.replace(rx, replacement);
        changed = true;
      }
    }
    if (!changed) return null;
    return { decision: 'edit', rule_id: 'R-E1', revised_name: revised, rationale: 'vague phrasing rewritten' };
  },
};

export const editRules = [R_E1];
