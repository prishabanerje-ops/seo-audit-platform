// backend/services/checks/s14-content.js
const SECTION = 'Content Quality';
const UTILITY_PATH_RE = /\/(login|signin|logout|search|404|error|admin|tag\/|author\/|feed|rss|page\/\d+|p=\d+)/i;
const FLESCH_EASY_THRESHOLD = 60;
const NEAR_DUP_THRESHOLD    = 0.80;
const NEAR_DUP_MAX_PAGES    = 200;
const FRESHNESS_MAX_DAYS    = 365;

function jaccardSim(textA, textB) {
  const setA = new Set(textA.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const setB = new Set(textB.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = new Set([...setA].filter(w => setB.has(w)));
  const union        = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function fleschReadingEase(text) {
  const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
  const words     = text.split(/\s+/).filter(Boolean).length || 1;
  const syllables = text.split(/[aeiouAEIOU]/).length - 1 || 1;
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

export function runContentChecks(records, _ctx) {
  const failures = [];

  const indexable = records.filter(r => r.url && r['Indexability'] === 'Indexable');

  // Cross-page: exact duplicate body hashes
  const hashMap = new Map(); // hash → first url
  for (const r of indexable) {
    const hash = r._bodyHash || '';
    if (!hash) continue;
    if (hashMap.has(hash)) {
      failures.push({ check_id: 'duplicate_content', passed: false, severity: 'critical', section: SECTION,
        message: `Exact duplicate of ${hashMap.get(hash)}`, details: r.url });
    } else {
      hashMap.set(hash, r.url);
    }
  }

  // Cross-page: near-duplicate (only on small sites ≤ 200 pages)
  if (indexable.length <= NEAR_DUP_MAX_PAGES) {
    const withText = indexable.filter(r => (r._bodyText || '').length > 200);
    for (let i = 0; i < withText.length; i++) {
      for (let j = i + 1; j < withText.length; j++) {
        const wA = parseInt(withText[i]['Word Count'] || '0', 10);
        const wB = parseInt(withText[j]['Word Count'] || '0', 10);
        if (wA === 0 || wB === 0) continue;
        if (Math.abs(wA - wB) / Math.max(wA, wB) > 0.10) continue;
        const sim = jaccardSim(withText[i]._bodyText || '', withText[j]._bodyText || '');
        if (sim > NEAR_DUP_THRESHOLD) {
          failures.push({ check_id: 'near_duplicate', passed: false, severity: 'warning', section: SECTION,
            message: `${Math.round(sim * 100)}% similar to ${withText[i].url}`, details: withText[j].url });
        }
      }
    }
  }

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const words  = parseInt(r['Word Count'] || '0', 10);
    const body   = r._bodyText || '';
    let isUtility = false;
    try { isUtility = UTILITY_PATH_RE.test(new URL(url).pathname); } catch { /* skip */ }

    // word_count
    if (!isUtility && words < 300) {
      failures.push({ check_id: 'word_count', passed: false, severity: 'warning', section: SECTION,
        message: `Word count ${words} — below 300-word minimum`, details: url });
    }

    // thin_content
    if (!isUtility && words < 300) {
      failures.push({ check_id: 'thin_content', passed: false, severity: 'critical', section: SECTION,
        message: `Thin content: ${words} words on non-utility page`, details: url });
    }

    // content_freshness — > 12 months old
    const lastModStr = r['Last Modified'] || r['article:modified_time'] || '';
    if (lastModStr) {
      const lastMod = new Date(lastModStr);
      if (!isNaN(lastMod)) {
        const ageDays = (Date.now() - lastMod.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > FRESHNESS_MAX_DAYS) {
          failures.push({ check_id: 'content_freshness', passed: false, severity: 'info', section: SECTION,
            message: `Content last modified ${Math.round(ageDays)} days ago — may be stale`, details: url });
        }
      }
    }

    // readability_score — Flesch < 60
    if (body.length > 500) {
      const score = fleschReadingEase(body);
      if (score < FLESCH_EASY_THRESHOLD) {
        failures.push({ check_id: 'readability_score', passed: false, severity: 'warning', section: SECTION,
          message: `Flesch Reading Ease = ${score.toFixed(1)} — below 60 (too complex)`, details: url });
      }
    }

    // expert_attribution — only flag when extractor explicitly set _authorSignal to false
    if (words > 300 && r._authorSignal === false) {
      failures.push({ check_id: 'expert_attribution', passed: false, severity: 'info', section: SECTION,
        message: 'No author attribution signal found on content page', details: url });
    }
  }

  return failures;
}
