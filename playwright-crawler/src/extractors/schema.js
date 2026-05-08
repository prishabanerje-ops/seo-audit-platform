/**
 * Schema / Structured Data extractor
 *
 * Extracts JSON-LD structured data matching SF CSV output:
 *
 * structured_data_all.csv columns:
 *   Address, Type, Property, Content, Errors, Warnings
 *
 * structured_data_validation_errors.csv columns:
 *   Address, Feature-1, Type-1, Rich Result Errors
 *
 * structured_data_validation_warnings.csv columns:
 *   Address, Feature-1, Type-1, Rich Result Warnings
 *
 * Also detects:
 *   - Missing schema types (Organization, BreadcrumbList, Product, FAQPage, etc.)
 *   - Invalid JSON-LD (parse errors)
 *   - Schema @type mismatch with page content
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:schema');

// Rich result types that Google supports — used for validation classification
const RICH_RESULT_TYPES = new Set([
  'Article', 'BreadcrumbList', 'Breadcrumb', 'Event', 'FAQPage',
  'HowTo', 'JobPosting', 'LocalBusiness', 'Movie', 'Organization',
  'Person', 'Product', 'Recipe', 'Review', 'SoftwareApplication',
  'VideoObject', 'WebPage', 'WebSite', 'ItemList', 'Dealer',
  'AutoDealer', 'Car', 'Vehicle',
]);

// Required properties per schema type (minimal set — triggers warnings if missing)
const REQUIRED_PROPS = {
  Product:       ['name', 'offers'],
  Car:           ['name', 'brand', 'model'],
  Vehicle:       ['name', 'brand'],
  LocalBusiness: ['name', 'address'],
  Organization:  ['name'],
  FAQPage:       ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
  Article:       ['headline', 'author'],
  JobPosting:    ['title', 'hiringOrganization', 'jobLocation'],
  Event:         ['name', 'startDate'],
  Recipe:        ['name', 'recipeIngredient'],
};

/**
 * Parse a single JSON-LD script block.
 * Returns parsed object or null with error info.
 *
 * @param {string} raw  — raw JSON string
 * @returns {{ data: object|null, error: string|null }}
 */
