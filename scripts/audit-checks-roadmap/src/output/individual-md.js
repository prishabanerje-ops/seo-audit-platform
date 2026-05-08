export function buildIndividualFlags(rows) {
  const lines = [
    '# Roadmap Individual Triage',
    '',
    'For each item, edit the `Your call:` line in place. Allowed values:',
    '`P0` / `P1` / `P2` (re-priority); `effort: S` / `effort: M` / `effort: L` / `effort: XL` (re-effort);',
    'combined like `P0 effort: L`; or `comment: <free text>` to append a note without changing priority/effort.',
    '',
  ];
  rows.forEach((r, i) => {
    lines.push(`## ROADMAP #${String(i + 1).padStart(3, '0')}  ${r.check_id}`);
    lines.push(`- category: ${r.category}`);
    lines.push(`- name:     ${r.original_name || r.name}`);
    lines.push(`- severity: ${r.severity}`);
    lines.push(`- impl_status: ${r.impl_status}`);
    lines.push(`- current_priority: ${r.priority}`);
    lines.push(`- current_effort: ${r.effort}`);
    lines.push(`- roadmap_notes: ${r.roadmap_notes}`);
    lines.push('');
    lines.push('> Your call: ___');
    lines.push('');
  });
  if (rows.length === 0) {
    lines.push('_No items flagged for individual review._');
  }
  return lines.join('\n');
}

export function parseIndividualFlags(markdown) {
  const blocks = markdown.split(/\n## ROADMAP /).slice(1);
  return blocks.map(block => {
    const idMatch = block.match(/^#?\d+\s+(C\d+)/);
    const callMatch = block.match(/> Your call:\s*(.+?)\s*$/m);
    const raw = callMatch ? callMatch[1].trim() : null;
    const out = { check_id: idMatch ? idMatch[1] : null, raw };
    if (!raw || raw === '___') return out;

    if (raw.startsWith('comment:')) {
      out.comment = raw.slice('comment:'.length).trim();
      return out;
    }
    // Match patterns like "P0", "P0 effort: L", "effort: M"
    const pMatch = raw.match(/\b(P[012])\b/);
    const eMatch = raw.match(/effort:\s*(S|M|L|XL)\b/i);
    if (pMatch) out.priority = pMatch[1];
    if (eMatch) out.effort = eMatch[1].toUpperCase();
    return out;
  });
}
