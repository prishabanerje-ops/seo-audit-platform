// backend/services/checks/s22-aio.js
const SECTION = 'AI Overviews & AIO Optimization';
const QUESTION_RE = /\?$/;
const AIO_SCHEMA_TYPES = new Set(['Article', 'FAQPage', 'HowTo', 'SpeakableSpecification']);
const FRESHNESS_DAYS_FAST = 180; // 6 months

// Positive signals for informational content — blog posts, guides, how-tos, FAQs, news.
// Commercial/transactional pages (insurance products, e-commerce, service landing pages)
// are NOT informational even if they don't match a shop/checkout pattern.
const INFO_URL_RE = /\/(blog|guide|guides|how-to|article|articles|tips|learn|advice|news|faq|faqs|resources|education|tutorial|tutorials)\b/i;

function isInfoPage(url, schema) {
  // Explicit informational URL pattern
  if (INFO_URL_RE.test(url)) return true;
  // Article, BlogPosting, or HowTo schema is a reliable content-page signal
  if (schema.some(t => ['Article', 'BlogPosting', 'HowTo', 'NewsArticle'].includes(t))) return true;
  return false;
}

function headingSample(hierarchy) {
  const h2h3 = hierarchy.filter(h => h.level === 2 || h.level === 3).slice(0, 3);
  return h2h3.map(h => `"${(h.text || '').slice(0, 50)}"`).join(', ');
}

export function runAioChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const words    = parseInt(r['Word Count'] || '0', 10);
    const schema   = r._schemaTypes || [];
    const hierarchy = r._headingHierarchy || [];
    const infoPage = isInfoPage(url, schema);

    // aio_qa_format — informational page should have ≥ 2 question-format H2/H3 headings
    if (infoPage && words > 300) {
      const h2h3 = hierarchy.filter(h => h.level === 2 || h.level === 3);
      const questionHeadings = h2h3.filter(h => QUESTION_RE.test(h.text || ''));
      if (questionHeadings.length < 2) {
        const sample = headingSample(hierarchy);
        failures.push({ check_id: 'aio_qa_format', passed: false, severity: 'warning', section: SECTION,
          url,
          message: `Only ${questionHeadings.length} of ${h2h3.length} H2/H3 headings use question format — aim for ≥ 2`,
          details: sample ? `Current headings: ${sample}` : 'No H2/H3 headings found' });
      }
    }

    // aio_schema_ai_readability — needs Article, FAQ, HowTo, or speakable
    if (!schema.some(t => AIO_SCHEMA_TYPES.has(t))) {
      failures.push({ check_id: 'aio_schema_ai_readability', passed: false, severity: 'warning', section: SECTION,
        url,
        message: 'No Article/FAQ/HowTo/speakable schema — AI readability compromised',
        details: schema.length ? `Schema present: ${schema.join(', ')}` : 'No structured data found on page' });
    }

    // aio_content_freshness — > 6 months old
    const lastMod = r['Last Modified'] || '';
    if (lastMod) {
      const ageDays = (Date.now() - new Date(lastMod).getTime()) / (1000 * 60 * 60 * 24);
      if (!isNaN(ageDays) && ageDays > FRESHNESS_DAYS_FAST) {
        failures.push({ check_id: 'aio_content_freshness', passed: false, severity: 'warning', section: SECTION,
          url,
          message: `Content last modified ${Math.round(ageDays)} days ago — stale for AI-indexed topics`,
          details: `Last-Modified: ${lastMod}` });
      }
    }

    // aio_toc_anchors — long-form pages (> 1,500 words) need a TOC
    if (words > 1500 && !r._hasTocAnchors) {
      failures.push({ check_id: 'aio_toc_anchors', passed: false, severity: 'info', section: SECTION,
        url,
        message: `Long-form page (${words} words) missing table of contents with anchor links`,
        details: 'Add a TOC with #anchor links to each major section to aid AI parsing' });
    }

    // aio_content_length — informational pages < 800 words
    if (infoPage && words > 0 && words < 800) {
      failures.push({ check_id: 'aio_content_length', passed: false, severity: 'info', section: SECTION,
        url,
        message: `Informational page has only ${words} words — consider comprehensive coverage`,
        details: 'AI Overviews typically favour pages with 800+ words of structured content' });
    }

    // aio_longtail_coverage — informational page with < 3 question headings
    if (infoPage) {
      const questionCount = hierarchy.filter(h => QUESTION_RE.test(h.text || '')).length;
      if (questionCount < 3) {
        failures.push({ check_id: 'aio_longtail_coverage', passed: false, severity: 'info', section: SECTION,
          url,
          message: `Only ${questionCount} question-format headings — long-tail coverage may be insufficient`,
          details: 'Add H2/H3 headings phrased as questions to capture voice search and featured snippet traffic' });
      }
    }

    // aio_speakable — only flag when extractor explicitly found no speakable
    if (schema.includes('Article') && r._hasSpeakable === false) {
      failures.push({ check_id: 'aio_speakable', passed: false, severity: 'info', section: SECTION,
        url,
        message: 'Article page missing speakable schema — voice assistant readability reduced',
        details: 'Add speakableSpecification to mark the most important sections for voice assistants' });
    }

    // aio_nlp_structure — flat unstructured text > 500 words with no H2
    if (words > 500 && hierarchy.filter(h => h.level === 2).length === 0) {
      failures.push({ check_id: 'aio_nlp_structure', passed: false, severity: 'warning', section: SECTION,
        url,
        message: `Long content block (${words} words) with no H2 heading structure`,
        details: 'AI parsers rely on heading hierarchy to segment content — add H2 headings to break up sections' });
    }
  }

  return failures;
}
