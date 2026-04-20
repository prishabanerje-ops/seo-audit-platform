/**
 * Migration 018 — Add issue_name column to audit_checks
 *
 * Adds `issue_name TEXT` — the problem-phrased label shown on failing audit
 * results (e.g. "Missing Title Tag" for the check named "Title Tag Present").
 *
 * The reports.js join is updated to match on `name OR issue_name` so that
 * both rule-phrased and problem-phrased lookups resolve to the same check.
 *
 * Backfills issue_name = name for any existing rows so no data is left NULL.
 */

export const id = '018_audit_checks_issue_name';

export function up(db) {
  db.prepare("ALTER TABLE audit_checks ADD COLUMN issue_name TEXT").run();
  db.prepare("UPDATE audit_checks SET issue_name = name WHERE issue_name IS NULL").run();
}
