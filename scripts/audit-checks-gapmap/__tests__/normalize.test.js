import { describe, it, expect } from 'vitest';
import { normalizeName } from '../src/normalize.js';

describe('normalizeName', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeName('Title Too Long (over 60 chars)')).toBe('title too long over 60 chars');
    expect(normalizeName('301 vs 302 Usage')).toBe('301 vs 302 usage');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeName('  Foo   Bar  ')).toBe('foo bar');
  });

  it('returns empty string for nullish input', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});
