export function buildIndividualFlags(rows) {
  const flagged = rows.filter(r => r.decision === 'flag');
  const lines = ['# Individual Flag Triage', '', 'For each flag, edit the `Your call:` line in place. Allowed values: `keep`, `cut`, `edit-and-keep`, `comment: <text>`.', ''];
  flagged.forEach((r, i) => {
    lines.push(`## FLAG #${String(i + 1).padStart(3, '0')}  ${r.check_id}`);
    lines.push(`- csv_row: ${r.csv_row || '(seed-only)'}`);
    lines.push(`- rule:   ${r.rule_id}`);
    lines.push(`- category: ${r.category}`);
    lines.push(`- name:   ${r.original_name}`);
    lines.push(`- severity: ${r.severity}`);
    lines.push(`- automation: ${r.automation_type}`);
    lines.push(`- rationale: ${r.rationale}`);
    if (r.notes) lines.push(`- notes:  ${r.notes}`);
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
