import { writeCsv } from '../csv.js';

const COLUMNS = [
  'check_id', 'csv_row', 'seed_check_number', 'source',
  'category', 'subsection', 'name', 'original_name',
  'severity', 'automation_type', 'decision', 'merge_into',
  'rationale', 'pass_condition', 'fail_condition',
  'implementation_rule', 'tool_current', 'notes',
];

export async function writeCanonicalCsv(rows) {
  const out = rows.map(r => {
    const o = {};
    for (const c of COLUMNS) o[c] = r[c] ?? '';
    return o;
  });
  return writeCsv(out, COLUMNS);
}
