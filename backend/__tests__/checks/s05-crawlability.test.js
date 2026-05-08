// backend/__tests__/checks/s05-crawlability.test.js
import { describe, it, expect } from 'vitest';
import { runCrawlabilityChecks } from '../../services/checks/s05-crawlability.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Crawl Depth': '2',
  'Unique Inlinks': '5',
  'Unique Outlinks': '10',
  'Word Count': '500',
  'Meta Robots 1': '',
  'X-Robots-Tag 1': '',
  _url: { hasSessionId: false, isCrawlTrap: false },
  _internalLinks: [],
  ...overrides,
});

describe('runCrawlabilityChecks', () => {
  it('passes for healthy page', () => {
    expect(runCrawlabilityChecks([page()], {})).toHaveLength(0);
  });
  it('flags session_ids_in_urls for JSESSIONID', () => {
    const r = runCrawlabilityChecks([page({ url: 'https://example.com/page;JSESSIONID=abc123', _url: { hasSessionId: true, isCrawlTrap: false } })], {});
    expect(r.some(x => x.check_id === 'session_ids_in_urls')).toBe(true);
  });
  it('flags crawl_trap for repeating path segments', () => {
    const r = runCrawlabilityChecks([page({ _url: { hasSessionId: false, isCrawlTrap: true } })], {});
    expect(r.some(x => x.check_id === 'crawl_trap')).toBe(true);
  });
  it('flags orphan_pages for zero inlinks on indexable page', () => {
    const r = runCrawlabilityChecks([page({ 'Unique Inlinks': '0' })], {});
    expect(r.some(x => x.check_id === 'orphan_pages')).toBe(true);
  });
  it('flags crawl_depth for depth > 4', () => {
    const r = runCrawlabilityChecks([page({ 'Crawl Depth': '5' })], {});
    expect(r.some(x => x.check_id === 'crawl_depth')).toBe(true);
  });
});
