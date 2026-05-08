import { loadCanonical, filterInScope } from './canonical.js';
import { computePriority } from './rubric/priority.js';
import { computeEffort } from './rubric/effort.js';

export function annotateRow(row) {
  const p = computePriority(row);
  const e = computeEffort(row);
  return {
    ...row,
    priority: p.priority,
    effort: e.effort,
    roadmap_notes: `${p.note}; ${e.note}`,
  };
}

export async function runRoadmap({ limit } = {}) {
  const all = await loadCanonical();
  const inScope = filterInScope(all);
  const slice = limit ? inScope.slice(0, limit) : inScope;
  const rows = slice.map(annotateRow);
  return { rows };
}
