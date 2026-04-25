import { describe, it, expect } from 'vitest';
import { reclassify } from '../src/rules/reclassify.js';

describe('R-R1 manual → hybrid for crawler-detectable signals', () => {
  it('reclassifies CSV manual rows whose name matches a crawler-detectable signal', () => {
    const row = { name: 'Privacy Policy Present', automation_type: 'manual' };
    expect(reclassify(row).automation_type).toBe('hybrid');
  });
});

describe('R-R2 GSC/GA4 dependency note', () => {
  it('keeps automated but adds notes for GSC-dependent checks', () => {
    const row = { name: 'Search Console Coverage Errors', automation_type: 'automated' };
    const out = reclassify(row);
    expect(out.automation_type).toBe('automated');
    expect(out.notes).toMatch(/GSC/);
  });
});

describe('R-R3 genuinely human-only stays manual', () => {
  it('does not reclassify rows with no crawler-detectable signal', () => {
    const row = { name: 'Brand Voice Sentiment Review', automation_type: 'manual' };
    expect(reclassify(row).automation_type).toBe('manual');
  });
});
