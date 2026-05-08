// backend/services/checks/s23-geo.js
const SECTION = 'GEO & LLM Crawlers';
const AI_CRAWLERS_GEO = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];
const BLOG_DOCS_RE    = /\/(blog|docs|articles|guide|learn|news|help)\//i;
const CONTENT_PAGES_MIN = 20;

export function runGeoChecks(records, _ctx) {
  const failures = [];

  const siteRecord = records.find(r => r._siteData?.robots);
  const robots = siteRecord?._siteData?.robots;

  // geo_llms_txt
  if (robots && !robots.llmsTxt) {
    failures.push({ check_id: 'geo_llms_txt', passed: false, severity: 'info', section: SECTION,
      message: '/llms.txt not found — missing AI-readable site index', details: '/llms.txt' });
  }

  // geo_url_md_endpoint
  if (robots) {
    const { urlMdSample } = robots;
    const contentPageCount = records.filter(r => BLOG_DOCS_RE.test(r.url || '')).length;
    if (contentPageCount >= CONTENT_PAGES_MIN && !urlMdSample?.hasAny) {
      failures.push({ check_id: 'geo_url_md_endpoint', passed: false, severity: 'warning', section: SECTION,
        message: `Content-heavy site (${contentPageCount} blog/docs pages) has no .md URL endpoints`,
        details: null });
    }
  }

  // geo_ai_bot_robots
  if (robots) {
    const agentRules = robots.agentRules || {};
    const hasAiRules = AI_CRAWLERS_GEO.some(bot => {
      const rules = agentRules[bot];
      return rules && (rules.disallowed?.length > 0 || rules.allowed?.length > 0);
    });
    if (!hasAiRules) {
      failures.push({ check_id: 'geo_ai_bot_robots', passed: false, severity: 'warning', section: SECTION,
        message: 'No explicit directives for AI crawlers in robots.txt (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)',
        details: '/robots.txt' });
    }

  }

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const js = r._jsRender || {};

    // geo_content_without_js — key content in raw HTML
    if (!js.rawHasH1 || (js.rawWordCount || 0) < 50 || (js.rawLinkCount || 0) === 0) {
      failures.push({ check_id: 'geo_content_without_js', passed: false, severity: 'critical', section: SECTION,
        message: 'Key content (H1, body text, or links) not available in raw HTML — AI crawlers cannot access it',
        details: url });
    }

    // geo_https_trust
    if (!r._isHttps) {
      failures.push({ check_id: 'geo_https_trust', passed: false, severity: 'critical', section: SECTION,
        message: 'Content served over HTTP — AI crawlers require HTTPS', details: url });
    }

    // geo_canonical_dedup — self-canonical required
    if (!r['Canonical Link Element 1']) {
      failures.push({ check_id: 'geo_canonical_dedup', passed: false, severity: 'warning', section: SECTION,
        message: 'Missing canonical — AI crawlers use canonical for deduplication', details: url });
    }

    // geo_og_tags — only when extractor collected OG data
    if (Object.prototype.hasOwnProperty.call(r, '_ogTitle') ||
        Object.prototype.hasOwnProperty.call(r, '_ogDescription') ||
        Object.prototype.hasOwnProperty.call(r, '_ogImage')) {
      const ogTitle = r._ogTitle || '';
      const ogDesc  = r._ogDescription || '';
      const ogImage = r._ogImage || '';
      if (!ogTitle || !ogDesc || !ogImage) {
        const missing = [!ogTitle && 'og:title', !ogDesc && 'og:description', !ogImage && 'og:image'].filter(Boolean);
        failures.push({ check_id: 'geo_og_tags', passed: false, severity: 'info', section: SECTION,
          message: `Missing Open Graph tags: ${missing.join(', ')}`, details: url });
      }
    }

    // geo_faq_html — FAQ content must be in raw HTML
    if (r._hasFaqContent && !js.rawHasH1) {
      failures.push({ check_id: 'geo_faq_html', passed: false, severity: 'warning', section: SECTION,
        message: 'FAQ content may not be present in raw HTML — AI crawlers cannot access JS-rendered FAQs',
        details: url });
    }

    // geo_licensing_policy — check terms page for AI/LLM policy
    if (r._isTermsPage) {
      const body = r._bodyText || '';
      if (!/artificial intelligence|AI training|machine learning|automated (scraping|training)|LLM|large language model|data scraping/i.test(body)) {
        failures.push({ check_id: 'geo_licensing_policy', passed: false, severity: 'info', section: SECTION,
          message: 'Terms of Service page has no AI/LLM usage policy', details: url });
      }
    }

    // geo_crawlable_pagination — infinite scroll with no numbered URLs
    if (r._hasInfiniteScroll && !r['rel="next"']) {
      failures.push({ check_id: 'geo_crawlable_pagination', passed: false, severity: 'info', section: SECTION,
        message: 'Infinite scroll pagination with no numbered URL pagination — AI crawlers cannot paginate',
        details: url });
    }
  }

  return failures;
}
