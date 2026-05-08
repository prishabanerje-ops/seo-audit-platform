/**
 * Canonical extractor
 *
 * Extracts canonical and hreflang data matching SF CSV output:
 *
 * canonicals_all.csv columns:
 *   Address, Canonical Link Element 1, Canonical HTTP Header,
 *   Canonical Link Element Match HTTP Header, Indexability
 *
 * Also extracts:
 *   - rel="next" / rel="prev" pagination tags
 *   - hreflang tags (for hreflang checks in Phase 3)
 */

import { createLogger } from '../utils/logger.js';
import { normaliseUrl }  from '../utils/url.js';

const logger = createLogger('extractor:canonical');

/**
 * Extract <link rel="canonical"> from DOM.
 * Returns the first and second canonical href values.
 *
 * @param {CheerioAPI} $
 * @returns {{ canonical1: string, canonical2: string, count: number, isOutsideHead: boolean }}
 */
function extractCanonicalTag($) {
  const canonicals = [];
  $('link[rel="canonical"]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (href) canonicals.push({ href, el });
  });

  // Check if any canonical is outside <head>
  let outsideHead = false;
  for (const { el } of canonicals) {
    let parent = $(el).parent();
    let found  = false;
    while (parent.length > 0) {
      if (parent.is('head')) { found = true; break; }
      parent = parent.parent();
    }
    if (!found) outsideHead = true;
  }

  return {
    canonical1:     canonicals[0]?.href || '',
    canonical2:     canonicals[1]?.href || '',
    count:          canonicals.length,
    isOutsideHead:  outsideHead,
  };
}

/**
 * Extract canonical from HTTP header (passed through response extractor).
 * The response extractor stores raw headers; we look for Link: <url>; rel="canonical".
 *
 * @param {object} headers — raw response headers object
 * @returns {string}
 */
function extractCanonicalHeader(headers = {}) {
  const linkHeader = headers['link'] || headers['Link'] || '';
  // Link: <https://example.com/page>; rel="canonical"
  const match = linkHeader.match(/<([^>]+)>\s*;\s*rel="canonical"/i);
  return match ? match[1].trim() : '';
}

/**
 * Extract hreflang annotations.
 *
 * @param {CheerioAPI} $
 * @returns {Array<{ lang: string, href: string }>}
 */
function extractHreflang($) {
  const tags = [];
  $('link[hreflang], link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = ($(el).attr('hreflang') || '').trim().toLowerCase();
    const href = ($(el).attr('href')     || '').trim();
    if (lang && href) tags.push({ lang, href });
  });
  return tags;
}

/**
 * Extract rel="next" and rel="prev" pagination links.
 *
 * @param {CheerioAPI} $
 * @returns {{ next: string, prev: string }}
 */
function extractPagination($) {
  const next = ($('link[rel="next"]').first().attr('href') || '').trim();
  const prev = ($('link[rel="prev"]').first().attr('href') || '').trim();
  return { next, prev };
}

/**
 * Derive canonical-related flags used by sf-parser checks.
 *
 * @param {string} url           — page URL
 * @param {string} canonical1    — first canonical tag value
 * @param {string} canonicalHdr  — canonical from HTTP header
 * @returns {object}
 */
function deriveFlags(url, canonical1, canonicalHdr) {
  const normUrl  = normaliseUrl(url)  || url;
  const normCan  = normaliseUrl(canonical1) || canonical1;

  return {
    // Canonical is Relative — starts with / but not //
    _canonicalIsRelative: canonical1.startsWith('/') && !canonical1.startsWith('//'),

    // Canonical Contains Fragment
    _canonicalHasFragment: canonical1.includes('#'),

    // Self-canonical — canonical matches the page URL
    _isSelfCanonical: !!normCan && normCan === normUrl,

    // HTTP header canonical exists and differs from tag
    _canonicalHeaderMismatch: !!canonicalHdr && !!canonical1 && canonicalHdr !== canonical1,

    // No canonical at all
    _missingCanonical: !canonical1,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract canonical, hreflang, and pagination data from a page.
 *
 * @param {CheerioAPI} $
 * @param {string}     url
 * @param {object}     [responseHeaders={}]  — raw HTTP response headers
 * @returns {object}   SF-compatible canonical fields + internal flags
 */
export function extractCanonical($, url, responseHeaders = {}) {
  if (!$) {
    logger.warn(`No cheerio instance for ${url}`);
    return {};
  }

  try {
    const { canonical1, canonical2, count, isOutsideHead } = extractCanonicalTag($);
    const canonicalHdr  = extractCanonicalHeader(responseHeaders);
    const hreflangTags  = extractHreflang($);
    const pagination    = extractPagination($);
    const flags         = deriveFlags(url, canonical1, canonicalHdr);

    // SF: "Canonical Link Element Match HTTP Header" — "Yes" / "No" / ""
    let canonicalMatch = '';
    if (canonical1 && canonicalHdr) {
      canonicalMatch = canonical1 === canonicalHdr ? 'Yes' : 'No';
    }

    return {
      // ── SF canonicals_all.csv columns ────────────────────────
      'Canonical Link Element 1':                canonical1,
      'Canonical Link Element 2':                canonical2,
      'Canonical HTTP Header':                   canonicalHdr,
      'Canonical Link Element Match HTTP Header': canonicalMatch,

      // ── Pagination ────────────────────────────────────────────
      'rel="next"':  pagination.next,
      'rel="prev"':  pagination.prev,

      // ── Internal flags ────────────────────────────────────────
      _canonicalCount:          count,
      _canonicalOutsideHead:    isOutsideHead,
      _multipleCanonicals:      count > 1,
      _hreflangTags:            hreflangTags,
      _hasHreflang:             hreflangTags.length > 0,
      ...flags,
    };
  } catch (err) {
    logger.error(`Canonical extraction failed for ${url}: ${err.message}`);
    return {};
  }
}
