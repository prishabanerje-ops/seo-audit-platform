import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const PARSER_FILE = join(PROJECT_ROOT, 'backend', 'services', 'audit-parser.service.js');

// Look back this many lines from each issueType for nearest section/severity
const CONTEXT_WINDOW = 5;

export async function extractParserSignals() {
  const text = await readFile(PARSER_FILE, 'utf8');
  const lines = text.split('\n');
  const signals = [];
  let counter = 1;

  for (let i = 0; i < lines.length; i++) {
    const m = /issueType:\s*['"]([^'"]+)['"]/.exec(lines[i]);
    if (!m) continue;

    // Walk back up to CONTEXT_WINDOW lines to find severity/section
    let severity, section;
    for (let j = i; j >= Math.max(0, i - CONTEXT_WINDOW); j--) {
      const sevM = /severity:\s*['"]([^'"]+)['"]/.exec(lines[j]);
      if (sevM && !severity) severity = sevM[1];
      const secM = /section:\s*['"]([^'"]+)['"]/.exec(lines[j]);
      if (secM && !section) section = secM[1];
    }

    signals.push({
      signal_id: `P1-S${String(counter).padStart(3, '0')}`,
      name: m[1],
      signal_type: 'issue-emitter',
      priority: 1,
      file: 'backend/services/audit-parser.service.js',
      line: i + 1,
      metadata: { severity, section },
    });
    counter++;
  }

  return signals;
}
