export function buildIndividualFlags(rows) {
  const flagged = rows.filter(r => r.impl_status === 'flag');
  const lines = [
    '# Gap-Map Individual Flag Triage',
    '',
    'For each flag, edit the `Your call:` line in place. Allowed values:',
    '`implemented`, `partial`, `missing`, `n-a`, `comment: <text>`.',
    '',
  ];
  flagged.forEach((r, i) => {
    lines.push(`## FLAG #${String(i + 1).padStart(3, '0')}  ${r.check_id}`);
    lines.push(`- category: ${r.category}`);
    lines.push(`- name:    ${r.original_name || r.name}`);
    lines.push(`- severity: ${r.severity}  |  automation: ${r.automation_type}`);
    lines.push(`- gap_notes: ${r.gap_notes}`);
    if (r.impl_evidence) lines.push(`- evidence: ${r.impl_evidence}`);
    if (r.impl_location) lines.push(`- location: ${r.impl_location}`);
    lines.push('');
    lines.push('> Your call: ___');
    lines.push('');
  });
  return lines.join('\n');
}

export function parseIndividualFlags(markdown) {
  const blocks = markdown.split(/\n## FLAG /).slice(1);
  return blocks.map(block => {
    const idMatch = block.match(/^#?\d+\s+(C\d+)/);
    const callMatch = block.match(/> Your call:\s*(.+?)\s*$/m);
    return {
      check_id: idMatch ? idMatch[1] : null,
      decision: callMatch ? callMatch[1].trim() : null,
    };
  });
}
