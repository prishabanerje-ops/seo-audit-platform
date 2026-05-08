/**
 * robots-txt parser
 *
 * Fetches and parses a site's robots.txt file.
 * Returns per-bot allow/disallow rules for all major crawlers.
 *
 * Uses the `robots-parser` npm package for spec-compliant parsing,
 * then layers on per-bot access checks for SEO audit purposes.
 */

import robotsParser from 'robots-parser';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('parser:robots-txt');

// All bots we care about for the AEO/SEO audit
const BOTS = [
  { name: 'Googlebot',      userAgent: 'Googlebot' },
  { name: 'Google-Extended', userAgent: 'Google-Extended' },
  { name: 'Bingbot',        userAgent: 'Bingbot' },
  { name: 'GPTBot',         userAgent: 'GPTBot' },
  { name: 'ChatGPT-User',   userAgent: 'ChatGPT-User' },
  { name: 'OAI-SearchBot',  userAgent: 'OAI-SearchBot' },
  { name: 'ClaudeBot',      userAgent: 'ClaudeBot' },
  { name: 'anthropic-ai',   userAgent: 'anthropic-ai' },
  { name: 'PerplexityBot',  userAgent: 'PerplexityBot' },
  { name: 'Bytespider',     userAgent: 'Bytespider' },
  { name: 'CCBot',          userAgent: 'CCBot' },
  { name: 'Applebot',       userAgent: 'Applebot' },
  { name: 'FacebookBot',    userAgent: 'FacebookBot' },
];

/**
 * Fetch robots.txt for a given domain.
 * Returns the raw text content or null if not found / error.
 *
 * @param {string} siteUrl  — e.g. 'https://example.com' or 'https://example.com/page'
 * @returns {Promise<{ url: string, content: string|null, statusCode: number }>}
 */
export async function fetchRobotsTxt(siteUrl) {
  let robotsUrl;
  try {
    const origin = new URL(siteUrl).origin;
    robotsUrl    = `${origin}/robots.txt`;
  } catch {
    return { url: '', content: null, statusCode: 0 };
  }

  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'SEOAuditBot/1.0' },
      signal:  AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    const statusCode = res.status;

    if (!res.ok) {
      logger.warn(`robots.txt returned ${statusCode} for ${robotsUrl}`);
      return { url: robotsUrl, content: null, statusCode };
    }

    const content = await res.text();
    logger.info(`robots.txt fetched (${content.length} bytes) — ${robotsUrl}`);
    return { url: robotsUrl, content, statusCode };
  } catch (err) {
    logger.error(`Failed to fetch robots.txt for ${robotsUrl}: ${err.message}`);
    return { url: robotsUrl, content: null, statusCode: 0 };
  }
}

/**
 * Parse robots.txt content and return per-bot access results.
 *
 * @param {string} robotsUrl    — absolute URL of robots.txt
 * @param {string} content      — raw robots.txt text
 * @param {string} siteUrl      — page URL to test (defaults to site root)
 * @returns {object}
 */
export function parseRobotsTxt(robotsUrl, content, siteUrl) {
  if (!content) {
    // No robots.txt — all bots allowed by default
    return buildResult(null, robotsUrl, siteUrl, null);
  }

  try {
    const robots = robotsParser(robotsUrl, content);
    return buildResult(robots, robotsUrl, siteUrl, content);
  } catch (err) {
    logger.error(`Failed to parse robots.txt: ${err.message}`);
    return buildResult(null, robotsUrl, siteUrl, content);
  }
}

/**
 * Build the result object from a parsed robots instance.
 *
 * @param {object|null} robots    — robots-parser instance or null
 * @param {string}      robotsUrl
 * @param {string}      siteUrl
 * @param {string|null} rawContent
 * @returns {object}
 */
function buildResult(robots, robotsUrl, siteUrl, rawContent) {
  const testUrl    = siteUrl || new URL(robotsUrl).origin + '/';
  const botResults = {};

  for (const bot of BOTS) {
    if (robots) {
      const allowed = robots.isAllowed(testUrl, bot.userAgent);
      botResults[bot.name] = {
        userAgent: bot.userAgent,
        allowed:   allowed !== false, // null = no explicit rule = allowed
        explicit:  allowed !== null,  // true if an explicit rule exists
      };
    } else {
      // No robots.txt = all allowed
      botResults[bot.name] = {
        userAgent: bot.userAgent,
        allowed:   true,
        explicit:  false,
      };
    }
  }

  // Extract sitemap declarations
  const sitemaps = [];
  if (rawContent) {
    const sitemapMatches = rawContent.matchAll(/^Sitemap:\s*(.+)$/gim);
    for (const match of sitemapMatches) {
      sitemaps.push(match[1].trim());
    }
  }

  // Detect crawl-delay
  let crawlDelay = null;
  if (rawContent) {
    const delayMatch = rawContent.match(/^Crawl-delay:\s*(\d+)/im);
    if (delayMatch) crawlDelay = parseInt(delayMatch[1], 10);
  }

  // Check if critical paths are blocked for Googlebot
  const criticalPathsBlocked = robots
    ? isCriticalPathBlocked(robots)
    : false;

  // Check if JS/CSS is disallowed
  const jsCssBlocked = robots
    ? isJsCssBlocked(robots)
    : false;

  logger.debug(`Robots parsed: ${Object.keys(botResults).length} bots, ${sitemaps.length} sitemaps`);

  return {
    // ── Bot access results ────────────────────────────────────────
    botAccess:            botResults,

    // ── Sitemap declarations ──────────────────────────────────────
    sitemapsInRobots:     sitemaps,
    hasSitemapInRobots:   sitemaps.length > 0,

    // ── Crawl settings ────────────────────────────────────────────
    crawlDelay,

    // ── Issue flags ───────────────────────────────────────────────
    _googlebotAllowed:    botResults['Googlebot']?.allowed ?? true,
    _gptbotAllowed:       botResults['GPTBot']?.allowed ?? true,
    _claudebotAllowed:    botResults['ClaudeBot']?.allowed ?? true,
    _perplexityAllowed:   botResults['PerplexityBot']?.allowed ?? true,
    _criticalPathBlocked: criticalPathsBlocked,
    _jsCssBlocked:        jsCssBlocked,
    _missingRobots:       rawContent === null,
    _rawContent:          rawContent || '',
  };
}

/**
 * Check if critical SEO paths are blocked for Googlebot.
 * @param {object} robots — robots-parser instance
 * @returns {boolean}
 */
function isCriticalPathBlocked(robots) {
  const criticalPaths = ['/', '/sitemap.xml', '/products', '/category'];
  return criticalPaths.some(path => {
    try {
      return robots.isAllowed(`https://example.com${path}`, 'Googlebot') === false;
    } catch { return false; }
  });
}

/**
 * Check if JS or CSS files are blocked.
 * @param {object} robots
 * @returns {boolean}
 */
function isJsCssBlocked(robots) {
  const testPaths = ['/assets/main.js', '/static/style.css', '/js/app.js'];
  return testPaths.some(path => {
    try {
      return robots.isAllowed(`https://example.com${path}`, 'Googlebot') === false;
    } catch { return false; }
  });
}

/**
 * Convenience: fetch + parse robots.txt for a site in one call.
 *
 * @param {string} siteUrl
 * @returns {Promise<object>}
 */
export async function getRobotsTxt(siteUrl) {
  const { url, content, statusCode } = await fetchRobotsTxt(siteUrl);
  const result = parseRobotsTxt(url, content, siteUrl);
  return { ...result, robotsUrl: url, robotsStatusCode: statusCode };
}
