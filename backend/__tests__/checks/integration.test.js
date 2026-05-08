// backend/__tests__/checks/integration.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB to avoid needing a real database in tests
vi.mock('../../db/sqlite.js', () => ({
  default: {
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      run: vi.fn(),
    })),
    transaction: vi.fn((fn) => fn),
  },
}));

import { parseAndStoreResults, classifyYmyl } from '../../services/audit-parser.service.js';

const makePage = (overrides) => ({
  url: 'https://example.com/page',
  'Status Code': '200',
  'Status': 'OK',
  'Content Type': 'text/html',
  'Indexability': 'Indexable',
  'Title 1': 'Car Insurance Plans | Compare & Save',
  'Title 1 Length': '42',
  'Meta Description 1': 'Compare the best car insurance plans. Get quotes instantly and save up to 40% on your premium today with our free comparison tool.',
  'Meta Description 1 Length': '130',
  'H1-1': 'Compare Car Insurance Plans',
  'H1 Occurrences': '1',
  'H2-1': 'Why Compare With Us',
  'H2 Occurrences': '4',
  'Word Count': '800',
  'Crawl Depth': '2',
  'Unique Inlinks': '5',
  'Unique Outlinks': '15',
  'Canonical Link Element 1': 'https://example.com/page',
  'Meta Robots 1': '',
  'X-Robots-Tag 1': '',
  'Response Time': '350',
  'Last Modified': new Date().toISOString(),
  _redirectChain: [],
  _isHttps: true,
  _hsts: 'max-age=31536000; includeSubDomains',
  _csp: "default-src 'self'",
  _xFrameOptions: 'DENY',
  _xContentTypeOptions: 'nosniff',
  _referrerPolicy: 'strict-origin-when-cross-origin',
  _permissionsPolicy: 'camera=(), microphone=()',
  _images: [],
  _schemaItems: [{ Type: 'WebPage', Property: '@type', Content: 'WebPage' }],
  _schemaTypes: ['WebPage'],
  _schemaValid: true,
  _hasJsonLd: true,
  _internalLinks: [],
  _hreflangTags: [],
  _bodyText: 'Compare car insurance plans. Find the best rates.',
  _bodyHash: 'unique-hash-123',
  _siteData: {
    robots: { exists: true, raw: 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml', sitemapUrls: ['https://example.com/sitemap.xml'], disallowedPaths: ['/admin'], agentRules: {}, parseErrors: [], llmsTxt: '# Example Site\n\nSEO platform.\n\n- [Home](/): Homepage' },
    sitemap: { found: true, url: 'https://example.com/sitemap.xml', urls: [], fileSizeBytes: 1000, parseErrors: [], isIndex: false, childSitemaps: [] },
  },
  ...overrides,
});

describe('parseAndStoreResults (integration)', () => {
  it('runs without error on a well-formed page set', async () => {
    const pages = [makePage()];
    // Should not throw
    await expect(parseAndStoreResults(pages, 1, 1, null)).resolves.toBeTypeOf('number');
  });

  it('returns a number (failure count)', async () => {
    const count = await parseAndStoreResults([makePage()], 1, 1, null);
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('detects failures on a bad page', async () => {
    const count = await parseAndStoreResults([makePage({
      'Title 1': '',
      'H1-1': '',
      'H1 Occurrences': '0',
      _isHttps: false,
      url: 'http://example.com/page',
    })], 1, 1, null);
    expect(count).toBeGreaterThan(0);
  });
});
