// backend/__tests__/checks/s17-links.test.js
import { describe, it, expect } from 'vitest';
import { runLinksChecks } from '../../services/checks/s17-links.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Unique Inlinks': '5',
  'Unique Outlinks': '20',
  _internalLinks: Array.from({ length: 20 }, (_, i) => ({
    href: `https://example.com/page${i}`,
    text: `Page ${i}`,
    rel: '',
    statusCode: 200,
    isRedirect: false,
  })),
  ...overrides,
});

describe('runLinksChecks', () => {
  it('passes for healthy link structure', () => {
    expect(runLinksChecks([page()], {})).toHaveLength(0);
  });
  it('flags no_orphan_pages for indexable page with zero inlinks', () => {
    const r = runLinksChecks([page({ 'Unique Inlinks': '0' })], {});
    expect(r.some(x => x.check_id === 'no_orphan_pages')).toBe(true);
  });
  it('flags internal_link_count when > 100 internal links', () => {
    const links = Array.from({ length: 101 }, (_, i) => ({ href: `https://example.com/${i}`, text: `Link ${i}`, rel: '', statusCode: 200, isRedirect: false }));
    const r = runLinksChecks([page({ _internalLinks: links })], {});
    expect(r.some(x => x.check_id === 'internal_link_count')).toBe(true);
  });
  it('flags anchor_descriptiveness for "click here" anchor', () => {
    const links = [{ href: 'https://example.com/a', text: 'click here', rel: '', statusCode: 200, isRedirect: false }];
    const r = runLinksChecks([page({ _internalLinks: links })], {});
    expect(r.some(x => x.check_id === 'anchor_descriptiveness')).toBe(true);
  });
  it('flags broken_internal_links for 4xx link', () => {
    const links = [{ href: 'https://example.com/dead', text: 'Dead link', rel: '', statusCode: 404, isRedirect: false }];
    const r = runLinksChecks([page({ _internalLinks: links })], {});
    expect(r.some(x => x.check_id === 'broken_internal_links')).toBe(true);
  });
});
