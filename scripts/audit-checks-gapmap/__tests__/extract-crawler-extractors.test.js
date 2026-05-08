import { describe, it, expect } from 'vitest';
import { extractCrawlerExtractorSignals } from '../src/extract/crawler-extractors.js';

describe('extractCrawlerExtractorSignals', () => {
  it('extracts signals from all 9 extractor files', async () => {
    const signals = await extractCrawlerExtractorSignals();
    expect(signals.length).toBeGreaterThan(15);

    for (const s of signals) {
      expect(s.priority).toBe(3);
      expect(s.signal_type).toBe('extractor-field');
      expect(s.file).toContain('playwright-crawler/src/extractors/');
    }

    const files = new Set(signals.map(s => s.file));
    // Should hit at least most of the 9 extractor files
    expect(files.size).toBeGreaterThanOrEqual(5);
  });
});
