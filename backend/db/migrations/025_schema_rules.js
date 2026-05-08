// backend/db/migrations/025_schema_rules.js
/**
 * Migration 025 — schema_rules
 *
 * Per-site URL-glob → required schema @type mapping.
 * Evaluated top-to-bottom at check time; first matching pattern wins.
 * A catch-all { pattern: '*', required_types: '["WebPage"]' } is always
 * appended by the API PUT handler if missing.
 */
export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_rules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id        INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      pattern        TEXT    NOT NULL,
      required_types TEXT    NOT NULL DEFAULT '["WebPage"]',
      sort_order     INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_schema_rules_site ON schema_rules(site_id, sort_order)
  `).run();
}
