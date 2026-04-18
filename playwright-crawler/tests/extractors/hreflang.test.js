import { describe, it, expect } from '@jest/globals';
import { load } from 'cheerio';
import { extractHreflang } from '../../src/extractors/hreflang.js';

describe('extractHreflang()', () => {
  it('extracts hreflang tags and html lang', () => {
    const $ = load(`
      <html lang="en">
        <head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/" />
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/" />
          <link rel="alternate" hreflang="x-default" href="https://example.com/" />
        </head>
      </html>`);
    const { _hreflang: r } = extractHreflang($, 'https://example.com/en/');
    expect(r.hasHreflang).toBe(true);
    expect(r.hreflangTags).toHaveLength(3);
    expect(r.htmlLang).toBe('en');
    expect(r.hasXDefault).toBe(true);
  });

  it('returns empty when no hreflang tags present', () => {
    const $ = load('<html><head></head></html>');
    const { _hreflang: r } = extractHreflang($, 'https://example.com/');
    expect(r.hasHreflang).toBe(false);
    expect(r.hreflangTags).toEqual([]);
    expect(r.hasXDefault).toBe(false);
    expect(r.htmlLang).toBe('');
  });

  it('detects missing x-default', () => {
    const $ = load(`<html><head>
      <link rel="alternate" hreflang="en" href="https://example.com/en/" />
      <link rel="alternate" hreflang="de" href="https://example.com/de/" />
    </head></html>`);
    const { _hreflang: r } = extractHreflang($, 'https://example.com/');
    expect(r.hasHreflang).toBe(true);
    expect(r.hasXDefault).toBe(false);
  });

  it('handles null $ gracefully', () => {
    const { _hreflang: r } = extractHreflang(null, 'https://example.com/');
    expect(r.hasHreflang).toBe(false);
    expect(r.hreflangTags).toEqual([]);
  });
});
