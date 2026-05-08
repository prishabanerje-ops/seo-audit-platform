/**
 * Migration 007 — Add company_id to audit_results
 *
 * audit_results was missed in migration 006. Adding it now and back-filling
 * from crawl_jobs.company_id via crawl_job_id so all existing rows are scoped.
 */

export function up(db) {
  const cols = db.prepare('PRAGMA table_info(audit_results)').all().map(c => c.name);
  if (!cols.includes('company_id')) {
    db.exec('ALTER TABLE audit_results ADD COLUMN company_id TEXT;');
  }

  // Back-fill from crawl_jobs
  db.exec(`
    UPDATE audit_results
    SET company_id = (
      SELECT company_id FROM crawl_jobs WHERE crawl_jobs.id = audit_results.crawl_job_id
    )
    WHERE company_id IS NULL;
  `);
}
