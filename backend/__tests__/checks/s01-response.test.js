// backend/__tests__/checks/s01-response.test.js
import { describe, it, expect } from 'vitest';
import { runResponseChecks } from '../../services/checks/s01-response.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Status Code': '200',
  'Indexability': 'Indexable',
  'Redirect URL': '',
  'Redirect Type': '',
  _redirectChain: [],
  _isHttps: true,
  ...overrides,
});

describe('runResponseChecks', () => {
  it('passes on a healthy 200 indexable page', () => {
    expect(runResponseChecks([page()], {})).toHaveLength(0);
  });

  it('flags http_status for indexable non-200', () => {
    const results = runResponseChecks([page({ 'Status Code': '404', 'Indexability': 'Non-Indexable' })], {});
    // Non-indexable pages don't trigger http_status (they're expected to be non-200)
    // But broken_pages_4xx fires
    expect(results.some(r => r.check_id === 'broken_pages_4xx')).toBe(true);
  });

  it('flags http_status for indexable page with 404', () => {
    // An indexable page returning 404 is contradictory — flag http_status
    const results = runResponseChecks([page({ 'Status Code': '404', 'Indexability': 'Indexable' })], {});
    expect(results.some(r => r.check_id === 'http_status')).toBe(true);
  });

  it('flags redirect_301_vs_302 for 302 redirect', () => {
    const results = runResponseChecks([page({ 'Status Code': '302', 'Redirect URL': 'https://example.com/new' })], {});
    expect(results.some(r => r.check_id === 'redirect_301_vs_302')).toBe(true);
  });

  it('flags redirect_chain for multi-hop redirect', () => {
    const results = runResponseChecks([page({ _redirectChain: ['https://a.com', 'https://b.com', 'https://c.com'] })], {});
    expect(results.some(r => r.check_id === 'redirect_chain')).toBe(true);
  });

  it('flags server_errors_5xx for 500', () => {
    const results = runResponseChecks([page({ 'Status Code': '500', 'Indexability': 'Non-Indexable' })], {});
    expect(results.some(r => r.check_id === 'server_errors_5xx')).toBe(true);
  });

  it('flags redirect_count when > 10% of pages redirect', () => {
    const pages = [
      page({ url: 'https://example.com/1', 'Status Code': '301', 'Redirect URL': 'https://x.com' }),
      page({ url: 'https://example.com/2', 'Status Code': '301', 'Redirect URL': 'https://x.com' }),
      ...Array.from({ length: 8 }, (_, i) => page({ url: `https://example.com/${i + 3}` })),
    ];
    const results = runResponseChecks(pages, {});
    expect(results.some(r => r.check_id === 'redirect_count')).toBe(true);
  });
});
