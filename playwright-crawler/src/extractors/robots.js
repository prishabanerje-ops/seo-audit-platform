/**
 * Robots extractor (site-level)
 *
 * Runs once per crawl before the crawl loop begins.
 * Fetches robots.txt and llms.txt, parses rules and metadata.
 */

import { createLogger }              from '../utils/logger.js';
import { fetchRobotsTxt, parseRobotsTxt } from '../parsers/robots-txt.js';

const logger = createLogger('extractor:robots');

const LLMS_MAX_BYTES = 10240;

// Directive names considered valid in robots.txt
const VALID_DIRECTIVES = new Set([
  'user-agent', 'disallow', 'allow', 'sitemap', 'crawl-delay', 'host', 'noindex',
]);

/**
 * Parse raw robots.txt text into structured rule arrays.
 *
 * @param {string} raw
 * @returns {{ userAgents, disallowRules, allowRules, blockedPaths, sitemapUrls, hasMalformedRules }}
 */
function parseRules(raw) {
  const userAgents    = new Set();
  const disallowRules = [];
  const allowRules    = [];
  const sitemapUrls   = [];
  let   currentAgent  = null;
  let   hasMalformedRules = false;

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      hasMalformedRules = true;
      continue;
    }

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value     = line.slice(colonIdx + 1).trim();

    if (!VALID_DIRECTIVES.has(directive)) {
      hasMalformedRules = true;
      continue;
    }

    if (directive === 'user-agent') {
      currentAgent = value;
      userAgents.add(value);
    } else if (directive === 'disallow' && currentAgent) {
      disallowRules.push({ agent: currentAgent, path: value });
    } else if (directive === 'allow' && currentAgent) {
      allowRules.push({ agent: currentAgent, path: value });
    } else if (directive === 'sitemap') {
      sitemapUrls.push(value);
    }
  }

  // blockedPaths: Disallow paths for '*' or 'Googlebot'
  const targetAgents = new Set(['*', 'Googlebot']);
  const blockedPaths = disallowRules
    .filter(r => targetAgents.has(r.agent) && r.path.length > 0)
    .map(r => r.path);

  return {
    userAgents:      [...userAgents],
    disallowRules,
    allowRules,
    sitemapUrls,
    blockedPaths,
    hasMalformedRules,
  };
}

/**
 * Fetch llms.txt for a site.
 *
 * @param {string} origin
 * @returns {Promise<{ exists: boolean, statusCode: number, content: string }>}
 */
async function fetchLlmsTxt(origin) {
  const url = `${origin}/llms.txt`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SEOAuditBot/1.0' },
      signal:  AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    if (!res.ok) {
      return { exists: false, statusCode: res.status, content: '' };
    }
    const text = await res.text();
    return {
      exists:     true,
      statusCode: res.status,
      content:    text.slice(0, LLMS_MAX_BYTES),
    };
  } catch {
    return { exists: false, statusCode: 0, content: '' };
  }
}

/**
 * Site-level extractor: fetch and parse robots.txt + llms.txt.
 *
 * @param {string} startUrl  — crawl start URL, e.g. 'https://example.com'
 * @returns {Promise<object>}
 */
export async function extractRobots(startUrl) {
  const origin = new URL(startUrl).origin;

  const [robotsFetch, llms] = await Promise.all([
    fetchRobotsTxt(startUrl),
    fetchLlmsTxt(origin),
  ]);

  const { url: robotsUrl, content: rawContent, statusCode: robotsStatusCode } = robotsFetch;

  const exists = rawContent !== null && robotsStatusCode >= 200 && robotsStatusCode < 400;

  // Get content-type from the fetch response — re-fetch head only if not available.
  // fetchRobotsTxt doesn't return content-type, so we derive it from presence.
  // We'll do a lightweight HEAD to get it only if content exists.
  let robotsTxtContentType = '';
  if (exists) {
    try {
      const head = await fetch(robotsUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'SEOAuditBot/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      robotsTxtContentType = head.headers.get('content-type') || '';
    } catch {
      robotsTxtContentType = '';
    }
  }

  const parsed = exists
    ? parseRules(rawContent)
    : { userAgents: [], disallowRules: [], allowRules: [], sitemapUrls: [], blockedPaths: [], hasMalformedRules: false };

  logger.info(`Robots extractor: exists=${exists}, sitemaps=${parsed.sitemapUrls.length}, llms=${llms.exists}`);

  return {
    robotsTxtExists:     exists,
    robotsTxtStatusCode: robotsStatusCode,
    robotsTxtSize:       rawContent ? Buffer.byteLength(rawContent, 'utf8') : 0,
    robotsTxtContentType,
    sitemapDeclared:     parsed.sitemapUrls.length > 0,
    sitemapUrls:         parsed.sitemapUrls,
    disallowRules:       parsed.disallowRules,
    allowRules:          parsed.allowRules,
    blockedPaths:        parsed.blockedPaths,
    userAgents:          parsed.userAgents,
    hasMalformedRules:   parsed.hasMalformedRules,
    llmsTxtExists:       llms.exists,
    llmsTxtStatusCode:   llms.statusCode,
    llmsTxtContent:      llms.content,
  };
}
