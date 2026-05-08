/**
 * Migration 010 — Audit Checks v2
 *
 * Adds three columns to audit_checks to support the 291-check CSV-sourced registry:
 *   subsection         — second-level grouping within a category
 *   implementation_rule — pseudocode detection logic from the CSV rule sheet
 *   automation_type    — 'automated' | 'manual' | 'hybrid'
 *
 * is_automated (INTEGER) is kept for backward compatibility.
 * ALTER TABLE in SQLite ignores IF NOT EXISTS, so this migration is safe to
 * run only once — the migration runner (run.js) guards against re-runs.
 */

export function up(db) {
  db.prepare('ALTER TABLE audit_checks ADD COLUMN subsection TEXT').run();
  db.prepare('ALTER TABLE audit_checks ADD COLUMN implementation_rule TEXT').run();
  db.prepare("ALTER TABLE audit_checks ADD COLUMN automation_type TEXT DEFAULT 'automated'").run();
}
