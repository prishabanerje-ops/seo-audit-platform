import { describe, it, expect } from 'vitest';
import { tokenOverlap } from '../src/match.js';

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

