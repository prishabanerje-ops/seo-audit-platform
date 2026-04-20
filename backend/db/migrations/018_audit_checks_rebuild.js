/**
 * Migration 018 — Audit Checks Full Rebuild
 *
 * This migration prepares the audit_checks table for a ground-up replacement
 * of all check definitions (354 old checks → 321 new checks across 23 groups).
 *
 * Steps:
 *   1. Add issue_name TEXT column — the problem-phrased label shown on failing
 *      results (e.g. "Missing Title Tag" for check named "Title Tag Present").
 *   2. NULL out ai_suggestions.check_id to avoid FK violation on DELETE.
 *   3. Delete all existing audit_checks rows so the new seed starts clean.
 *
 * The new seed (audit-checks.js) re-inserts 321 checks across 23 categories.
 * Running seedAuditChecks() after this migration produces the correct state.
 */

export const id = '018_audit_checks_rebuild';

export function up(db) {
  // 1. Add issue_name column (problem-phrased label for findings)
  db.prepare("ALTER TABLE audit_checks ADD COLUMN issue_name TEXT").run();

  // 2. Detach ai_suggestions from old check IDs before deleting rows
  db.prepare("UPDATE ai_suggestions SET check_id = NULL WHERE check_id IS NOT NULL").run();

  // 3. Clear all old check definitions — seed will re-populate
  db.prepare("DELETE FROM audit_checks").run();
}
