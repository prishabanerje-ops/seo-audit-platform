// backend/db/migrations/030_audit_checks_reseed.js
/**
 * Migration 030 — audit_checks reseed
 *
 * Removes the 18 bogus extractor-map rows that were accidentally included in
 * the 029 seed (caused by the generator not stopping inAiChecks mode when
 * it hit the ## Extractor Map header). Re-seeds with the corrected 351 checks.
 */
import { AUDIT_CHECKS } from '../seed/audit-checks.js';

export function up(db) {
  db.prepare('DELETE FROM audit_checks').run();

  const insert = db.prepare(`
    INSERT INTO audit_checks (check_number, check_id, name, category, section, severity_default, feasibility)
    VALUES (@check_number, @check_id, @name, @section, @section, @severity, @feasibility)
  `);
  const insertAll = db.transaction((rows) => {
    rows.forEach((row, idx) => insert.run({ ...row, check_number: idx + 1 }));
  });
  insertAll(AUDIT_CHECKS);

  console.log('[migration 030] Reseeded', AUDIT_CHECKS.length, 'audit checks (bogus extractor rows removed)');
}
