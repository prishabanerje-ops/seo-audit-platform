/**
 * Meta extractor
 *
 * Extracts from <head>:
 *   - Title tags (title 1, title 2, length, pixel width estimate)
 *   - Meta description (desc 1, desc 2, length)
 *   - Meta robots directives
 *   - Meta refresh
 *   - Viewport tag
 *   - Open Graph tags (og:title, og:description, og:image, og:url)
 *   - Twitter card tags
 *
 * Output fields match SF CSV column names used by sf-parser.service.js.
 *
 * SF columns produced:
 *   Title 1, Title 1 Length, Title 1 Pixel Width, Title 2, Title 2 Length
 *   Meta Description 1, Meta Description 1 Length, Meta Description 2
 *   Meta Robots 1, Meta Refresh, Indexability (partial — combined with response)
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:meta');

// Average character width in pixels for a 20px system font (Google uses ~538px viewport)
// This is a rough estimate — SF uses actual browser rendering. Good enough for checks.
const AVG_CHAR_WIDTH_PX = 8;

/**
 * Estimate pixel width of a title string.
 * @param {string} text
 * @returns {number}
 */
function estimatePixelWidth(text) {
  return Math.round((text || '').length * AVG_CHAR_WIDTH_PX);
}

/**
 * Extract all <title> tag values from the document.
 * SF records Title 1 and Title 2 (the first two distinct titles).
 *
 * @param {CheerioAPI} $
 * @returns {{ title1: string, title1Length: number, title1PixelWidth: number, title2: string, title2Length: number }}
 */
function extractTitles($) {
  const titles = [];
  $('title').each((_, el) => {
    const text = $(el).text().trim();
    if (text) titles.push(text);
  });

  const title1      = titles[0] || '';
  const title2      = titles[1] || '';

  return {
    'Title 1':             title1,
    'Title 1 Length':      String(title1.length || ''),
    'Title 1 Pixel Width': String(title1 ? estimatePixelWidth(title1) : ''),
    'Title 2':             title2,
    'Title 2 Length':      String(title2.length || ''),
  };
}

/**
 * Extract meta description values.
 * SF records Meta Description 1 and Meta Description 2.
 *
 * @param {CheerioAPI} $
 * @returns {object}
 */
function extractMetaDescriptions($) {
  const descs = [];
  $('meta[name="description"], meta[name="Description"]').each((_, el) => {
    const content = ($(el).attr('content') || '').trim();
    if (content) descs.push(content);
  });

  const desc1 = descs[0] || '';
  const desc2 = descs[1] || '';

  return {
    'Meta Description 1':        desc1,
    'Meta Description 1 Length': String(desc1.length || ''),
    'Meta Description 2':        desc2,
  };
}

/**
 * Extract meta robots directives.
 * Handles: name="robots", name="googlebot", name="bingbot"
 *
 * @param {CheerioAPI} $
 * @returns {object}
 */
function extractMetaRobots($) {
  const robotsMeta = [];
  $('meta[name="robots"], meta[name="googlebot"], meta[name="bingbot"]').each((_, el) => {
    const content = ($(el).attr('content') || '').trim();
    if (content) robotsMeta.push(content);
  });

  return {
    'Meta Robots 1': robotsMeta[0] || '',
    'Meta Robots 2': robotsMeta[1] || '',
  };
}

/**
 * Extract meta refresh tag.
 * Returns the content attribute value if present, or empty string.
 *
 * @param {CheerioAPI} $
 * @returns {string}
 */
function extractMetaRefresh($) {
  const refresh = $('meta[http-equiv="refresh"], meta[http-equiv="Refresh"]').first();
  return (refresh.attr('content') || '').trim();
}

/**
 * Extract viewport meta tag.
 *
 * @param {CheerioAPI} $
 * @returns {string}
 */
function extractViewport($) {
  return ($('meta[name="viewport"]').first().attr('content') || '').trim();
}

/**
 * Extract Open Graph meta tags.
 *
 * @param {CheerioAPI} $
 * @returns {object}
 */
function extractOpenGraph($) {
  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop    = ($(el).attr('property') || '').replace('og:', '');
    const content = ($(el).attr('content') || '').trim();
    if (prop && content) og[prop] = content;
  });

  return {
    'OG Title':       og['title']       || '',
    'OG Description': og['description'] || '',
    'OG Image':       og['image']       || '',
    'OG URL':         og['url']         || '',
    'OG Type':        og['type']        || '',
  };
}

/**
 * Extract Twitter card meta tags.
 *
 * @param {CheerioAPI} $
 * @returns {object}
 */
function extractTwitter($) {
  const tw = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name    = ($(el).attr('name') || '').replace('twitter:', '');
    const content = ($(el).attr('content') || '').trim();
    if (name && content) tw[name] = content;
  });

  return {
    'Twitter Card':        tw['card']        || '',
    'Twitter Title':       tw['title']       || '',
    'Twitter Description': tw['description'] || '',
    'Twitter Image':       tw['image']       || '',
  };
}

/**
 * Check if the title tag is inside <head> (SF flags titles outside head).
 * @param {CheerioAPI} $
 * @returns {boolean}
 */
function isTitleOutsideHead($) {
  let outsideHead = false;
  $('title').each((_, el) => {
    // Walk up parents — if we never find <head>, it's outside head
    let parent = $(el).parent();
    let found  = false;
    while (parent.length > 0) {
      if (parent.is('head')) { found = true; break; }
      parent = parent.parent();
    }
    if (!found) outsideHead = true;
  });
  return outsideHead;
}

/**
 * Check if multiple <title> tags exist.
 * @param {CheerioAPI} $
 * @returns {boolean}
 */
function hasMultipleTitles($) {
  return $('title').length > 1;
}

/**
 * Check if multiple meta descriptions exist.
 * @param {CheerioAPI} $
 * @returns {boolean}
 */
function hasMultipleMetaDescriptions($) {
  return $('meta[name="description"]').length > 1;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all meta-related data from a page.
 *
 * @param {CheerioAPI} $ — cheerio instance for the page
 * @param {string}     url
 * @returns {object}   SF-compatible meta fields + internal flags
 */
export function extractMeta($, url) {
  if (!$) {
    logger.warn(`No cheerio instance for ${url}`);
    return {};
  }

  try {
    return {
      ...extractTitles($),
      ...extractMetaDescriptions($),
      ...extractMetaRobots($),
      ...extractOpenGraph($),
      ...extractTwitter($),
      'Meta Refresh':            extractMetaRefresh($),
      'Viewport':                extractViewport($),

      // Internal flags used by check logic
      _titleOutsideHead:         isTitleOutsideHead($),
      _multipleTitles:           hasMultipleTitles($),
      _multipleMetaDescriptions: hasMultipleMetaDescriptions($),
    };
  } catch (err) {
    logger.error(`Meta extraction failed for ${url}: ${err.message}`);
    return {};
  }
}
