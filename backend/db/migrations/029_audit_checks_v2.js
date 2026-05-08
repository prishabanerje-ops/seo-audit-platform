// backend/db/migrations/029_audit_checks_v2.js
/**
 * Migration 029 — audit_checks v2 seed
 *
 * Adds check_id, section, feasibility columns to audit_checks.
 * Clears old seed rows. Seeds 369 new checks from v2 seed file.
 *
 * check_number (old auto-increment PK) is preserved for backward compat.
 * check_id (new string column) is the canonical identifier going forward.
 */
import { AUDIT_CHECKS } from '../seed/audit-checks.js';

export function up(db) {
  const cols = db.prepare('PRAGMA table_info(audit_checks)').all().map(c => c.name);

  if (!cols.includes('check_id')) {
    db.prepare('ALTER TABLE audit_checks ADD COLUMN check_id TEXT').run();
  }
  if (!cols.includes('section')) {
    db.prepare('ALTER TABLE audit_checks ADD COLUMN section TEXT').run();
  }
  if (!cols.includes('feasibility')) {
    db.prepare('ALTER TABLE audit_checks ADD COLUMN feasibility TEXT').run();
  }

  // Clear all existing rows (old seed)
  db.prepare('DELETE FROM audit_checks').run();

  // Seed new checks.
  // check_number (NOT NULL UNIQUE) is assigned sequentially from 1.
  // category (NOT NULL) is mapped from section for backward compat.
  // @severity maps to severity_default column.
  const insert = db.prepare(`
    INSERT INTO audit_checks (check_number, check_id, name, category, section, severity_default, feasibility)
    VALUES (@check_number, @check_id, @name, @section, @section, @severity, @feasibility)
  `);
  const insertAll = db.transaction((rows) => {
    rows.forEach((row, idx) => insert.run({ ...row, check_number: idx + 1 }));
  });
  insertAll(AUDIT_CHECKS);

  console.log('[migration 029] Seeded', AUDIT_CHECKS.length, 'audit checks');
}
