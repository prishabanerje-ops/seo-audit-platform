// backend/__tests__/checks/s03-robots.test.js
import { describe, it, expect } from 'vitest';
import { runRobotsChecks } from '../../services/checks/s03-robots.js';

const makeSiteData = (robotsOverrides = {}) => ({
  robots: {
    exists: true,
    raw: 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml',
    sitemapUrls: ['https://example.com/sitemap.xml'],
    disallowedPaths: ['/admin'],
    agentRules: {
      'GPTBot': { disallowed: [], allowed: [] },
      'ClaudeBot': { disallowed: [], allowed: [] },
      'PerplexityBot': { disallowed: [], allowed: [] },
      'Google-Extended': { disallowed: [], allowed: [] },
    },
    parseErrors: [],
    ...robotsOverrides,
  },
  sitemap: { found: true, urls: [], fileSizeBytes: 1000, parseErrors: [] },
});

const pages = (overrides = {}) => [{
  url: 'https://example.com/',
  'Indexability': 'Indexable',
  _siteData: makeSiteData(overrides),
}];

describe('runRobotsChecks', () => {
  it('passes with valid robots.txt', () => {
    expect(runRobotsChecks(pages(), {})).toHaveLength(0);
  });

  it('flags robots_txt_exists when missing', () => {
    const r = runRobotsChecks(pages({ exists: false }), {});
    expect(r.some(x => x.check_id === 'robots_txt_exists')).toBe(true);
  });

  it('flags sitemap_in_robots when no sitemap declared', () => {
    const r = runRobotsChecks(pages({ sitemapUrls: [] }), {});
    expect(r.some(x => x.check_id === 'sitemap_in_robots')).toBe(true);
  });

  it('flags crawlable_resources_not_blocked when /css is disallowed', () => {
    const r = runRobotsChecks(pages({ disallowedPaths: ['/css', '/admin'] }), {});
    expect(r.some(x => x.check_id === 'crawlable_resources_not_blocked')).toBe(true);
  });

  it('flags important_pages_not_blocked when indexable page is blocked', () => {
    const pgs = [
      { url: 'https://example.com/insurance', 'Indexability': 'Indexable', _siteData: makeSiteData({ disallowedPaths: ['/insurance'] }) },
    ];
    const r = runRobotsChecks(pgs, {});
    expect(r.some(x => x.check_id === 'important_pages_not_blocked')).toBe(true);
  });
});
