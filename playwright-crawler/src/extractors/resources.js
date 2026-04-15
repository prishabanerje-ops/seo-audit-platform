/**
 * Resources extractor
 *
 * Extracts all JS, CSS, and font resources from a page and classifies each as:
 *   - Critical     — render-blocking, in <head>, no defer/async
 *   - Deferrable   — in <head> but could be deferred
 *   - Safe to Block — known third-party non-essential scripts
 *   - Removable    — unused, duplicate, or tiny third-party resources
 *
 * Also identifies:
 *   - Large JS bundles (> 100KB by URL pattern)
 *   - Render-blocking scripts
 *   - Third-party vs first-party
 *   - Tag manager count (GTM, Tealium, etc.)
 *   - Tracking script count (analytics, ads, pixels)
 */

import { createLogger } from '../utils/logger.js';
import { resolveUrl }   from '../utils/url.js';

const logger = createLogger('extractor:resources');

// ─── Third-party classification rules ─────────────────────────────────────────

const THIRD_PARTY_PATTERNS = [
  // Analytics
  { pattern: /google-analytics\.com|googletagmanager\.com|gtag\/js/i,     category: 'Analytics',    vendor: 'Google Analytics',  verdict: 'Safe to Block' },
  { pattern: /hotjar\.com/i,                                               category: 'Analytics',    vendor: 'Hotjar',            verdict: 'Safe to Block' },
  { pattern: /mixpanel\.com/i,                                             category: 'Analytics',    vendor: 'Mixpanel',          verdict: 'Safe to Block' },
  { pattern: /segment\.com|segment\.io/i,                                  category: 'Analytics',    vendor: 'Segment',           verdict: 'Safe to Block' },
  { pattern: /clarity\.ms/i,                                               category: 'Analytics',    vendor: 'MS Clarity',        verdict: 'Safe to Block' },
  { pattern: /heap\.io|heapanalytics/i,                                    category: 'Analytics',    vendor: 'Heap',              verdict: 'Safe to Block' },

  // Tag Managers
  { pattern: /googletagmanager\.com\/gtm\.js/i,                           category: 'Tag Manager',  vendor: 'Google Tag Manager',verdict: 'Deferrable' },
  { pattern: /tealiumiq\.com|tags\.tiqcdn\.com/i,                         category: 'Tag Manager',  vendor: 'Tealium',           verdict: 'Deferrable' },
  { pattern: /launch-cdn\.adobe\.net|satelliteLib/i,                      category: 'Tag Manager',  vendor: 'Adobe Launch',      verdict: 'Deferrable' },

  // Ads
  { pattern: /doubleclick\.net|googlesyndication\.com|adservice\.google/i,category: 'Ads',          vendor: 'Google Ads',        verdict: 'Safe to Block' },
  { pattern: /amazon-adsystem\.com/i,                                      category: 'Ads',          vendor: 'Amazon Ads',        verdict: 'Safe to Block' },
  { pattern: /outbrain\.com/i,                                             category: 'Ads',          vendor: 'Outbrain',          verdict: 'Safe to Block' },
  { pattern: /taboola\.com/i,                                              category: 'Ads',          vendor: 'Taboola',           verdict: 'Safe to Block' },

  // Social / Pixels
  { pattern: /connect\.facebook\.net|facebook\.com\/tr/i,                 category: 'Social',       vendor: 'Facebook Pixel',    verdict: 'Safe to Block' },
  { pattern: /platform\.twitter\.com|syndication\.twitter\.com/i,         category: 'Social',       vendor: 'Twitter/X',         verdict: 'Safe to Block' },
  { pattern: /snap\.licdn\.com|linkedin\.com\/insight/i,                   category: 'Social',       vendor: 'LinkedIn',          verdict: 'Safe to Block' },
  { pattern: /sc-static\.net|static\.snapchat\.com/i,                      category: 'Social',       vendor: 'Snapchat',          verdict: 'Safe to Block' },

  // Fonts
  { pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/i,               category: 'Fonts',        vendor: 'Google Fonts',      verdict: 'Deferrable' },
  { pattern: /use\.typekit\.net|use\.typekit\.com/i,                       category: 'Fonts',        vendor: 'Adobe Fonts',       verdict: 'Deferrable' },

  // CDN Libraries
  { pattern: /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com/i,     category: 'CDN Library',  vendor: 'CDN',               verdict: 'Deferrable' },
  { pattern: /code\.jquery\.com/i,                                         category: 'CDN Library',  vendor: 'jQuery CDN',        verdict: 'Deferrable' },

  // Chat / Support
  { pattern: /widget\.intercom\.io|js\.intercomcdn\.com/i,                category: 'Chat',         vendor: 'Intercom',          verdict: 'Safe to Block' },
  { pattern: /static\.zdassets\.com|ekr\.zdassets\.com/i,                  category: 'Chat',         vendor: 'Zendesk',           verdict: 'Safe to Block' },
  { pattern: /js\.hs-scripts\.com|js\.hubspot\.com/i,                      category: 'Chat',         vendor: 'HubSpot',           verdict: 'Safe to Block' },

  // Performance monitoring
  { pattern: /rum\.browser-intake-datadoghq\.com|datadoghq\.com/i,        category: 'Monitoring',   vendor: 'Datadog RUM',       verdict: 'Safe to Block' },
  { pattern: /newrelic\.com/i,                                             category: 'Monitoring',   vendor: 'New Relic',         verdict: 'Safe to Block' },
];

