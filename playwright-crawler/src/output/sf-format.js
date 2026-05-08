/**
 * SF Format output layer
 *
 * Maps raw crawler page records → SF-compatible CSV row objects.
 * Each function produces the exact column names that sf-parser.service.js reads.
 *
 * The goal: sf-parser.service.js reads these objects identically to SF CSV rows.
 * No changes needed downstream — only this file + crawl.service.js swap out.
 *
 * Produces equivalent of:
 *   internal_all.csv
 *   response_codes_all.csv
 *   page_titles_all.csv
 *   meta_description_all.csv
 *   h1_all.csv
 *   h2_all.csv
 *   canonicals_all.csv
 *   images_all.csv
 *   structured_data_all.csv
 *   structured_data_validation_errors.csv
 *   structured_data_validation_warnings.csv
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('output:sf-format');

// ─── Per-CSV row builders ─────────────────────────────────────────────────────

/**
 * Build a row matching internal_all.csv
 * Used for: URL Structure, indexability, word count, text ratio
 */
function toInternalRow(page) {
  return {
    'Address':               page.url || '',
    'Content Type':          page['Content Type'] || '',
    'Status Code':           page['Status Code']  || '',
    'Status':                page['Status']        || '',
    'Indexability':          page['Indexability']  || '',
    'Indexability Status':   page['Indexability Status'] || '',
    'Title 1':               page['Title 1']       || '',
    'Title 1 Length':        page['Title 1 Length']|| '',
    'Title 1 Pixel Width':   page['Title 1 Pixel Width'] || '',
    'Title 2':               page['Title 2']       || '',
    'Title 2 Length':        page['Title 2 Length']|| '',
    'Meta Description 1':    page['Meta Description 1'] || '',
    'Meta Description 1 Length': page['Meta Description 1 Length'] || '',
    'Meta Description 2':    page['Meta Description 2'] || '',
    'H1-1':                  page['H1-1']           || '',
    'H1-1 Length':           page['H1-1 Length']    || '',
    'H1-2':                  page['H1-2']           || '',
    'H2-1':                  page['H2-1']           || '',
    'H2-1 Length':           page['H2-1 Length']    || '',
    'H2-2':                  page['H2-2']           || '',
    'Meta Robots 1':         page['Meta Robots 1']  || '',
    'X-Robots-Tag 1':        page['X-Robots-Tag 1'] || '',
    'Meta Refresh':          page['Meta Refresh']   || '',
    'Canonical Link Element 1': page['Canonical Link Element 1'] || '',
    'rel="next"':            page['rel="next"']     || '',
    'rel="prev"':            page['rel="prev"']     || '',
    'Size':                  page['Size']            || '',
    'Word Count':            page['Word Count']      || '',
    'Text Ratio':            page['Text Ratio']      || '',
    'Crawl Depth':           page['Crawl Depth']     || '',
    'Link Score':            '',  // not computed — reserved
    'Unique Inlinks':        page['Unique Inlinks']  || '',
    'Unique Outlinks':       page['Unique Outlinks'] || '',
    'Response Time':         page['Response Time']   || '',
    'Last Modified':         page['Last Modified']   || '',
    'Redirect URL':          page['Redirect URL']    || '',
    'Redirect Type':         page['Redirect Type']   || '',
  };
}

/**
 * Build a row matching response_codes_all.csv
 */
function toResponseCodeRow(page) {
  return {
    'Address':      page.url || '',
    'Status Code':  page['Status Code']  || '',
    'Status':       page['Status']        || '',
    'Redirect URL': page['Redirect URL']  || '',
    'Redirect Type':page['Redirect Type'] || '',
  };
}

/**
 * Build a row matching page_titles_all.csv
 */
function toPageTitleRow(page) {
  return {
    'Address':             page.url || '',
    'Title 1':             page['Title 1']              || '',
    'Title 1 Length':      page['Title 1 Length']       || '',
    'Title 1 Pixel Width': page['Title 1 Pixel Width']  || '',
    'Title 2':             page['Title 2']              || '',
    'Title 2 Length':      page['Title 2 Length']       || '',
    'Indexability':        page['Indexability']         || '',
  };
}

/**
 * Build a row matching meta_description_all.csv
 */
function toMetaDescriptionRow(page) {
  return {
    'Address':                   page.url || '',
    'Meta Description 1':        page['Meta Description 1']        || '',
    'Meta Description 1 Length': page['Meta Description 1 Length'] || '',
    'Meta Description 2':        page['Meta Description 2']        || '',
    'Indexability':               page['Indexability']             || '',
  };
}

/**
 * Build a row matching h1_all.csv
 */
function toH1Row(page) {
  return {
    'Address':        page.url || '',
    'H1-1':           page['H1-1']           || '',
    'H1-1 Length':    page['H1-1 Length']     || '',
    'H1-2':           page['H1-2']            || '',
    'H1-2 Length':    page['H1-2 Length']     || '',
    'Occurrences':    page['H1 Occurrences']  || '0',
    'Indexability':   page['Indexability']    || '',
  };
}

/**
 * Build a row matching h2_all.csv
 */
function toH2Row(page) {
  return {
    'Address':        page.url || '',
    'H2-1':           page['H2-1']           || '',
    'H2-1 Length':    page['H2-1 Length']     || '',
    'H2-2':           page['H2-2']            || '',
    'H2-2 Length':    page['H2-2 Length']     || '',
    'Occurrences':    page['H2 Occurrences']  || '0',
    'Indexability':   page['Indexability']    || '',
  };
}

