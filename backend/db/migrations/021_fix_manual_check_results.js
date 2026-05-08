export const id = '021_fix_manual_check_results';

export function up(db) {
  db.prepare('DROP TABLE IF EXISTS manual_check_results').run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS manual_check_results (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id       TEXT    NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      check_number  INTEGER NOT NULL,
      status        TEXT CHECK(status IN ('pass', 'fail', 'needs_review')),
      notes         TEXT,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_id, check_number)
    )
  `).run();
}
