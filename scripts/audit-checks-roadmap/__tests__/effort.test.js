import { describe, it, expect } from 'vitest';
import { computeEffort } from '../src/rubric/effort.js';

describe('computeEffort', () => {
  it('R-EFF-1-PARTIAL: partial → S regardless of category', () => {
    const r = computeEffort({ impl_status: 'partial', category: 'Title Tags' });
    expect(r.effort).toBe('S');
    expect(r.rule).toBe('R-EFF-1-PARTIAL');
    expect(r.note).toContain('partial→S');
  });

  it('R-EFF-2-EXTRACTOR: missing in extractor-covered category → M', () => {
    const r = computeEffort({ impl_status: 'missing', category: 'Title Tags' });
    expect(r.effort).toBe('M');
    expect(r.rule).toBe('R-EFF-2-EXTRACTOR');
    expect(r.note).toContain('missing/extractor-covered→M');
  });

  it('R-EFF-3-NEW-INFRA: missing in needs-new-infra → L', () => {
    const r = computeEffort({ impl_status: 'missing', category: 'Robots & Crawl Directives' });
    expect(r.effort).toBe('L');
    expect(r.rule).toBe('R-EFF-3-NEW-INFRA');
    expect(r.note).toContain('missing/needs-new-infra→L');
  });

  it('R-EFF-4-EXTERNAL: missing in needs-external-integration → L', () => {
    const r = computeEffort({ impl_status: 'missing', category: 'Local SEO' });
    expect(r.effort).toBe('L');
    expect(r.rule).toBe('R-EFF-4-EXTERNAL');
    expect(r.note).toContain('missing/needs-external-integration→L');
  });

  it('falls back to L with EFFORT-FLAG when category is unknown', () => {
    const r = computeEffort({ impl_status: 'missing', category: 'Unknown Category' });
    expect(r.effort).toBe('L');
    expect(r.rule).toBe('R-EFF-DEFAULT');
    expect(r.note).toContain('EFFORT-FLAG: unknown category');
  });
});
