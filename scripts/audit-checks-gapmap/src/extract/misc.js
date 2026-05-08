import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');

const TARGETS = [
  'playwright-crawler/src/crawler.js',
  'backend/services/crawl-runner.js',
  'backend/routes/reports.js',
];

const SIGNAL_PATTERNS = [
  { rx: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function', signal_type: 'service-function' },
  { rx: /export\s+const\s+(\w+)\s*=/g, kind: 'const', signal_type: 'service-function' },
];

const NOISE_NAMES = new Set([
  'if', 'for', 'while', 'return', 'const', 'let', 'var', 'function',
  'log', 'debug', 'info', 'warn', 'error',
]);

export async function extractMiscSignals() {
  const all = [];
  let counter = 1;

  for (const file of TARGETS) {
    try {
      const text = await readFile(join(PROJECT_ROOT, file), 'utf8');

      for (const { rx, kind, signal_type } of SIGNAL_PATTERNS) {
        rx.lastIndex = 0;
        let m;
        while ((m = rx.exec(text))) {
          const name = m[1];
          if (NOISE_NAMES.has(name) || name.length < 3) continue;

          const upTo = text.slice(0, m.index);
          const line = upTo.split('\n').length;

          all.push({
            signal_id: `P4-S${String(counter++).padStart(3, '0')}`,
            name,
            signal_type,
            priority: 4,
            file,
            line,
            metadata: { kind },
          });
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return all;
}
