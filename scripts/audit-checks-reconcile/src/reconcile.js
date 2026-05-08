import { mapCategory, recategorizeBotPolicy } from './taxonomy.js';
import { normalizeName } from './normalize.js';
import { applyRules } from './rules/apply.js';
import { reclassify } from './rules/reclassify.js';
import { allocateIds } from './id.js';

function csvRowToCanonical(csvRow, idx) {
  const mapped = mapCategory(csvRow.group);
  const base = {
    csv_row: idx + 2, // +1 for header, +1 for 1-indexed line number
    source: 'csv-only',
    category: mapped || csvRow.group,
    name: csvRow.sub_check_name,
    original_name: csvRow.sub_check_name,
    severity: csvRow.severity,
    automation_type: csvRow.automation_type,
    pass_condition: csvRow.pass_condition,
    fail_condition: csvRow.fail_condition,
    notes: csvRow.notes || '',
    _category_unmapped: !mapped,
  };
  return recategorizeBotPolicy(base); // R-M3 part a (preprocessing)
}

function seedRowToCanonical(seedRow) {
  const base = {
    seed_check_number: seedRow.check_number,
    source: 'seed-only',
    category: mapCategory(seedRow.category) || seedRow.category,
    name: seedRow.name,
    original_name: seedRow.name,
    severity: seedRow.severity_default,
    automation_type: seedRow.automation_type,
    implementation_rule: seedRow.implementation_rule || '',
    tool_current: seedRow.tool_current || '',
    tool_future: seedRow.tool_future || '',
    pass_condition: '',
    fail_condition: '',
    notes: '',
  };
  return recategorizeBotPolicy(base); // R-M3 part a (preprocessing)
}

export function reconcile({ csvRows, seed, limit }) {
  const csvSlice = limit ? csvRows.slice(0, limit) : csvRows;
  const csvCanonical = csvSlice.map(csvRowToCanonical);

  // Match csv→seed
  const seedByName = new Map();
  for (const s of seed) seedByName.set(normalizeName(s.name), s);
  const matchedSeedNumbers = new Set();
  for (const row of csvCanonical) {
    const seedHit = seedByName.get(normalizeName(row.name));
    if (seedHit) {
      row.source = 'both';
      row.seed_check_number = seedHit.check_number;
      row.implementation_rule = seedHit.implementation_rule || '';
      row.tool_current = seedHit.tool_current || '';
      row.tool_future = seedHit.tool_future || '';
      matchedSeedNumbers.add(seedHit.check_number);
    }
  }

  // Add seed-only rows
  const seedOnlyRows = limit
    ? []
    : seed
        .filter(s => !matchedSeedNumbers.has(s.check_number))
        .map(seedRowToCanonical);

  let allRows = [...csvCanonical, ...seedOnlyRows];
  allRows = allocateIds(allRows);

  // Apply decision rules
  const ctx = { allRows };
  for (const row of allRows) {
    const decision = applyRules(row, ctx);
    Object.assign(row, decision);
  }

  // Apply reclassify post-processor
  for (let i = 0; i < allRows.length; i++) {
    allRows[i] = reclassify(allRows[i]);
  }

  return { rows: allRows };
}
