// backend/db/migrations/028_audit_results_v2.js
/**
 * Migration 028 — audit_results v2
 *
 * Adds columns required by the CheckResult contract.
 * Existing rows keep their old issue_type/data values — both coexist.
 * New crawl results populate both old and new columns.
 *
 * New columns:
 *   check_id  TEXT     — string ID from check-catalog.md (e.g. 'http_status')
 *   passed    INTEGER  — 1 = passed, 0 = failed
 *   message   TEXT     — human-readable one-line result summary
 *   details   TEXT     — specific value/element that failed; NULL if passed
 */
export function up(db) {
  const cols = db.prepare('PRAGMA table_info(audit_results)').all().map(c => c.name);

  if (!cols.includes('check_id')) {
    db.prepare('ALTER TABLE audit_results ADD COLUMN check_id TEXT').run();
  }
  if (!cols.includes('passed')) {
    db.prepare('ALTER TABLE audit_results ADD COLUMN passed INTEGER').run();
  }
  if (!cols.includes('message')) {
    db.prepare('ALTER TABLE audit_results ADD COLUMN message TEXT').run();
  }
  if (!cols.includes('details')) {
    db.prepare('ALTER TABLE audit_results ADD COLUMN details TEXT').run();
  }

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_audit_results_check_id
      ON audit_results(site_id, crawl_job_id, check_id)
  `).run();
}
