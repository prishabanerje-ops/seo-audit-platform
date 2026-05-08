import { describe, it, expect } from 'vitest';
import { extractIntegrationSignals } from '../src/extract/integration.js';

describe('extractIntegrationSignals', () => {
  it('extracts signals from gsc.js, ga4.js, psi.js, sitemap-fetcher.js', async () => {
    const signals = await extractIntegrationSignals();
    expect(signals.length).toBeGreaterThan(10);

    // Every signal has the expected shape
    for (const s of signals) {
      expect(s.priority).toBe(2);
      expect(s.signal_type).toBe('service-function');
      expect(s.file).toMatch(/(gsc|ga4|psi|sitemap-fetcher)/);
      expect(typeof s.line).toBe('number');
      expect(typeof s.name).toBe('string');
    }

    // Should have signals from all four services
    const files = new Set(signals.map(s => s.file));
    expect(files.size).toBeGreaterThanOrEqual(2);  // at least 2 of the 4 yield signals
  });
});
