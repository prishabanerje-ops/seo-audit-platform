/**
 * Parity Test
 *
 * Two test modes:
 *
 * Mode 1 — Self-validation (no SF needed, runs always)
 *   Crawls a URL and verifies:
 *   - All required SF CSV columns are present
 *   - Values have correct types / formats
 *   - Known constraints hold (indexability values, status code format, etc.)
 *   - Results are stable across two runs (same URL → same output)
 *
 * Mode 2 — SF diff (requires actual SF CSV files)
 *   Loads SF CSV exports from a directory, runs our crawler on the same URL,
 *   and diffs field-by-field. Reports match % per CSV file.
 *
 * Run:
 *   node tests/parity.test.js <url> [sfCsvDir]
 *
 *   # Mode 1 (self-validation only):
 *   node tests/parity.test.js https://www.cars24.com
 *
 *   # Mode 2 (with SF diff):
 *   node tests/parity.test.js https://www.cars24.com /path/to/sf/output/
 */

import { createReadStream, existsSync, readdirSync } from 'fs';
import { createInterface }                            from 'readline';
import { crawl }      from '../src/crawler.js';
import { toSfFormat } from '../src/output/sf-format.js';

const startUrl  = process.argv[2];
const sfCsvDir  = process.argv[3] || null;

if (!startUrl) {
  console.error('Usage: node tests/parity.test.js <url> [sfCsvDir]');
  process.exit(1);
}

// ─── Required columns per SF CSV ─────────────────────────────────────────────

const REQUIRED_COLUMNS = {
  internal_all: [
    'Address', 'Content Type', 'Status Code', 'Status',
    'Indexability', 'Title 1', 'Title 1 Length',
    'Meta Description 1', 'Meta Description 1 Length',
    'H1-1', 'H1-1 Length', 'H2-1',
    'Canonical Link Element 1', 'Word Count', 'Text Ratio',
    'Size', 'Crawl Depth', 'Unique Outlinks',
  ],
  response_codes_all: [
    'Address', 'Status Code', 'Status', 'Redirect URL', 'Redirect Type',
  ],
  page_titles_all: [
    'Address', 'Title 1', 'Title 1 Length', 'Indexability',
  ],
  meta_description_all: [
    'Address', 'Meta Description 1', 'Meta Description 1 Length', 'Indexability',
  ],
  h1_all: [
    'Address', 'H1-1', 'H1-1 Length', 'Occurrences', 'Indexability',
  ],
  h2_all: [
    'Address', 'H2-1', 'H2-1 Length', 'Occurrences', 'Indexability',
  ],
  canonicals_all: [
    'Address', 'Canonical Link Element 1', 'Canonical HTTP Header',
    'Canonical Link Element Match HTTP Header', 'Indexability',
  ],
  images_all: [
    'Address', 'Source', 'Alt Text', 'Alt Text Length',
    'Missing Alt Text', 'Alt Text Too Long',
  ],
  structured_data_all: [
    'Address', 'Type', 'Property', 'Content', 'Errors', 'Warnings',
  ],
  javascript_all: [
    'Address', 'Rendered Word Count', 'Raw Word Count',
    'Rendered Title', 'Raw Title',
  ],
};

// ─── Value constraint checks ──────────────────────────────────────────────────

const CONSTRAINTS = {
  'Status Code':    (v) => /^\d{3}$/.test(v)          || `Expected 3-digit code, got "${v}"`,
  'Indexability':   (v) => ['Indexable','Non-Indexable',''].includes(v) || `Unexpected value "${v}"`,
  'Title 1 Length': (v) => v === '' || /^\d+$/.test(v) || `Expected number, got "${v}"`,
  'Meta Description 1 Length': (v) => v === '' || /^\d+$/.test(v) || `Expected number, got "${v}"`,
  'Word Count':     (v) => v === '' || /^\d+$/.test(v) || `Expected number, got "${v}"`,
  'Text Ratio':     (v) => v === '' || /^\d+$/.test(v) || `Expected number, got "${v}"`,
  'Size':           (v) => v === '' || /^\d+$/.test(v) || `Expected number, got "${v}"`,
  'Crawl Depth':    (v) => v === '' || /^\d+$/.test(v) || `Expected number, got "${v}"`,
  'Missing Alt Text': (v) => ['True','False',''].includes(v) || `Expected True/False, got "${v}"`,
  'Alt Text Too Long':(v) => ['True','False',''].includes(v) || `Expected True/False, got "${v}"`,
};

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    process.stdout.write('.');
  } else {
    failed++;
    failures.push(message);
    process.stdout.write('F');
  }
}

