/**
 * Images extractor
 *
 * Extracts all <img> tags matching SF images_all.csv output:
 *
 * images_all.csv columns:
 *   Address, Source, Alt Text, Alt Text Length, Title,
 *   Missing Alt Text, Alt Text Too Long
 *
 * Also detects:
 *   - WebP format usage
 *   - Lazy load (loading="lazy")
 *   - Image file size estimate (from Content-Length if available, else 0)
 *   - Image format from extension
 */

import { createLogger } from '../utils/logger.js';
import { resolveUrl }   from '../utils/url.js';

const logger = createLogger('extractor:images');

// SF flags alt text as "too long" over 100 chars
const ALT_TEXT_MAX_LENGTH = 100;

// Image extensions
const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'avif', 'bmp', 'ico', 'tiff', 'tif',
]);

/**
 * Detect image format from a URL path.
 * @param {string} src
 * @returns {string}  e.g. 'jpg', 'webp', 'svg', or ''
 */
function detectFormat(src) {
  try {
    const path = new URL(src).pathname;
    const ext  = path.split('.').pop().toLowerCase().split('?')[0];
    return IMAGE_EXTS.has(ext) ? ext : '';
  } catch {
    const ext = src.split('.').pop().toLowerCase().split('?')[0];
    return IMAGE_EXTS.has(ext) ? ext : '';
  }
}

/**
 * Extract all image data from a page.
 *
 * @param {CheerioAPI} $
 * @param {string}     pageUrl   — absolute URL of the page (used to resolve relative src)
 * @returns {object}
 */
export function extractImages($, pageUrl) {
  if (!$) {
    logger.warn(`No cheerio instance for ${pageUrl}`);
    return { _images: [] };
  }

  try {
    const images = [];

    $('img').each((_, el) => {
      const rawSrc   = ($(el).attr('src') || $(el).attr('data-src') || '').trim();
      const alt      = ($(el).attr('alt')    || '').trim();
      const title    = ($(el).attr('title')  || '').trim();
      const loading  = ($(el).attr('loading') || '').toLowerCase();
      const width    = parseInt($(el).attr('width')  || '0', 10) || 0;
      const height   = parseInt($(el).attr('height') || '0', 10) || 0;

      const src      = resolveUrl(rawSrc, pageUrl) || rawSrc;
      const format   = detectFormat(src);
      const isWebP   = format === 'webp';
      const isLazy   = loading === 'lazy';
      const altLen   = alt.length;

      // SF flags
      const missingAlt = alt === '' && $(el).attr('alt') !== undefined
        ? 'False'   // alt="" is decorative — not missing in SF
        : alt === '' && $(el).attr('alt') === undefined
          ? 'True'  // no alt attribute at all
          : 'False';

      const altTooLong = altLen > ALT_TEXT_MAX_LENGTH ? 'True' : 'False';

      images.push({
        // ── SF images_all.csv columns ──────────────────────────
        'Source':          src,
        'Alt Text':        alt,
        'Alt Text Length': String(altLen),
        'Title':           title,
        'Missing Alt Text': missingAlt,
        'Alt Text Too Long': altTooLong,

        // ── Internal flags ─────────────────────────────────────
        _format:    format,
        _isWebP:    isWebP,
        _isLazy:    isLazy,
        _width:     width,
        _height:    height,
      });
    });

    // Page-level summary flags
    const missingAltCount   = images.filter(i => i['Missing Alt Text'] === 'True').length;
    const altTooLongCount   = images.filter(i => i['Alt Text Too Long'] === 'True').length;
    const noWebPCount       = images.filter(i => !i._isWebP && i._format && i._format !== 'svg').length;
    const lazyLoadErrors    = images.filter(i => i._isLazy && !i.src).length;

    logger.debug(`Images: ${images.length} total, ${missingAltCount} missing alt — ${pageUrl}`);

    return {
      _images:          images,
      _imageCount:      images.length,
      _missingAltCount: missingAltCount,
      _altTooLongCount: altTooLongCount,
      _noWebPCount:     noWebPCount,
      _lazyLoadErrors:  lazyLoadErrors,
    };
  } catch (err) {
    logger.error(`Images extraction failed for ${pageUrl}: ${err.message}`);
    return { _images: [] };
  }
}
