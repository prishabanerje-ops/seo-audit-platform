export function buildSignalIndexMarkdown(signals) {
  const byPriority = new Map();
  for (const s of signals) {
    const p = s.priority;
    if (!byPriority.has(p)) byPriority.set(p, []);
    byPriority.get(p).push(s);
  }

  const lines = ['# Gap-Map Signal Index', ''];
  lines.push(`Total signals extracted: **${signals.length}**`);
  lines.push('');

  for (const [priority, items] of [...byPriority.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`## Priority ${priority} (${items.length} signals)`);
    lines.push('');
    lines.push('| signal_id | name | type | file:line |');
    lines.push('|---|---|---|---|');
    for (const s of items) {
      const name = String(s.name).replace(/\|/g, '\\|');
      lines.push(`| ${s.signal_id} | ${name} | ${s.signal_type} | ${s.file}:${s.line} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
