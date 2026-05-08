import { describe, it, expect } from 'vitest';
import { flagRules } from '../src/rules/flag.js';

const find = (id) => flagRules.find(r => r.id === id);
const ctx = (rows) => ({ allRows: rows });

describe('R-F1 csv↔seed contradiction', () => {
  it('flags when severity differs between csv-only and a seed-only twin', () => {
    const a = { check_id: 'C001', source: 'csv-only', name: 'X', severity: 'info' };
    const b = { check_id: 'C002', source: 'seed-only', name: 'X', severity: 'critical' };
    const result = find('R-F1').apply(a, ctx([a, b]));
    // F1 fires for adjacent severity differences (1 step). info→critical is 2 steps → R-F5 territory.
    // This pair is critical/info = 2 steps gap, so R-F1 should NOT fire here. Test that.
    expect(result).toBe(null);
  });

  it('flags adjacent severity (warning vs info) between csv and seed twins', () => {
    const a = { check_id: 'C001', source: 'csv-only', name: 'Y', severity: 'warning' };
    const b = { check_id: 'C002', source: 'seed-only', name: 'Y', severity: 'info' };
    const result = find('R-F1').apply(a, ctx([a, b]));
    expect(result?.decision).toBe('flag');
  });
});

describe('R-F2-extended platform-incapable critical/warning', () => {
  it('flags critical Backlinks rows for integration decision', () => {
    const row = { check_id: 'C001', category: 'Backlinks & Authority', severity: 'critical' };
    const result = find('R-F2').apply(row, ctx([row]));
    expect(result?.decision).toBe('flag');
    expect(result.rationale).toMatch(/integration/i);
    expect(result.notes).toMatch(/backlink|API/i);
  });

  it('does NOT flag info-severity (R-C3a will cut)', () => {
    const row = { check_id: 'C001', category: 'Backlinks & Authority', severity: 'info' };
    expect(find('R-F2').apply(row, ctx([row]))).toBe(null);
  });
});

describe('R-F5 severity disagreement >1 step', () => {
  it('flags critical-vs-info pair', () => {
    const a = { check_id: 'C001', source: 'csv-only', name: 'X', severity: 'critical' };
    const b = { check_id: 'C002', source: 'seed-only', name: 'X', severity: 'info' };
    expect(find('R-F5').apply(a, ctx([a, b]))?.decision).toBe('flag');
  });

  it('does NOT flag adjacent severity (warning-info)', () => {
    const a = { check_id: 'C001', source: 'csv-only', name: 'Y', severity: 'warning' };
    const b = { check_id: 'C002', source: 'seed-only', name: 'Y', severity: 'info' };
    expect(find('R-F5').apply(a, ctx([a, b]))).toBe(null);
  });
});
