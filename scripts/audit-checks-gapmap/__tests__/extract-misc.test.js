import { describe, it, expect } from 'vitest';
import { extractMiscSignals } from '../src/extract/misc.js';

describe('extractMiscSignals', () => {
  it('extracts signals from crawler.js, crawl-runner.js, reports.js', async () => {
    const signals = await extractMiscSignals();
    // These files may have few clean signals — assert a non-empty result
    expect(signals.length).toBeGreaterThan(0);

    for (const s of signals) {
      expect(s.priority).toBe(4);
      expect(s.file).toMatch(/(crawler\.js|crawl-runner\.js|reports\.js)/);
    }
  });
});