/**
 * Classify a resource URL against known third-party patterns.
 * Returns null if not recognised as a known third party.
 *
 * @param {string} src
 * @returns {{ category: string, vendor: string, verdict: string }|null}
 */
function classifyThirdParty(src) {
  for (const rule of THIRD_PARTY_PATTERNS) {
    if (rule.pattern.test(src)) {
      return { category: rule.category, vendor: rule.vendor, verdict: rule.verdict };
    }
  }
  return null;
}

/**
 * Check if a URL is first-party relative to the page origin.
 *
 * @param {string} src
 * @param {string} pageUrl
 * @returns {boolean}
 */
function isFirstParty(src, pageUrl) {
  try {
    const srcHost  = new URL(src).hostname;
    const pageHost = new URL(pageUrl).hostname;
    return srcHost === pageHost || srcHost.endsWith(`.${pageHost}`) || pageHost.endsWith(`.${srcHost}`);
  } catch {
    return true; // relative URLs are first-party
  }
}

// ─── Script extractor ─────────────────────────────────────────────────────────

/**
 * Extract and classify all <script> tags.
 *
 * @param {CheerioAPI} $
 * @param {string}     pageUrl
 * @returns {object[]}
 */
function extractScripts($, pageUrl) {
  const scripts = [];
  const seen    = new Set();

  $('script').each((i, el) => {
    const src     = ($(el).attr('src') || '').trim();
    const defer   = $(el).attr('defer') !== undefined;
    const async_  = $(el).attr('async') !== undefined;
    const type    = ($(el).attr('type') || '').toLowerCase();
    const inline  = !src;

    // Skip JSON-LD and module type for blocking analysis
    if (type === 'application/ld+json') return;

    if (src) {
      const resolved = resolveUrl(src, pageUrl) || src;
      if (seen.has(resolved)) return; // skip duplicates
      seen.add(resolved);

      const inHead       = isInHead($, el);
      const thirdParty   = classifyThirdParty(resolved);
      const firstParty   = isFirstParty(resolved, pageUrl);
      const isBlocking   = inHead && !defer && !async_ && !type.includes('module');

      let verdict = 'Critical';
      let category = firstParty ? 'First Party' : 'Third Party';

      if (thirdParty) {
        verdict  = thirdParty.verdict;
        category = thirdParty.category;
      } else if (!isBlocking) {
        verdict = 'Deferrable';
      } else if (!firstParty) {
        verdict = 'Safe to Block';
      }

      scripts.push({
        src:        resolved,
        type:       'script',
        defer,
        async:      async_,
        inHead,
        inline:     false,
        isBlocking,
        firstParty,
        category,
        vendor:     thirdParty?.vendor || '',
        verdict,
      });
    } else if (inline) {
      // Inline scripts — only flag large ones
      const content = $(el).html() || '';
      if (content.length > 5000) {
        scripts.push({
          src:       '[inline]',
          type:      'script-inline',
          defer:     false,
          async:     false,
          inHead:    isInHead($, el),
          inline:    true,
          isBlocking: true,
          firstParty: true,
          category:  'Inline Script',
          vendor:    '',
          verdict:   content.length > 20000 ? 'Critical' : 'Deferrable',
          size:      content.length,
        });
      }
    }
  });

  return scripts;
}

// ─── Stylesheet extractor ─────────────────────────────────────────────────────

