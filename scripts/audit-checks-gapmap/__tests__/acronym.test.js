import { describe, it, expect } from 'vitest';
import { splitCamelCase, expandAcronyms } from '../src/acronym.js';

describe('splitCamelCase', () => {
  it('splits camelCase to space-separated words', () => {
    expect(splitCamelCase('getLcpScore')).toBe('get Lcp Score');
    expect(splitCamelCase('isHttpsRedirect')).toBe('is Https Redirect');
  });

  it('preserves all-lowercase strings', () => {
    expect(splitCamelCase('foo')).toBe('foo');
  });

  it('handles consecutive caps (acronyms)', () => {
    expect(splitCamelCase('parseHTMLTag')).toBe('parse HTMLTag');
  });
});

describe('expandAcronyms', () => {
  it('expands known SEO acronyms', () => {
    expect(expandAcronyms('lcp')).toBe('largest contentful paint');
    expect(expandAcronyms('cls')).toBe('cumulative layout shift');
    expect(expandAcronyms('cwv')).toBe('core web vitals');
    expect(expandAcronyms('gsc')).toBe('search console');
    expect(expandAcronyms('ga4')).toBe('analytics');
  });

  it('expands acronyms inside multi-word strings', () => {
    expect(expandAcronyms('lcp score under 2.5s')).toBe('largest contentful paint score under 2.5s');
  });

  it('does not expand non-acronyms', () => {
    expect(expandAcronyms('title length')).toBe('title length');
  });
});
