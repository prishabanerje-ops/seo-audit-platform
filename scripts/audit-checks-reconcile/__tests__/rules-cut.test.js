import { describe, it, expect } from 'vitest';
import { cutRules } from '../src/rules/cut.js';

const SEV = { critical: 3, warning: 2, info: 1 };
const ctx = (rows) => ({ allRows: rows });

describe('R-C1 exact-duplicate name', () => {
  it('cuts the lower-severity duplicate', () => {
    const a = { check_id: 'C001', name: 'Sitemap Exists', severity: 'info' };
    const b = { check_id: 'C002', name: 'Sitemap Exists', severity: 'critical' };
    const result = cutRules.find(r => r.id === 'R-C1').apply(a, ctx([a, b]));
    expect(result?.decision).toBe('cut');
  });

  it('does not cut when current row has higher severity', () => {
    const a = { check_id: 'C001', name: 'Sitemap Exists', severity: 'critical' };
    const b = { check_id: 'C002', name: 'Sitemap Exists', severity: 'info' };
    const result = cutRules.find(r => r.id === 'R-C1').apply(a, ctx([a, b]));
    expect(result).toBe(null);
  });
});

describe('R-C2 info subset of higher-severity check', () => {
  it('cuts an info row whose pass_condition is a substring of a warning row', () => {
    const a = { check_id: 'C001', severity: 'info', pass_condition: 'sitemap exists' };
    const b = { check_id: 'C002', severity: 'warning', pass_condition: 'sitemap exists and is valid xml' };
    const result = cutRules.find(r => r.id === 'R-C2').apply(a, ctx([a, b]));
    expect(result?.decision).toBe('cut');
  });
});

describe('R-C3a platform-incapable + info + no PRD commit', () => {
  it('cuts info-severity, manual, no integration', () => {
    const row = {
      check_id: 'C001',
      severity: 'info',
      automation_type: 'manual',
      category: 'Backlinks & Authority',
    };
    const result = cutRules.find(r => r.id === 'R-C3a').apply(row, ctx([row]));
    expect(result?.decision).toBe('cut');
  });

  it('does NOT cut critical/warning even if platform-incapable (those flag instead)', () => {
    const row = {
      check_id: 'C001',
      severity: 'critical',
      automation_type: 'manual',
      category: 'Backlinks & Authority',
    };
    const result = cutRules.find(r => r.id === 'R-C3a').apply(row, ctx([row]));
    expect(result).toBe(null);
  });
});

describe('R-C4 manual + opinion-only', () => {
  it('cuts when pass_condition is opinion-phrased and no measurable threshold', () => {
    const row = {
      check_id: 'C001',
      automation_type: 'manual',
      pass_condition: 'Brand voice is consistent',
      fail_condition: 'Brand voice is inconsistent',
    };
    const result = cutRules.find(r => r.id === 'R-C4').apply(row, ctx([row]));
    expect(result?.decision).toBe('cut');
  });
});
