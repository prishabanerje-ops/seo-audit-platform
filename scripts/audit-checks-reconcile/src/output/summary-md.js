function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(r[key] || 'unset', (m.get(r[key] || 'unset') || 0) + 1);
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

export function buildRunSummary(rows, meta = {}) {
  const total = rows.length;
  const byDecision = countBy(rows, 'decision');
  const byCategory = countBy(rows, 'category');
  const bySeverity = countBy(rows, 'severity');
  const byAutomation = countBy(rows, 'automation_type');
  const bySource = countBy(rows, 'source');

  const lines = [];
  lines.push('# Run Summary');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  if (meta.label) lines.push(`- Label: ${meta.label}`);
  lines.push(`- Total rows: ${total}`);
  lines.push('');
  lines.push('## By decision');
  for (const [k, v] of Object.entries(byDecision)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By source');
  for (const [k, v] of Object.entries(bySource)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By severity');
  for (const [k, v] of Object.entries(bySeverity)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By automation_type');
  for (const [k, v] of Object.entries(byAutomation)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By category');
  for (const [k, v] of Object.entries(byCategory)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  return lines.join('\n');
}

export function buildDryrunTable(rows) {
  const header = '| csv_row | category | original_name | rule_fired | decision | revised_name | rationale |\n|---|---|---|---|---|---|---|';
  const body = rows.map(r => `| ${r.csv_row || ''} | ${r.category || ''} | ${r.original_name || ''} | ${r.rule_id || ''} | ${r.decision || ''} | ${r.revised_name || ''} | ${r.rationale || ''} |`).join('\n');
  return `# Dry-Run Decision Table (first 25 CSV rows)\n\n${header}\n${body}\n`;
}
