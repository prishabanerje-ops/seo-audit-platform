function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(r[key] || 'unset', (m.get(r[key] || 'unset') || 0) + 1);
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

function crosstab(rows) {
  const cats = new Map();
  for (const r of rows) {
    const cat = r.category || 'unset';
    if (!cats.has(cat)) cats.set(cat, { P0: 0, P1: 0, P2: 0 });
    cats.get(cat)[r.priority || 'P2']++;
  }
  return cats;
}

function priorityBacklog(rows, priority) {
  const items = rows.filter(r => r.priority === priority);
  const byCategory = new Map();
  for (const r of items) {
    const cat = r.category || 'unset';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(r);
  }
  const lines = [];
  for (const [cat, list] of [...byCategory.entries()].sort()) {
    lines.push(`### ${cat}`);
    for (const r of list) {
      const rule = (r.roadmap_notes || '').split(';')[0].trim();
      const name = r.original_name || r.name || '';
      lines.push(`- ${r.check_id}: ${name} [${r.severity || ''}, ${r.impl_status}, ${r.effort}] — ${rule}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function buildRoadmapSummary(rows, meta = {}) {
  const total = rows.length;
  const byPriority = countBy(rows, 'priority');
  const byEffort = countBy(rows, 'effort');

  const lines = [];
  lines.push('# Audit-Checks Roadmap v1');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  if (meta.label) lines.push(`- Label: ${meta.label}`);
  const missing = rows.filter(r => r.impl_status === 'missing').length;
  const partial = rows.filter(r => r.impl_status === 'partial').length;
  lines.push(`- Total in-scope: ${total} (${missing} missing + ${partial} partial)`);
  lines.push('');

  lines.push('## By priority');
  for (const tier of ['P0', 'P1', 'P2']) lines.push(`- ${tier}: ${byPriority[tier] || 0}`);
  lines.push('');

  lines.push('## By effort');
  for (const eff of ['S', 'M', 'L', 'XL']) lines.push(`- ${eff}: ${byEffort[eff] || 0}`);
  lines.push('');

  lines.push('## Priority × category crosstab');
  lines.push('| Category | P0 | P1 | P2 | Total |');
  lines.push('|---|---|---|---|---|');
  const ct = crosstab(rows);
  const cats = [...ct.entries()].sort((a, b) => (b[1].P0 + b[1].P1) - (a[1].P0 + a[1].P1));
  for (const [cat, counts] of cats) {
    const tot = counts.P0 + counts.P1 + counts.P2;
    lines.push(`| ${cat} | ${counts.P0} | ${counts.P1} | ${counts.P2} | ${tot} |`);
  }
  lines.push('');

  lines.push('## P0 backlog (the build-first list)');
  lines.push('');
  lines.push(priorityBacklog(rows, 'P0'));

  lines.push('## P1 backlog');
  lines.push('');
  lines.push(priorityBacklog(rows, 'P1'));

  lines.push('## P2 backlog');
  lines.push('');
  lines.push(priorityBacklog(rows, 'P2'));

  return lines.join('\n');
}
