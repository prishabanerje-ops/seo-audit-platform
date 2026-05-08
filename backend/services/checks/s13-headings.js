// backend/services/checks/s13-headings.js
const SECTION = 'Headings';

export function runHeadingChecks(records, _ctx) {
  const failures = [];

  // Cross-page: duplicate H1 detection
  const h1Counts = new Map();
  for (const r of records) {
    if (r['Indexability'] !== 'Indexable') continue;
    const h1 = (r['H1-1'] || '').trim().toLowerCase();
    if (h1) h1Counts.set(h1, (h1Counts.get(h1) || 0) + 1);
  }

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const h1         = (r['H1-1'] || '').trim();
    const h1Count    = parseInt(r['H1 Occurrences'] || (h1 ? '1' : '0'), 10);
    const h2Count    = parseInt(r['H2 Occurrences'] || '0', 10);
    const wordCount  = parseInt(r['Word Count'] || '0', 10);
    const hierarchy  = r._headingHierarchy || [];

    // h1_present — missing or multiple H1s
    if (h1Count === 0 || !h1) {
      failures.push({ check_id: 'h1_present', passed: false, severity: 'critical', section: SECTION,
        message: 'No H1 tag on page', details: url });
    } else if (h1Count > 1 || r['H1-2']) {
      failures.push({ check_id: 'h1_present', passed: false, severity: 'critical', section: SECTION,
        message: `Multiple H1 tags: ${h1Count} found — exactly one required`, details: url });
    }

    // h1_unique
    if (h1 && (h1Counts.get(h1.toLowerCase()) || 0) > 1) {
      failures.push({ check_id: 'h1_unique', passed: false, severity: 'critical', section: SECTION,
        message: `Duplicate H1 across site: "${h1.slice(0, 60)}"`, details: url });
    }

    // h1_length
    if (h1 && (h1.length < 4 || h1.length > 100)) {
      failures.push({ check_id: 'h1_length', passed: false, severity: 'info', section: SECTION,
        message: `H1 length ${h1.length} chars — optimal range is 4–100`, details: url });
    }

    // h2_structure — content page > 300 words with no H2
    if (wordCount > 300 && h2Count === 0) {
      failures.push({ check_id: 'h2_structure', passed: false, severity: 'warning', section: SECTION,
        message: 'Content page (> 300 words) has no H2 headings', details: url });
    }

    // heading_hierarchy — skipped heading levels
    if (hierarchy.length >= 2) {
      for (let i = 1; i < hierarchy.length; i++) {
        const prev = hierarchy[i - 1].level;
        const curr = hierarchy[i].level;
        if (curr > prev + 1) {
          failures.push({ check_id: 'heading_hierarchy', passed: false, severity: 'critical', section: SECTION,
            message: `Heading hierarchy skips from H${prev} to H${curr}`, details: url });
          break;
        }
      }
    }

    // h3_h6_nesting — H3 not under an H2
    const seenLevels = new Set();
    for (const h of hierarchy) {
      if (h.level >= 3) {
        if (!seenLevels.has(h.level - 1)) {
          failures.push({ check_id: 'h3_h6_nesting', passed: false, severity: 'warning', section: SECTION,
            message: `H${h.level} appears without parent H${h.level - 1}`, details: url });
          break;
        }
      }
      seenLevels.add(h.level);
    }

    // heading_stuffing — any keyword appears 3+ times across all headings
    const allHeadingText = hierarchy.map(h => h.text || '').join(' ').toLowerCase();
    const headWords = allHeadingText.split(/\s+/);
    const freq = new Map();
    for (const w of headWords) { if (w.length > 2) freq.set(w, (freq.get(w) || 0) + 1); }
    for (const [word, count] of freq) {
      if (count >= 3) {
        failures.push({ check_id: 'heading_stuffing', passed: false, severity: 'warning', section: SECTION,
          message: `Keyword "${word}" repeated ${count} times across headings`, details: url });
        break;
      }
    }
  }

  return failures;
}
