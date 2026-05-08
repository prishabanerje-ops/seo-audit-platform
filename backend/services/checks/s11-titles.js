// backend/services/checks/s11-titles.js
const SECTION = 'Title Tags';

export function runTitleChecks(records, ctx) {
  const failures = [];

  // Cross-page: find duplicate titles
  const titleCounts = new Map();
  for (const r of records) {
    if (r['Indexability'] !== 'Indexable') continue;
    const t = (r['Title 1'] || '').trim();
    if (t) titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
  }

  const brandName = ctx.siteSettings?.get('brand_name') || '';

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const title  = (r['Title 1'] || '').trim();
    const length = parseInt(r['Title 1 Length'] || String(title.length), 10);
    const pixels = parseInt(r['Title 1 Pixel Width'] || '0', 10);
    const h1     = (r['H1-1'] || '').trim();

    // title_present
    if (!title) {
      failures.push({ check_id: 'title_present', passed: false, severity: 'critical', section: SECTION,
        message: 'Missing <title> tag', details: url });
      continue;
    }

    // title_unique
    if ((titleCounts.get(title) || 0) > 1) {
      failures.push({ check_id: 'title_unique', passed: false, severity: 'critical', section: SECTION,
        message: `Duplicate title: "${title.slice(0, 60)}${title.length > 60 ? '…' : ''}"`, details: url });
    }

    // title_length_chars
    if (length < 30 || length > 75) {
      failures.push({ check_id: 'title_length_chars', passed: false, severity: 'warning', section: SECTION,
        message: `Title length ${length} chars — optimal range is 50–60 (flag if < 30 or > 75)`, details: url });
    }

    // title_pixel_width
    if (pixels > 600) {
      failures.push({ check_id: 'title_pixel_width', passed: false, severity: 'warning', section: SECTION,
        message: `Title pixel width ${pixels}px — exceeds 600px display cutoff`, details: url });
    }

    // title_keyword_stuffing — any word repeated 3+ times
    const words = title.toLowerCase().split(/\s+/);
    const wordFreq = new Map();
    for (const w of words) wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    for (const [word, count] of wordFreq) {
      if (count >= 3 && word.length > 2) {
        failures.push({ check_id: 'title_keyword_stuffing', passed: false, severity: 'warning', section: SECTION,
          message: `Keyword "${word}" repeated ${count} times in title`, details: url });
        break;
      }
    }

    // title_brand
    if (brandName && !title.toLowerCase().includes(brandName.toLowerCase())) {
      failures.push({ check_id: 'title_brand', passed: false, severity: 'info', section: SECTION,
        message: `Brand name "${brandName}" not found in title`, details: url });
    }

    // title_h1_diff — title identical to H1
    if (h1 && title.toLowerCase() === h1.toLowerCase()) {
      failures.push({ check_id: 'title_h1_diff', passed: false, severity: 'info', section: SECTION,
        message: 'Title tag is identical to H1 — missed targeting opportunity', details: url });
    }
  }

  return failures;
}
