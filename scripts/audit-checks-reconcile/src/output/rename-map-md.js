import { getRenameLog } from '../taxonomy.js';

export function buildRenameMap() {
  const log = getRenameLog();
  const lines = ['# Category Rename Map', '', 'Mappings applied in Phase 1 reconciliation. Frontend slugs and DB seed must be updated in a later phase.', '', '| From | To |', '|---|---|'];
  for (const { from, to } of log) lines.push(`| ${from} | ${to} |`);
  return lines.join('\n');
}
