import { describe, it, expect } from 'vitest';
import { loadCanonical, filterInScope } from '../src/canonical.js';

describe('loadCanonical', () => {
  it('loads the canonical CSV with all 23 columns from Phase 2', async () => {
    const rows = await loadCanonical();
    expect(rows.length).toBeGreaterThan(500);
    expect(rows[0]).toHaveProperty('check_id');
    expect(rows[0]).toHaveProperty('decision');
    expect(rows[0]).toHaveProperty('source');
    expect(rows[0]).toHaveProperty('category');
    expect(rows[0]).toHaveProperty('impl_status');
  });
});

describe('filterInScope', () => {
  it('returns only rows where decision/source are in-scope AND impl_status ∈ {missing, partial}', () => {
    const all = [
      { check_id: 'C1', decision: 'keep', source: 'csv-only', impl_status: 'missing' },
      { check_id: 'C2', decision: 'cut', source: 'csv-only', impl_status: 'missing' },
      { check_id: 'C3', decision: 'keep', source: 'seed-only', impl_status: 'implemented' },
      { check_id: 'C4', decision: 'edit', source: 'csv-only', impl_status: 'partial' },
      { check_id: 'C5', decision: 'keep', source: 'both', impl_status: 'implemented' },
      { check_id: 'C6', decision: 'keep', source: 'both', impl_status: 'n-a' },
      { check_id: 'C7', decision: 'keep', source: 'both', impl_status: 'missing' },
    ];
    const inScope = filterInScope(all);
    expect(inScope.map(r => r.check_id)).toEqual(['C1', 'C4', 'C7']);
  });

  it('full canonical filters to ~163 in-scope rows (149 missing + 14 partial)', async () => {
    const all = await loadCanonical();
    const inScope = filterInScope(all);
    expect(inScope.length).toBeGreaterThan(155);
    expect(inScope.length).toBeLessThan(175);
    const counts = inScope.reduce((m, r) => { m[r.impl_status] = (m[r.impl_status] || 0) + 1; return m; }, {});
    expect(counts.missing).toBeGreaterThan(140);
    expect(counts.partial).toBeGreaterThan(10);
  });
});
