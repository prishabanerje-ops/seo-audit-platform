export function up(db) {
  // Rename role value 'founder' → 'admin' in users table
  db.exec(`UPDATE users SET role = 'admin' WHERE role = 'founder';`);

  // Add comment column to ai_suggestion_feedback if not present
  const cols = db.prepare("PRAGMA table_info(ai_suggestion_feedback)").all().map(c => c.name);
  if (!cols.includes('comment')) {
    db.exec(`ALTER TABLE ai_suggestion_feedback ADD COLUMN comment TEXT;`);
  }

  // Add token budget tracking to settings (seed defaults if not present)
  const budgetExists = db.prepare("SELECT 1 FROM settings WHERE key = 'ai_token_budget'").get();
  if (!budgetExists) {
    db.exec(`INSERT INTO settings (key, value) VALUES ('ai_token_budget', '0');`);
  }
  const usedExists = db.prepare("SELECT 1 FROM settings WHERE key = 'ai_token_used'").get();
  if (!usedExists) {
    db.exec(`INSERT INTO settings (key, value) VALUES ('ai_token_used', '0');`);
  }

  // Add cms_type column to sites if not present
  const siteCols = db.prepare("PRAGMA table_info(sites)").all().map(c => c.name);
  if (!siteCols.includes('cms_type')) {
    db.exec(`ALTER TABLE sites ADD COLUMN cms_type TEXT;`);
  }
}
