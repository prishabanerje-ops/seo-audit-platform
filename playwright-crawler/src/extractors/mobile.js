/**
 * Mobile SEO extractor (per-page)
 *
 * Extracts viewport meta, AMP link, render-blocking resources,
 * and third-party script count.
 */

import { createLogger } from '../utils/logger.js';
import { resolveUrl }   from '../utils/url.js';

const logger = createLogger('extractor:mobile');

/**
 * @param {CheerioAPI} $
 * @param {string}     pageUrl
 * @returns {object}
 */
export function extractMobile($, pageUrl) {
  if (!$) {
    logger.warn(`No cheerio instance for ${pageUrl}`);
    return { _mobile: { hasViewport: false, viewportContent: '', hasAmpLink: false, ampHref: '', renderBlockingCount: 0, thirdPartyScriptCount: 0, thirdPartyDomains: [] } };
  }

  try {
    const pageOrigin = (() => { try { return new URL(pageUrl).origin; } catch { return ''; } })();

    // Viewport
    const viewportEl      = $('meta[name="viewport"]').first();
    const hasViewport     = viewportEl.length > 0;
    const viewportContent = (viewportEl.attr('content') || '').trim();

    // AMP link
    const ampEl   = $('link[rel="amphtml"]').first();
    const hasAmpLink = ampEl.length > 0;
    const ampHref    = (ampEl.attr('href') || '').trim();

    // Render-blocking resources: sync <script> and <link rel="stylesheet"> in <head>
    let renderBlockingCount = 0;
    $('head script').each((_, el) => {
      const src   = $(el).attr('src');
      const type  = ($(el).attr('type') || '').toLowerCase();
      const defer = $(el).attr('defer') !== undefined;
      const async_ = $(el).attr('async') !== undefined;
      // External sync scripts that are not deferred/async and not module/nomodule bloat
      if (src && !defer && !async_ && type !== 'module') {
        renderBlockingCount++;
      }
    });
    $('head link[rel="stylesheet"]').each(() => {
      renderBlockingCount++;
    });

    // Third-party scripts: external <script src="..."> from a different origin
    const thirdPartyDomainSet = new Set();
    $('script[src]').each((_, el) => {
      const src = ($(el).attr('src') || '').trim();
      if (!src) return;
      try {
        const resolved = resolveUrl(src, pageUrl);
        if (!resolved) return;
        const scriptOrigin = new URL(resolved).origin;
        if (scriptOrigin && scriptOrigin !== pageOrigin) {
          thirdPartyDomainSet.add(scriptOrigin);
        }
      } catch { /* skip malformed */ }
    });

    const thirdPartyDomains      = [...thirdPartyDomainSet];
    const thirdPartyScriptCount  = $('script[src]').toArray().filter((el) => {
      try {
        const src = resolveUrl(($(el).attr('src') || '').trim(), pageUrl);
        return src && new URL(src).origin !== pageOrigin;
      } catch { return false; }
    }).length;

    return {
      _mobile: {
        hasViewport,
        viewportContent,
        hasAmpLink,
        ampHref,
        renderBlockingCount,
        thirdPartyScriptCount,
        thirdPartyDomains,
      },
    };
  } catch (err) {
    logger.error(`Mobile extraction failed for ${pageUrl}: ${err.message}`);
    return { _mobile: { hasViewport: false, viewportContent: '', hasAmpLink: false, ampHref: '', renderBlockingCount: 0, thirdPartyScriptCount: 0, thirdPartyDomains: [] } };
  }
}
