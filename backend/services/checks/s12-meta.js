// backend/services/checks/s12-meta.js
const SECTION = 'Meta Descriptions';
const CTA_VERBS_RE = /\b(get|compare|check|buy|learn|find|apply|download|try|start|explore|discover|see|view|read|calculate|plan|save|earn|invest)\b/i;
const HTML_TAG_RE  = /<[a-z][^>]*>/i;

export function runMetaDescChecks(records, _ctx) {
  const failures = [];

  // Cross-page: duplicate detection
  const descCounts = new Map();
  for (const r of records) {
    if (r['Indexability'] !== 'Indexable') continue;
    const d = (r['Meta Description 1'] || '').trim();
    if (d) descCounts.set(d, (descCounts.get(d) || 0) + 1);
  }

  // Templated description detection — same prefix (first 40 chars) on 3+ pages
  const prefixCounts = new Map();
  for (const r of records) {
    if (r['Indexability'] !== 'Indexable') continue;
    const d = (r['Meta Description 1'] || '').trim();
    if (d.length >= 40) {
      const prefix = d.slice(0, 40);
      prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
    }
  }
  const templatedPrefixes = new Set([...prefixCounts.entries()].filter(([, c]) => c >= 3).map(([p]) => p));

  for (const r of records) {
    const url  = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const desc   = (r['Meta Description 1'] || '').trim();
    const length = parseInt(r['Meta Description 1 Length'] || String(desc.length), 10);

    // meta_desc_present
    if (!desc) {
      failures.push({ check_id: 'meta_desc_present', passed: false, severity: 'warning', section: SECTION,
        message: 'Missing <meta name="description">', details: url });
      continue;
    }

    // meta_desc_unique
    if ((descCounts.get(desc) || 0) > 1) {
      failures.push({ check_id: 'meta_desc_unique', passed: false, severity: 'critical', section: SECTION,
        message: `Duplicate meta description`, details: url });
    }

    // meta_desc_length
    if (length < 70 || length > 165) {
      failures.push({ check_id: 'meta_desc_length', passed: false, severity: 'warning', section: SECTION,
        message: `Description length ${length} chars — optimal range is 140–160 (flag if < 70 or > 165)`, details: url });
    }

    // meta_desc_cta — no action verb in first 15 words
    const first15 = desc.split(/\s+/).slice(0, 15).join(' ');
    if (!CTA_VERBS_RE.test(first15)) {
      failures.push({ check_id: 'meta_desc_cta', passed: false, severity: 'info', section: SECTION,
        message: 'No action verb in first 15 words of meta description', details: url });
    }

    // meta_desc_no_html
    if (HTML_TAG_RE.test(desc)) {
      failures.push({ check_id: 'meta_desc_no_html', passed: false, severity: 'info', section: SECTION,
        message: 'HTML tags detected inside meta description', details: url });
    }

    // meta_desc_encoding — garbled characters
    if (/[^\x09\x0A\x0D\x20-\x7E -￿]/.test(desc) || desc.includes('â€') || desc.includes('Ã')) {
      failures.push({ check_id: 'meta_desc_encoding', passed: false, severity: 'info', section: SECTION,
        message: 'Possibly garbled characters in meta description (encoding issue)', details: url });
    }

    // meta_desc_auto_generated — templated descriptions
    if (desc.length >= 40 && templatedPrefixes.has(desc.slice(0, 40))) {
      failures.push({ check_id: 'meta_desc_auto_generated', passed: false, severity: 'critical', section: SECTION,
        message: 'Templated meta description (same prefix on 3+ pages)', details: url });
    }
  }

  return failures;
}
