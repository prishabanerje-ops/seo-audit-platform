import { describe, it, expect } from 'vitest';
import { writeExtendedCanonicalCsv, COLUMNS } from '../src/output/canonical-csv.js';
import { buildGapmapSummary } from '../src/output/summary-md.js';
import { buildSignalIndexMarkdown } from '../src/output/signal-index-md.js';
import { buildBulkDecisions, parseBulkDecisions } from '../src/output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from '../src/output/individual-md.js';
import { buildDryrunTable } from '../src/output/dryrun-md.js';

const fakeRows = [
  { check_id: 'C001', category: 'Title Tags', name: 'Title length', original_name: 'Title length', severity: 'warning', automation_type: 'automated', impl_status: 'implemented', gap_notes: 'G-IMPL-1: P1 score 0.80', impl_evidence: "issueType: 'Title Too Long'", impl_location: 'backend/services/audit-parser.service.js:152' },
  { check_id: 'C002', category: 'Schema', name: 'Schema check', original_name: 'Schema check', severity: 'critical', automation_type: 'automated', impl_status: 'flag', gap_notes: 'G-FLAG: cross-type ambiguity', impl_evidence: "issueType: 'Schema X'", impl_location: 'backend/services/audit-parser.service.js:300' },
];

const fakeSignals = [
  { signal_id: 'P1-S001', name: 'Title Too Long', signal_type: 'issue-emitter', priority: 1, file: 'backend/services/audit-parser.service.js', line: 152 },
  { signal_id: 'P3-S001', name: 'h1Count', signal_type: 'extractor-field', priority: 3, file: 'playwright-crawler/src/extractors/headings.js', line: 5 },
];

describe('output writers smoke', () => {
  it('extended canonical CSV has 23 columns', async () => {
    expect(COLUMNS.length).toBe(23);
    const csv = await writeExtendedCanonicalCsv(fakeRows);
    expect(csv.split('\n')[0]).toContain('impl_status');
    expect(csv.split('\n')[0]).toContain('gap_notes');
  });

  it('summary contains totals + by-status + by-category', () => {
    const md = buildGapmapSummary(fakeRows);
    expect(md).toContain('Total in-scope rows: 2');
    expect(md).toContain('## By impl_status');
    expect(md).toContain('## By category');
  });

  it('signal index markdown includes priority sections', () => {
    const md = buildSignalIndexMarkdown(fakeSignals);
    expect(md).toContain('Total signals extracted: **2**');
    expect(md).toContain('Priority 1');
    expect(md).toContain('Priority 3');
  });

  it('bulk decisions round-trip', () => {
    const md = buildBulkDecisions(fakeRows);
    expect(md).toContain('Group 1');
    const filled = md.replace('Decision: ___', 'Decision: accept-missing');
    const parsed = parseBulkDecisions(filled);
    expect(parsed[0].decision).toBe('accept-missing');
  });

  it('individual flags round-trip', () => {
    const md = buildIndividualFlags(fakeRows);
    expect(md).toContain('FLAG #001');
    const filled = md.replace('Your call: ___', 'Your call: missing');
    const parsed = parseIndividualFlags(filled);
    expect(parsed[0]).toEqual({ check_id: 'C002', decision: 'missing' });
  });

  it('dryrun table renders all status types', () => {
    const md = buildDryrunTable(fakeRows);
    expect(md).toContain('| C001 |');
    expect(md).toContain('| C002 |');
    expect(md).toContain('implemented');
    expect(md).toContain('flag');
  });
});
