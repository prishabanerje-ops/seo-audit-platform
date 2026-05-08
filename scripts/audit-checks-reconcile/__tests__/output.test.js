import { describe, it, expect } from 'vitest';
import { writeCanonicalCsv } from '../src/output/canonical-csv.js';
import { buildRunSummary, buildDryrunTable } from '../src/output/summary-md.js';
import { buildBulkDecisions, parseBulkDecisions } from '../src/output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from '../src/output/individual-md.js';
import { buildRenameMap } from '../src/output/rename-map-md.js';

describe('output writers smoke', () => {
  const rows = [
    { check_id: 'C001', csv_row: 2, source: 'csv-only', category: 'Title Tags', name: 'X', original_name: 'X', severity: 'warning', automation_type: 'automated', decision: 'keep', rule_id: 'R-K', rationale: 'default' },
    { check_id: 'C002', csv_row: 3, source: 'csv-only', category: 'Backlinks & Authority', name: 'Toxic', original_name: 'Toxic', severity: 'critical', automation_type: 'manual', decision: 'flag', rule_id: 'R-F2', rationale: 'platform-incapable' },
  ];

  it('writes csv with all required columns', async () => {
    const csv = await writeCanonicalCsv(rows);
    expect(csv).toContain('check_id,csv_row,seed_check_number,source');
    expect(csv).toContain('C001');
  });

  it('builds run summary with totals', () => {
    const md = buildRunSummary(rows);
    expect(md).toContain('Total rows: 2');
    expect(md).toContain('## By decision');
  });

  it('builds dry-run table with rule_fired column', () => {
    const md = buildDryrunTable(rows);
    expect(md).toContain('rule_fired');
    expect(md).toContain('R-K');
    expect(md).toContain('R-F2');
  });

  it('round-trips bulk decisions parse', () => {
    const md = buildBulkDecisions(rows);
    expect(md).toContain('Group 1');
    const filled = md.replace('Decision: ___', 'Decision: keep-all');
    const parsed = parseBulkDecisions(filled);
    expect(parsed[0].decision).toBe('keep-all');
  });

  it('round-trips individual flags parse', () => {
    const md = buildIndividualFlags(rows);
    expect(md).toContain('FLAG #001');
    const filled = md.replace('Your call: ___', 'Your call: keep');
    const parsed = parseIndividualFlags(filled);
    expect(parsed[0]).toEqual({ check_id: 'C002', decision: 'keep' });
  });

  it('builds rename map with at least one row', () => {
    const md = buildRenameMap();
    expect(md).toContain('| From | To |');
    expect(md).toContain('Local SEO');
  });
});
