// backend/services/checks/s16-schema.js
import micromatch from 'micromatch';
const SECTION = 'Schema & Structured Data';

const VALID_TYPES = new Set([
  'WebPage','Product','FAQPage','NewsArticle','Article','BlogPosting','BreadcrumbList',
  'DiscussionForumPosting','QAPage','ItemList','Event','HowTo','Review','LocalBusiness',
  'Organization','SiteNavigationElement','ImageObject','VideoObject','Person',
  'AggregateRating','SpeakableSpecification','WebSite',
]);

const ARTICLE_REQUIRED = ['headline', 'datePublished', 'author', 'image'];

function getSchemaJson(page) {
  const types = page._schemaTypes || [];
  const items = page._schemaItems || [];
  return { types, items };
}

export function runSchemaChecks(records, ctx) {
  const failures = [];
  const schemaRules = ctx.schemaRules || [];

  for (const r of records) {
    const url   = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const { types, items } = getSchemaJson(r);
    const hasSchema = types.length > 0 || r._hasJsonLd;

    // schema_rules — user-configured URL pattern → required types
    if (schemaRules.length > 0) {
      let path = '';
      try { path = new URL(url).pathname; } catch { /* skip */ }
      const matchedRule = schemaRules.find(rule => micromatch.isMatch(path, rule.pattern));
      if (matchedRule) {
        for (const reqType of matchedRule.required) {
          if (!types.includes(reqType)) {
            failures.push({ check_id: 'schema_rules', passed: false, severity: 'warning', section: SECTION,
              message: `Required schema type "${reqType}" missing (rule: ${matchedRule.pattern})`, details: url });
          }
        }
      }
    }

    // schema_present
    if (!hasSchema) {
      failures.push({ check_id: 'schema_present', passed: false, severity: 'critical', section: SECTION,
        message: 'No structured data (JSON-LD) found on page', details: url });
      continue;
    }

    // schema_json_ld — Microdata/RDFa detected instead of JSON-LD
    if (r._hasMicrodata && !r._hasJsonLd) {
      failures.push({ check_id: 'schema_json_ld', passed: false, severity: 'warning', section: SECTION,
        message: 'Page uses Microdata/RDFa — JSON-LD is the preferred format', details: url });
    }

    // schema_validation — invalid JSON-LD or unknown @type
    if (r._schemaValid === false) {
      failures.push({ check_id: 'schema_validation', passed: false, severity: 'warning', section: SECTION,
        message: 'Invalid or malformed JSON-LD detected', details: url });
    }
    for (const t of types) {
      if (!VALID_TYPES.has(t)) {
        failures.push({ check_id: 'schema_validation', passed: false, severity: 'warning', section: SECTION,
          message: `Unknown schema @type: "${t}"`, details: url });
      }
    }

    // schema_rich_results — Article required fields
    if (types.includes('Article') || types.includes('BlogPosting') || types.includes('NewsArticle')) {
      const articleItem = items.find(i => ['Article','BlogPosting','NewsArticle'].includes(i['Type']));
      if (articleItem) {
        const props = new Set((articleItem.properties || []).map(p => p.name));
        const missing = ARTICLE_REQUIRED.filter(f => !props.has(f));
        if (missing.length > 0) {
          failures.push({ check_id: 'schema_rich_results', passed: false, severity: 'warning', section: SECTION,
            message: `Article schema missing required fields: ${missing.join(', ')}`, details: url });
        }
      }
    }

    // schema_article — content pages without Article schema
    const wordCount = parseInt(r['Word Count'] || '0', 10);
    if (wordCount > 400 && !types.some(t => ['Article','BlogPosting','NewsArticle'].includes(t))) {
      failures.push({ check_id: 'schema_article', passed: false, severity: 'info', section: SECTION,
        message: 'Content page without Article/BlogPosting/NewsArticle schema', details: url });
    }

    // schema_organization — homepage must have Organization/WebSite schema
    let path = '';
    try { path = new URL(url).pathname; } catch { /* skip */ }
    if (path === '/' || path === '') {
      if (!types.some(t => ['Organization','WebSite'].includes(t))) {
        failures.push({ check_id: 'schema_organization', passed: false, severity: 'info', section: SECTION,
          message: 'Homepage missing Organization or WebSite schema', details: url });
      }
    }

    // schema_faq — Q&A heading pattern without FAQPage schema
    if (r._hasQandAHeadings && !types.includes('FAQPage')) {
      failures.push({ check_id: 'schema_faq', passed: false, severity: 'info', section: SECTION,
        message: 'FAQ-style headings detected but no FAQPage schema', details: url });
    }

    // schema_breadcrumb — breadcrumb nav without BreadcrumbList schema
    if (r._hasBreadcrumbNav && !types.includes('BreadcrumbList')) {
      failures.push({ check_id: 'schema_breadcrumb', passed: false, severity: 'info', section: SECTION,
        message: 'Breadcrumb navigation detected without BreadcrumbList schema', details: url });
    }

    // schema_product — product page without Product schema
    if (r._isProductPage && !types.includes('Product')) {
      failures.push({ check_id: 'schema_product', passed: false, severity: 'info', section: SECTION,
        message: 'Product page detected without Product schema', details: url });
    }

    // schema_local_business — local business page without LocalBusiness schema
    if (r._isLocalPage && !types.includes('LocalBusiness')) {
      failures.push({ check_id: 'schema_local_business', passed: false, severity: 'info', section: SECTION,
        message: 'Local business page without LocalBusiness schema', details: url });
    }

    // schema_author — Article schema missing author name
    for (const item of items) {
      if (!['Article','BlogPosting','NewsArticle'].includes(item['Type'])) continue;
      const author = item['author'] || {};
      if (!author.name) {
        failures.push({ check_id: 'schema_author', passed: false, severity: 'info', section: SECTION,
          message: 'Article schema author.name missing', details: url });
      }
    }
  }

  return failures;
}
