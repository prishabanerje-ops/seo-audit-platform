import { describe, it, expect } from 'vitest';
import { CANONICAL_CATEGORIES, mapCategory, recategorizeBotPolicy } from '../src/taxonomy.js';

describe('CANONICAL_CATEGORIES', () => {
  it('contains exactly 23 unique slugs including Local SEO (renamed)', () => {
    expect(CANONICAL_CATEGORIES.length).toBe(23);
    expect(new Set(CANONICAL_CATEGORIES).size).toBe(23);
    expect(CANONICAL_CATEGORIES).toContain('Local SEO');
    expect(CANONICAL_CATEGORIES).not.toContain('Local SEO & GEO');
  });
});

describe('mapCategory', () => {
  it('renames Local SEO & GEO to Local SEO (R-M3 part b)', () => {
    expect(mapCategory('Local SEO & GEO')).toBe('Local SEO');
  });

  it('passes through canonical names unchanged', () => {
    expect(mapCategory('Title Tags')).toBe('Title Tags');
    expect(mapCategory('GEO & LLM Crawlers')).toBe('GEO & LLM Crawlers');
  });

  it('maps seed-style category names (DB taxonomy) to canonical slugs', () => {
    expect(mapCategory('Mobile SEO')).toBe('Mobile & Usability');
    expect(mapCategory('Schema / Structured Data')).toBe('Schema & Structured Data');
    expect(mapCategory('Robots / Indexability')).toBe('Crawlability & Indexability');
  });

  it('returns null for unrecognized category to surface taxonomy gaps', () => {
    expect(mapCategory('Made-Up Category')).toBe(null);
  });
});

describe('recategorizeBotPolicy (R-M3 part a)', () => {
  it('moves bot-policy checks from AI Overviews to GEO & LLM Crawlers', () => {
    const moved = recategorizeBotPolicy({
      name: 'AI Bot Access in Robots.txt',
      category: 'AI Overviews & AIO Optimization',
    });
    expect(moved.category).toBe('GEO & LLM Crawlers');
  });

  it('leaves rows in other categories unchanged', () => {
    const row = { name: 'AI Bot Access in Robots.txt', category: 'Robots & Crawl Directives' };
    expect(recategorizeBotPolicy(row).category).toBe('Robots & Crawl Directives');
  });

  it('leaves non-bot-policy AI Overviews rows unchanged', () => {
    const row = { name: 'Citation Audit on Perplexity', category: 'AI Overviews & AIO Optimization' };
    expect(recategorizeBotPolicy(row).category).toBe('AI Overviews & AIO Optimization');
  });
});
