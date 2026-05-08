/**
 * Migration 013 — Per-site default crawl configuration
 *
 * Adds crawl_config (JSON TEXT) to the sites table so that the
 * crawl configuration set in the New Site Wizard is persisted and
 * pre-loaded when starting a crawl for that site.
 */

export function up(db) {
  // Add the column only if it doesn't already exist (idempotent)
  const columns = db.pragma('table_info(sites)');
  if (!columns.find(c => c.name === 'crawl_config')) {
    db.prepare('ALTER TABLE sites ADD COLUMN crawl_config TEXT DEFAULT NULL').run();
  }
}
