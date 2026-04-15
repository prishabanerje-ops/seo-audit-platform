/**
 * Migration 011 — Performance indexes
 *
 * Adds company_id indexes on sites, crawl_jobs, and audit_results.
 * These tables are always queried with a company_id WHERE clause.
 * Without indexes, every list query does a full table scan.
 */

export function up(db) {
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_sites_company_id ON sites(company_id)'
  ).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_crawl_jobs_company_id ON crawl_jobs(company_id)'
  ).run();
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_audit_results_company_id ON audit_results(company_id)'
  ).run();
}
