// playwright-crawler/tests/extractors/url.test.js
import { extractUrl } from '../../src/extractors/url.js';

describe('extractUrl', () => {
  test('returns full URL length as lengthChars', () => {
    const url = 'https://example.com/page';
    expect(extractUrl(url).lengthChars).toBe(url.length);
  });

  test('detects uppercase in path', () => {
    expect(extractUrl('https://example.com/Hello').hasUpperCase).toBe(true);
    expect(extractUrl('https://example.com/hello').hasUpperCase).toBe(false);
  });

  test('detects underscores in path', () => {
    expect(extractUrl('https://example.com/foo_bar').hasUnderscores).toBe(true);
    expect(extractUrl('https://example.com/foo-bar').hasUnderscores).toBe(false);
  });

  test('trailing slash on path longer than root', () => {
    expect(extractUrl('https://example.com/about/').trailingSlash).toBe(true);
    expect(extractUrl('https://example.com/about').trailingSlash).toBe(false);
    expect(extractUrl('https://example.com/').trailingSlash).toBe(false); // root excluded
  });

  test('counts directory depth', () => {
    expect(extractUrl('https://example.com/').directoryDepth).toBe(0);
    expect(extractUrl('https://example.com/a').directoryDepth).toBe(0);
    expect(extractUrl('https://example.com/a/b').directoryDepth).toBe(1);
    expect(extractUrl('https://example.com/a/b/c').directoryDepth).toBe(2);
  });

  test('detects YYYY/MM/DD date in path', () => {
    const r = extractUrl('https://example.com/blog/2024/03/15/post');
    expect(r.hasDateInPath).toBe(true);
    expect(r.dateFormat).toBe('YYYY/MM/DD');
  });

  test('detects YYYY-MM-DD date in path', () => {
    const r = extractUrl('https://example.com/2024-03-15/post');
    expect(r.hasDateInPath).toBe(true);
    expect(r.dateFormat).toBe('YYYY-MM-DD');
  });

  test('no date for normal paths', () => {
    expect(extractUrl('https://example.com/car-insurance').hasDateInPath).toBe(false);
  });

  test('detects JSESSIONID', () => {
    expect(extractUrl('https://example.com/?JSESSIONID=abc123').hasSessionId).toBe(true);
  });

  test('detects PHPSESSID', () => {
    expect(extractUrl('https://example.com/?PHPSESSID=abc').hasSessionId).toBe(true);
  });

  test('does not flag normal id param as session id', () => {
    expect(extractUrl('https://example.com/?id=123').hasSessionId).toBe(false);
  });

  test('counts query params', () => {
    expect(extractUrl('https://example.com/?a=1&b=2&c=3').queryParamCount).toBe(3);
    expect(extractUrl('https://example.com/').queryParamCount).toBe(0);
  });

  test('hasCrawlTrap for 5+ query params', () => {
    expect(extractUrl('https://example.com/?a=1&b=2&c=3&d=4&e=5').hasCrawlTrap).toBe(true);
    expect(extractUrl('https://example.com/?a=1&b=2').hasCrawlTrap).toBe(false);
  });

  test('hasCrawlTrap for repeated path segments', () => {
    expect(extractUrl('https://example.com/cat/sub/sub/sub/sub').hasCrawlTrap).toBe(true);
  });

  test('isGenericSlug matches /page-123', () => {
    expect(extractUrl('https://example.com/page-123').isGenericSlug).toBe(true);
    expect(extractUrl('https://example.com/car-insurance').isGenericSlug).toBe(false);
  });

  test('handles invalid URL without throwing', () => {
    const r = extractUrl('not-a-url');
    expect(r.url).toBe('not-a-url');
    expect(r.lengthChars).toBe('not-a-url'.length);
    expect(r.hasUpperCase).toBe(false);
  });
});
