import { describe, it, expect } from 'vitest';
import { writeExtendedCanonicalCsv, COLUMNS } from '../src/output/canonical-csv.js';
import { buildRoadmapSummary } from '../src/output/summary-md.js';
import { buildBulkDecisions, parseBulkDecisions } from '../src/output/bulk-decisions-md.js';
import { buildIndividualFlags, parseIndividualFlags } from '../src/output/individual-md.js';
import { buildDryrunTable } from '../src/output/dryrun-md.js';

const fakeRows = [
  { check_id: 'C001', category: 'Title Tags', name: 'Title length', original_name: 'Title length', severity: 'critical', impl_status: 'missing', priority: 'P0', effort: 'M', roadmap_notes: 'R-BASE-CRITICAL (critical→P0); R-EFF-2-EXTRACTOR (missing/extractor-covered→M)' },
  { check_id: 'C002', category: 'Robots & Crawl Directives', name: 'Robots.txt Exists', original_name: 'Robots.txt Exists', severity: 'critical', impl_status: 'missing', priority: 'P0', effort: 'L', roadmap_notes: 'R-BASE-CRITICAL; R-EFF-3-NEW-INFRA' },
  { check_id: 'C003', category: 'Title Tags', name: 'Title length partial', original_name: 'Title length partial', severity: 'info', impl_status: 'partial', priority: 'P1', effort: 'S', roadmap_notes: 'R-PROMO-PARTIAL (partial+info→P1); R-EFF-1-PARTIAL (partial→S)' },
];

describe('output writers smoke', () => {
  it('extended canonical CSV has 26 columns', () => {
    expect(COLUMNS.length).toBe(26);
    const csv = writeExtendedCanonicalCsv(fakeRows);
    expect(csv.split('\n')[0]).toContain('priority');
    expect(csv.split('\n')[0]).toContain('effort');
    expect(csv.split('\n')[0]).toContain('roadmap_notes');
  });

  it('summary contains totals + by-priority + by-effort + crosstab + backlogs', () => {
    const md = buildRoadmapSummary(fakeRows);
    expect(md).toContain('Total in-scope: 3');
    expect(md).toContain('## By priority');
    expect(md).toContain('## By effort');
    expect(md).toContain('## Priority × category crosstab');
    expect(md).toContain('## P0 backlog');
    expect(md).toContain('## P1 backlog');
    expect(md).toContain('## P2 backlog');
  });

  it('bulk decisions group items by (priority × category)', () => {
    const md = buildBulkDecisions(fakeRows);
    expect(md).toContain('Group 1');
    // C001 + C003 are both Title Tags but different priorities → 2 separate groups
    expect(md).toMatch(/## Group \d+: P0 \/ Title Tags \(1 items\)/);
    expect(md).toMatch(/## Group \d+: P1 \/ Title Tags \(1 items\)/);
    expect(md).toMatch(/## Group \d+: P0 \/ Robots & Crawl Directives \(1 items\)/);
  });

  it('bulk decisions round-trip', () => {
    const md = buildBulkDecisions(fakeRows);
    const filled = md.replace(/Decision: ___/, 'Decision: reshape: P1');
    const parsed = parseBulkDecisions(filled);
    expect(parsed[0].decision).toBe('reshape: P1');
  });

  it('individual flags round-trip with priority + effort combined', () => {
    const md = buildIndividualFlags([fakeRows[1]]);  // C002 only
    expect(md).toContain('ROADMAP #001');
    const filled = md.replace('Your call: ___', 'Your call: P1 effort: XL');
    const parsed = parseIndividualFlags(filled);
    expect(parsed[0]).toMatchObject({ check_id: 'C002', priority: 'P1', effort: 'XL' });
  });

  it('individual flags round-trip with comment-only', () => {
    const md = buildIndividualFlags([fakeRows[0]]);
    const filled = md.replace('Your call: ___', 'Your call: comment: depends on robots fetcher');
    const parsed = parseIndividualFlags(filled);
    expect(parsed[0].comment).toBe('depends on robots fetcher');
    expect(parsed[0].priority).toBeUndefined();
    expect(parsed[0].effort).toBeUndefined();
  });

  it('dryrun table renders all priority + effort fields', () => {
    const md = buildDryrunTable(fakeRows);
    expect(md).toContain('| C001 |');
    expect(md).toContain('| C002 |');
    expect(md).toContain('| C003 |');
    expect(md).toContain('P0');
    expect(md).toContain('P1');
    expect(md).toContain('M');
    expect(md).toContain('L');
    expect(md).toContain('S');
  });
});
