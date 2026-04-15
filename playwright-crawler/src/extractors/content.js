/**
 * Content extractor
 *
 * Extracts content quality signals matching SF CSV output:
 *
 * internal_all.csv columns used:
 *   Word Count, Text Ratio, Size
 *
 * javascript_all.csv columns:
 *   Rendered Word Count, Raw Word Count, Rendered Title, Raw Title
 *
 * Also extracts:
 *   - Doctype presence
 *   - Lang attribute
 *   - Multiple <head> tags
 *   - Viewport meta (already in meta.js, cross-referenced here)
 *   - Non-visible text (hidden content via CSS)
 *   - Template-to-content ratio estimate
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:content');

// Tags whose text content is boilerplate / navigation — excluded from word count
const BOILERPLATE_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  'script', 'style', 'noscript',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
];

/**
 * Count words in a string.
 * Splits on whitespace and filters empty tokens.
 *
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Get visible text from the page body, stripping script/style content.
 *
 * @param {CheerioAPI} $
 * @returns {string}
 */
function getBodyText($) {
  // Clone body and remove noise elements
  const body = $('body').clone();
  body.find('script, style, noscript, template').remove();
  return body.text().replace(/\s+/g, ' ').trim();
}

/**
 * Get text from main content area only (estimate template ratio).
 * Tries common content selectors in order.
 *
 * @param {CheerioAPI} $
 * @returns {string}
 */
function getMainContentText($) {
  const selectors = ['main', 'article', '#content', '#main', '.content', '.main', '[role="main"]'];
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length > 0) {
      const clone = el.clone();
      clone.find('script, style, noscript').remove();
      const text = clone.text().replace(/\s+/g, ' ').trim();
      if (text.length > 50) return text;
    }
  }
  return '';
}

/**
 * Get boilerplate text (nav, header, footer, aside).
 *
 * @param {CheerioAPI} $
 * @returns {string}
 */
function getBoilerplateText($) {
  let text = '';
  for (const sel of BOILERPLATE_SELECTORS) {
    $(sel).each((_, el) => {
      const clone = $(el).clone();
      clone.find('script, style').remove();
      text += ' ' + clone.text();
    });
  }
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Estimate HTML page size in bytes.
 * @param {string} rawHtml
 * @returns {number}
 */
function estimateSize(rawHtml) {
  return rawHtml ? Buffer.byteLength(rawHtml, 'utf8') : 0;
}

/**
 * Check if page has a valid DOCTYPE declaration.
 * @param {string} rawHtml
 * @returns {boolean}
 */
function hasDoctype(rawHtml) {
  return /^\s*<!DOCTYPE\s+html/i.test(rawHtml || '');
}

/**
 * Check for multiple <head> tags.
 * @param {CheerioAPI} $
 * @returns {boolean}
 */
function hasMultipleHeads($) {
  return $('head').length > 1;
}

/**
 * Extract lang attribute from <html> element.
 * @param {CheerioAPI} $
 * @returns {string}
 */
function getLangAttribute($) {
  return ($('html').first().attr('lang') || '').trim();
}

/**
 * Detect likely keyword stuffing — a single word appearing > 3% of total words.
 * Very rough heuristic.
 *
 * @param {string} text
 * @returns {boolean}
 */
function detectKeywordStuffing(text) {
  const words  = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (words.length < 50) return false;
  const freq   = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const max    = Math.max(...Object.values(freq));
  return max / words.length > 0.05; // > 5% = suspicious
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract content quality data from a page.
 *
 * @param {CheerioAPI} $
 * @param {string}     url
 * @param {string}     rawHtml       — raw (pre-render) HTML string
 * @param {string}     [renderedHtml] — post-JS-render HTML (Playwright pages only)
 * @returns {object}   SF-compatible content fields + internal flags
 */
export function extractContent($, url, rawHtml = '', renderedHtml = '') {
  if (!$) {
    logger.warn(`No cheerio instance for ${url}`);
    return {};
  }

  try {
    const bodyText       = getBodyText($);
    const mainText       = getMainContentText($);
    const boilerplate    = getBoilerplateText($);
    const totalWords     = countWords(bodyText);
    const mainWords      = countWords(mainText);
    const boilerWords    = countWords(boilerplate);
    const sizeBytes      = estimateSize(rawHtml);

    // Text ratio: content text vs total HTML size
    // SF calculates: visible text chars / total HTML chars * 100
    const htmlChars    = (rawHtml || '').length;
    const textChars    = bodyText.length;
    const textRatio    = htmlChars > 0 ? Math.round((textChars / htmlChars) * 100) : 0;

    // Template dominance: boilerplate words > content words
    const templateDominant = boilerWords > mainWords && mainWords > 0;

    // javascript_all.csv equivalents
    const rawTitle      = rawHtml.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
    const renderedTitle = $('title').first().text().trim();

    // Raw word count from raw HTML (pre-render)
    let rawWordCount = 0;
    if (rawHtml) {
      // Strip tags from raw HTML
      const rawText = rawHtml
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      rawWordCount = countWords(rawText);
    }

    logger.debug(`Content: ${totalWords} words, ${textRatio}% text ratio, ${sizeBytes}B — ${url}`);

    return {
      // ── SF internal_all.csv columns ──────────────────────────
      'Word Count':  String(totalWords),
      'Text Ratio':  String(textRatio),
      'Size':        String(sizeBytes),

      // ── SF javascript_all.csv columns ────────────────────────
      'Rendered Word Count': String(totalWords),
      'Raw Word Count':      String(rawWordCount),
      'Rendered Title':      renderedTitle,
      'Raw Title':           rawTitle,

      // ── HTML structure flags ──────────────────────────────────
      'Missing Doctype':       String(!hasDoctype(rawHtml)),
      'Missing Language Attr': String(!getLangAttribute($)),
      'Lang':                  getLangAttribute($),
      'Multiple Heads':        String(hasMultipleHeads($)),

      // ── Internal flags ────────────────────────────────────────
      _wordCount:         totalWords,
      _mainWordCount:     mainWords,
      _boilerplateWords:  boilerWords,
      _textRatio:         textRatio,
      _sizeBytes:         sizeBytes,
      _templateDominant:  templateDominant,
      _thinContent:       totalWords < 200,
      _keywordStuffing:   detectKeywordStuffing(bodyText),
      _missingDoctype:    !hasDoctype(rawHtml),
      _missingLang:       !getLangAttribute($),
      _multipleHeads:     hasMultipleHeads($),
    };
  } catch (err) {
    logger.error(`Content extraction failed for ${url}: ${err.message}`);
    return {};
  }
}
