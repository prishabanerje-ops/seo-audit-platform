/**
 * Response extractor
 *
 * Extracts HTTP-level data from a Crawlee response:
 *   - Status code + status text
 *   - Content-Type
 *   - Redirect chain (URL, type)
 *   - Response time
 *   - Last-Modified header
 *   - X-Robots-Tag header
 *   - Vary header
 *
 * Output fields match SF CSV column names used by sf-parser.service.js:
 *   Address, Status Code, Status, Content Type, Redirect URL, Redirect Type,
 *   Response Time, Last Modified, X-Robots-Tag 1, Vary
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:response');

/**
 * Map numeric status code to a human-readable SF-style status string.
 * SF uses strings like "OK", "Moved Permanently", "Not Found", etc.
 *
 * @param {number} code
 * @returns {string}
 */
function statusText(code) {
  const map = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    410: 'Gone',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[code] || String(code);
}

/**
 * Map numeric status code to SF redirect type string.
 * Returns empty string for non-redirects.
 *
 * @param {number} code
 * @returns {string}
 */
function redirectType(code) {
  const map = {
    301: 'Permanent (301)',
    302: 'Temporary (302)',
    303: 'See Other (303)',
    307: 'Temporary (307)',
    308: 'Permanent (308)',
  };
  return map[code] || '';
}

/**
 * Determine SF Indexability from status code and robots directives.
 *
 * @param {number}  statusCode
 * @param {string}  metaRobots   — content of <meta name="robots"> (or '')
 * @param {string}  xRobotsTag   — value of X-Robots-Tag header (or '')
 * @returns {{ indexability: string, indexabilityStatus: string }}
 */
export function deriveIndexability(statusCode, metaRobots = '', xRobotsTag = '') {
  const combined = `${metaRobots} ${xRobotsTag}`.toLowerCase();

  if (statusCode !== 200) {
    return {
      indexability:       'Non-Indexable',
      indexabilityStatus: statusCode >= 300 && statusCode < 400
        ? 'Redirected'
        : `${statusCode} Response`,
    };
  }

  if (combined.includes('noindex')) {
    return {
      indexability:       'Non-Indexable',
      indexabilityStatus: 'Noindex',
    };
  }

  return {
    indexability:       'Indexable',
    indexabilityStatus: '',
  };
}

/**
 * Extract response-level data from a Crawlee request/response pair.
 *
 * @param {object} params
 * @param {string}   params.url           — final URL after redirects
 * @param {string}   params.startUrl      — original requested URL
 * @param {number}   params.statusCode    — HTTP status code
 * @param {object}   params.headers       — response headers (key → string)
 * @param {number}   params.responseTime  — ms from request start to response end
 * @param {string[]} params.redirectChain — ordered list of URLs in redirect chain (excluding final)
 * @returns {object}  SF-compatible response record
 */
export function extractResponse({
  url,
  startUrl,
  statusCode,
  headers = {},
  responseTime = 0,
  redirectChain = [],
}) {
  const h = (name) => headers[name.toLowerCase()] || '';

  const contentType  = h('content-type').split(';')[0].trim();
  const lastModified = h('last-modified');
  const xRobotsTag   = h('x-robots-tag');
  const vary         = h('vary');

  // Redirect info — final redirect target is `url` when startUrl !== url
  const wasRedirected = redirectChain.length > 0 || (startUrl && startUrl !== url);
  const redirectUrl   = wasRedirected ? url : '';
  const redirType     = wasRedirected ? redirectType(statusCode) : '';

  // Detect redirect chains (more than one hop)
  const isChain = redirectChain.length > 1;
  const chainFlag = isChain ? 'Chain' : '';

  // HTTPS mixed content hint — captured at response level for the record
  const isHttps = url.startsWith('https://');

  logger.debug(`Response: ${statusCode} ${url} (${responseTime}ms)`);

  return {
    // ── Core SF columns ──────────────────────────────────────────
    'Address':        url,
    'Status Code':    String(statusCode),
    'Status':         statusText(statusCode),
    'Content Type':   contentType,

    // ── Redirect columns ─────────────────────────────────────────
    'Redirect URL':   redirectUrl,
    'Redirect Type':  chainFlag || redirType,

    // ── Performance / metadata ───────────────────────────────────
    'Response Time':  String(responseTime),
    'Last Modified':  lastModified,

    // ── Directive headers ────────────────────────────────────────
    'X-Robots-Tag 1': xRobotsTag,
    'Vary':           vary,

    // ── Internal flags (not SF columns — used by other extractors) ──
    _isHttps:         isHttps,
    _redirectChain:   redirectChain,
  };
}