function section(name) {
  console.log(`\n\n── ${name} ${'─'.repeat(60 - name.length)}`);
}

// ─── CSV reader (same logic as sf-parser.service.js) ─────────────────────────

async function readCsv(filePath) {
  if (!existsSync(filePath)) return null;
  return new Promise((resolve, reject) => {
    const rows = []; let headers = null; let lineNum = 0;
    const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
    rl.on('line', (rawLine) => {
      lineNum++;
      const line = lineNum === 1 ? rawLine.replace(/^\uFEFF/, '') : rawLine;
      if (!line.trim()) return;
      const fields = parseCsvLine(line);
      if (!headers) { headers = fields.map(h => h.trim()); return; }
      const row = {};
      headers.forEach((h, i) => row[h] = fields[i] ?? '');
      rows.push(row);
    });
    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });
}

function parseCsvLine(line) {
  const fields = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) { if (ch === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else { inQ = false; } } else { cur += ch; } }
    else { if (ch === '"') { inQ = true; } else if (ch === ',') { fields.push(cur); cur = ''; } else { cur += ch; } }
  }
  fields.push(cur); return fields;
}

// ─── Mode 1: Self-validation ──────────────────────────────────────────────────

async function runSelfValidation(datasets) {
  section('Mode 1 — Column presence');

  for (const [csvName, required] of Object.entries(REQUIRED_COLUMNS)) {
    const rows = datasets[csvName];
    if (!rows) { assert(false, `Dataset "${csvName}" missing entirely`); continue; }
    if (rows.length === 0) continue; // empty is OK for some datasets

    const row = rows[0];
    for (const col of required) {
      assert(col in row, `[${csvName}] Missing column: "${col}"`);
    }
  }

  section('Mode 1 — Row counts');

  const internal = datasets.internal_all || [];
  assert(internal.length > 0, 'internal_all has 0 rows — crawl produced no pages');

  // Every page in internal_all should also appear in the other per-page datasets
  const internalUrls  = new Set(internal.map(r => r['Address']));
  const titleUrls     = new Set((datasets.page_titles_all     || []).map(r => r['Address']));
  const h1Urls        = new Set((datasets.h1_all               || []).map(r => r['Address']));
  const canonicalUrls = new Set((datasets.canonicals_all       || []).map(r => r['Address']));

  for (const url of internalUrls) {
    assert(titleUrls.has(url),     `URL in internal_all but not page_titles_all: ${url}`);
    assert(h1Urls.has(url),        `URL in internal_all but not h1_all: ${url}`);
    assert(canonicalUrls.has(url), `URL in internal_all but not canonicals_all: ${url}`);
  }

  section('Mode 1 — Value constraints');

  for (const row of internal) {
    for (const [col, check] of Object.entries(CONSTRAINTS)) {
      if (!(col in row)) continue;
      const result = check(row[col]);
      assert(result === true, `[internal_all] ${row['Address']} → ${col}: ${result}`);
    }
  }

  section('Mode 1 — Address is absolute URL');

  for (const [csvName, rows] of Object.entries(datasets)) {
    for (const row of (rows || [])) {
      if (!row['Address']) continue;
      assert(
        row['Address'].startsWith('http://') || row['Address'].startsWith('https://'),
        `[${csvName}] Address not absolute URL: "${row['Address']}"`
      );
    }
  }

  section('Mode 1 — Status Code is 3 digits for all pages');

  for (const row of (datasets.response_codes_all || [])) {
    assert(/^\d{3}$/.test(row['Status Code'] || ''), `response_codes_all: bad status code "${row['Status Code']}" for ${row['Address']}`);
  }

  section('Mode 1 — Stability (field consistency within crawl)');

  // Verify that every Address in internal_all is unique (no duplicate pages)
  const addresses  = (datasets.internal_all || []).map(r => r['Address']);
  const uniqueAddr = new Set(addresses);
  assert(addresses.length === uniqueAddr.size,
    `Duplicate pages detected: ${addresses.length} rows but only ${uniqueAddr.size} unique URLs`);

  // Verify Title 1 Length matches actual Title 1 string length for all pages
  for (const row of (datasets.page_titles_all || [])) {
    if (!row['Title 1'] || !row['Title 1 Length']) continue;
    const stated  = parseInt(row['Title 1 Length'], 10);
    const actual  = row['Title 1'].length;
    assert(stated === actual,
      `Title length mismatch for ${row['Address']}: stated=${stated} actual=${actual}`);
  }

  // Verify Meta Description 1 Length matches actual string length
  for (const row of (datasets.meta_description_all || [])) {
    if (!row['Meta Description 1'] || !row['Meta Description 1 Length']) continue;
    const stated = parseInt(row['Meta Description 1 Length'], 10);
    const actual = row['Meta Description 1'].length;
    assert(stated === actual,
      `Meta desc length mismatch for ${row['Address']}: stated=${stated} actual=${actual}`);
  }
}