/**
 * Build a row matching canonicals_all.csv
 */
function toCanonicalRow(page) {
  return {
    'Address':                                 page.url || '',
    'Canonical Link Element 1':               page['Canonical Link Element 1']                || '',
    'Canonical HTTP Header':                   page['Canonical HTTP Header']                   || '',
    'Canonical Link Element Match HTTP Header':page['Canonical Link Element Match HTTP Header']|| '',
    'Indexability':                            page['Indexability']                            || '',
  };
}

/**
 * Build rows matching images_all.csv
 * One row per image on the page.
 */
function toImageRows(page) {
  const images = page._images || [];
  return images.map(img => ({
    'Address':          page.url || '',
    'Source':           img['Source']           || '',
    'Alt Text':         img['Alt Text']         || '',
    'Alt Text Length':  img['Alt Text Length']  || '',
    'Title':            img['Title']            || '',
    'Missing Alt Text': img['Missing Alt Text'] || '',
    'Alt Text Too Long':img['Alt Text Too Long'] || '',
  }));
}

/**
 * Build rows matching structured_data_all.csv
 * One row per schema block on the page.
 */
function toStructuredDataRows(page) {
  const items = page._schemaItems || [];
  if (items.length === 0) return [];

  return items.map(item => ({
    'Address':  page.url || '',
    'Type':     item['Type']     || '',
    'Property': item['Property'] || '',
    'Content':  item['Content']  || '',
    'Errors':   item['Errors']   || '0',
    'Warnings': item['Warnings'] || '0',
  }));
}

/**
 * Build rows matching structured_data_validation_errors.csv
 */
function toStructuredDataErrorRows(page) {
  const items = page._schemaItems || [];
  return items
    .filter(item => parseInt(item['Errors'] || '0', 10) > 0)
    .map(item => ({
      'Address':          page.url || '',
      'Feature-1':        item._type || '',
      'Type-1':           item._type || '',
      'Rich Result Errors': item['Errors'] || '0',
    }));
}

/**
 * Build rows matching structured_data_validation_warnings.csv
 */
function toStructuredDataWarningRows(page) {
  const items = page._schemaItems || [];
  return items
    .filter(item => parseInt(item['Warnings'] || '0', 10) > 0)
    .map(item => ({
      'Address':            page.url || '',
      'Feature-1':          item._type || '',
      'Type-1':             item._type || '',
      'Rich Result Warnings': item['Warnings'] || '0',
    }));
}

/**
 * Build rows matching javascript_all.csv
 */
function toJavascriptRow(page) {
  return {
    'Address':             page.url || '',
    'Rendered Word Count': page['Rendered Word Count'] || '',
    'Raw Word Count':      page['Raw Word Count']      || '',
    'Rendered Title':      page['Rendered Title']      || '',
    'Raw Title':           page['Raw Title']            || '',
  };
}

// ─── Inlink counter (cross-page) ──────────────────────────────────────────────

/**
 * Compute unique inlinks for every page from the full crawl results.
 * Returns a Map<url, count>.
 *
 * @param {object[]} pages — raw crawler records
 * @returns {Map<string, number>}
 */
function computeInlinks(pages) {
  const inlinks = new Map();

  for (const page of pages) {
    const links = page._internalLinks || [];
    for (const link of links) {
      const target = link.href;
      inlinks.set(target, (inlinks.get(target) || 0) + 1);
    }
  }

  return inlinks;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert an array of raw crawler page records into SF-format CSV datasets.
 *
 * Returns an object whose keys match the SF CSV filenames (without .csv),
 * and whose values are arrays of row objects — exactly as readCsv() would return.
 *
 * @param {object[]} pages — raw records from crawler.js
 * @returns {object}  SF-format datasets
 */
export function toSfFormat(pages) {
  logger.info(`Converting ${pages.length} pages to SF format...`);

  // Compute inlinks cross-page
  const inlinks = computeInlinks(pages);

  // Stamp inlinks onto each page record
  for (const page of pages) {
    page['Unique Inlinks'] = String(inlinks.get(page.url) || 0);
  }

  const datasets = {
    internal_all:                        [],
    response_codes_all:                  [],
    page_titles_all:                     [],
    meta_description_all:                [],
    h1_all:                              [],
    h2_all:                              [],
    canonicals_all:                      [],
    images_all:                          [],
    structured_data_all:                 [],
    structured_data_validation_errors:   [],
    structured_data_validation_warnings: [],
    javascript_all:                      [],
  };

  for (const page of pages) {
    datasets.internal_all.push(toInternalRow(page));
    datasets.response_codes_all.push(toResponseCodeRow(page));
    datasets.page_titles_all.push(toPageTitleRow(page));
    datasets.meta_description_all.push(toMetaDescriptionRow(page));
    datasets.h1_all.push(toH1Row(page));
    datasets.h2_all.push(toH2Row(page));
    datasets.canonicals_all.push(toCanonicalRow(page));
    datasets.images_all.push(...toImageRows(page));
    datasets.structured_data_all.push(...toStructuredDataRows(page));
    datasets.structured_data_validation_errors.push(...toStructuredDataErrorRows(page));
    datasets.structured_data_validation_warnings.push(...toStructuredDataWarningRows(page));
    datasets.javascript_all.push(toJavascriptRow(page));
  }

  logger.info(`SF format ready: ${Object.entries(datasets).map(([k,v]) => `${k}=${v.length}`).join(', ')}`);

  return datasets;
}
