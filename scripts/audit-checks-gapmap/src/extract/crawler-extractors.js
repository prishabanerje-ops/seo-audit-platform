import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const EXTRACTORS_DIR = join(PROJECT_ROOT, 'playwright-crawler', 'src', 'extractors');

const SIGNAL_PATTERNS = [
  // exported functions: export function extractFoo(...) { ... }
  { rx: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function' },
  // exported const arrows: export const fooBar = ...
  { rx: /export\s+const\s+(\w+)\s*=/g, kind: 'const' },
  // returned object field keys: foo: ..., bar: ...
  { rx: /^\s*([a-z_]\w*):\s*[a-zA-Z0-9_'"\[{]/gm, kind: 'field' },
];

const NOISE_NAMES = new Set([
  'if', 'for', 'while', 'return', 'const', 'let', 'var', 'function',
  'log', 'debug', 'info', 'warn', 'error',
]);

export async function extractCrawlerExtractorSignals() {
  const files = await readdir(EXTRACTORS_DIR);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  const all = [];
  let counter = 1;

  for (const fname of jsFiles) {
    const fullPath = join(EXTRACTORS_DIR, fname);
    const relPath = relative(PROJECT_ROOT, fullPath);
    const text = await readFile(fullPath, 'utf8');

    for (const { rx, kind } of SIGNAL_PATTERNS) {
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(text))) {
        const name = m[1];
        if (NOISE_NAMES.has(name) || name.length < 3) continue;

        const upTo = text.slice(0, m.index);
        const line = upTo.split('\n').length;

        all.push({
          signal_id: `P3-S${String(counter++).padStart(3, '0')}`,
          name,
          signal_type: 'extractor-field',
          priority: 3,
          file: relPath,
          line,
          metadata: { kind, extractor: fname.replace('.js', '') },
        });
      }
    }
  }
  return all;
}
