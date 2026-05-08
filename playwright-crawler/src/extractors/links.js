/**
 * Links extractor
 *
 * Extracts all <a> links from a page and classifies them as:
 *   - Internal vs External
 *   - Follow vs Nofollow
 *
 * Produces data used for:
 *   - Unique Inlinks / Unique Outlinks (internal_all.csv)
 *   - Orphan page detection (cross-page analysis in sf-format.js)
 *   - Internal linking checks
 *   - Broken external link checks
 */

import { createLogger }             from '../utils/logger.js';
import { resolveUrl, isInScope }    from '../utils/url.js';

const logger = createLogger('extractor:links');

/**
 * Extract all links from a page.
 *
 * @param {CheerioAPI} $
 * @param {string}     pageUrl   — absolute URL of this page
 * @param {string}     startUrl  — crawl root URL (for scope determination)
 * @returns {object}
 */
export function extractLinks($, pageUrl, startUrl) {
  if (!$) {
    logger.warn(`No cheerio instance for ${pageUrl}`);
    return {};
  }

  try {
    const internalLinks  = [];
    const externalLinks  = [];
    const internalFollow = [];

    $('a[href]').each((_, el) => {
      const href       = ($(el).attr('href') || '').trim();
      const rel        = ($(el).attr('rel')  || '').toLowerCase();
      const anchorText = $(el).text().replace(/\s+/g, ' ').trim();
      const isNofollow = rel.includes('nofollow');
      const resolved   = resolveUrl(href, pageUrl);

      if (!resolved) return; // skip non-HTTP, mailto, javascript: etc.

      const internal = isInScope(resolved, startUrl);

      const link = {
        href:       resolved,
        anchorText,
        isNofollow,
        rel,
      };

      if (internal) {
        internalLinks.push(link);
        if (!isNofollow) internalFollow.push(resolved);
      } else {
        externalLinks.push(link);
      }
    });

    // Dedup by href for counting (SF counts unique links)
    const uniqueInternal = [...new Map(internalLinks.map(l => [l.href, l])).values()];
    const uniqueExternal = [...new Map(externalLinks.map(l => [l.href, l])).values()];

    // Internal search pages — flag if URL contains search patterns
    const hasInternalSearch = uniqueInternal.some(l =>
      /[?&](q|query|search|s|keyword)=/i.test(l.href)
    );

    logger.debug(`Links: ${uniqueInternal.length} internal, ${uniqueExternal.length} external — ${pageUrl}`);

    return {
      // ── SF internal_all.csv columns ──────────────────────────
      'Unique Inlinks':  '',             // populated cross-page in sf-format.js
      'Unique Outlinks': String(uniqueInternal.length),

      // ── Internal flags ────────────────────────────────────────
      _internalLinks:       uniqueInternal,
      _externalLinks:       uniqueExternal,
      _internalFollowUrls:  internalFollow,
      _hasInternalSearch:   hasInternalSearch,
      _totalLinks:          uniqueInternal.length + uniqueExternal.length,
    };
  } catch (err) {
    logger.error(`Links extraction failed for ${pageUrl}: ${err.message}`);
    return {};
  }
}
