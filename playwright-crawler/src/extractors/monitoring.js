/**
 * Monitoring & Operations extractor (per-page)
 *
 * Detects HTTPS, security headers, analytics scripts (GA4/GTM),
 * and server response time.
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:monitoring');

// GA4 measurement ID pattern: G-XXXXXXXXXX
const GA4_PATTERN   = /G-[A-Z0-9]{4,}/g;
// GTM container pattern: GTM-XXXXXX
const GTM_PATTERN   = /GTM-[A-Z0-9]{4,}/g;
// UA pattern (legacy): UA-XXXXXX-X
const UA_PATTERN    = /UA-\d{4,}-\d+/g;

/**
 * @param {object} headers        — response headers object (lowercase keys)
 * @param {number} responseTime   — ms from request start to response
 * @param {CheerioAPI} $
 * @param {string} pageUrl
 * @returns {object}
 */
export function extractMonitoring(headers, responseTime, $, pageUrl) {
  try {
    const isHttps = pageUrl.startsWith('https://');

    // Security headers (case-insensitive — normalise to lowercase)
    const h = Object.fromEntries(
      Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
    const hasHsts                = !!(h['strict-transport-security']);
    const hasXContentTypeOptions = !!(h['x-content-type-options']);
    const hasXFrameOptions       = !!(h['x-frame-options']);
    const hasContentSecurityPolicy = !!(h['content-security-policy']);

    // Analytics detection — scan all inline <script> text and <script src> attrs
    let analyticsDetected = false;
    let analyticsType     = 'none';
    let ga4DoubleFiring   = false;

    if ($) {
      const allScriptText = $('script:not([src])').map((_, el) => $(el).html() || '').get().join('\n');
      const allScriptSrcs = $('script[src]').map((_, el) => $(el).attr('src') || '').get().join('\n');
      const combined      = allScriptText + '\n' + allScriptSrcs;

      const ga4Matches = combined.match(GA4_PATTERN);
      const gtmMatches = combined.match(GTM_PATTERN);
      const uaMatches  = combined.match(UA_PATTERN);

      if (ga4Matches) {
        analyticsDetected = true;
        analyticsType     = 'ga4';
        // Double-firing: more than one distinct G- ID
        const uniqueIds = new Set(ga4Matches);
        ga4DoubleFiring = uniqueIds.size > 1;
      } else if (gtmMatches) {
        analyticsDetected = true;
        analyticsType     = 'gtm';
      } else if (uaMatches) {
        analyticsDetected = true;
        analyticsType     = 'ua';
      }
    }

    logger.debug(`Monitoring: https=${isHttps}, hsts=${hasHsts}, analytics=${analyticsType} — ${pageUrl}`);

    return {
      _monitoring: {
        isHttps,
        hasHsts,
        hasXContentTypeOptions,
        hasXFrameOptions,
        hasContentSecurityPolicy,
        analyticsDetected,
        analyticsType,
        ga4DoubleFiring,
        serverResponseTime: responseTime || 0,
      },
    };
  } catch (err) {
    logger.error(`Monitoring extraction failed for ${pageUrl}: ${err.message}`);
    return {
      _monitoring: {
        isHttps: false, hasHsts: false, hasXContentTypeOptions: false,
        hasXFrameOptions: false, hasContentSecurityPolicy: false,
        analyticsDetected: false, analyticsType: 'none',
        ga4DoubleFiring: false, serverResponseTime: 0,
      },
    };
  }
}
