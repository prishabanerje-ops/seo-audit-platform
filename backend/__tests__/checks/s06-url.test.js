// backend/__tests__/checks/s06-url.test.js
import { describe, it, expect } from 'vitest';
import { runUrlChecks } from '../../services/checks/s06-url.js';

const page = (url, urlData = {}) => ({
  url,
  'Indexability': 'Indexable',
  _url: { urlLength: url.length, isLowercase: url === url.toLowerCase(), ...urlData },
  _internalLinks: [],
});

describe('runUrlChecks', () => {
  it('passes for clean short URL', () => {
    expect(runUrlChecks([page('https://example.com/car-insurance')], {})).toHaveLength(0);
  });
  it('flags url_length for URL > 100 chars', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(100);
    const r = runUrlChecks([page(longUrl, { urlLength: longUrl.length })], {});
    expect(r.some(x => x.check_id === 'url_length')).toBe(true);
  });
  it('flags url_lowercase for mixed case path', () => {
    const r = runUrlChecks([page('https://example.com/CarInsurance', { isLowercase: false })], {});
    expect(r.some(x => x.check_id === 'url_lowercase')).toBe(true);
  });
  it('flags url_hyphens for underscore separators', () => {
    const r = runUrlChecks([page('https://example.com/car_insurance', { hasHyphens: false })], {});
    expect(r.some(x => x.check_id === 'url_hyphens')).toBe(true);
  });
  it('flags url_deep_nesting for > 4 directory levels', () => {
    const r = runUrlChecks([page('https://example.com/a/b/c/d/e/page', { dirDepth: 5 })], {});
    expect(r.some(x => x.check_id === 'url_deep_nesting')).toBe(true);
  });
});
