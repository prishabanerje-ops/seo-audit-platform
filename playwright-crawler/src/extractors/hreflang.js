/**
 * Hreflang extractor (per-page)
 *
 * Extracts hreflang alternate link tags and the html[lang] attribute.
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:hreflang');

/**
 * @param {CheerioAPI} $
 * @param {string}     pageUrl
 * @returns {object}
 */
export function extractHreflang($, pageUrl) {
  if (!$) {
    logger.warn(`No cheerio instance for ${pageUrl}`);
    return { _hreflang: { hreflangTags: [], htmlLang: '', hasHreflang: false, hasXDefault: false } };
  }

  try {
    const hreflangTags = [];
    let hasXDefault = false;

    $('link[rel="alternate"][hreflang]').each((_, el) => {
      const lang = ($(el).attr('hreflang') || '').trim();
      const href = ($(el).attr('href')    || '').trim();
      if (lang) {
        hreflangTags.push({ lang, href });
        if (lang.toLowerCase() === 'x-default') hasXDefault = true;
      }
    });

    const htmlLang = ($('html').attr('lang') || '').trim();

    return {
      _hreflang: {
        hreflangTags,
        htmlLang,
        hasHreflang: hreflangTags.length > 0,
        hasXDefault,
      },
    };
  } catch (err) {
    logger.error(`Hreflang extraction failed for ${pageUrl}: ${err.message}`);
    return { _hreflang: { hreflangTags: [], htmlLang: '', hasHreflang: false, hasXDefault: false } };
  }
}
