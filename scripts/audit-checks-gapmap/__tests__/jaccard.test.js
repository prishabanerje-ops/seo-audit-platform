import { describe, it, expect } from 'vitest';
import { jaccardScore } from '../src/jaccard.js';

describe('jaccardScore', () => {
  it('returns 1.0 for identical names', () => {
    expect(jaccardScore('Title Too Long', 'Title Too Long')).toBe(1);
  });

  it('returns Jaccard similarity', () => {
    // {title,long} vs {title,short} → intersection 1, union 3 → 1/3
    expect(jaccardScore('title long', 'title short')).toBeCloseTo(1/3, 2);
  });

  it('returns 0 for disjoint tokens', () => {
    expect(jaccardScore('foo', 'bar')).toBe(0);
  });

  it('matches code identifier to canonical name via tokenization', () => {
    // 'getLcpScore' -> {get, largest, contentful, paint, score}
    // 'LCP score under 2.5s' (after acronym + tokenize) -> {largest, contentful, paint, score, under, 2, 5s}
    // intersection: {largest, contentful, paint, score} = 4
    // union: 8
    expect(jaccardScore('getLcpScore', 'LCP score under 2.5s')).toBeGreaterThan(0.4);
  });

  it('returns 1 when both inputs reduce to empty token sets', () => {
    expect(jaccardScore('', '')).toBe(1);
    expect(jaccardScore('the', 'a')).toBe(1); // both reduce to empty
  });
});
