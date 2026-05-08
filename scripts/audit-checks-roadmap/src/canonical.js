import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const CANONICAL_CSV = join(PROJECT_ROOT, 'docs', 'audit-checks', 'canonical-checks-v1.csv');

const IN_SCOPE_DECISIONS = new Set(['keep', 'edit']);
const IN_SCOPE_SOURCES = new Set(['csv-only', 'both']);
const IN_SCOPE_IMPL_STATUSES = new Set(['missing', 'partial']);

export async function loadCanonical() {
  const text = await readFile(CANONICAL_CSV, 'utf8');
  return parseCsv(text);
}

export function filterInScope(rows) {
  return rows.filter(r =>
    IN_SCOPE_DECISIONS.has(r.decision) &&
    IN_SCOPE_SOURCES.has(r.source) &&
    IN_SCOPE_IMPL_STATUSES.has(r.impl_status),
  );
}
