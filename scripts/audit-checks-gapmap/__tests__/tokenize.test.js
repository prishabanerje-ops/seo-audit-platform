import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenize.js';

describe('tokenize', () => {
  it('tokenizes a canonical-style name', () => {
    const tokens = tokenize('Title Too Long (over 60 chars)');
    expect(tokens).toEqual(new Set(['title', 'too', 'long', 'over', '60', 'chars']));
  });

  it('tokenizes a code-style identifier (camelCase split + acronym expand)', () => {
    const tokens = tokenize('getLcpScore');
    expect(tokens.has('get')).toBe(true);
    expect(tokens.has('largest')).toBe(true);
    expect(tokens.has('contentful')).toBe(true);
    expect(tokens.has('paint')).toBe(true);
    expect(tokens.has('score')).toBe(true);
  });

  it('removes stopwords', () => {
    const tokens = tokenize('the title of a page');
    expect(tokens.has('the')).toBe(false);
    expect(tokens.has('of')).toBe(false);
    expect(tokens.has('a')).toBe(false);
    expect(tokens.has('title')).toBe(true);
    expect(tokens.has('page')).toBe(true);
  });

  it('returns empty set for nullish input', () => {
    expect(tokenize(null)).toEqual(new Set());
    expect(tokenize(undefined)).toEqual(new Set());
  });
});
