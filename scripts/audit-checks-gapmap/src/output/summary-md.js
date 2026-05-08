function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(r[key] || 'unset', (m.get(r[key] || 'unset') || 0) + 1);
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

export function buildGapmapSummary(rows, meta = {}) {
  const total = rows.length;
  const byStatus = countBy(rows, 'impl_status');
  const byCategory = countBy(rows, 'category');

  const lines = [];
  lines.push('# Gap-Map Summary');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  if (meta.label) lines.push(`- Label: ${meta.label}`);
  lines.push(`- Total in-scope rows: ${total}`);
  lines.push('');
  lines.push('## By impl_status');
  for (const [k, v] of Object.entries(byStatus)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## By category');
  for (const [k, v] of Object.entries(byCategory)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## Top categories with `missing` rows');
  const missingByCategory = countBy(rows.filter(r => r.impl_status === 'missing'), 'category');
  for (const [k, v] of Object.entries(missingByCategory)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  return lines.join('\n');
}
