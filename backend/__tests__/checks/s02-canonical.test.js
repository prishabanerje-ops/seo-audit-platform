// backend/__tests__/checks/s02-canonical.test.js
import { describe, it, expect } from 'vitest';
import { runCanonicalChecks } from '../../services/checks/s02-canonical.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Canonical Link Element 1': 'https://example.com/page',
  _canonicalCount: 1,
  _hreflangTags: [],
  'rel="next"': '',
  'rel="prev"': '',
  ...overrides,
});

describe('runCanonicalChecks', () => {
  it('passes for self-canonical indexable page', () => {
    expect(runCanonicalChecks([page()], {})).toHaveLength(0);
  });

  it('flags self_referencing_canonical when missing canonical on indexable page', () => {
    const r = runCanonicalChecks([page({ 'Canonical Link Element 1': '', _canonicalCount: 0 })], {});
    expect(r.some(x => x.check_id === 'self_referencing_canonical')).toBe(true);
  });

  it('flags duplicate_canonical_tags when count > 1', () => {
    const r = runCanonicalChecks([page({ _canonicalCount: 2 })], {});
    expect(r.some(x => x.check_id === 'duplicate_canonical_tags')).toBe(true);
  });

  it('flags canonical_points_https when canonical uses http://', () => {
    const r = runCanonicalChecks([page({ 'Canonical Link Element 1': 'http://example.com/page' })], {});
    expect(r.some(x => x.check_id === 'canonical_points_https')).toBe(true);
  });

  it('flags canonical_loop when A → B → A', () => {
    const pages = [
      page({ url: 'https://example.com/a', 'Canonical Link Element 1': 'https://example.com/b' }),
      page({ url: 'https://example.com/b', 'Canonical Link Element 1': 'https://example.com/a' }),
    ];
    const r = runCanonicalChecks(pages, {});
    expect(r.some(x => x.check_id === 'canonical_loop')).toBe(true);
  });

  it('flags paginated_canonical when paginated page canonicals to different path', () => {
    const r = runCanonicalChecks([page({
      url: 'https://example.com/blog?page=2',
      'Canonical Link Element 1': 'https://example.com/blog',
      'rel="prev"': 'https://example.com/blog',
    })], {});
    expect(r.some(x => x.check_id === 'paginated_canonical')).toBe(true);
  });
});
