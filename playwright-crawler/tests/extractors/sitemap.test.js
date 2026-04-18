/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { extractSitemap } from '../../src/extractors/sitemap.js';

const URLSET_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
  </url>
</urlset>`;

const INDEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-pages.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-posts.xml</loc>
  </sitemap>
</sitemapindex>`;

const CHILD_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/child1</loc><lastmod>2026-02-01</lastmod></url>
  <url><loc>https://example.com/child2</loc></url>
  <url><loc>https://example.com/child3</loc></url>
</urlset>`;

function makeFetch(responses) {
  return jest.fn((url) => {
    const entry = responses.find(r => url.includes(r.match));
    if (!entry) return Promise.resolve({ ok: false, status: 404, text: async () => '' });
    return Promise.resolve({
      ok:     entry.status >= 200 && entry.status < 400,
      status: entry.status,
      text:   async () => entry.body,
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('extractSitemap()', () => {
  it('parses a valid urlset sitemap', async () => {
    global.fetch = makeFetch([
      { match: '/sitemap.xml', status: 200, body: URLSET_XML },
    ]);

    const result = await extractSitemap('https://example.com');

    expect(result.sitemapExists).toBe(true);
    expect(result.isIndex).toBe(false);
    expect(result.totalUrlCount).toBe(2);
    expect(result.urlsWithLastmod).toBe(1);
    expect(result.oversized).toBe(false);
    expect(result.parseErrors).toEqual([]);
  });

  it('returns sitemapExists=false when sitemap returns 404', async () => {
    global.fetch = makeFetch([
      { match: '/sitemap.xml', status: 404, body: '' },
    ]);

    const result = await extractSitemap('https://example.com');

    expect(result.sitemapExists).toBe(false);
    expect(result.totalUrlCount).toBe(0);
  });

  it('handles sitemap index and fetches children', async () => {
    global.fetch = makeFetch([
      { match: 'sitemap.xml',        status: 200, body: INDEX_XML },
      { match: 'sitemap-pages.xml',  status: 200, body: CHILD_XML },
      { match: 'sitemap-posts.xml',  status: 200, body: CHILD_XML },
    ]);

    const result = await extractSitemap('https://example.com');

    expect(result.sitemapExists).toBe(true);
    expect(result.isIndex).toBe(true);
    expect(result.childSitemaps).toContain('https://example.com/sitemap-pages.xml');
    expect(result.totalUrlCount).toBe(6); // 3 from each child
    expect(result.urlsWithLastmod).toBe(2); // 1 per child with lastmod
  });

  it('uses provided sitemapUrls instead of default /sitemap.xml', async () => {
    global.fetch = makeFetch([
      { match: '/custom-sitemap.xml', status: 200, body: URLSET_XML },
    ]);

    const result = await extractSitemap('https://example.com', ['https://example.com/custom-sitemap.xml']);

    expect(result.sitemapUrl).toBe('https://example.com/custom-sitemap.xml');
    expect(result.sitemapExists).toBe(true);
    expect(result.totalUrlCount).toBe(2);
  });

  it('flags invalid (wrong-domain) URLs in sitemap', async () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://other-domain.com/page</loc></url>
      <url><loc>https://example.com/good</loc></url>
    </urlset>`;
    global.fetch = makeFetch([
      { match: '/sitemap.xml', status: 200, body: xml },
    ]);

    const result = await extractSitemap('https://example.com');

    expect(result.invalidUrls).toContain('https://other-domain.com/page');
    expect(result.invalidUrls).not.toContain('https://example.com/good');
  });
});
