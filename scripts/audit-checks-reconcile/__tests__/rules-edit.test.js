import { describe, it, expect } from 'vitest';
import { editRules } from '../src/rules/edit.js';

describe('R-E1 vague-name rewrite', () => {
  it('renames "Set If Needed" patterns to declarative form', () => {
    const row = { check_id: 'C001', name: 'Crawl-Delay Set If Needed' };
    const result = editRules.find(r => r.id === 'R-E1').apply(row);
    expect(result?.decision).toBe('edit');
    expect(result.revised_name).toMatch(/declared/i);
    expect(result.revised_name).not.toMatch(/if needed/i);
  });

  it('returns null for already-actionable names', () => {
    const row = { check_id: 'C001', name: 'All internal links return 200 status' };
    const result = editRules.find(r => r.id === 'R-E1').apply(row);
    expect(result).toBe(null);
  });
});
