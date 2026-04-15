/**
 * Quick test runner — crawls a URL and dumps SF-format output to JSON files.
 *
 * Usage:
 *   node test.js <url> [maxUrls]
 *
 * Output:
 *   test-output/<dataset>.json   — one file per SF CSV equivalent
 *   test-output/robots.json      — robots.txt bot access results
 *   test-output/summary.json     — per-page field summary
 */

import { writeFileSync, mkdirSync } from 'fs';
import { crawl }       from './src/crawler.js';
import { toSfFormat }  from './src/output/sf-format.js';
import { getRobotsTxt } from './src/parsers/robots-txt.js';

const startUrl = process.argv[2];
const maxUrls  = parseInt(process.argv[3] || '10', 10);

if (!startUrl) {
  console.error('Usage: node test.js <url> [maxUrls]');
  process.exit(1);
}

console.log(`\nTest crawl: ${startUrl}  (max ${maxUrls} pages)\n`);

// ── Crawl ─────────────────────────────────────────────────────────────────────
const pages = await crawl({
  startUrl,
  maxUrls,
  maxConcurrency: 3,
  onProgress: (crawled, queued) => {
    process.stdout.write(`\r  Crawled: ${crawled}  Discovered: ${queued}   `);
  },
});
console.log(`\n`);

// ── SF format ─────────────────────────────────────────────────────────────────
const datasets = toSfFormat(pages);

// ── robots.txt ────────────────────────────────────────────────────────────────
const robots = await getRobotsTxt(startUrl);

// ── Write output ─────────────────────────────────────────────────────────────
mkdirSync('./test-output', { recursive: true });

for (const [name, rows] of Object.entries(datasets)) {
  writeFileSync(`./test-output/${name}.json`, JSON.stringify(rows, null, 2));
}

writeFileSync('./test-output/robots.json', JSON.stringify(robots, null, 2));

// ── Per-page summary ──────────────────────────────────────────────────────────
const summary = pages.map(p => ({
  url:            p.url,
  mode:           p.mode,
  depth:          p.crawlDepth,
  status:         p['Status Code'],
  indexability:   p['Indexability'],
  title:          p['Title 1'],
  titleLen:       p['Title 1 Length'],
  metaDesc:       p['Meta Description 1'] ? p['Meta Description 1'].slice(0, 60) + '...' : '(missing)',
  h1:             p['H1-1'],
  canonical:      p['Canonical Link Element 1'] || '(missing)',
  wordCount:      p['Word Count'],
  images:         p._imageCount,
  internalLinks:  p._internalLinks?.length,
  schemaTypes:    p._schemaTypes?.join(', ') || '(none)',
  blockingScripts:p._blockingCount,
  missingAlt:     p._missingAltCount,
}));

writeFileSync('./test-output/summary.json', JSON.stringify(summary, null, 2));

// ── Print summary table to console ────────────────────────────────────────────
console.log('─'.repeat(100));
console.log(`${'URL'.padEnd(55)} ${'SC'.padEnd(4)} ${'IDX'.padEnd(14)} ${'Title'.padEnd(20)} ${'H1'.padEnd(20)} Words`);
console.log('─'.repeat(100));

for (const p of summary) {
  const url   = p.url.replace(startUrl, '').slice(0, 54) || '/';
  const sc    = p.status;
  const idx   = p.indexability.slice(0, 13);
  const title = (p.title || '(missing)').slice(0, 19);
  const h1    = (p.h1 || '(missing)').slice(0, 19);
  console.log(`${url.padEnd(55)} ${sc.padEnd(4)} ${idx.padEnd(14)} ${title.padEnd(20)} ${h1.padEnd(20)} ${p.wordCount}`);
}
console.log('─'.repeat(100));

// ── Issues summary ────────────────────────────────────────────────────────────
console.log('\nIssues detected:');
const missingTitles    = summary.filter(p => !p.title).length;
const missingH1        = summary.filter(p => !p.h1).length;
const missingCanonical = summary.filter(p => p.canonical === '(missing)').length;
const missingMeta      = summary.filter(p => p.metaDesc === '(missing)').length;
const totalAltMissing  = summary.reduce((s, p) => s + (p.missingAlt || 0), 0);

console.log(`  Missing title tags:    ${missingTitles}`);
console.log(`  Missing H1:            ${missingH1}`);
console.log(`  Missing canonical:     ${missingCanonical}`);
console.log(`  Missing meta desc:     ${missingMeta}`);
console.log(`  Images missing alt:    ${totalAltMissing}`);

// ── robots.txt bot access ─────────────────────────────────────────────────────
console.log('\nBot access (robots.txt):');
for (const [bot, result] of Object.entries(robots.botAccess || {})) {
  const status = result.allowed ? '✓ Allowed' : '✗ Blocked';
  console.log(`  ${bot.padEnd(20)} ${status}`);
}

if (robots.sitemapsInRobots?.length > 0) {
  console.log(`\nSitemaps in robots.txt: ${robots.sitemapsInRobots.join(', ')}`);
}

console.log(`\nOutput written to ./test-output/ (${Object.keys(datasets).length + 2} files)`);
