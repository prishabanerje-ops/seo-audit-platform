// backend/__tests__/checks/s12-meta.test.js
import { describe, it, expect } from 'vitest';
import { runMetaDescChecks } from '../../services/checks/s12-meta.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Meta Description 1': 'Compare car insurance plans. Get the best rates and save on your premium today.',
  'Meta Description 1 Length': '80',
  ...overrides,
});

describe('runMetaDescChecks', () => {
  it('passes for valid meta description', () => {
    expect(runMetaDescChecks([page()], {})).toHaveLength(0);
  });
  it('flags meta_desc_present when missing', () => {
    const r = runMetaDescChecks([page({ 'Meta Description 1': '' })], {});
    expect(r.some(x => x.check_id === 'meta_desc_present')).toBe(true);
  });
  it('flags meta_desc_unique for duplicates', () => {
    const pages = [page({ url: 'https://example.com/a' }), page({ url: 'https://example.com/b' })];
    const r = runMetaDescChecks(pages, {});
    expect(r.some(x => x.check_id === 'meta_desc_unique')).toBe(true);
  });
  it('flags meta_desc_length when < 120 chars', () => {
    const r = runMetaDescChecks([page({ 'Meta Description 1': 'Too short', 'Meta Description 1 Length': '9' })], {});
    expect(r.some(x => x.check_id === 'meta_desc_length')).toBe(true);
  });
  it('flags meta_desc_cta when no action verb in first 15 words', () => {
    const r = runMetaDescChecks([page({ 'Meta Description 1': 'A'.repeat(140) })], {});
    expect(r.some(x => x.check_id === 'meta_desc_cta')).toBe(true);
  });
});
