// backend/services/checks/s03-robots.js
const SECTION = 'Robots & Crawl Directives';

const CRAWLABLE_RESOURCE_PATHS = ['/css', '/js', '/images', '/static', '/assets'];
const SENSITIVE_PATHS = ['/admin', '/wp-admin', '/wp-login', '/login', '/dashboard'];
const AI_CRAWLERS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];

export function runRobotsChecks(records, _ctx) {
  const failures = [];

  const siteRecord = records.find(r => r._siteData?.robots);
  if (!siteRecord) return failures;

  const robots  = siteRecord._siteData.robots;
  const blocked = robots.disallowedPaths || [];

  // robots_txt_exists
  if (!robots.exists) {
    failures.push({ check_id: 'robots_txt_exists', passed: false, severity: 'critical', section: SECTION,
      message: '/robots.txt not found or returned non-200', details: '/robots.txt' });
    return failures;
  }

  // robots_txt_syntax
  if ((robots.parseErrors || []).length > 0) {
    failures.push({ check_id: 'robots_txt_syntax', passed: false, severity: 'warning', section: SECTION,
      message: `robots.txt parse errors: ${robots.parseErrors.join('; ')}`, details: '/robots.txt' });
  }

  // sitemap_in_robots
  if (!robots.sitemapUrls || robots.sitemapUrls.length === 0) {
    failures.push({ check_id: 'sitemap_in_robots', passed: false, severity: 'info', section: SECTION,
      message: 'No Sitemap: directive in robots.txt', details: '/robots.txt' });
  }

  // crawlable_resources_not_blocked
  for (const path of CRAWLABLE_RESOURCE_PATHS) {
    if (blocked.some(b => b.startsWith(path) || path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'crawlable_resources_not_blocked', passed: false, severity: 'critical', section: SECTION,
        message: `Critical resource path blocked in robots.txt: ${path}`, details: path });
    }
  }

  // sensitive_paths_blocked — only flag paths that were actually crawled (exist on this site)
  const crawledPaths = new Set(records.map(r => {
    try { return new URL(r.url || '').pathname; } catch { return ''; }
  }).filter(Boolean));
  for (const path of SENSITIVE_PATHS) {
    const siteHasPath = [...crawledPaths].some(p => p.startsWith(path));
    if (siteHasPath && !blocked.some(b => b === path || path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'sensitive_paths_blocked', passed: false, severity: 'warning', section: SECTION,
        message: `Sensitive path not blocked in robots.txt: ${path}`, details: path });
    }
  }

  // important_pages_not_blocked — check each indexable crawled page against Disallow rules
  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    let path = '';
    try { path = new URL(url).pathname; } catch { continue; }
    if (blocked.some(b => b && path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'important_pages_not_blocked', passed: false, severity: 'critical', section: SECTION,
        message: `Indexable page is blocked by robots.txt Disallow: ${path}`, details: url });
    }
  }

  // conflicting_directives — Allow and Disallow for same path
  const raw = robots.raw || '';
  const allowLines    = raw.split('\n').filter(l => l.trim().toLowerCase().startsWith('allow:')).map(l => l.split(':')[1]?.trim() || '');
  const disallowLines = raw.split('\n').filter(l => l.trim().toLowerCase().startsWith('disallow:')).map(l => l.split(':')[1]?.trim() || '');
  for (const al of allowLines) {
    if (disallowLines.some(dl => dl === al || al.startsWith(dl))) {
      failures.push({ check_id: 'conflicting_directives', passed: false, severity: 'warning', section: SECTION,
        message: `Conflicting Allow/Disallow directives for path: ${al}`, details: al });
    }
  }

  // ai_crawler_directives — check that at least one AI crawler bot has an explicit rule entry
  const agentRules = robots.agentRules || {};
  const hasSomeAiRule = AI_CRAWLERS.some(bot => bot in agentRules);
  if (!hasSomeAiRule) {
    failures.push({ check_id: 'ai_crawler_directives', passed: false, severity: 'info', section: SECTION,
      message: 'No explicit directives for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)',
      details: '/robots.txt' });
  }

  // noindex_not_disallowed — noindex pages should not also be blocked
  for (const r of records) {
    const url = r.url || '';
    if (!url) continue;
    const metaRobots = (r['Meta Robots 1'] || '').toLowerCase();
    const xRobots    = (r['X-Robots-Tag 1'] || '').toLowerCase();
    const isNoindex  = metaRobots.includes('noindex') || xRobots.includes('noindex');
    if (!isNoindex) continue;
    let path = '';
    try { path = new URL(url).pathname; } catch { continue; }
    if (blocked.some(b => b && path.startsWith(b.replace('*', '')))) {
      failures.push({ check_id: 'noindex_not_disallowed', passed: false, severity: 'warning', section: SECTION,
        message: `Noindex page also blocked by robots.txt — Googlebot cannot read noindex directive`, details: url });
    }
  }

  // crawl_delay — flag if no Crawl-delay and site has high TTFB (> 2s average)
  const hasCrawlDelay = raw.toLowerCase().includes('crawl-delay');
  if (!hasCrawlDelay) {
    const avgResponseTime = records.reduce((sum, r) => sum + (parseFloat(r['Response Time'] || '0') || 0), 0) / (records.length || 1);
    if (avgResponseTime > 2000) {
      failures.push({ check_id: 'crawl_delay', passed: false, severity: 'info', section: SECTION,
        message: `Average TTFB > 2s and no Crawl-delay directive in robots.txt`, details: '/robots.txt' });
    }
  }

  return failures;
}
