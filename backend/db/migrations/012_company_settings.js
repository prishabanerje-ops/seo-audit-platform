/**
 * Migration 012 — Per-company settings and OAuth tokens
 *
 * 1. company_settings — key-value store scoped per company
 * 2. company_oauth_tokens — GSC/GA4 OAuth tokens per company
 */

export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT    NOT NULL,
      key        TEXT    NOT NULL,
      value      TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, key),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS company_oauth_tokens (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id      TEXT NOT NULL,
      provider        TEXT NOT NULL,
      access_token    TEXT NOT NULL,
      refresh_token   TEXT,
      token_expiry    TEXT,
      scope           TEXT,
      connected_email TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, provider),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
  `).run();
}
