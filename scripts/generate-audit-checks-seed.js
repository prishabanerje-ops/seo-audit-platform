// scripts/generate-audit-checks-seed.js
/**
 * Generates backend/db/seed/audit-checks.js from docs/audit-checks/check-catalog.md.
 *
 * Run after editing the catalog:
 *   node scripts/generate-audit-checks-seed.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT         = join(__dirname, '..');
const CATALOG_PATH = join(ROOT, 'docs/audit-checks/check-catalog.md');
const OUTPUT_PATH  = join(ROOT, 'backend/db/seed/audit-checks.js');

const FEASIBILITY_MAP = {
  '✅':           'automated',
  '⚠️ GSC':       'gsc',
  '⚠️ GA4':       'ga4',
  '⚠️ PSI':       'psi',
  '⚠️ CrUX':      'crux',
  '⚠️ KW-UPLOAD': 'kw_upload',
  '⚠️ BL-UPLOAD': 'bl_upload',
  '🤖':           'ai',
  '📋':           'manual',
};

const catalog = readFileSync(CATALOG_PATH, 'utf8');
const lines   = catalog.split('\n');
const checks  = [];
let currentSection = null;
let inAiChecks     = false;

for (const line of lines) {
  // Level-2 section headers only (## Section N — Name)
  const secMatch = line.match(/^## Section \d+ — (.+)/);
  if (secMatch) {
    currentSection = secMatch[1].trim();
    inAiChecks = false;
    continue;
  }

  // AI Checks section
  if (line.startsWith('## AI Checks')) {
    currentSection = 'AI Checks';
    inAiChecks = true;
    continue;
  }

  // Any other ## header (e.g. Extractor Map, appendix) — stop processing
  if (line.startsWith('## ')) {
    currentSection = null;
    inAiChecks = false;
    continue;
  }

  if (!currentSection) continue;

  // Skip table header rows and separator rows
  if (line.includes('check_id') || /^\|[-\s|:]+$/.test(line.trim())) continue;

  if (!inAiChecks) {
    // Standard check row: | `check_id` | Name | feasibility | severity | ...
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*(✅|⚠️ GSC|⚠️ GA4|⚠️ PSI|⚠️ CrUX|⚠️ KW-UPLOAD|⚠️ BL-UPLOAD|🤖|📋)\s*\|\s*(critical|warning|info)\s*\|/);
    if (m) {
      checks.push({
        check_id:    m[1].trim(),
        name:        m[2].trim(),
        section:     currentSection,
        severity:    m[4].trim(),
        feasibility: FEASIBILITY_MAP[m[3].trim()] ?? 'automated',
      });
    }
  } else {
    // AI Checks table rows — 4 columns, no severity column (default info)
    // | `check_id` | Name | Input | Key Output Fields |
    const aim = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/);
    if (aim && aim[1] !== 'check_id' && aim[1] !== '---') {
      checks.push({
        check_id:    aim[1].trim(),
        name:        aim[2].trim(),
        section:     'AI Checks',
        severity:    'info',
        feasibility: 'ai',
      });
    }
  }
}

// Validate
if (checks.length < 300) {
  console.error(`ERROR: Only ${checks.length} checks parsed — expected >= 300.`);
  console.error('Check that the catalog table row format matches the regex.');
  process.exit(1);
}

const ids = checks.map(c => c.check_id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length > 0) {
  console.error('ERROR: Duplicate check_ids found:', [...new Set(dupes)]);
  process.exit(1);
}

const output = `/**
 * Audit checks seed — v2.
 * Auto-generated from docs/audit-checks/check-catalog.md
 * Regenerate: node scripts/generate-audit-checks-seed.js
 * DO NOT EDIT MANUALLY.
 *
 * ${checks.length} checks across all sections.
 */

export const AUDIT_CHECKS = ${JSON.stringify(checks, null, 2)};

/**
 * Seeds audit_checks table. Idempotent — INSERT OR IGNORE.
 * @param {import('better-sqlite3').Database} db
 */
export function seedAuditChecks(db) {
  const insert = db.prepare(\`
    INSERT OR IGNORE INTO audit_checks (check_id, name, section, severity_default, feasibility)
    VALUES (@check_id, @name, @section, @severity, @feasibility)
  \`);
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertAll(AUDIT_CHECKS);
}
`;

writeFileSync(OUTPUT_PATH, output, 'utf8');
console.log(`Generated ${checks.length} checks -> ${OUTPUT_PATH}`);
