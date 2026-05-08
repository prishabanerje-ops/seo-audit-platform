// backend/__tests__/checks/s04-sitemap.test.js
import { describe, it, expect } from 'vitest';
import { runSitemapChecks } from '../../services/checks/s04-sitemap.js';

const makePages = (sitemapOverrides = {}) => [{
  url: 'https://example.com/',
  'Indexability': 'Indexable',
  _siteData: {
    robots: { exists: true, sitemapUrls: ['https://example.com/sitemap.xml'], disallowedPaths: [] },
    sitemap: {
      found: true,
      url: 'https://example.com/sitemap.xml',
      isIndex: false,
      childSitemaps: [],
      urls: [{ loc: 'https://example.com/', lastmod: new Date().toISOString(), images: [], videos: [], news: null }],
      fileSizeBytes: 1000,
      parseErrors: [],
      ...sitemapOverrides,
    },
  },
}];

describe('runSitemapChecks', () => {
  it('passes with valid sitemap', () => {
    expect(runSitemapChecks(makePages(), {})).toHaveLength(0);
  });

  it('flags sitemap_exists when not found', () => {
    const r = runSitemapChecks(makePages({ found: false }), {});
    expect(r.some(x => x.check_id === 'sitemap_exists')).toBe(true);
  });

  it('flags sitemap_valid_xml when parse errors present', () => {
    const r = runSitemapChecks(makePages({ parseErrors: ['unexpected token'] }), {});
    expect(r.some(x => x.check_id === 'sitemap_valid_xml')).toBe(true);
  });

  it('flags sitemap_url_count when > 50000 URLs', () => {
    const urls = Array.from({ length: 50001 }, (_, i) => ({ loc: `https://example.com/${i}`, lastmod: null, images: [], videos: [], news: null }));
    const r = runSitemapChecks(makePages({ urls }), {});
    expect(r.some(x => x.check_id === 'sitemap_url_count')).toBe(true);
  });
});
