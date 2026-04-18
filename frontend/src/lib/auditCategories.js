// frontend/src/lib/auditCategories.js

/**
 * Maps URL slug → DB section name (used in AuditCategory to resolve the path slug).
 * Legacy slugs (robots, sitemap, security, indexability) redirect to the canonical
 * new names so old bookmarks/links continue to work.
 */
export const SLUG_TO_SECTION = {
  'response-codes':      'Response Codes',
  'redirects':           'Response Codes',
  'canonicals':          'Canonical',
  'robots-indexability': 'Robots & Indexability',
  'robots':              'Robots & Indexability',   // legacy alias
  'indexability':        'Robots & Indexability',   // legacy alias
  'sitemaps':            'Sitemaps',
  'sitemap':             'Sitemaps',                // legacy alias
  'crawl-depth':         'URL Structure',
  'title-tags':          'Title Tags',
  'meta-desc':           'Meta Description',
  'headings':            'Headings',
  'links':               'Internal Linking',
  'images':              'Images',
  'structured-data':     'Schema / Structured Data',
  'content':             'Content',
  'page-speed':          'Speed & Performance',
  'mobile':              'Mobile SEO',
  'custom':              'JavaScript Rendering',
  'hreflang':            'International SEO',
  'international':       'International SEO',
  'security-monitoring': 'Security & Monitoring',
  'security':            'Security & Monitoring',   // legacy alias
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
  'Robots & Indexability':    'robots-indexability',
  'Sitemaps':                 'sitemaps',
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
  'Security & Monitoring':    'security-monitoring',
  'Rankings & Traffic':       'rankings',
  'LLM / AI Crawlers':        'llm-ai',
};
