/**
 * Migration 016 — Add sheets_spreadsheet_id to sites
 *
 * Needed by the Exports feature to identify which Google Spreadsheet
 * to push audit results into. Idempotent.
 */
export function up(db) {
  const cols = db.pragma('table_info(sites)').map(c => c.name);
  if (!cols.includes('sheets_spreadsheet_id')) {
    db.prepare('ALTER TABLE sites ADD COLUMN sheets_spreadsheet_id TEXT').run();
  }
}
