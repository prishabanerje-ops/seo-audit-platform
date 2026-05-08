// playwright-crawler/tests/extractors/robots.test.js
import { jest, describe, test, expect } from '@jest/globals';
import { extractRobots, probeUrlMdSample } from '../../src/extractors/robots.js';

// Helper to build a mock fetch function from a list of responses in call order.
function mockFetch(...responses) {
  let i = 0;
  return jest.fn(() => Promise.resolve(responses[i++] ?? { ok: false, text: async () => '', headers: { get: () => null } }));
}

function okResponse(text, contentType = 'text/plain') {
  return { ok: true, text: async () => text, headers: { get: (k) => k === 'content-type' ? contentType : null } };
}

function notFound() {
  return { ok: false, text: async () => '', headers: { get: () => null } };
}

describe('extractRobots', () => {
  test('exists is false when robots.txt returns 404', async () => {
    const fetcher = mockFetch(notFound(), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.exists).toBe(false);
    expect(r.raw).toBe('');
    expect(r.sitemapUrls).toEqual([]);
    expect(r.disallowedPaths).toEqual([]);
  });

  test('parses sitemap URLs from robots.txt', async () => {
    const body = 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml\nSitemap: https://example.com/news-sitemap.xml';
    const fetcher = mockFetch(okResponse(body), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.exists).toBe(true);
    expect(r.sitemapUrls).toEqual(['https://example.com/sitemap.xml', 'https://example.com/news-sitemap.xml']);
  });

  test('parses disallowed paths for wildcard user-agent', async () => {
    const body = 'User-agent: *\nDisallow: /admin\nDisallow: /private\n\nUser-agent: Googlebot\nDisallow: /test';
    const fetcher = mockFetch(okResponse(body), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.disallowedPaths).toContain('/admin');
    expect(r.disallowedPaths).toContain('/private');
    expect(r.disallowedPaths).not.toContain('/test'); // belongs to Googlebot, not wildcard
  });

  test('fetches llmsTxt when /llms.txt returns 200', async () => {
    const fetcher = mockFetch(
      okResponse('User-agent: *\n'),  // robots.txt
      okResponse('# LLMs.txt\n## About\nAI training site.\n'),  // llms.txt
      notFound(),  // llms-full.txt
    );
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.llmsTxt).toContain('AI training site');
    expect(r.llmsFullTxt).toBeNull();
  });

  test('fetches both llmsTxt and llmsFullTxt', async () => {
    const fetcher = mockFetch(
      okResponse('User-agent: *\n'),
      okResponse('short llms'),
      okResponse('full llms content'),
    );
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.llmsTxt).toBe('short llms');
    expect(r.llmsFullTxt).toBe('full llms content');
  });

  test('agentRules marks GPTBot as blocked when disallowed', async () => {
    const body = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /';
    const fetcher = mockFetch(okResponse(body), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.agentRules['GPTBot'].allowed).toBe(false);
  });

  test('urlMdSample starts empty (filled post-crawl)', async () => {
    const fetcher = mockFetch(notFound(), notFound(), notFound());
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.urlMdSample).toEqual({ tested: [], found: [], hasAny: false });
  });

  test('does not throw when fetch rejects (network error)', async () => {
    const fetcher = jest.fn(() => Promise.reject(new Error('network error')));
    const r = await extractRobots('https://example.com', fetcher);
    expect(r.exists).toBe(false);
    expect(r.llmsTxt).toBeNull();
  });
});

describe('probeUrlMdSample', () => {
  test('finds .md variant when it returns 200 non-HTML', async () => {
    const fetcher = mockFetch(
      okResponse('# Markdown content', 'text/markdown'),  // /blog/post.md → 200
    );
    const r = await probeUrlMdSample('https://example.com', ['https://example.com/blog/post'], fetcher);
    expect(r.hasAny).toBe(true);
    expect(r.found).toContain('https://example.com/blog/post.md');
  });

  test('does not flag .md that returns text/html (likely redirect to 404 page)', async () => {
    const fetcher = mockFetch(
      { ok: true, headers: { get: () => 'text/html' }, text: async () => '' },  // .md returns HTML
      notFound(), // .md.txt also not found
    );
    const r = await probeUrlMdSample('https://example.com', ['https://example.com/page'], fetcher);
    expect(r.hasAny).toBe(false);
    expect(r.found).toHaveLength(0);
  });

  test('returns empty when all probes fail', async () => {
    const fetcher = jest.fn(() => Promise.reject(new Error('network')));
    const r = await probeUrlMdSample('https://example.com', ['https://example.com/page'], fetcher);
    expect(r.hasAny).toBe(false);
  });

  test('skips root URL (/) — only probes real content paths', async () => {
    const fetcher = mockFetch(okResponse('# md', 'text/markdown'));
    const r = await probeUrlMdSample('https://example.com', ['https://example.com/'], fetcher);
    // Root path filtered out — no fetch calls
    expect(fetcher).not.toHaveBeenCalled();
    expect(r.hasAny).toBe(false);
  });
});
