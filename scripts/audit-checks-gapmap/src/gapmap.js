import { loadCanonical, filterInScope } from './canonical.js';
import { buildSignalIndex } from './signal-index.js';
import { classifyRow } from './classifier.js';

export async function runGapmap({ limit } = {}) {
  const all = await loadCanonical();
  const inScope = filterInScope(all);
  const slice = limit ? inScope.slice(0, limit) : inScope;
  const signals = await buildSignalIndex();

  const rows = slice.map(r => {
    const decision = classifyRow(r, signals);
    return { ...r, ...decision };
  });

  return { rows, signals };
}
