/**
 * Standalone audit-checks seed runner.
 * Usage: node scripts/seed-checks.js
 * Run from the project root.
 *
 * Requires migration 018 to have been applied first.
 * Migration 018 adds the issue_name column and clears old check definitions.
 * To apply: add { id: 18, ... } to the MIGRATIONS array in backend/db/sqlite.js
 * and restart the server (or run: node backend/db/sqlite.js).
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { seedAuditChecks } from '../backend/db/seed/audit-checks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = join(__dirname, '..', 'backend', 'seo-automation.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Guard: migration 018 must have run (adds issue_name column, clears old checks)
const applied = db.prepare("SELECT id FROM _migrations WHERE id = 18").get();
if (!applied) {
  console.error('❌ Migration 018 has not been applied.');
  console.error('   Add { id: 18, ... } to MIGRATIONS in backend/db/sqlite.js and restart the server.');
  db.close();
  process.exit(1);
}

const { cnt: existingCount } = db.prepare('SELECT COUNT(*) AS cnt FROM audit_checks').get();
if (existingCount > 0) {
  console.log(`ℹ  audit_checks already seeded (${existingCount} rows). Nothing to do.`);
  db.close();
  process.exit(0);
}

const inserted = seedAuditChecks(db);
console.log(`✅ Seeded ${inserted} audit checks`);
db.close();
