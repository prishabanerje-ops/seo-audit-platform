import { describe, it, expect } from 'vitest';
import { loadSeed } from '../src/seed.js';

describe('loadSeed', () => {
  it('returns array with check_number 1..N and required fields', async () => {
    const seed = await loadSeed();
    expect(Array.isArray(seed)).toBe(true);
    expect(seed.length).toBeGreaterThan(280);
    expect(seed.length).toBeLessThan(310);
    const first = seed[0];
    expect(first.check_number).toBe(1);
    for (const key of ['name', 'category', 'severity_default', 'automation_type']) {
      expect(typeof first[key]).toBe('string');
    }
  });
});
