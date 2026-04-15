/**
 * Standalone audit-checks seed runner.
 * Usage: node scripts/seed-checks.js
 * Run from the project root.
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

const inserted = seedAuditChecks(db);
if (inserted > 0) {
  console.log(`✅ Seeded ${inserted} audit checks`);
} else {
  const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM audit_checks').get();
  console.log(`ℹ  audit_checks already seeded (${cnt} rows)`);
}
db.close();
