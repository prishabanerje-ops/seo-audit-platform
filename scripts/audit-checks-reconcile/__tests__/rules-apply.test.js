import { describe, it, expect } from 'vitest';
import { applyRules } from '../src/rules/apply.js';

describe('applyRules tie-breaker', () => {
  it('flag short-circuits cut/merge/edit', () => {
    const row = {
      check_id: 'C001',
      source: 'csv-only',
      name: 'Toxic Spammy Links',
      category: 'Backlinks & Authority',
      severity: 'critical',
      automation_type: 'manual',
    };
    const result = applyRules(row, { allRows: [row] });
    expect(result.decision).toBe('flag');
    expect(result.rule_id).toBe('R-F2');
  });

  it('cut beats merge when both could fire', () => {
    const a = { check_id: 'C001', name: 'X', severity: 'info' };
    const b = { check_id: 'C002', name: 'X', severity: 'critical' };
    const result = applyRules(a, { allRows: [a, b] });
    expect(result.decision).toBe('cut');
  });

  it('default keep when no rule matches', () => {
    const row = {
      check_id: 'C001',
      name: 'All internal links return 200',
      category: 'Response Codes & Redirects',
      severity: 'critical',
      automation_type: 'automated',
    };
    const result = applyRules(row, { allRows: [row] });
    expect(result.decision).toBe('keep');
  });
});
