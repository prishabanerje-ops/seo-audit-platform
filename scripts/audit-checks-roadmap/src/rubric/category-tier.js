// Maps each of the 23 in-scope canonical categories to one of three infrastructure tiers.
// See spec §6 for tier definitions.
export const CATEGORY_TIER = {
  // Tier 1: Extractor-covered (default missing → M)
  'Title Tags': 'extractor-covered',
  'Meta Descriptions': 'extractor-covered',
  'Headings': 'extractor-covered',
  'Canonicalisation': 'extractor-covered',
  'Schema & Structured Data': 'extractor-covered',
  'Images': 'extractor-covered',
  'Internal Linking': 'extractor-covered',
  'Response Codes & Redirects': 'extractor-covered',
  'URL Structure': 'extractor-covered',
  'Content Quality': 'extractor-covered',

  // Tier 2: Needs-new-infra (default missing → L)
  'Robots & Crawl Directives': 'needs-new-infra',
  'XML Sitemaps': 'needs-new-infra',
  'Crawlability & Indexability': 'needs-new-infra',
  'Mobile & Usability': 'needs-new-infra',
  'JavaScript Rendering': 'needs-new-infra',
  'Core Web Vitals': 'needs-new-infra',
  'Security & HTTPS': 'needs-new-infra',

  // Tier 3: Needs-external-integration (default missing → L)
  'GEO & LLM Crawlers': 'needs-external-integration',
  'AI Overviews & AIO Optimization': 'needs-external-integration',
  'Local SEO': 'needs-external-integration',
  'International SEO': 'needs-external-integration',
  'E-E-A-T Signals': 'needs-external-integration',
  'Rankings & Traffic': 'needs-external-integration',
};

export function getCategoryTier(category) {
  return Object.prototype.hasOwnProperty.call(CATEGORY_TIER, category)
    ? CATEGORY_TIER[category]
    : null;
}
