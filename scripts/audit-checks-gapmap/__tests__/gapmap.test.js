import { describe, it, expect } from 'vitest';
import { runGapmap } from '../src/gapmap.js';

describe('runGapmap', () => {
  it('classifies the in-scope canonical rows against the signal index', async () => {
    const result = await runGapmap();
    expect(result.rows.length).toBeGreaterThan(195);
    expect(result.rows.length).toBeLessThan(215);

    for (const r of result.rows) {
      expect(['implemented', 'partial', 'missing', 'n-a', 'flag']).toContain(r.impl_status);
    }
  });

  it('limits to first N rows when limit option provided (for dry-run)', async () => {
    const result = await runGapmap({ limit: 25 });
    expect(result.rows.length).toBe(25);
  });
});
