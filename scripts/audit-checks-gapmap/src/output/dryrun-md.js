export function buildDryrunTable(rows) {
  const header = '| check_id | category | name | impl_status | rule | evidence |\n|---|---|---|---|---|---|';
  const body = rows.map(r => {
    const rule = (r.gap_notes || '').split(':')[0].trim() || '';
    const evidence = (r.impl_evidence || '').replace(/\|/g, '\\|');
    const name = String(r.name || '').replace(/\|/g, '\\|');
    return `| ${r.check_id} | ${r.category} | ${name} | ${r.impl_status} | ${rule} | ${evidence} |`;
  }).join('\n');
  return `# Gap-Map Dry-Run Decision Table (first 25 in-scope rows)\n\n${header}\n${body}\n`;
}
