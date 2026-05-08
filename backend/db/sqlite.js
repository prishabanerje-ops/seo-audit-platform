import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

import { up as migration001 } from './migrations/001_initial.js';
import { up as migration002 } from './migrations/002_v3_additions.js';
import { up as migration003 } from './migrations/003_gsc_extended.js';
import { up as migration004 } from './migrations/004_task_detail.js';
import { up as migration006 } from './migrations/006_multi_tenancy.js';
import { up as migration007 } from './migrations/007_audit_results_company_id.js';
import { up as migration008 } from './migrations/008_force_password_reset.js';
import { up as migration009 } from './migrations/009_ads_integration.js';
import { up as migration010 } from './migrations/010_audit_checks_v2.js';
import { up as migration011 } from './migrations/011_performance_indexes.js';
import { up as migration012 } from './migrations/012_company_settings.js';
import { up as migration013 } from './migrations/013_site_crawl_config.js';
import { up as migration014 } from './migrations/014_audit_checks_tools.js';
import { up as migration015 } from './migrations/015_ai_suggestions_per_url.js';
import { up as migration016 } from './migrations/016_sheets_spreadsheet_id.js';
import { up as migration019 } from './migrations/019_password_version.js';
import { up as migration020 } from './migrations/020_manual_check_results.js';
import { up as migration021 } from './migrations/021_fix_manual_check_results.js';
import { up as migration022 } from './migrations/022_seed_seo_test_user.js';
import { up as migration023 } from './migrations/023_reset_test_credentials.js';
import { up as migration024 } from './migrations/024_site_settings.js';
import { up as migration025 } from './migrations/025_schema_rules.js';
import { up as migration026 } from './migrations/026_keyword_mappings.js';
import { up as migration027 } from './migrations/027_backlinks.js';
import { up as migration028 } from './migrations/028_audit_results_v2.js';
import { up as migration029 } from './migrations/029_audit_checks_v2.js';
import { up as migration030 } from './migrations/030_audit_checks_reseed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'seo-automation.db');

// Ensure the db directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Performance + safety settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Migration registry — run in order
const MIGRATIONS = [
  { id: 1, fn: migration001, name: '001_initial' },
  { id: 2, fn: migration002, name: '002_v3_additions' },
  { id: 3, fn: migration003, name: '003_gsc_extended' },
  { id: 4, fn: migration004, name: '004_task_detail' },
  // Note: 005_founder_to_admin was applied directly without a migration file entry.
  // Migration 006 uses id=6 to leave that gap intentional.
  { id: 6, fn: migration006, name: '006_multi_tenancy' },
  { id: 7, fn: migration007, name: '007_audit_results_company_id' },
  { id: 8, fn: migration008, name: '008_force_password_reset' },
  { id: 9, fn: migration009, name: '009_ads_integration' },
  { id: 10, fn: migration010, name: '010_audit_checks_v2' },
  { id: 11, fn: migration011, name: '011_performance_indexes' },
  { id: 12, fn: migration012, name: '012_company_settings' },
  { id: 13, fn: migration013, name: '013_site_crawl_config' },
  { id: 14, fn: migration014, name: '014_audit_checks_tools' },
  { id: 15, fn: migration015, name: '015_ai_suggestions_per_url' },
  { id: 16, fn: migration016, name: '016_sheets_spreadsheet_id' },
  // 017 and 018 are on disk but intentionally unapplied here — see PRD-v2-FINAL
  // and Phase 11 audit; enabling them is a separate PRD conformance decision.
  { id: 19, fn: migration019, name: '019_password_version' },
  { id: 20, fn: migration020, name: '020_manual_check_results' },
  { id: 21, fn: migration021, name: '021_fix_manual_check_results' },
  { id: 22, fn: migration022, name: '022_seed_seo_test_user' },
  { id: 23, fn: migration023, name: '023_reset_test_credentials' },
  { id: 24, fn: migration024, name: '024_site_settings' },
  { id: 25, fn: migration025, name: '025_schema_rules' },
  { id: 26, fn: migration026, name: '026_keyword_mappings' },
  { id: 27, fn: migration027, name: '027_backlinks' },
  { id: 28, fn: migration028, name: '028_audit_results_v2' },
  { id: 29, fn: migration029, name: '029_audit_checks_v2' },
  { id: 30, fn: migration030, name: '030_audit_checks_reseed' },
];

/**
 * Creates the migrations tracking table if it doesn't exist.
 */
function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * Runs pending migrations in order.
 * Idempotent — skips already-applied migrations.
 */
export function runMigrations() {
  ensureMigrationsTable();

  for (const { id, fn, name } of MIGRATIONS) {
    const applied = db.prepare('SELECT id FROM _migrations WHERE id = ?').get(id);
    if (!applied) {
      console.log(`[db] Running migration: ${name}`);
      fn(db);
      db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)').run(id, name);
      console.log(`[db] Migration applied: ${name}`);
    }
  }
}

// Auto-migrate in development
if (process.env.NODE_ENV !== 'production') {
  runMigrations();
}

export default db;

// Allow running directly: node backend/db/sqlite.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations();
  console.log('[db] Migrations complete.');
  db.close();
}
