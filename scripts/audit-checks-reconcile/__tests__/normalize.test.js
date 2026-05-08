import { describe, it, expect } from 'vitest';
import { normalizeName } from '../src/normalize.js';

describe('normalizeName', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeName('Toxic / Spammy Links')).toBe('toxic spammy links');
    expect(normalizeName('301 vs 302 Usage')).toBe('301 vs 302 usage');
    expect(normalizeName('Hreflang vs. Canonical Conflict')).toBe('hreflang vs canonical conflict');
  });

  it('collapses repeated whitespace and trims', () => {
    expect(normalizeName('  Foo   Bar  ')).toBe('foo bar');
  });

  it('returns empty string for nullish input', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});
