export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id                TEXT PRIMARY KEY,
      project_id        TEXT,
      label             TEXT NOT NULL,
      url               TEXT NOT NULL,
      gsc_property      TEXT,
      ga4_property_id   TEXT,
      color             TEXT DEFAULT '#6366f1',
      sheets_tab_name   TEXT,
      linear_project_id TEXT,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crawl_jobs (
      id            TEXT PRIMARY KEY,
      site_id       TEXT,
      project_id    TEXT,
      started_at    DATETIME,
      completed_at  DATETIME,
      status        TEXT DEFAULT 'running',
      mode          TEXT DEFAULT 'spider',
      total_urls    INTEGER DEFAULT 0,
      error_message TEXT,
      config        TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_results (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      crawl_job_id TEXT NOT NULL,
      site_id      TEXT NOT NULL,
      section      TEXT NOT NULL,
      url          TEXT NOT NULL,
      data         TEXT,
      severity     TEXT NOT NULL,
      issue_type   TEXT NOT NULL,
      FOREIGN KEY (crawl_job_id) REFERENCES crawl_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (site_id)      REFERENCES sites(id)      ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_checks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      check_number     INTEGER NOT NULL UNIQUE,
      name             TEXT NOT NULL,
      category         TEXT NOT NULL,
      description      TEXT,
      detection_method TEXT,
      logic_summary    TEXT,
      seo_impact       TEXT,
      tool_source      TEXT    DEFAULT 'screaming-frog',
      severity_default TEXT    DEFAULT 'warning',
      is_automated     INTEGER DEFAULT 1,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gsc_cache (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id     TEXT NOT NULL,
      url         TEXT NOT NULL,
      clicks      INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      ctr         REAL    DEFAULT 0,
      position    REAL    DEFAULT 0,
      top_query   TEXT,
      period      TEXT    DEFAULT 'current',
      fetched_at  DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ga4_cache (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id              TEXT NOT NULL,
      url                  TEXT NOT NULL,
      sessions             INTEGER DEFAULT 0,
      engaged_sessions     INTEGER DEFAULT 0,
      engagement_rate      REAL    DEFAULT 0,
      bounce_rate          REAL    DEFAULT 0,
      avg_session_duration REAL    DEFAULT 0,
      total_revenue        REAL    DEFAULT 0,
      conversions          INTEGER DEFAULT 0,
      fetched_at           TEXT    DEFAULT (datetime('now')),
      UNIQUE(site_id, url),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id              TEXT PRIMARY KEY,
      site_ids        TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      notify_slack    INTEGER DEFAULT 0,
      notify_email    INTEGER DEFAULT 0,
      enabled         INTEGER DEFAULT 1,
      last_run        DATETIME,
      next_run        DATETIME,
      crawl_results   TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      email          TEXT UNIQUE NOT NULL,
      password_hash  TEXT NOT NULL,
      name           TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'seo',
      avatar_url     TEXT,
      status         TEXT DEFAULT 'active',
      last_active_at TEXT,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invites (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'readonly',
      token      TEXT NOT NULL UNIQUE,
      invited_by TEXT,
      expires_at TEXT NOT NULL,
      accepted   INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      description TEXT,
      created_by  TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS linear_tickets (
      id              TEXT PRIMARY KEY,
      audit_result_id TEXT,
      site_id         TEXT,
      linear_issue_id TEXT NOT NULL,
      linear_url      TEXT NOT NULL,
      title           TEXT,
      priority        INTEGER,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by      TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id            TEXT PRIMARY KEY,
      check_id      INTEGER,
      job_id        TEXT,
      site_id       TEXT,
      section       TEXT,
      response_text TEXT NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_suggestion_feedback (
      id            TEXT PRIMARY KEY,
      suggestion_id TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      rating        INTEGER NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(suggestion_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_status (
      id               TEXT PRIMARY KEY,
      audit_result_id  TEXT,
      site_id          TEXT NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT,
      status           TEXT DEFAULT 'backlog',
      assignee_id      TEXT,
      linear_ticket_id TEXT,
      linear_url       TEXT,
      created_by       TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      user_id    TEXT,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT,
      link       TEXT,
      is_read    INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS error_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      level      TEXT NOT NULL,
      source     TEXT NOT NULL,
      message    TEXT NOT NULL,
      stack      TEXT,
      user_id    TEXT,
      url        TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
