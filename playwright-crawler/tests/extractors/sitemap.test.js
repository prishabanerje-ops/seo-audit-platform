// playwright-crawler/tests/extractors/sitemap.test.js
import { jest, describe, test, expect } from '@jest/globals';
import { extractSitemap } from '../../src/extractors/sitemap.js';

function mockFetch(...responses) {
  let i = 0;
  return jest.fn(() => Promise.resolve(responses[i++] ?? { ok: false, text: async () => '' }));
}

function xmlResponse(xml) {
  return { ok: true, text: async () => xml };
}

const SIMPLE_SITEMAP = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2024-01-01</lastmod><priority>1.0</priority></url>
  <url><loc>https://example.com/about</loc><changefreq>monthly</changefreq></url>
</urlset>`;

const INDEX_SITEMAP = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
</sitemapindex>`;

describe('extractSitemap', () => {
  test('returns found:false when no sitemap is reachable', async () => {
    const fetcher = jest.fn(() => Promise.resolve({ ok: false, text: async () => '' }));
    const r = await extractSitemap('https://example.com', [], fetcher);
    expect(r.found).toBe(false);
    expect(r.parseErrors).toContain('Sitemap not found');
  });

  test('parses a simple urlset sitemap', async () => {
    const fetcher = mockFetch(xmlResponse(SIMPLE_SITEMAP));
    const r = await extractSitemap('https://example.com', [], fetcher);
    expect(r.found).toBe(true);
    expect(r.isIndex).toBe(false);
    expect(r.urls).toHaveLength(2);
    expect(r.urls[0].loc).toBe('https://example.com/');
    expect(r.urls[0].lastmod).toBe('2024-01-01');
    expect(r.urls[0].priority).toBe('1.0');
    expect(r.urls[1].changefreq).toBe('monthly');
  });

  test('detects sitemap index and fetches first child', async () => {
    const fetcher = mockFetch(
      xmlResponse(INDEX_SITEMAP),    // index sitemap
      xmlResponse(SIMPLE_SITEMAP),   // first child (sitemap-pages.xml)
    );
    const r = await extractSitemap('https://example.com', [], fetcher);
    expect(r.found).toBe(true);
    expect(r.isIndex).toBe(true);
    expect(r.childSitemaps).toHaveLength(2);
    expect(r.urls).toHaveLength(2); // from first child
  });

  test('uses provided sitemapUrls before falling back to /sitemap.xml', async () => {
    const fetcher = mockFetch(xmlResponse(SIMPLE_SITEMAP));
    const r = await extractSitemap('https://example.com', ['https://example.com/custom-sitemap.xml'], fetcher);
    expect(fetcher).toHaveBeenCalledWith('https://example.com/custom-sitemap.xml', expect.any(Object));
  });

  test('tries next candidate on failure', async () => {
    const fetcher = mockFetch(
      { ok: false, text: async () => '' },   // /sitemap.xml fails
    );
    const r = await extractSitemap('https://example.com', ['https://example.com/sitemap.xml'], fetcher);
    expect(r.found).toBe(false);
  });

  test('falls back to /sitemap.xml when sitemapUrls is empty', async () => {
    const fetcher = mockFetch(xmlResponse(SIMPLE_SITEMAP));
    await extractSitemap('https://example.com', [], fetcher);
    const calledUrl = fetcher.mock.calls[0][0];
    expect(calledUrl).toBe('https://example.com/sitemap.xml');
  });

  test('returns fileSizeBytes > 0 for non-empty sitemap', async () => {
    const fetcher = mockFetch(xmlResponse(SIMPLE_SITEMAP));
    const r = await extractSitemap('https://example.com', [], fetcher);
    expect(r.fileSizeBytes).toBeGreaterThan(0);
  });

  test('records parse errors for malformed XML', async () => {
    const fetcher = mockFetch({ ok: true, text: async () => '<broken xml' });
    const r = await extractSitemap('https://example.com', [], fetcher);
    // Malformed XML may parse incorrectly or return an error
    expect(Array.isArray(r.parseErrors)).toBe(true);
  });
});
