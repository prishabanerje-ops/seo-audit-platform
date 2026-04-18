/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { extractRobots } from '../../src/extractors/robots.js';

const ROBOTS_BASIC = `
User-agent: *
Disallow: /admin/
Allow: /public/
Sitemap: https://example.com/sitemap.xml
`;

const ROBOTS_AI_BOTS = `
User-agent: *
Disallow: /

User-agent: Googlebot
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /critical/
`;

function makeFetch(responses) {
  return jest.fn((url, _opts) => {
    const entry = responses.find(r => url.includes(r.match));
    if (!entry) return Promise.resolve({ ok: false, status: 404, text: async () => '', headers: { get: () => null } });
    return Promise.resolve({
      ok:      entry.status >= 200 && entry.status < 400,
      status:  entry.status,
      text:    async () => entry.body,
      headers: { get: (h) => entry.headers?.[h.toLowerCase()] ?? null },
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('extractRobots()', () => {
  it('parses a valid robots.txt with disallow and sitemap', async () => {
    global.fetch = makeFetch([
      { match: '/robots.txt',  status: 200, body: ROBOTS_BASIC, headers: { 'content-type': 'text/plain' } },
      { match: '/llms.txt',    status: 404, body: '' },
    ]);

    const result = await extractRobots('https://example.com');

    expect(result.robotsTxtExists).toBe(true);
    expect(result.robotsTxtStatusCode).toBe(200);
    expect(result.sitemapDeclared).toBe(true);
    expect(result.sitemapUrls).toEqual(['https://example.com/sitemap.xml']);
    expect(result.blockedPaths).toContain('/admin/');
    expect(result.userAgents).toContain('*');
    expect(result.allowRules.length).toBeGreaterThan(0);
    expect(result.llmsTxtExists).toBe(false);
  });

  it('returns robotsTxtExists=false on 404', async () => {
    global.fetch = makeFetch([
      { match: '/robots.txt', status: 404, body: '' },
      { match: '/llms.txt',   status: 404, body: '' },
    ]);

    const result = await extractRobots('https://example.com');

    expect(result.robotsTxtExists).toBe(false);
    expect(result.sitemapDeclared).toBe(false);
    expect(result.blockedPaths).toEqual([]);
    expect(result.userAgents).toEqual([]);
  });

  it('detects llms.txt when present', async () => {
    const llmsContent = '# LLMs.txt\n> SEO Platform\nDo not train on this content.';
    global.fetch = makeFetch([
      { match: '/robots.txt', status: 200, body: ROBOTS_BASIC, headers: { 'content-type': 'text/plain' } },
      { match: '/llms.txt',   status: 200, body: llmsContent },
    ]);

    const result = await extractRobots('https://example.com');

    expect(result.llmsTxtExists).toBe(true);
    expect(result.llmsTxtContent).toBe(llmsContent);
    expect(result.llmsTxtStatusCode).toBe(200);
  });

  it('collects blocked paths for * and Googlebot agents', async () => {
    global.fetch = makeFetch([
      { match: '/robots.txt', status: 200, body: ROBOTS_AI_BOTS, headers: {} },
      { match: '/llms.txt',   status: 404, body: '' },
    ]);

    const result = await extractRobots('https://example.com');

    expect(result.blockedPaths).toContain('/');
    expect(result.userAgents).toContain('GPTBot');
    expect(result.userAgents).toContain('ClaudeBot');
  });

  it('flags malformed rules', async () => {
    const malformed = 'User-agent: *\nDisallow: /admin/\nBADLINE_NO_COLON\n';
    global.fetch = makeFetch([
      { match: '/robots.txt', status: 200, body: malformed, headers: {} },
      { match: '/llms.txt',   status: 404, body: '' },
    ]);

    const result = await extractRobots('https://example.com');

    expect(result.hasMalformedRules).toBe(true);
  });
});