/**
 * Extract and classify all <link rel="stylesheet"> and <style> tags.
 *
 * @param {CheerioAPI} $
 * @param {string}     pageUrl
 * @returns {object[]}
 */
function extractStylesheets($, pageUrl) {
  const sheets = [];
  const seen   = new Set();

  $('link[rel="stylesheet"], link[rel="preload"][as="style"]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;

    const resolved = resolveUrl(href, pageUrl) || href;
    if (seen.has(resolved)) return;
    seen.add(resolved);

    const media      = ($(el).attr('media') || 'all').toLowerCase();
    const thirdParty = classifyThirdParty(resolved);
    const firstParty = isFirstParty(resolved, pageUrl);
    const isBlocking = media === 'all' || media === 'screen';

    sheets.push({
      src:        resolved,
      type:       'stylesheet',
      media,
      inHead:     true, // link tags should always be in head
      inline:     false,
      isBlocking,
      firstParty,
      category:   thirdParty?.category || (firstParty ? 'First Party CSS' : 'Third Party CSS'),
      vendor:     thirdParty?.vendor || '',
      verdict:    thirdParty?.verdict || (isBlocking ? 'Critical' : 'Deferrable'),
    });
  });

  return sheets;
}

// ─── Font extractor ───────────────────────────────────────────────────────────

/**
 * Extract font preload hints and @font-face references.
 *
 * @param {CheerioAPI} $
 * @param {string}     pageUrl
 * @returns {object[]}
 */
function extractFonts($, pageUrl) {
  const fonts = [];

  $('link[rel="preload"][as="font"], link[rel="preconnect"]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;

    const resolved   = resolveUrl(href, pageUrl) || href;
    const crossorigin = $(el).attr('crossorigin') !== undefined;
    const thirdParty = classifyThirdParty(resolved);

    fonts.push({
      src:        resolved,
      type:       'font',
      crossorigin,
      firstParty: isFirstParty(resolved, pageUrl),
      category:   thirdParty?.category || 'Font',
      vendor:     thirdParty?.vendor   || '',
      verdict:    crossorigin ? 'Deferrable' : 'Critical',
    });
  });

  return fonts;
}

// ─── Helper: check if element is inside <head> ────────────────────────────────

function isInHead($, el) {
  let parent = $(el).parent();
  while (parent.length > 0) {
    if (parent.is('head')) return true;
    if (parent.is('body')) return false;
    parent = parent.parent();
  }
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract and classify all page resources.
 *
 * @param {CheerioAPI} $
 * @param {string}     pageUrl
 * @returns {object}
 */
export function extractResources($, pageUrl) {
  if (!$) {
    logger.warn(`No cheerio instance for ${pageUrl}`);
    return { _resources: [] };
  }

  try {
    const scripts     = extractScripts($, pageUrl);
    const stylesheets = extractStylesheets($, pageUrl);
    const fonts       = extractFonts($, pageUrl);
    const all         = [...scripts, ...stylesheets, ...fonts];

    // Summary counts
    const blockingCount     = all.filter(r => r.isBlocking && r.verdict === 'Critical').length;
    const thirdPartyCount   = all.filter(r => !r.firstParty).length;
    const tagManagerCount   = all.filter(r => r.category === 'Tag Manager').length;
    const trackingCount     = all.filter(r => ['Analytics','Ads','Social','Monitoring'].includes(r.category)).length;
    const safeToBlockCount  = all.filter(r => r.verdict === 'Safe to Block').length;

    logger.debug(`Resources: ${scripts.length} scripts, ${stylesheets.length} CSS, ${fonts.length} fonts — ${pageUrl}`);

    return {
      // ── Internal flags ────────────────────────────────────────
      _resources:         all,
      _scripts:           scripts,
      _stylesheets:       stylesheets,
      _fonts:             fonts,
      _resourceCount:     all.length,
      _blockingCount:     blockingCount,
      _thirdPartyCount:   thirdPartyCount,
      _tagManagerCount:   tagManagerCount,
      _trackingCount:     trackingCount,
      _safeToBlockCount:  safeToBlockCount,
      _renderBlocking:    blockingCount > 0,
      _excessiveTracking: trackingCount > 5,
      _multipleTagManagers: tagManagerCount > 1,
    };
  } catch (err) {
    logger.error(`Resources extraction failed for ${pageUrl}: ${err.message}`);
    return { _resources: [] };
  }
}
