// backend/db/migrations/026_keyword_mappings.js
/**
 * Migration 026 — keyword_mappings
 *
 * Per-site URL → primary keyword mapping. Populated via CSV upload.
 * Enables all KW-UPLOAD feasibility checks.
 * CSV format: url, primary_keyword, search_volume, secondary_keywords, is_pillar
 * Duplicate URLs: last row wins (upsert on site_id + url).
 */
export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS keyword_mappings (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id            INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      url                TEXT    NOT NULL,
      primary_keyword    TEXT    NOT NULL,
      search_volume      INTEGER,
      secondary_keywords TEXT,
      is_pillar          INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site_id, url)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_keyword_mappings_site ON keyword_mappings(site_id)
  `).run();
}
