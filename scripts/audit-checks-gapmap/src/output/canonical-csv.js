import { writeCsv } from '../csv.js';

const ORIGINAL_COLUMNS = [
  'check_id', 'csv_row', 'seed_check_number', 'source',
  'category', 'subsection', 'name', 'original_name',
  'severity', 'automation_type', 'decision', 'rule_id', 'merge_into',
  'rationale', 'pass_condition', 'fail_condition',
  'implementation_rule', 'tool_current', 'notes',
];

const NEW_COLUMNS = ['impl_status', 'impl_location', 'impl_evidence', 'gap_notes'];

export const COLUMNS = [...ORIGINAL_COLUMNS, ...NEW_COLUMNS];

export async function writeExtendedCanonicalCsv(rows) {
  const out = rows.map(r => {
    const o = {};
    for (const c of COLUMNS) o[c] = r[c] ?? '';
    return o;
  });
  return writeCsv(out, COLUMNS);
}
