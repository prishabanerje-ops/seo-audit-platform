import { describe, it, expect } from 'vitest';
import { allocateIds } from '../src/id.js';

describe('allocateIds', () => {
  it('assigns C001..Cnnn padded to 3 digits', () => {
    const rows = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    const out = allocateIds(rows);
    expect(out[0].check_id).toBe('C001');
    expect(out[1].check_id).toBe('C002');
    expect(out[2].check_id).toBe('C003');
  });

  it('preserves input order (stable sort by source priority is caller-driven)', () => {
    const rows = [{ name: 'first' }, { name: 'second' }];
    expect(allocateIds(rows).map(r => r.name)).toEqual(['first', 'second']);
  });

  it('does not overwrite existing check_id', () => {
    const rows = [{ name: 'a', check_id: 'C999' }, { name: 'b' }];
    const out = allocateIds(rows);
    expect(out[0].check_id).toBe('C999');
    expect(out[1].check_id).toBe('C001');
  });
});
