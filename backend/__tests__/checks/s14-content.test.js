// backend/__tests__/checks/s14-content.test.js
import { describe, it, expect } from 'vitest';
import { runContentChecks } from '../../services/checks/s14-content.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Word Count': '500',
  'Last Modified': new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
  _bodyText: 'Main content here with enough words for testing purposes.',
  _bodyHash: 'abc123unique',
  ...overrides,
});

describe('runContentChecks', () => {
  it('passes for healthy content page', () => {
    expect(runContentChecks([page()], {})).toHaveLength(0);
  });
  it('flags word_count for < 300 words on indexable non-utility page', () => {
    const r = runContentChecks([page({ 'Word Count': '150' })], {});
    expect(r.some(x => x.check_id === 'word_count')).toBe(true);
  });
  it('flags thin_content for < 300 words on non-utility page', () => {
    const r = runContentChecks([page({ 'Word Count': '200' })], {});
    expect(r.some(x => x.check_id === 'thin_content')).toBe(true);
  });
  it('flags duplicate_content for identical body hash', () => {
    const pages = [
      page({ url: 'https://example.com/a', _bodyHash: 'duphash' }),
      page({ url: 'https://example.com/b', _bodyHash: 'duphash' }),
    ];
    const r = runContentChecks(pages, {});
    expect(r.some(x => x.check_id === 'duplicate_content')).toBe(true);
  });
  it('flags content_freshness for content > 12 months old', () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const r = runContentChecks([page({ 'Last Modified': oldDate })], {});
    expect(r.some(x => x.check_id === 'content_freshness')).toBe(true);
  });
});
