export function up(db) {
  // Add period column if not exists (idempotent)
  const cols = db.prepare("PRAGMA table_info(gsc_cache)").all();
  const hasPeriod = cols.some(c => c.name === 'period');
  if (!hasPeriod) {
    db.exec(`ALTER TABLE gsc_cache ADD COLUMN period TEXT DEFAULT 'current';`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS gsc_queries (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id          TEXT NOT NULL,
      query            TEXT NOT NULL,
      clicks           INTEGER DEFAULT 0,
      impressions      INTEGER DEFAULT 0,
      ctr              REAL    DEFAULT 0,
      position         REAL    DEFAULT 0,
      prev_clicks      INTEGER DEFAULT 0,
      prev_impressions INTEGER DEFAULT 0,
      fetched_at       DATETIME DEFAULT (datetime('now')),
      UNIQUE(site_id, query)
    );

    CREATE TABLE IF NOT EXISTS gsc_daily (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id     TEXT NOT NULL,
      date        TEXT NOT NULL,
      clicks      INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      ctr         REAL    DEFAULT 0,
      position    REAL    DEFAULT 0,
      fetched_at  DATETIME DEFAULT (datetime('now')),
      UNIQUE(site_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_gsc_queries_site    ON gsc_queries(site_id, clicks DESC);
    CREATE INDEX IF NOT EXISTS idx_gsc_daily_site_date ON gsc_daily(site_id, date);
  `);
}
