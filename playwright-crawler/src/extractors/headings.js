/**
 * Headings extractor
 *
 * Extracts H1–H6 data matching SF CSV output:
 *
 * h1_all.csv columns:
 *   Address, H1-1, H1-1 Length, H1-2, H1-2 Length, Occurrences, Indexability
 *
 * h2_all.csv columns:
 *   Address, H2-1, H2-1 Length, H2-2, H2-2 Length, Occurrences, Indexability
 *
 * Also extracts H3–H6 counts for hierarchy checks.
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:headings');

/**
 * Extract heading data for a given heading level (h1, h2, h3, etc.)
 *
 * @param {CheerioAPI} $
 * @param {string}     level  — 'h1' | 'h2' | 'h3' | ...
 * @returns {object}
 */
function extractLevel($, level) {
  const L = level.toUpperCase(); // 'H1', 'H2', etc.
  const headings = [];

  $(level).each((_, el) => {
    // Get visible text — strip inner tags
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text) headings.push(text);
  });

  const first  = headings[0] || '';
  const second = headings[1] || '';
  const count  = headings.length;

  return {
    [`${L}-1`]:             first,
    [`${L}-1 Length`]:      String(first.length  || ''),
    [`${L}-2`]:             second,
    [`${L}-2 Length`]:      String(second.length || ''),
    [`${L} Occurrences`]:   String(count),
    _allHeadings:           headings,
  };
}

/**
 * Check if headings are hidden via common CSS patterns.
 * Cheerio doesn't execute CSS, so we check for inline styles only.
 * (Playwright-rendered pages will already have resolved styles applied to DOM.)
 *
 * @param {CheerioAPI} $
 * @returns {boolean}
 */
function hasHiddenHeadings($) {
  let hidden = false;
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const style = ($(el).attr('style') || '').toLowerCase();
    if (
      style.includes('display:none') ||
      style.includes('display: none') ||
      style.includes('visibility:hidden') ||
      style.includes('visibility: hidden') ||
      style.includes('opacity:0') ||
      style.includes('opacity: 0')
    ) {
      hidden = true;
    }
  });
  return hidden;
}

/**
 * Check heading hierarchy — H1 → H2 → H3 should not skip levels.
 * Returns true if levels are skipped (e.g. H1 → H3 with no H2).
 *
 * @param {CheerioAPI} $
 * @returns {boolean}
 */
function hasBrokenHierarchy($) {
  const order = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = parseInt(el.tagName.replace('h', ''), 10);
    order.push(level);
  });

  for (let i = 1; i < order.length; i++) {
    // A jump of more than 1 level downward is a hierarchy violation
    if (order[i] - order[i - 1] > 1) return true;
  }
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all heading data from a page.
 *
 * @param {CheerioAPI} $ — cheerio instance
 * @param {string}     url
 * @returns {object}   SF-compatible heading fields + internal flags
 */
export function extractHeadings($, url) {
  if (!$) {
    logger.warn(`No cheerio instance for ${url}`);
    return {};
  }

  try {
    const h1Data = extractLevel($, 'h1');
    const h2Data = extractLevel($, 'h2');
    const h3Data = extractLevel($, 'h3');
    const h4Data = extractLevel($, 'h4');
    const h5Data = extractLevel($, 'h5');
    const h6Data = extractLevel($, 'h6');

    // H2 Overstuffing — more than 10 H2 tags
    const h2Count = parseInt(h2Data['H2 Occurrences'], 10);
    const h1Count = parseInt(h1Data['H1 Occurrences'], 10);

    // Ordered [{level, text}] for all h1–h6 — used by heading/AIO checks
    const headingHierarchy = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const level = parseInt(el.tagName.slice(1), 10);
      const text  = $(el).text().replace(/\s+/g, ' ').trim();
      if (text) headingHierarchy.push({ level, text });
    });

    return {
      // ── SF h1_all.csv columns ─────────────────────────────────
      'H1-1':           h1Data['H1-1'],
      'H1-1 Length':    h1Data['H1-1 Length'],
      'H1-2':           h1Data['H1-2'],
      'H1-2 Length':    h1Data['H1-2 Length'],
      'H1 Occurrences': h1Data['H1 Occurrences'],

      // ── SF h2_all.csv columns ─────────────────────────────────
      'H2-1':           h2Data['H2-1'],
      'H2-1 Length':    h2Data['H2-1 Length'],
      'H2-2':           h2Data['H2-2'],
      'H2-2 Length':    h2Data['H2-2 Length'],
      'H2 Occurrences': h2Data['H2 Occurrences'],

      // ── H3–H6 counts (for hierarchy checks) ──────────────────
      'H3 Occurrences': h3Data['H3 Occurrences'],
      'H4 Occurrences': h4Data['H4 Occurrences'],
      'H5 Occurrences': h5Data['H5 Occurrences'],
      'H6 Occurrences': h6Data['H6 Occurrences'],

      // ── Internal flags ────────────────────────────────────────
      _h1Missing:         h1Count === 0,
      _multipleH1s:       h1Count > 1,
      _h2Missing:         h2Count === 0,
      _h2Overstuffed:     h2Count > 10,
      _hiddenHeadings:    hasHiddenHeadings($),
      _brokenHierarchy:   hasBrokenHierarchy($),
      _allH1s:            h1Data._allHeadings,
      _allH2s:            h2Data._allHeadings,
      _headingHierarchy:  headingHierarchy,
    };
  } catch (err) {
    logger.error(`Headings extraction failed for ${url}: ${err.message}`);
    return {};
  }
}
