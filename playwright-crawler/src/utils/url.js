/**
 * URL utilities
 * - Normalise URLs (lowercase scheme+host, strip fragments, trailing slash rules)
 * - Deduplication via a Set
 * - Scope filtering (stay within start domain)
 */

/**
 * Normalise a URL string:
 * - Lowercase scheme and hostname
 * - Remove fragment (#...)
 * - Remove default ports (80 for http, 443 for https)
 * - Preserve path casing (important for case-sensitivity checks downstream)
 * - Preserve query string
 *
 * Returns null if the input is not a valid absolute HTTP/HTTPS URL.
 *
 * @param {string} raw
 * @returns {string|null}
 */
export function normaliseUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  // Only HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  // Lowercase scheme and host
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  // Remove default ports
  if (parsed.protocol === 'http:'  && parsed.port === '80')  parsed.port = '';
  if (parsed.protocol === 'https:' && parsed.port === '443') parsed.port = '';

  // Remove fragment
  parsed.hash = '';

  return parsed.href;
}

/**
 * Resolve a potentially relative href against a base URL.
 * Returns a normalised absolute URL, or null if not resolvable / not HTTP(S).
 *
 * @param {string} href
 * @param {string} base  — absolute URL of the page that contained the link
 * @returns {string|null}
 */
export function resolveUrl(href, base) {
  if (!href || typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) return null;

  try {
    const resolved = new URL(trimmed, base);
    return normaliseUrl(resolved.href);
  } catch {
    return null;
  }
}

/**
 * Returns true if `url` is within the crawl scope of `startUrl`.
 * Scope = same hostname (www and non-www are treated as equal).
 *
 * @param {string} url
 * @param {string} startUrl
 * @returns {boolean}
 */
export function isInScope(url, startUrl) {
  try {
    const u = new URL(url);
    const s = new URL(startUrl);
    const uHost = stripWww(u.hostname.toLowerCase());
    const sHost = stripWww(s.hostname.toLowerCase());
    return uHost === sHost;
  } catch {
    return false;
  }
}

/**
 * Strip leading "www." from a hostname for comparison.
 * @param {string} host
 * @returns {string}
 */
function stripWww(host) {
  return host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Simple URL deduplication set.
 * Wraps a Set<string> and exposes add / has / size.
 */
export class UrlSet {
  constructor() {
    this._set = new Set();
  }

  /** Returns true if the URL was added (i.e. was not already seen). */
  add(url) {
    const norm = normaliseUrl(url);
    if (!norm) return false;
    if (this._set.has(norm)) return false;
    this._set.add(norm);
    return true;
  }

  has(url) {
    const norm = normaliseUrl(url);
    return norm ? this._set.has(norm) : false;
  }

  get size() {
    return this._set.size;
  }

  values() {
    return this._set.values();
  }
}

/**
 * Extract the root origin of a URL (scheme + host + port).
 * @param {string} url
 * @returns {string|null}
 */
export function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