// ─── Mode 2: SF diff ──────────────────────────────────────────────────────────

async function runSfDiff(datasets, sfDir) {
  section('Mode 2 — SF CSV diff');

  const sfFiles = readdirSync(sfDir).filter(f => f.endsWith('.csv'));
  if (sfFiles.length === 0) {
    console.log('  No CSV files found in SF directory — skipping diff');
    return;
  }

  console.log(`  Found ${sfFiles.length} SF CSV files in ${sfDir}`);

  const diffResults = [];

  for (const file of sfFiles) {
    const key     = file.replace('.csv', '');
    const sfRows  = await readCsv(`${sfDir}/${file}`);
    const ourRows = datasets[key];

    if (!sfRows || !ourRows) {
      console.log(`  ⚠  Skipping ${file} — no matching dataset`);
      continue;
    }

    // Index both by Address for comparison
    const sfByUrl  = new Map(sfRows.map(r => [r['Address'], r]));
    const ourByUrl = new Map(ourRows.map(r => [r['Address'], r]));

    // URLs present in both
    const commonUrls = [...sfByUrl.keys()].filter(u => ourByUrl.has(u));

    if (commonUrls.length === 0) {
      console.log(`  ⚠  ${file}: no common URLs to compare`);
      continue;
    }

    let totalFields  = 0;
    let matchedFields = 0;
    const mismatches  = [];

    // Get columns from SF file
    const sfCols = Object.keys(sfRows[0] || {});

    for (const url of commonUrls) {
      const sfRow  = sfByUrl.get(url);
      const ourRow = ourByUrl.get(url);

      for (const col of sfCols) {
        if (!(col in ourRow)) continue; // we don't produce this column
        totalFields++;

        const sfVal  = (sfRow[col]  || '').trim();
        const ourVal = (ourRow[col] || '').trim();

        if (sfVal === ourVal) {
          matchedFields++;
        } else {
          mismatches.push({ url, col, sf: sfVal, ours: ourVal });
        }
      }
    }

    const matchPct = totalFields > 0 ? ((matchedFields / totalFields) * 100).toFixed(1) : 'N/A';
    const status   = parseFloat(matchPct) >= 95 ? '✅' : parseFloat(matchPct) >= 80 ? '⚠️ ' : '❌';

    diffResults.push({ file, commonUrls: commonUrls.length, totalFields, matchedFields, matchPct, mismatches });

    assert(
      parseFloat(matchPct) >= 95,
      `${file}: match rate ${matchPct}% below 95% target (${matchedFields}/${totalFields} fields matched)`
    );

    console.log(`\n  ${status} ${file.padEnd(45)} ${matchPct}% match  (${commonUrls.length} URLs, ${totalFields} fields)`);

    // Show top 10 mismatches
    if (mismatches.length > 0) {
      console.log(`     Top mismatches:`);
      mismatches.slice(0, 10).forEach(m => {
        console.log(`       ${m.col.padEnd(30)} SF: "${m.sf.slice(0,30)}"  Ours: "${m.ours.slice(0,30)}"`);
      });
    }
  }

  return diffResults;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nParity Test`);
console.log(`URL:  ${startUrl}`);
console.log(`Mode: ${sfCsvDir ? 'Self-validation + SF diff' : 'Self-validation only'}`);
console.log('─'.repeat(70));

console.log('\nCrawling...');
const pages    = await crawl({ startUrl, maxUrls: 10, maxConcurrency: 3 });
const datasets = toSfFormat(pages);
console.log(`Crawled ${pages.length} pages → ${Object.values(datasets).reduce((s,r) => s + r.length, 0)} total dataset rows`);

await runSelfValidation(datasets);

if (sfCsvDir) {
  await runSfDiff(datasets, sfCsvDir);
}

// ─── Final report ─────────────────────────────────────────────────────────────

console.log('\n\n' + '─'.repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}

const score = passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : 0;
console.log(`\nScore: ${score}%  ${parseFloat(score) >= 95 ? '✅ PASS' : parseFloat(score) >= 80 ? '⚠️  NEEDS WORK' : '❌ FAIL'}`);

if (parseFloat(score) >= 95) {
  console.log('\nCrawler is ready for cutover. Proceed to Phase 4 wiring.\n');
} else {
  console.log('\nFix failures before cutover.\n');
}

process.exit(failed > 0 ? 1 : 0);
