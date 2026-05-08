export const CANONICAL_CATEGORIES = [
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
  'Title Tags',
  'Meta Descriptions',
  'Headings',
  'Content Quality',
  'Images',
  'Schema & Structured Data',
  'Internal Linking',
  'International SEO',
  'Rankings & Traffic',
  'Backlinks & Authority',
  'E-E-A-T Signals',
  'AI Overviews & AIO Optimization',
  'GEO & LLM Crawlers',
  'Local SEO',
];

const ALIASES = {
  // CSV → canonical (R-M3 rename)
  'Local SEO & GEO': 'Local SEO',
  // Seed DB categories → canonical (frontend slugs)
  'Mobile SEO': 'Mobile & Usability',
  'Schema / Structured Data': 'Schema & Structured Data',
  'Robots / Indexability': 'Crawlability & Indexability',
  'Speed & Performance': 'Core Web Vitals',
  'Monitoring & Operations': 'Security & HTTPS',
  'Sitemap': 'XML Sitemaps',
  'LLM / AI Crawlers': 'GEO & LLM Crawlers',
  'Rankings & Traffic Drops': 'Rankings & Traffic',
  'Canonical': 'Canonicalisation',
  'Response Codes': 'Response Codes & Redirects',
  'Meta Description': 'Meta Descriptions',
  'Content': 'Content Quality',
};

const CANONICAL_SET = new Set(CANONICAL_CATEGORIES);

export function mapCategory(input) {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (CANONICAL_SET.has(trimmed)) return trimmed;
  if (ALIASES[trimmed]) return ALIASES[trimmed];
  return null;
}

export function getRenameLog() {
  return Object.entries(ALIASES).map(([from, to]) => ({ from, to }));
}

// R-M3 part a: bot-policy checks placed in "AI Overviews & AIO Optimization"
// belong in "GEO & LLM Crawlers". This is preprocessing, not a decision rule —
// it mutates category before the rule pipeline runs.
const BOT_POLICY_KEYWORDS = [
  /\bbot\b/i, /\brobots\.txt\b/i, /\bllms?\.txt\b/i, /\bcrawler\b/i,
  /\bgoogle-extended\b/i, /\bgptbot\b/i, /\bclaudebot\b/i, /\bperplexitybot\b/i,
];

export function recategorizeBotPolicy(row) {
  if (row.category !== 'AI Overviews & AIO Optimization') return row;
  if (!BOT_POLICY_KEYWORDS.some(rx => rx.test(row.name || ''))) return row;
  return { ...row, category: 'GEO & LLM Crawlers', notes: appendNote(row.notes, 'recategorized by R-M3a (bot-policy → GEO & LLM Crawlers)') };
}

function appendNote(notes, addition) {
  return notes ? `${notes}; ${addition}` : addition;
}
