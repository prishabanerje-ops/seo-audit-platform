// frontend/src/lib/auditCategories.js

/**
 * Maps URL slug → DB section name (used in AuditCategory to resolve the path slug).
 * Aliases (redirects → Response Codes, indexability → Robots / Indexability, etc.) are kept
 * for backwards-compat with existing routes in router.jsx.
 */
export const SLUG_TO_SECTION = {
  'response-codes':     'Response Codes',
  'redirects':          'Response Codes',
  'canonicals':         'Canonical',
  'robots':             'Robots / Indexability',
  'indexability':       'Robots / Indexability',
  'sitemap':            'Sitemap',
  'crawl-depth':        'URL Structure',
  'title-tags':         'Title Tags',
  'meta-desc':          'Meta Description',
  'headings':           'Headings',
  'links':              'Internal Linking',
  'images':             'Images',
  'structured-data':    'Schema / Structured Data',
  'content':            'Content',
  'page-speed':         'Speed & Performance',
  'mobile':             'Mobile SEO',
  'custom':             'JavaScript Rendering',
  'hreflang':           'International SEO',
  'international':      'International SEO',
  'security':           'Monitoring & Operations',
  // Phase 2 additions
  'robots-indexability': 'Robots & Indexability',
  'sitemaps':            'Sitemaps',
  'security-monitoring': 'Security & Monitoring',
  'rankings':            'Rankings & Traffic',
  'llm-ai':              'LLM / AI Crawlers',
};

/**
 * Maps DB section name → canonical URL slug (used in AuditCategories picker
 * to build navigation links). One canonical slug per section.
 */
export const SECTION_TO_SLUG = {
  'Response Codes':           'response-codes',
  'Canonical':                'canonicals',
  'Robots / Indexability':    'robots',
  'Sitemap':                  'sitemap',
  'URL Structure':            'crawl-depth',
  'Title Tags':               'title-tags',
  'Meta Description':         'meta-desc',
  'Headings':                 'headings',
  'Internal Linking':         'links',
  'Images':                   'images',
  'Schema / Structured Data': 'structured-data',
  'Content':                  'content',
  'Speed & Performance':      'page-speed',
  'Mobile SEO':               'mobile',
  'JavaScript Rendering':     'custom',
  'International SEO':        'hreflang',
  'Monitoring & Operations':  'security',
  // Phase 2 additions
  'Robots & Indexability':    'robots-indexability',
  'Sitemaps':                 'sitemaps',
  'Security & Monitoring':    'security-monitoring',
  'Rankings & Traffic':       'rankings',
  'LLM / AI Crawlers':        'llm-ai',
};
