// backend/db/migrations/027_backlinks.js
/**
 * Migration 027 — backlink_uploads + backlinks
 *
 * Stores Semrush/Ahrefs backlink export CSVs per site.
 * backlink_uploads: one row per CSV upload (for history + lost_backlinks diff).
 * backlinks: individual link rows from the upload.
 * Enables all BL-UPLOAD feasibility checks.
 * link_type values: editorial | guest_post | pr | directory | other
 */
export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS backlink_uploads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      filename    TEXT    NOT NULL,
      row_count   INTEGER NOT NULL,
      uploaded_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS backlinks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id         INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      upload_id       INTEGER NOT NULL REFERENCES backlink_uploads(id) ON DELETE CASCADE,
      source_url      TEXT    NOT NULL,
      target_url      TEXT    NOT NULL,
      anchor_text     TEXT,
      domain_rating   INTEGER,
      is_dofollow     INTEGER NOT NULL DEFAULT 1,
      first_seen_date TEXT,
      link_type       TEXT    NOT NULL DEFAULT 'other',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_backlinks_site ON backlinks(site_id, target_url)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_backlinks_upload ON backlinks(upload_id)
  `).run();
}
