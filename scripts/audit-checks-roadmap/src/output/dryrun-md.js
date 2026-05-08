export function buildDryrunTable(rows) {
  const header = '| check_id | category | name | impl_status | priority | effort | rule |\n|---|---|---|---|---|---|---|';
  const body = rows.map(r => {
    const rule = (r.roadmap_notes || '').split(';')[0].trim();
    const name = String(r.name || '').replace(/\|/g, '\\|');
    return `| ${r.check_id} | ${r.category} | ${name} | ${r.impl_status} | ${r.priority} | ${r.effort} | ${rule} |`;
  }).join('\n');
  return `# Roadmap Dry-Run Decision Table (first 25 in-scope rows)\n\n${header}\n${body}\n`;
}
