export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id    TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      body       TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES task_status(id) ON DELETE CASCADE
    );
  `);

  // Add columns to task_status idempotently
  const cols = db.prepare("PRAGMA table_info(task_status)").all().map(c => c.name);

  if (!cols.includes('priority'))            db.exec(`ALTER TABLE task_status ADD COLUMN priority TEXT DEFAULT 'medium';`);
  if (!cols.includes('due_date'))            db.exec(`ALTER TABLE task_status ADD COLUMN due_date TEXT;`);
  if (!cols.includes('issue_type'))          db.exec(`ALTER TABLE task_status ADD COLUMN issue_type TEXT;`);
  if (!cols.includes('issue_section'))       db.exec(`ALTER TABLE task_status ADD COLUMN issue_section TEXT;`);
  if (!cols.includes('affected_urls_count')) db.exec(`ALTER TABLE task_status ADD COLUMN affected_urls_count INTEGER DEFAULT 0;`);

  // Add health_score to crawl_jobs
  const crawlCols = db.prepare("PRAGMA table_info(crawl_jobs)").all().map(c => c.name);
  if (!crawlCols.includes('health_score'))   db.exec(`ALTER TABLE crawl_jobs ADD COLUMN health_score INTEGER;`);
}
