/**
 * playwright-crawler — public entry point
 *
 * Usage from backend (after Phase 4 cutover):
 *   import { crawl } from '../../playwright-crawler/src/index.js'
 *   const pages = await crawl({ startUrl, maxUrls, onProgress })
 *
 * CLI usage (for manual testing):
 *   node src/index.js https://example.com 100
 */

export { crawl }       from './crawler.js';
export { toSfFormat }  from './output/sf-format.js';
export { getRobotsTxt } from './parsers/robots-txt.js';

// ─── CLI runner ───────────────────────────────────────────────────────────────
// Only runs when invoked directly: node src/index.js <url> [maxUrls]

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const startUrl = process.argv[2];
  const maxUrls  = parseInt(process.argv[3] || '50', 10);

  if (!startUrl) {
    console.error('Usage: node src/index.js <startUrl> [maxUrls]');
    process.exit(1);
  }

  const { crawl }      = await import('./crawler.js');
  const { toSfFormat } = await import('./output/sf-format.js');

  console.log(`\nCrawling: ${startUrl}  (max ${maxUrls} pages)\n`);

  const { pages } = await crawl({
    startUrl,
    maxUrls,
    maxConcurrency: 5,
    onProgress: (crawled, queued) => {
      process.stdout.write(`\r  Pages crawled: ${crawled}  |  Discovered: ${queued}   `);
    },
  });

  console.log(`\n\nDone. ${pages.length} pages crawled.\n`);

  // Print a summary table
  const statusCounts = {};
  for (const p of pages) {
    const code = p['Status Code'] || '0';
    statusCounts[code] = (statusCounts[code] || 0) + 1;
  }

  console.log('Status code breakdown:');
  for (const [code, count] of Object.entries(statusCounts).sort()) {
    console.log(`  ${code}  →  ${count} pages`);
  }

  const jsPagesCount = pages.filter(p => p.mode === 'playwright').length;
  console.log(`\nCrawl modes:  cheerio=${pages.length - jsPagesCount}  playwright=${jsPagesCount}`);

  // Show first 5 URLs
  console.log('\nFirst 5 URLs:');
  pages.slice(0, 5).forEach(p => {
    console.log(`  [${p['Status Code']}] ${p.url}  (${p.mode}, depth ${p.crawlDepth})`);
  });

  // Convert to SF format and show dataset row counts
  const datasets = toSfFormat(pages);
  console.log('\nSF-format datasets:');
  for (const [name, rows] of Object.entries(datasets)) {
    console.log(`  ${name.padEnd(45)} ${rows.length} rows`);
  }
}
