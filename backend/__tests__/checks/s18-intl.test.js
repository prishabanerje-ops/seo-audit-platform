// backend/__tests__/checks/s18-intl.test.js
import { describe, it, expect } from 'vitest';
import { runIntlChecks } from '../../services/checks/s18-intl.js';

const page = (overrides) => ({
  url: 'https://example.com/en/page',
  'Indexability': 'Indexable',
  _hreflangTags: [
    { lang: 'en', href: 'https://example.com/en/page' },
    { lang: 'x-default', href: 'https://example.com/en/page' },
  ],
  _bodyText: 'This is content about insurance plans available in the United Kingdom.',
  'Word Count': '300',
  ...overrides,
});

describe('runIntlChecks', () => {
  it('passes for valid hreflang setup', () => {
    expect(runIntlChecks([page()], {})).toHaveLength(0);
  });
  it('flags hreflang_self_ref when page URL not in hreflang set', () => {
    const r = runIntlChecks([page({ _hreflangTags: [{ lang: 'en', href: 'https://other.com/page' }] })], {});
    expect(r.some(x => x.check_id === 'hreflang_self_ref')).toBe(true);
  });
  it('flags hreflang_x_default when missing', () => {
    const r = runIntlChecks([page({ _hreflangTags: [{ lang: 'en', href: 'https://example.com/en/page' }] })], {});
    expect(r.some(x => x.check_id === 'hreflang_x_default')).toBe(true);
  });
  it('flags hreflang_lang_valid for invalid language code', () => {
    const r = runIntlChecks([page({ _hreflangTags: [{ lang: 'english', href: 'https://example.com/en/page' }] })], {});
    expect(r.some(x => x.check_id === 'hreflang_lang_valid')).toBe(true);
  });
});
