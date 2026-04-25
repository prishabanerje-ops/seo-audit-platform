import { describe, it, expect } from 'vitest';
import { semanticMatch, tokenOverlap } from '../src/match.js';

describe('tokenOverlap', () => {
  it('returns 1.0 for identical tokens', () => {
    expect(tokenOverlap('foo bar baz', 'foo bar baz')).toBe(1);
  });

  it('returns Jaccard similarity for partial overlap', () => {
    // {foo,bar,baz} vs {foo,bar,qux} — intersection 2, union 4 = 0.5
    expect(tokenOverlap('foo bar baz', 'foo bar qux')).toBeCloseTo(0.5, 2);
  });

  it('returns 0 for disjoint sets', () => {
    expect(tokenOverlap('foo bar', 'baz qux')).toBe(0);
  });

  it('ignores stopwords', () => {
    // "the page" vs "page" → after stopwords, both = {page} → 1.0
    expect(tokenOverlap('the page', 'page')).toBe(1);
  });
});

describe('semanticMatch', () => {
  it('returns the seed entry whose normalized name overlaps >= threshold', () => {
    const seed = [
      { check_number: 1, name: 'All internal links return 200 status' },
      { check_number: 2, name: '404 pages return proper 404 status code' },
    ];
    const result = semanticMatch('Internal links return 200 status', seed, 0.7);
    expect(result?.check_number).toBe(1);
  });

  it('returns null when nothing meets threshold', () => {
    const seed = [{ check_number: 1, name: 'Hreflang configured correctly' }];
    expect(semanticMatch('Title tag length under 60 chars', seed, 0.9)).toBe(null);
  });
});
