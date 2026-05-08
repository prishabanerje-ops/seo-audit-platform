import { describe, it, expect } from 'vitest';
import { CATEGORY_TIER, getCategoryTier } from '../src/rubric/category-tier.js';

describe('CATEGORY_TIER', () => {
  it('covers all 23 in-scope categories', () => {
    expect(Object.keys(CATEGORY_TIER).length).toBe(23);
  });

  it('partitions into 10 + 7 + 6 = 23', () => {
    const counts = { 'extractor-covered': 0, 'needs-new-infra': 0, 'needs-external-integration': 0 };
    for (const tier of Object.values(CATEGORY_TIER)) counts[tier]++;
    expect(counts['extractor-covered']).toBe(10);
    expect(counts['needs-new-infra']).toBe(7);
    expect(counts['needs-external-integration']).toBe(6);
  });

  it('places known categories in expected tiers', () => {
    expect(CATEGORY_TIER['Title Tags']).toBe('extractor-covered');
    expect(CATEGORY_TIER['Robots & Crawl Directives']).toBe('needs-new-infra');
    expect(CATEGORY_TIER['Local SEO']).toBe('needs-external-integration');
  });
});

describe('getCategoryTier', () => {
  it('returns the tier for a known category', () => {
    expect(getCategoryTier('Title Tags')).toBe('extractor-covered');
    expect(getCategoryTier('Core Web Vitals')).toBe('needs-new-infra');
  });

  it('returns null for an unknown category', () => {
    expect(getCategoryTier('Some Unknown Category')).toBe(null);
  });
});
