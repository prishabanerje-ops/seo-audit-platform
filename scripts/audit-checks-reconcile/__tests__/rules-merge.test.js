import { describe, it, expect } from 'vitest';
import { mergeRules } from '../src/rules/merge.js';

const ctx = (rows) => ({ allRows: rows });

describe('R-M1 csv↔seed semantic match (cross-category — strict 0.9)', () => {
  it('merges identical names across categories (Jaccard 1.0)', () => {
    const csvRow = { check_id: 'C001', source: 'csv-only', name: 'HTTPS used', category: 'Security & HTTPS' };
    const seedRow = { check_id: 'C002', source: 'seed-only', name: 'HTTPS used', category: 'GEO & LLM Crawlers' };
    const result = mergeRules.find(r => r.id === 'R-M1').apply(csvRow, ctx([csvRow, seedRow]));
    expect(result?.decision).toBe('merge');
    expect(result.merge_into).toBe('C002');
    expect(result.rationale).toMatch(/cross-category/);
  });

  it('does NOT merge across categories when overlap is moderate (e.g., 0.6)', () => {
    // Cross-category demands ≥0.9 — 0.5 overlap should NOT merge
    const csvRow = { check_id: 'C001', source: 'csv-only', name: 'Foo Bar Baz', category: 'Title Tags' };
    const seedRow = { check_id: 'C002', source: 'seed-only', name: 'Foo Bar Qux', category: 'Mobile & Usability' };
    // Tokens {foo,bar,baz} vs {foo,bar,qux}: intersection 2, union 4 → 0.5
    const result = mergeRules.find(r => r.id === 'R-M1').apply(csvRow, ctx([csvRow, seedRow]));
    expect(result).toBe(null);
  });
});

describe('R-M1 csv↔seed semantic match (same-category — relaxed 0.5)', () => {
  it('merges within same category at moderate overlap (≥0.5)', () => {
    // Same category, Jaccard 0.5 — should merge
    const csvRow = { check_id: 'C001', source: 'csv-only', name: 'Foo Bar Baz', category: 'Title Tags' };
    const seedRow = { check_id: 'C002', source: 'seed-only', name: 'Foo Bar Qux', category: 'Title Tags' };
    const result = mergeRules.find(r => r.id === 'R-M1').apply(csvRow, ctx([csvRow, seedRow]));
    expect(result?.decision).toBe('merge');
    expect(result.merge_into).toBe('C002');
    expect(result.rationale).toMatch(/same-category/);
  });

  it('does NOT merge within same category when overlap is below 0.5', () => {
    // Same category but only 1/4 = 0.25 overlap — below same-category threshold
    const csvRow = { check_id: 'C001', source: 'csv-only', name: 'Foo Bar', category: 'Title Tags' };
    const seedRow = { check_id: 'C002', source: 'seed-only', name: 'Bar Baz Qux', category: 'Title Tags' };
    // Tokens {foo,bar} vs {bar,baz,qux}: intersection 1, union 4 → 0.25
    const result = mergeRules.find(r => r.id === 'R-M1').apply(csvRow, ctx([csvRow, seedRow]));
    expect(result).toBe(null);
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
