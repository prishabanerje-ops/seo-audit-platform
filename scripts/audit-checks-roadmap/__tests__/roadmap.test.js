import { describe, it, expect } from 'vitest';
import { runRoadmap, annotateRow } from '../src/roadmap.js';

describe('annotateRow', () => {
  it('annotates a row with priority + effort + roadmap_notes', () => {
    const row = {
      check_id: 'C1',
      category: 'Title Tags',
      severity: 'critical',
      impl_status: 'missing',
    };
    const out = annotateRow(row);
    expect(out.priority).toBe('P0');
    expect(out.effort).toBe('M');
    expect(out.roadmap_notes).toContain('R-BASE-CRITICAL');
    expect(out.roadmap_notes).toContain('R-EFF-2-EXTRACTOR');
    expect(out.roadmap_notes).toContain(';');
  });

  it('annotates a partial in needs-new-infra: P0 (warning promo) + S', () => {
    const row = {
      check_id: 'C2',
      category: 'Robots & Crawl Directives',
      severity: 'warning',
      impl_status: 'partial',
    };
    const out = annotateRow(row);
    expect(out.priority).toBe('P0');
    expect(out.effort).toBe('S');
    expect(out.roadmap_notes).toContain('R-PROMO-PARTIAL');
    expect(out.roadmap_notes).toContain('R-EFF-1-PARTIAL');
  });

  it('preserves all original row fields', () => {
    const row = {
      check_id: 'C1', category: 'Title Tags', severity: 'critical',
      impl_status: 'missing', name: 'Foo', custom: 'bar',
    };
    const out = annotateRow(row);
    expect(out.check_id).toBe('C1');
    expect(out.name).toBe('Foo');
    expect(out.custom).toBe('bar');
  });
});

describe('runRoadmap', () => {
  it('returns annotated in-scope rows from canonical', async () => {
    const result = await runRoadmap();
    expect(result.rows.length).toBeGreaterThan(155);
    expect(result.rows.length).toBeLessThan(175);

    for (const r of result.rows) {
      expect(['P0', 'P1', 'P2']).toContain(r.priority);
      expect(['S', 'M', 'L', 'XL']).toContain(r.effort);
      expect(r.roadmap_notes).toBeTruthy();
    }
  });

  it('limits to first N rows when limit option provided (for dry-run)', async () => {
    const result = await runRoadmap({ limit: 25 });
    expect(result.rows.length).toBe(25);
  });
});
