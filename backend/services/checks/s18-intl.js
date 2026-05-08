// backend/services/checks/s18-intl.js
// franc-min provides language detection for content_language_match
let franc;
try { franc = (await import('franc-min')).franc; } catch { franc = null; }

const SECTION = 'International SEO';
const ISO_639_1 = new Set(['aa','ab','ae','af','ak','am','an','ar','as','av','ay','az','ba','be','bg','bh','bi','bm','bn','bo','br','bs','ca','ce','ch','co','cr','cs','cu','cv','cy','da','de','dv','dz','ee','el','en','eo','es','et','eu','fa','ff','fi','fj','fo','fr','fy','ga','gd','gl','gn','gu','gv','ha','he','hi','ho','hr','ht','hu','hy','hz','ia','id','ie','ig','ii','ik','io','is','it','iu','ja','jv','ka','kg','ki','kj','kk','kl','km','kn','ko','kr','ks','ku','kv','kw','ky','la','lb','lg','li','ln','lo','lt','lu','lv','mg','mh','mi','mk','ml','mn','mr','ms','mt','my','na','nb','nd','ne','ng','nl','nn','no','nr','nv','ny','oc','oj','om','or','os','pa','pi','pl','ps','pt','qu','rm','rn','ro','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sq','sr','ss','st','su','sv','sw','ta','te','tg','th','ti','tk','tl','tn','to','tr','ts','tt','tw','ty','ug','uk','ur','uz','ve','vi','vo','wa','wo','xh','yi','yo','za','zh','zu']);

export function runIntlChecks(records, _ctx) {
  const failures = [];

  // Build map of all crawled hreflang tags
  const hreflangGraph = new Map(); // url → array of {lang, href}
  for (const r of records) {
    if (r.url && (r._hreflangTags || []).length > 0) {
      hreflangGraph.set(r.url, r._hreflangTags);
    }
  }

  const internationalPages = records.filter(r => (r._hreflangTags || []).length > 0);
  if (internationalPages.length === 0) return failures;

  for (const r of records) {
    const url  = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const tags = r._hreflangTags || [];
    if (tags.length === 0) continue;

    // hreflang_self_ref — page's own URL not in hreflang set
    const selfRef = tags.find(t => t.href === url);
    if (!selfRef) {
      failures.push({ check_id: 'hreflang_self_ref', passed: false, severity: 'critical', section: SECTION,
        message: `Page URL not included in its own hreflang annotations`, details: url });
    }

    // hreflang_x_default — x-default must be present
    if (!tags.find(t => t.lang === 'x-default')) {
      failures.push({ check_id: 'hreflang_x_default', passed: false, severity: 'warning', section: SECTION,
        message: 'x-default hreflang annotation missing', details: url });
    }

    // hreflang_lang_valid — validate ISO 639-1 + optional ISO 3166-1 region
    for (const tag of tags) {
      if (tag.lang === 'x-default') continue;
      const [lang] = tag.lang.split('-');
      if (!ISO_639_1.has(lang)) {
        failures.push({ check_id: 'hreflang_lang_valid', passed: false, severity: 'warning', section: SECTION,
          message: `Invalid language code in hreflang: "${tag.lang}"`, details: url });
      }
    }

    // hreflang_reciprocal — every referenced URL should reference back
    for (const tag of tags) {
      if (tag.lang === 'x-default') continue;
      const targetTags = hreflangGraph.get(tag.href);
      if (targetTags) {
        const reciprocates = targetTags.some(t => t.href === url);
        if (!reciprocates) {
          failures.push({ check_id: 'hreflang_reciprocal', passed: false, severity: 'critical', section: SECTION,
            message: `Hreflang alternate ${tag.href} does not reference back to ${url}`, details: url });
        }
      }
    }

    // hreflang_url_consistent — all URLs in set use same format (trailing slash)
    const hrefs = tags.map(t => t.href);
    const trailingSlashes = hrefs.filter(h => { try { return new URL(h).pathname.endsWith('/'); } catch { return false; } });
    if (trailingSlashes.length > 0 && trailingSlashes.length < hrefs.length) {
      failures.push({ check_id: 'hreflang_url_consistent', passed: false, severity: 'critical', section: SECTION,
        message: 'Hreflang set mixes URLs with/without trailing slash', details: url });
    }

    // content_language_match — detect language and compare to hreflang value
    const bodyText = r._bodyText || '';
    const wordCount = parseInt(r['Word Count'] || '0', 10);
    if (franc && bodyText.length > 200 && wordCount >= 200) {
      const selfTag = tags.find(t => t.href === url);
      if (selfTag && selfTag.lang !== 'x-default') {
        const declaredLang = selfTag.lang.split('-')[0];
        let detectedLang = null;
        try { detectedLang = franc(bodyText.slice(0, 2000)); } catch { /* skip */ }
        if (detectedLang && detectedLang !== 'und' && detectedLang !== declaredLang) {
          failures.push({ check_id: 'content_language_match', passed: false, severity: 'critical', section: SECTION,
            message: `Detected language "${detectedLang}" does not match declared hreflang "${declaredLang}"`,
            details: url });
        }
      }
    }
  }

  // hreflang_indexed — check if any hreflang alternate URL returns non-200
  for (const [url, tags] of hreflangGraph) {
    for (const tag of tags) {
      if (tag.lang === 'x-default') continue;
      const altRecord = records.find(r => r.url === tag.href);
      if (altRecord) {
        const code = String(altRecord['Status Code'] || '');
        const isNoindex = altRecord['Indexability'] !== 'Indexable';
        // Only flag when status code is known and non-200
        if ((code && !code.startsWith('200')) || isNoindex) {
          failures.push({ check_id: 'hreflang_indexed', passed: false, severity: 'warning', section: SECTION,
            message: `Hreflang alternate ${tag.href} is not indexed (${code || 'noindex'})`, details: url });
        }
      }
    }
  }

  return failures;
}
