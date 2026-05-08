import { describe, it, expect } from 'vitest';
import { extractParserSignals } from '../src/extract/parser.js';

describe('extractParserSignals', () => {
  it('extracts issueType strings + section + severity', async () => {
    const signals = await extractParserSignals();
    // The parser emits exactly 30 issue types as confirmed in Phase 1 exploration
    expect(signals.length).toBeGreaterThanOrEqual(28);
    expect(signals.length).toBeLessThanOrEqual(35);

    // Every signal has the expected shape
    for (const s of signals) {
      expect(s.priority).toBe(1);
      expect(s.signal_type).toBe('issue-emitter');
      expect(s.file).toContain('audit-parser.service.js');
      expect(typeof s.line).toBe('number');
      expect(typeof s.name).toBe('string');
    }

    // Some specific issue types are known to be present
    const names = signals.map(s => s.name);
    expect(names).toContain('Missing Title Tag');
    expect(names).toContain('Title Too Long (over 60 chars)');
    expect(names).toContain('H1 Missing');
    expect(names).toContain('Redirect Loops');
  });

  it('attaches metadata.severity and metadata.section when present near the issueType', () => {
    // Smoke: at least some signals carry severity/section
    return extractParserSignals().then(signals => {
      const withSev = signals.filter(s => s.metadata?.severity);
      const withSection = signals.filter(s => s.metadata?.section);
      expect(withSev.length).toBeGreaterThan(20);
      expect(withSection.length).toBeGreaterThan(20);
    });
  });
});
