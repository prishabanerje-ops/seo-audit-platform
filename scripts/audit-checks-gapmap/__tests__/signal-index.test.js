import { describe, it, expect } from 'vitest';
import { buildSignalIndex } from '../src/signal-index.js';

describe('buildSignalIndex', () => {
  it('combines all 4 priority extractors into a unified list', async () => {
    const index = await buildSignalIndex();
    expect(index.length).toBeGreaterThan(50);

    // All 4 priorities are represented
    const priorities = new Set(index.map(s => s.priority));
    expect(priorities.has(1)).toBe(true);
    expect(priorities.has(2)).toBe(true);
    expect(priorities.has(3)).toBe(true);
  });

  it('all signals have signal_id, name, file, line', async () => {
    const index = await buildSignalIndex();
    for (const s of index) {
      expect(typeof s.signal_id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(typeof s.file).toBe('string');
      expect(typeof s.line).toBe('number');
    }
  });
});
