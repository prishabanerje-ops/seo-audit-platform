import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');

const TARGETS = [
  { file: 'backend/routes/gsc.js', label: 'gsc' },
  { file: 'backend/routes/ga4.js', label: 'ga4' },
  { file: 'backend/routes/psi.js', label: 'psi' },
  { file: 'backend/services/sitemap-fetcher.js', label: 'sitemap-fetcher' },
];

// Patterns that indicate a check-like signal
const SIGNAL_PATTERNS = [
  // exported functions
  { rx: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function' },
  // exported const arrows
  { rx: /export\s+const\s+(\w+)\s*=/g, kind: 'const' },
  // route definitions: router.get/post/...('/path', ...)
  { rx: /router\.(?:get|post|put|delete)\(\s*['"]([^'"]+)['"]/g, kind: 'route' },
  // returned object keys at function-return depth (heuristic)
  { rx: /^\s*([a-z_]\w*):\s*[a-zA-Z0-9_'"\[{]/gm, kind: 'field' },
];

function extractFromText(text, file, label, counterRef) {
  const out = [];

  for (const { rx, kind } of SIGNAL_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const name = m[1];
      // skip very common JS keywords / noise
      if (['if', 'for', 'while', 'return', 'const', 'let', 'var', 'function'].includes(name)) continue;
      if (name.length < 3) continue;

      // Find the line number from the match index
      const upTo = text.slice(0, m.index);
      const line = upTo.split('\n').length;

      out.push({
        signal_id: `P2-S${String(counterRef.value++).padStart(3, '0')}`,
        name: kind === 'route' ? `${label} route ${name}` : name,
        signal_type: 'service-function',
        priority: 2,
        file,
        line,
        metadata: { kind, label },
      });
    }
  }
  return out;
}

export async function extractIntegrationSignals() {
  const counterRef = { value: 1 };
  const all = [];
  for (const { file, label } of TARGETS) {
    try {
      const text = await readFile(join(PROJECT_ROOT, file), 'utf8');
      all.push(...extractFromText(text, file, label, counterRef));
    } catch (err) {
      // File may not exist (e.g., feature not yet built); skip silently
      if (err.code !== 'ENOENT') throw err;
    }
  }
  return all;
}