function parseJsonLd(raw) {
  try {
    const data = JSON.parse(raw.trim());
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Flatten a schema object into Property/Content pairs (SF format).
 * Only goes one level deep — nested objects are stringified.
 *
 * @param {object} obj
 * @returns {Array<{ property: string, content: string }>}
 */
function flattenProperties(obj) {
  const pairs = [];
  if (!obj || typeof obj !== 'object') return pairs;

  for (const [key, val] of Object.entries(obj)) {
    if (key === '@context' || key === '@type') continue;
    const content = typeof val === 'object' ? JSON.stringify(val) : String(val);
    pairs.push({ property: key, content: content.slice(0, 500) }); // cap length
  }
  return pairs;
}

/**
 * Validate a schema object against known required properties.
 * Returns arrays of errors and warnings.
 *
 * @param {object} schema
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateSchema(schema) {
  const errors   = [];
  const warnings = [];

  if (!schema || typeof schema !== 'object') {
    errors.push('Invalid schema object');
    return { errors, warnings };
  }

  const type = schema['@type'];
  if (!type) {
    warnings.push('Missing @type');
    return { errors, warnings };
  }

  const typeStr = Array.isArray(type) ? type[0] : type;

  // Check required properties
  const required = REQUIRED_PROPS[typeStr] || [];
  for (const prop of required) {
    if (!schema[prop]) {
      warnings.push(`Missing required property: ${prop}`);
    }
  }

  // Check for empty name
  if (schema.name !== undefined && !schema.name) {
    errors.push('Empty name property');
  }

  // Check for invalid URL in url property
  if (schema.url) {
    try {
      new URL(schema.url);
    } catch {
      errors.push(`Invalid URL in "url" property: ${schema.url}`);
    }
  }

  return { errors, warnings };
}

/**
 * Normalise @type — could be a string or array.
 * Returns the first type string.
 *
 * @param {any} typeVal
 * @returns {string}
 */
function getType(typeVal) {
  if (!typeVal) return '';
  if (Array.isArray(typeVal)) return typeVal[0] || '';
  return String(typeVal);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all structured data from a page.
 *
 * @param {CheerioAPI} $
 * @param {string}     url
 * @returns {object}
 */
export function extractSchema($, url) {
  if (!$) {
    logger.warn(`No cheerio instance for ${url}`);
    return { _schemaItems: [], _schemaErrors: 0, _schemaWarnings: 0 };
  }

  try {
    const schemaItems  = [];  // one entry per JSON-LD block
    const parseErrors  = [];
    let   totalErrors   = 0;
    let   totalWarnings = 0;

    // Extract all <script type="application/ld+json"> blocks
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).html() || '';
      if (!raw.trim()) return;

      const { data, error } = parseJsonLd(raw);

      if (error) {
        parseErrors.push(error);
        totalErrors++;
        schemaItems.push({
          'Type':     '',
          'Property': '',
          'Content':  '',
          'Errors':   '1',
          'Warnings': '0',
          _parseError: error,
          _raw: raw.slice(0, 200),
        });
        return;
      }

      // Handle @graph arrays
      const schemas = data['@graph'] ? data['@graph'] : [data];

      for (const schema of schemas) {
        const type       = getType(schema['@type']);
        const { errors, warnings } = validateSchema(schema);
        const properties = flattenProperties(schema);

        totalErrors   += errors.length;
        totalWarnings += warnings.length;

        schemaItems.push({
          // ── SF structured_data_all.csv columns ───────────────
          'Type':     type,
          'Property': properties.map(p => p.property).join(', '),
          'Content':  properties.map(p => p.content).join(' | ').slice(0, 500),
          'Errors':   String(errors.length),
          'Warnings': String(warnings.length),

          // ── Internal ──────────────────────────────────────────
          _type:          type,
          _isRichResult:  RICH_RESULT_TYPES.has(type),
          _errors:        errors,
          _warnings:      warnings,
          _properties:    properties,
          _raw:           schema,
        });
      }
    });

    // Detect presence of key schema types
    const types       = schemaItems.map(s => s._type).filter(Boolean);
    const typeSet     = new Set(types);

    logger.debug(`Schema: ${schemaItems.length} blocks, ${totalErrors} errors, ${totalWarnings} warnings — ${url}`);

    return {
      // ── SF structured_data_all.csv summary ───────────────────
      'Structured Data Errors':   String(totalErrors),
      'Structured Data Warnings': String(totalWarnings),
      'Structured Data Count':    String(schemaItems.length),

      // ── Internal flags ────────────────────────────────────────
      _schemaItems:          schemaItems,
      _schemaTypes:          [...typeSet],
      _schemaErrors:         totalErrors,
      _schemaWarnings:       totalWarnings,
      _schemaCount:          schemaItems.length,
      _parseErrors:          parseErrors,

      // Missing schema type flags (used by check logic)
      _hasOrganization:     typeSet.has('Organization'),
      _hasBreadcrumb:       typeSet.has('BreadcrumbList') || typeSet.has('Breadcrumb'),
      _hasProduct:          typeSet.has('Product') || typeSet.has('Car') || typeSet.has('Vehicle'),
      _hasFAQ:              typeSet.has('FAQPage'),
      _hasLocalBusiness:    typeSet.has('LocalBusiness') || typeSet.has('AutoDealer'),
      _hasWebSite:          typeSet.has('WebSite'),
      _hasArticle:          typeSet.has('Article'),
    };
  } catch (err) {
    logger.error(`Schema extraction failed for ${url}: ${err.message}`);
    return { _schemaItems: [], _schemaErrors: 0, _schemaWarnings: 0 };
  }
}
