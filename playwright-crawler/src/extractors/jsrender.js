/**
 * JS Render extractor (per-page, Playwright-only)
 *
 * Compares raw HTML (before JS execution) vs rendered HTML (after JS execution)
 * to detect content that depends on JavaScript.
 */

import { load }          from 'cheerio';
import { createLogger }  from '../utils/logger.js';

const logger = createLogger('extractor:jsrender');

function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractTitle(html) {
  try {
    const $ = load(html);
    return $('title').first().text().trim();
  } catch { return ''; }
}

function hasJsonLd(html) {
  return /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);
}

function hasH1(html) {
  try {
    const $ = load(html);
    return $('h1').length > 0;
  } catch { return false; }
}

function hasArticle(html) {
  try {
    const $ = load(html);
    return $('article, main, [role="main"]').length > 0;
  } catch { return false; }
}

function getBodyWordCount(html) {
  try {
    const $ = load(html);
    $('script, style, noscript').remove();
    return countWords($('body').text());
  } catch { return 0; }
}

function detectHashRouting(html) {
  // Hash-based SPA routing: many internal links with href="#..."
  try {
    const $ = load(html);
    const hashLinks = $('a[href]').filter((_, el) => {
      const href = ($(el).attr('href') || '').trim();
      return href.startsWith('#') && href.length > 1;
    }).length;
    return hashLinks > 3;
  } catch { return false; }
}

function detectInfiniteScroll(html) {
  // Heuristic: page has no pagination links but has large volume of list items
  try {
    const $ = load(html);
    const hasPagination = $('a[rel="next"], .pagination, [aria-label*="page"], nav a').length > 0;
    const listItems     = $('li, .item, [class*="card"], [class*="product"]').length;
    return !hasPagination && listItems > 20;
  } catch { return false; }
}

/**
 * Compare raw (pre-render) HTML vs rendered (post-render) HTML.
 *
 * @param {string} rawHtml       — HTML body as received from server (before JS runs)
 * @param {string} renderedHtml  — HTML after Playwright JS execution
 * @param {string} pageUrl
 * @returns {object}  { _jsrender: { ... } }
 */
export function extractJsRender(rawHtml, renderedHtml, pageUrl) {
  if (!rawHtml || !renderedHtml) {
    return {
      _jsrender: {
        titleChangedAfterRender:  false,
        preRenderTitle:           '',
        postRenderTitle:          '',
        wordCountChange:          0,
        preRenderWordCount:       0,
        postRenderWordCount:      0,
        schemaOnlyAfterRender:    false,
        hasHashRouting:           false,
        hasInfiniteScroll:        false,
        criticalContentJsOnly:    false,
      },
    };
  }

  try {
    const preRenderTitle  = extractTitle(rawHtml);
    const postRenderTitle = extractTitle(renderedHtml);
    const titleChangedAfterRender = preRenderTitle !== postRenderTitle && postRenderTitle.length > 0;

    const preRenderWordCount  = getBodyWordCount(rawHtml);
    const postRenderWordCount = getBodyWordCount(renderedHtml);
    const wordCountChange     = postRenderWordCount - preRenderWordCount;

    const schemaOnlyAfterRender = !hasJsonLd(rawHtml) && hasJsonLd(renderedHtml);

    // Critical content is JS-only if h1 or article/main is absent in raw but present rendered
    const criticalContentJsOnly = (!hasH1(rawHtml) && hasH1(renderedHtml)) ||
                                  (!hasArticle(rawHtml) && hasArticle(renderedHtml));

    const hasHashRouting   = detectHashRouting(renderedHtml);
    const hasInfiniteScroll = detectInfiniteScroll(renderedHtml);

    logger.debug(`jsrender: titleChanged=${titleChangedAfterRender}, wordDiff=${wordCountChange}, schemaOnly=${schemaOnlyAfterRender} — ${pageUrl}`);

    return {
      _jsrender: {
        titleChangedAfterRender,
        preRenderTitle,
        postRenderTitle,
        wordCountChange,
        preRenderWordCount,
        postRenderWordCount,
        schemaOnlyAfterRender,
        hasHashRouting,
        hasInfiniteScroll,
        criticalContentJsOnly,
      },
    };
  } catch (err) {
    logger.error(`jsrender extraction failed for ${pageUrl}: ${err.message}`);
    return {
      _jsrender: {
        titleChangedAfterRender: false, preRenderTitle: '', postRenderTitle: '',
        wordCountChange: 0, preRenderWordCount: 0, postRenderWordCount: 0,
        schemaOnlyAfterRender: false, hasHashRouting: false,
        hasInfiniteScroll: false, criticalContentJsOnly: false,
      },
    };
  }
}
