import { describe, it, expect } from 'vitest';
import { reconcile } from '../src/reconcile.js';

describe('reconcile', () => {
  it('tags csv-seed overlap as both, csv-unmatched as csv-only, seed-unmatched as seed-only', () => {
    const csvRows = [
      { group: 'Title Tags', sub_check_name: 'Title under 60 chars', severity: 'warning', automation_type: 'automated', pass_condition: '', fail_condition: '' },
      { group: 'Backlinks & Authority', sub_check_name: 'Toxic Spammy Links', severity: 'critical', automation_type: 'manual', pass_condition: '', fail_condition: '' },
    ];
    const seed = [
      { check_number: 1, name: 'Title under 60 chars', category: 'Title Tags', severity_default: 'warning', automation_type: 'automated' },
      { check_number: 99, name: 'Some seed-only check', category: 'Mobile SEO', severity_default: 'info', automation_type: 'automated' },
    ];
    const result = reconcile({ csvRows, seed });
    const sources = result.rows.map(r => r.source).sort();
    expect(sources).toEqual(['both', 'csv-only', 'seed-only']);
    const both = result.rows.find(r => r.source === 'both');
    expect(both.seed_check_number).toBe(1);
  });

  it('applies category mapping and rename', () => {
    const csvRows = [{ group: 'Local SEO & GEO', sub_check_name: 'GBP exists', severity: 'critical', automation_type: 'manual', pass_condition: '', fail_condition: '' }];
    const seed = [];
    const result = reconcile({ csvRows, seed });
    expect(result.rows[0].category).toBe('Local SEO');
  });

  it('limits to first N rows when limit option provided (for dry-run)', () => {
    const csvRows = Array.from({ length: 50 }, (_, i) => ({
      group: 'Title Tags', sub_check_name: `t${i}`, severity: 'info', automation_type: 'automated', pass_condition: '', fail_condition: '',
    }));
    const result = reconcile({ csvRows, seed: [], limit: 25 });
    expect(result.rows.filter(r => r.source !== 'seed-only').length).toBe(25);
  });
});
