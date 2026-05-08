// backend/db/migrations/024_site_settings.js
/**
 * Migration 024 — site_settings
 *
 * Generic per-site key-value store for check configuration.
 * Keys used by the check engine:
 *   trusted_authority_domains  TEXT  newline-separated domain list
 *   ymyl_url_patterns          TEXT  newline-separated path patterns
 *   ymyl_disclaimer_patterns   TEXT  newline-separated regex strings
 *   brand_name                 TEXT  site brand name (title_brand check)
 *   site_topic                 TEXT  e.g. "insurance comparison"
 *   crux_api_key               TEXT  falls back to global settings key
 */
export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id    INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      key        TEXT    NOT NULL,
      value      TEXT    NOT NULL DEFAULT '',
      updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(site_id, key)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_site_settings_site ON site_settings(site_id)
  `).run();
}
