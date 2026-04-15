export function up(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_results_job      ON audit_results(crawl_job_id);
    CREATE INDEX IF NOT EXISTS idx_audit_results_section  ON audit_results(section);
    CREATE INDEX IF NOT EXISTS idx_audit_results_severity ON audit_results(severity);
    CREATE INDEX IF NOT EXISTS idx_audit_results_site     ON audit_results(site_id);
    CREATE INDEX IF NOT EXISTS idx_audit_results_site_job ON audit_results(site_id, crawl_job_id);
    CREATE INDEX IF NOT EXISTS idx_audit_results_url      ON audit_results(url);
    CREATE INDEX IF NOT EXISTS idx_gsc_cache_site_url     ON gsc_cache(site_id, url);
    CREATE INDEX IF NOT EXISTS idx_ga4_cache_site_url     ON ga4_cache(site_id, url);
    CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_task_status_site       ON task_status(site_id, status);
    CREATE INDEX IF NOT EXISTS idx_crawl_jobs_site        ON crawl_jobs(site_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_error_log_created      ON error_log(created_at DESC);
  `);
}
