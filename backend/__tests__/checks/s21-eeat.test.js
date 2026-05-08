// backend/__tests__/checks/s21-eeat.test.js
import { describe, it, expect } from 'vitest';
import { runEeatChecks } from '../../services/checks/s21-eeat.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Word Count': '400',
  _bodyText: 'By John Smith. This article explains insurance options. We are licensed by IRDAI Reg. No. 101. Last updated January 2026.',
  _internalLinks: [{ href: 'https://example.com/contact', text: 'Contact' }],
  _schemaTypes: ['Article'],
  _schemaItems: [],
  _authorSignal: true,
  ...overrides,
});

describe('runEeatChecks', () => {
  it('passes for page with good E-E-A-T signals', () => {
    expect(runEeatChecks([page()], {})).toHaveLength(0);
  });
  it('flags author_expertise on YMYL page without author signal', () => {
    const r = runEeatChecks([page({ url: 'https://example.com/insurance/car', _authorSignal: false })], {});
    expect(r.some(x => x.check_id === 'author_expertise')).toBe(true);
  });
  it('flags contact_page_present when no contact link found', () => {
    const r = runEeatChecks([page({ _internalLinks: [] })], {});
    expect(r.some(x => x.check_id === 'contact_page_present')).toBe(true);
  });
  it('flags ymyl_disclaimer_present when YMYL page lacks disclaimer', () => {
    const r = runEeatChecks([page({ url: 'https://example.com/insurance/car', _bodyText: 'Some insurance content without any disclaimer. premium and policy coverage claim.' })], {});
    expect(r.some(x => x.check_id === 'ymyl_disclaimer_present')).toBe(true);
  });
});
