import { describe, it, expect } from 'vitest';
import { loadCanonical, filterInScope } from '../src/canonical.js';

describe('loadCanonical', () => {
  it('loads the canonical CSV with all 19 columns', async () => {
    const rows = await loadCanonical();
    expect(rows.length).toBeGreaterThan(500);
    expect(rows[0]).toHaveProperty('check_id');
    expect(rows[0]).toHaveProperty('decision');
    expect(rows[0]).toHaveProperty('source');
    expect(rows[0]).toHaveProperty('category');
  });
});

describe('filterInScope', () => {
  it('returns only rows where decision is keep/edit and source is csv-only/both', () => {
    const all = [
      { check_id: 'C1', decision: 'keep', source: 'csv-only' },
      { check_id: 'C2', decision: 'cut', source: 'csv-only' },
      { check_id: 'C3', decision: 'keep', source: 'seed-only' },
      { check_id: 'C4', decision: 'edit', source: 'csv-only' },
      { check_id: 'C5', decision: 'merge', source: 'csv-only' },
      { check_id: 'C6', decision: 'keep', source: 'both' },
    ];
    const inScope = filterInScope(all);
    expect(inScope.map(r => r.check_id)).toEqual(['C1', 'C4', 'C6']);
  });

  it('full canonical filters to ~204 in-scope rows', async () => {
    const all = await loadCanonical();
    const inScope = filterInScope(all);
    expect(inScope.length).toBeGreaterThan(195);
    expect(inScope.length).toBeLessThan(215);
  });
});
