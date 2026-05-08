export function buildBulkDecisions(rows) {
  // Group by (priority × category)
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.priority}|${r.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const lines = [
    '# Roadmap Bulk Triage Decisions',
    '',
    'For each group below, edit the `Decision:` line in place. Allowed values:',
    '`accept` (keep heuristic priority), `reshape: P0` / `reshape: P1` / `reshape: P2` (re-tier the whole group), `flag-individually` (forces per-row review at R6).',
    '',
  ];

  let idx = 1;
  // Sort by (priority asc, count desc)
  const ordered = [...groups.entries()].sort((a, b) => {
    const pa = a[0].split('|')[0];
    const pb = b[0].split('|')[0];
    if (pa !== pb) return pa.localeCompare(pb);
    return b[1].length - a[1].length;
  });

  for (const [key, items] of ordered) {
    const [priority, category] = key.split('|');
    lines.push(`## Group ${idx}: ${priority} / ${category} (${items.length} items)`);
    lines.push('');
    lines.push('Sample names:');
    for (const r of items.slice(0, 5)) {
      const name = r.original_name || r.name;
      lines.push(`- ${name} [${r.severity}]`);
    }
    if (items.length > 5) lines.push(`- ...and ${items.length - 5} more`);
    lines.push('');
    lines.push('> Decision: ___');
    lines.push('');
    idx++;
  }

  if (groups.size === 0) {
    lines.push('_No in-scope rows. Skip R4 and proceed to R5._');
  }
  return lines.join('\n');
}

export function parseBulkDecisions(markdown) {
  const groups = [];
  // Match: ## Group N: <priority> / <category> (<count> items) ... > Decision: <answer>
  const groupRe = /## Group \d+: (P\d) \/ ([^()]+?) \((\d+) items\)[\s\S]*?> Decision:\s*(\S+(?:\s+\S+)*?)\s*$/gm;
  let m;
  while ((m = groupRe.exec(markdown))) {
    groups.push({ priority: m[1], category: m[2].trim(), count: Number(m[3]), decision: m[4].trim() });
  }
  return groups;
}
