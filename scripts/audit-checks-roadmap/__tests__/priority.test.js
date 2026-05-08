import { describe, it, expect } from 'vitest';
import { computePriority } from '../src/rubric/priority.js';

describe('computePriority', () => {
  it('R-BASE-CRITICAL: missing+critical → P0', () => {
    const r = computePriority({ severity: 'critical', impl_status: 'missing' });
    expect(r.priority).toBe('P0');
    expect(r.rule).toBe('R-BASE-CRITICAL');
    expect(r.note).toContain('critical→P0');
  });

  it('R-BASE-WARNING: missing+warning → P1', () => {
    const r = computePriority({ severity: 'warning', impl_status: 'missing' });
    expect(r.priority).toBe('P1');
    expect(r.rule).toBe('R-BASE-WARNING');
  });

  it('R-BASE-INFO: missing+info → P2', () => {
    const r = computePriority({ severity: 'info', impl_status: 'missing' });
    expect(r.priority).toBe('P2');
    expect(r.rule).toBe('R-BASE-INFO');
  });

  it('R-PROMO-PARTIAL: partial+critical → P0 (no change)', () => {
    const r = computePriority({ severity: 'critical', impl_status: 'partial' });
    expect(r.priority).toBe('P0');
    expect(r.rule).toBe('R-PROMO-PARTIAL');
    expect(r.note).toContain('partial+critical→P0');
  });

  it('R-PROMO-PARTIAL: partial+warning → P0', () => {
    const r = computePriority({ severity: 'warning', impl_status: 'partial' });
    expect(r.priority).toBe('P0');
    expect(r.rule).toBe('R-PROMO-PARTIAL');
    expect(r.note).toContain('partial+warning→P0');
  });

  it('R-PROMO-PARTIAL: partial+info → P1', () => {
    const r = computePriority({ severity: 'info', impl_status: 'partial' });
    expect(r.priority).toBe('P1');
    expect(r.rule).toBe('R-PROMO-PARTIAL');
    expect(r.note).toContain('partial+info→P1');
  });

  it('R-BASE-DEFAULT: empty severity → P2 + flag', () => {
    const r = computePriority({ severity: '', impl_status: 'missing' });
    expect(r.priority).toBe('P2');
    expect(r.rule).toBe('R-BASE-DEFAULT');
    expect(r.note).toContain('PRIORITY-FLAG: empty severity');
  });

  it('R-BASE-DEFAULT: unknown severity → P2 + flag', () => {
    const r = computePriority({ severity: 'something-weird', impl_status: 'missing' });
    expect(r.priority).toBe('P2');
    expect(r.rule).toBe('R-BASE-DEFAULT');
  });
});
