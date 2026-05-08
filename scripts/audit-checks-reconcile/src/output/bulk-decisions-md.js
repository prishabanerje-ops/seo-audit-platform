export function buildBulkDecisions(rows) {
  const flagged = rows.filter(r => r.decision === 'flag');
  const groups = new Map();
  for (const r of flagged) {
    const key = `${r.rule_id}|${r.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const lines = ['# Bulk Triage Decisions', '', 'For each group below, edit the `Decision:` line in place. Allowed values: `keep-all`, `cut-all`, `flag-individually` (forces per-row review in M5).', ''];
  let idx = 1;
  for (const [key, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const [rule, category] = key.split('|');
    lines.push(`## Group ${idx}: ${rule} in ${category} (${items.length} flags)`);
    lines.push('');
    lines.push('Sample names:');
    for (const r of items.slice(0, 5)) lines.push(`- ${r.original_name} [${r.severity}]`);
    if (items.length > 5) lines.push(`- ...and ${items.length - 5} more`);
    lines.push('');
    lines.push(`> Decision: ___`);
    lines.push('');
    idx++;
  }
  if (groups.size === 0) {
    lines.push('_No flag rules fired. Skip M4 and proceed to M5._');
  }
  return lines.join('\n');
}

export function parseBulkDecisions(markdown) {
  const groups = [];
  const groupRe = /## Group \d+: (\S+) in ([^()]+?) \((\d+) flags\)[\s\S]*?> Decision:\s*(\S+)/g;
  let m;
  while ((m = groupRe.exec(markdown))) {
    groups.push({ rule: m[1], category: m[2].trim(), count: Number(m[3]), decision: m[4] });
  }
  return groups;
}
