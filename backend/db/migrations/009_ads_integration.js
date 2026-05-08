/**
 * Migration 009 — Paid Ads Integration
 *
 * Creates tables for managing ad account connections, OAuth state, accounts, and snapshots
 * for integrating with Google Ads, Meta/Facebook, and other ad platforms.
 *
 * Tables created:
 * 1. ad_oauth_state — OAuth state tokens for multi-step auth flows
 * 2. ad_connections — Authenticated connections to ad platforms per company
 * 3. ad_accounts — Individual ad accounts within a connection
 * 4. ad_snapshots — Cached ad performance data (cost, impressions, clicks, conversions)
 */

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_oauth_state (
      state       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      platform    TEXT NOT NULL,
      expires_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ad_connections (
      id              TEXT PRIMARY KEY,
      company_id      TEXT NOT NULL,
      platform        TEXT NOT NULL,
      access_token    TEXT NOT NULL,
      refresh_token   TEXT,
      token_expires_at TEXT,
      selected_account_id TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(company_id, platform)
    );

    CREATE TABLE IF NOT EXISTS ad_accounts (
      id            TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL REFERENCES ad_connections(id) ON DELETE CASCADE,
      platform      TEXT NOT NULL,
      account_id    TEXT NOT NULL,
      account_name  TEXT NOT NULL,
      currency      TEXT NOT NULL,
      is_selected   INTEGER NOT NULL DEFAULT 0,
      extras        TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ad_snapshots (
      id            TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL REFERENCES ad_connections(id) ON DELETE CASCADE,
      date_range    TEXT NOT NULL,
      data          TEXT NOT NULL,
      fetched_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(connection_id, date_range)
    );
  `);

  // Purge any expired state rows left from previous runs
  db.prepare("DELETE FROM ad_oauth_state WHERE expires_at < datetime('now')").run();
}
