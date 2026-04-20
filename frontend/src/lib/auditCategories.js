// frontend/src/lib/auditCategories.js

/**
 * 23-group audit taxonomy (Phase 2 rebuild).
 *
 * SLUG_TO_SECTION  → URL slug → DB category name (used in AuditCategory page)
 * SECTION_TO_SLUG  → DB category name → canonical slug (used in AuditCategories list)
 */

export const SLUG_TO_SECTION = {
  // Technical SEO
  'response-codes':    'Response Codes & Redirects',
  'canonicalisation':  'Canonicalisation',
  'robots':            'Robots & Crawl Directives',
  'sitemaps':          'XML Sitemaps',
  'crawlability':      'Crawlability & Indexability',
  'url-structure':     'URL Structure',
  'javascript':        'JavaScript Rendering',
  'mobile':            'Mobile & Usability',
  'security':          'Security & HTTPS',
  'core-web-vitals':   'Core Web Vitals',

  // On-Page SEO
  'title-tags':        'Title Tags',
  'meta-desc':         'Meta Descriptions',
  'headings':          'Headings',
  'content':           'Content Quality',
  'images':            'Images',
  'schema':            'Schema & Structured Data',
  'internal-linking':  'Internal Linking',
  'international':     'International SEO',

  // Performance & Monitoring
  'rankings':          'Rankings & Traffic',

  // Off-Page & Authority
  'backlinks':         'Backlinks & Authority',

  // Trust
  'eeat':              'E-E-A-T Signals',

  // AI & Future Search
  'aio':               'AI Overviews & AIO Optimization',
  'geo-llm':           'GEO & LLM Crawlers',

  // Local
  'local-seo':         'Local SEO & GEO',

  // Legacy aliases (keep for backwards compat with any stored links)
  'redirects':         'Response Codes & Redirects',
  'canonicals':        'Canonicalisation',
  'indexability':      'Crawlability & Indexability',
  'sitemap':           'XML Sitemaps',
  'crawl-depth':       'URL Structure',
  'custom':            'JavaScript Rendering',
  'hreflang':          'International SEO',
  'structured-data':   'Schema & Structured Data',
  'links':             'Internal Linking',
  'page-speed':        'Core Web Vitals',
};

/**
 * Canonical slug per DB category name.
 * Used to build navigation links in the AuditCategories picker.
 */
export const SECTION_TO_SLUG = {
  'Response Codes & Redirects':      'response-codes',
  'Canonicalisation':                'canonicalisation',
  'Robots & Crawl Directives':       'robots',
  'XML Sitemaps':                    'sitemaps',
  'Crawlability & Indexability':     'crawlability',
  'URL Structure':                   'url-structure',
  'JavaScript Rendering':            'javascript',
  'Mobile & Usability':              'mobile',
  'Security & HTTPS':                'security',
  'Core Web Vitals':                 'core-web-vitals',
  'Title Tags':                      'title-tags',
  'Meta Descriptions':               'meta-desc',
  'Headings':                        'headings',
  'Content Quality':                 'content',
  'Images':                          'images',
  'Schema & Structured Data':        'schema',
  'Internal Linking':                'internal-linking',
  'International SEO':               'international',
  'Rankings & Traffic':              'rankings',
  'Backlinks & Authority':           'backlinks',
  'E-E-A-T Signals':                 'eeat',
  'AI Overviews & AIO Optimization': 'aio',
  'GEO & LLM Crawlers':              'geo-llm',
  'Local SEO & GEO':                 'local-seo',
};

/**
 * Ordered display list for the Audit Categories page.
 * Groups are organized into logical sections for the UI.
 */
export const AUDIT_CATEGORY_GROUPS = [
  {
    groupLabel: 'Technical SEO',
    categories: [
      'Response Codes & Redirects',
      'Canonicalisation',
      'Robots & Crawl Directives',
      'XML Sitemaps',
      'Crawlability & Indexability',
      'URL Structure',
      'JavaScript Rendering',
      'Mobile & Usability',
      'Security & HTTPS',
      'Core Web Vitals',
    ],
  },
  {
    groupLabel: 'On-Page SEO',
    categories: [
      'Title Tags',
      'Meta Descriptions',
      'Headings',
      'Content Quality',
      'Images',
      'Schema & Structured Data',
      'Internal Linking',
      'International SEO',
    ],
  },
  {
    groupLabel: 'Performance & Monitoring',
    categories: ['Rankings & Traffic'],
  },
  {
    groupLabel: 'Off-Page & Authority',
    categories: ['Backlinks & Authority'],
  },
  {
    groupLabel: 'Trust & Credibility',
    categories: ['E-E-A-T Signals'],
  },
  {
    groupLabel: 'AI & Future Search',
    categories: ['AI Overviews & AIO Optimization', 'GEO & LLM Crawlers'],
  },
  {
    groupLabel: 'Local SEO',
    categories: ['Local SEO & GEO'],
  },
];
