/**
 * Migration 020 — manual_check_results
 *
 * Stores analyst pass/fail/needs_review answers for manual-only audit checks.
 * One row per (site, check_number). updated_at tracks staleness.
 */

export const id = '020_manual_check_results';

export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS manual_check_results (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      check_number  INTEGER NOT NULL,
      status        TEXT CHECK(status IN ('pass', 'fail', 'needs_review')),
      notes         TEXT,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id, check_number)
    )
  `).run();
}
