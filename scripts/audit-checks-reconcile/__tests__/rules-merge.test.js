import { describe, it, expect } from 'vitest';
import { mergeRules } from '../src/rules/merge.js';

const ctx = (rows) => ({ allRows: rows });

describe('R-M1 csv↔seed semantic match', () => {
  it('merges csv-only row into a both/seed-only row whose names match >=0.9', () => {
    const csvRow = { check_id: 'C001', source: 'csv-only', name: 'All internal links return 200' };
    const seedRow = { check_id: 'C002', source: 'seed-only', name: 'All internal links return 200 status' };
    const result = mergeRules.find(r => r.id === 'R-M1').apply(csvRow, ctx([csvRow, seedRow]));
    expect(result?.decision).toBe('merge');
    expect(result.merge_into).toBe('C002');
  });
});

describe('R-M2 same-signal across different categories', () => {
  it('merges into more specific category when names normalize equal but categories differ', () => {
    const a = { check_id: 'C001', name: 'HTTPS used', category: 'Security & HTTPS' };
    const b = { check_id: 'C002', name: 'HTTPS used', category: 'GEO & LLM Crawlers' };
    const result = mergeRules.find(r => r.id === 'R-M2').apply(b, ctx([a, b]));
    expect(result?.decision).toBe('merge');
    expect(result.merge_into).toBe('C001');
  });
});
