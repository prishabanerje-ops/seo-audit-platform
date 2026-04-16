/**
 * Migration 015 — ai_suggestions per-URL caching and feedback
 *
 * - Adds   : result_id INTEGER  (FK to audit_results — enables per-URL suggestion caching)
 * - Adds   : feedback INTEGER   (inline rating: +1 thumbs up, -1 thumbs down; different from older ai_suggestion_feedback table design)
 *
 * Idempotent: checks column existence before ALTER TABLE.
 */

export function up(db) {
  const cols = db.pragma('table_info(ai_suggestions)').map(c => c.name);

  if (!cols.includes('result_id')) {
    db.prepare('ALTER TABLE ai_suggestions ADD COLUMN result_id INTEGER DEFAULT NULL').run();
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_suggestions_result_id
      ON ai_suggestions(result_id) WHERE result_id IS NOT NULL
    `).run();
  }

  if (!cols.includes('feedback')) {
    db.prepare('ALTER TABLE ai_suggestions ADD COLUMN feedback INTEGER DEFAULT NULL').run();
  }
}
