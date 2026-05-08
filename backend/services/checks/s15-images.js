// backend/services/checks/s15-images.js
const SECTION = 'Images';
const IMG_SIZE_MAX     = 200_000; // 200KB
const GENERIC_ALT_RE   = /^(image|photo|img|pic|picture|graphic|screenshot|banner|thumbnail)s?(\s*\d+)?$/i;
const FILENAME_ALT_RE  = /\.(jpe?g|png|gif|webp|svg|avif)$/i;
const GENERIC_NAME_RE  = /^(image\d+|IMG_|photo|pic\d*|screenshot)/i;
const NON_WEB_FORMAT_RE = /\.(bmp|tiff?)$/i;

export function runImageChecks(records, _ctx) {
  const failures = [];

  // Cross-page: duplicate alt text
  const altCounts = new Map();
  for (const r of records) {
    for (const img of (r._images || [])) {
      const alt = (img.alt || '').trim();
      if (alt) altCounts.set(alt, (altCounts.get(alt) || 0) + 1);
    }
  }

  for (const r of records) {
    const url    = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const images = r._images || [];

    let hasWebP = false;
    for (const img of images) {
      const src        = img.src || img['Source'] || '';
      const alt        = img.alt != null ? String(img.alt) : undefined;
      const hasMissing = img.missing ?? alt === undefined;
      const isContent  = img.isContent ?? true;

      // img_broken
      if (img.statusCode && img.statusCode >= 400) {
        failures.push({ check_id: 'img_broken', passed: false, severity: 'critical', section: SECTION,
          message: `Broken image (${img.statusCode}): ${src}`, details: url });
      }

      // img_alt_missing
      if (hasMissing) {
        failures.push({ check_id: 'img_alt_missing', passed: false, severity: 'critical', section: SECTION,
          message: `<img> missing alt attribute: ${src}`, details: url });
        continue;
      }

      // img_alt_empty — empty alt on content image
      if (alt === '' && isContent) {
        failures.push({ check_id: 'img_alt_empty', passed: false, severity: 'warning', section: SECTION,
          message: `Content image has empty alt attribute: ${src}`, details: url });
      }

      // img_alt_descriptive — generic alt text
      if (alt && (GENERIC_ALT_RE.test(alt) || FILENAME_ALT_RE.test(alt))) {
        failures.push({ check_id: 'img_alt_descriptive', passed: false, severity: 'warning', section: SECTION,
          message: `Generic/filename alt text: "${alt}"`, details: url });
      }

      // img_alt_duplicate — same alt on 3+ images
      if (alt && (altCounts.get(alt) || 0) >= 3) {
        failures.push({ check_id: 'img_alt_duplicate', passed: false, severity: 'warning', section: SECTION,
          message: `Duplicate alt text "${alt}" on ${altCounts.get(alt)} images`, details: url });
      }

      // img_file_name — generic filename
      const filename = src.split('/').pop()?.split('?')[0] || '';
      if (GENERIC_NAME_RE.test(filename)) {
        failures.push({ check_id: 'img_file_name', passed: false, severity: 'info', section: SECTION,
          message: `Generic image filename: ${filename}`, details: url });
      }

      // img_file_size
      if ((img.fileSizeBytes || img.contentLength || 0) > IMG_SIZE_MAX) {
        const kb = Math.round((img.fileSizeBytes || img.contentLength) / 1024);
        failures.push({ check_id: 'img_file_size', passed: false, severity: 'warning', section: SECTION,
          message: `Image too large: ${filename} = ${kb}KB (max 200KB)`, details: url });
      }

      // img_dimensions — missing width/height (only when extractor collected these fields)
      if (Object.prototype.hasOwnProperty.call(img, 'width') && !img.width && !img.height) {
        failures.push({ check_id: 'img_dimensions', passed: false, severity: 'info', section: SECTION,
          message: `Missing width/height attributes on <img> (causes CLS): ${src}`, details: url });
      }

      // img_lazy_loading — images below fold without loading="lazy"
      if ((img.offsetTop || 0) > 800 && !img.loading) {
        failures.push({ check_id: 'img_lazy_loading', passed: false, severity: 'info', section: SECTION,
          message: `Below-fold image missing loading="lazy": ${src}`, details: url });
      }

      // img_format — BMP/TIFF
      if (NON_WEB_FORMAT_RE.test(src)) {
        failures.push({ check_id: 'img_format', passed: false, severity: 'info', section: SECTION,
          message: `Legacy format (BMP/TIFF): ${filename}`, details: url });
      }

      // img_srcset — missing srcset (only when extractor collected this field)
      if (Object.prototype.hasOwnProperty.call(img, 'srcset') && !img.srcset && !img.inPicture) {
        failures.push({ check_id: 'img_srcset', passed: false, severity: 'info', section: SECTION,
          message: `<img> missing srcset for responsive images: ${src}`, details: url });
      }

      if (/\.(webp|avif)$/i.test(src)) hasWebP = true;
    }

    // img_next_gen — page uses no WebP/AVIF at all
    if (images.length > 0 && !hasWebP && !images.some(i => i.inPicture)) {
      failures.push({ check_id: 'img_next_gen', passed: false, severity: 'info', section: SECTION,
        message: 'No WebP or AVIF images found — consider next-gen format adoption', details: url });
    }

    // img_decorative_handling — decorative images without alt=""
    for (const img of images) {
      if (img.isDecorative && (img.alt || '').trim() !== '') {
        failures.push({ check_id: 'img_decorative_handling', passed: false, severity: 'info', section: SECTION,
          message: `Decorative image should have empty alt text: ${img.src || ''}`, details: url });
      }
    }
  }

  return failures;
}
