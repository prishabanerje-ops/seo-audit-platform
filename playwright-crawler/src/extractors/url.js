// playwright-crawler/src/extractors/url.js
/**
 * URL extractor — pure string parsing, no network calls.
 * Serves: Section 5 (session_ids_in_urls, crawl_trap), Section 6 (URL Structure).
 */

const SESSION_ID_RE = /[?&](JSESSIONID|PHPSESSID|sessid|session_id|sid)=/i;
const GENERIC_SLUG_RE = /\/(page-?\d+|index\.html?|default\.aspx?)\/?$/i;

/**
 * @param {string} url — full URL including protocol and domain
 * @returns {object}
 */
export function extractUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch {
    return {
      url, lengthChars: url.length,
      hasUpperCase: false, hasUnderscores: false, hasSpecialChars: false,
      isGenericSlug: false, trailingSlash: false, directoryDepth: 0,
      hasDateInPath: false, dateFormat: null,
      hasSessionId: false, hasCrawlTrap: false, queryParamCount: 0,
    };
  }

  const path   = parsed.pathname;
  const search = parsed.search;

  const hasUpperCase   = /[A-Z]/.test(path);
  const hasUnderscores = path.includes('_');

  // Chars outside the safe URL path set (spaces, braces, brackets, pipe, etc.)
  let decodedPath = path;
  try { decodedPath = decodeURIComponent(path); } catch {}
  const hasSpecialChars = /[\s{}[\]|\\^`<>]/.test(decodedPath);

  const isGenericSlug  = GENERIC_SLUG_RE.test(path);
  const trailingSlash  = path.length > 1 && path.endsWith('/');
  const directoryDepth = Math.max(0, (path.match(/\//g) ?? []).length - 1);

  let hasDateInPath = false, dateFormat = null;
  if (/\/\d{4}\/\d{2}\/\d{2}/.test(path))   { hasDateInPath = true; dateFormat = 'YYYY/MM/DD'; }
  else if (/\/\d{4}-\d{2}-\d{2}/.test(path)) { hasDateInPath = true; dateFormat = 'YYYY-MM-DD'; }

  const hasSessionId   = SESSION_ID_RE.test(search);

  const segments       = path.split('/').filter(Boolean);
  const hasTrapSegments = segments.length > 4 && new Set(segments).size < segments.length / 2;
  const queryParamCount = search ? [...new URLSearchParams(search)].length : 0;
  const hasCrawlTrap   = hasTrapSegments || queryParamCount >= 5;

  return {
    url, lengthChars: url.length,
    hasUpperCase, hasUnderscores, hasSpecialChars,
    isGenericSlug, trailingSlash, directoryDepth,
    hasDateInPath, dateFormat,
    hasSessionId, hasCrawlTrap, queryParamCount,
  };
}
