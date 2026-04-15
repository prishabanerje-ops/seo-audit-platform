/**
 * Migration 006 — Multi-tenancy foundation
 *
 * 1. Creates `companies` table
 * 2. Creates `audit_log` table
 * 3. Adds `company_id` column (idempotent) to all data tables
 * 4. Enforces single superadmin via partial unique index
 * 5. Seeds Cars24 company record
 * 6. Promotes aakash.srivastava@cars24.com to superadmin (existing install)
 * 7. Assigns all existing data rows to Cars24
 * 8. Creates admin@c24.com as Cars24 admin with temp password ChangeMe123!
 * 9. For fresh installs with no users: creates superadmin@localhost / SuperAdmin123!
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Fixed UUID so this seed is idempotent across re-runs
const CARS24_ID = 'c24c0000-0000-0000-0000-000000000001';

export function up(db) {
  // ── 1. companies table ────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      contact_email TEXT,
      domain        TEXT,
      logo_url      TEXT,
      logo_path     TEXT,
      max_seats     INTEGER NOT NULL DEFAULT 10,
      plan          TEXT NOT NULL DEFAULT 'Starter',
      is_paid       INTEGER NOT NULL DEFAULT 1,
      status        TEXT NOT NULL DEFAULT 'active',
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── 2. audit_log table ────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id     TEXT NOT NULL,
      actor_email  TEXT NOT NULL,
      action       TEXT NOT NULL,
      target_type  TEXT,
      target_id    TEXT,
      company_id   TEXT,
      metadata     TEXT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── 3. Add company_id to all data tables (idempotent) ────────────────────
  const targets = [
    'users',
    'sites',
    'crawl_jobs',
    'invites',
    'schedules',
    'notifications',
    'task_status',
    'linear_tickets',
    'ai_suggestions',
    'ai_suggestion_feedback',
  ];

  for (const table of targets) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes('company_id')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN company_id TEXT;`);
    }
  }

  // ── 4. Enforce single superadmin at DB level ──────────────────────────────
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_single_superadmin
    ON users(role) WHERE role = 'superadmin';
  `);

  // ── 5. Seed Cars24 company ────────────────────────────────────────────────
  const existingC24 = db.prepare('SELECT id FROM companies WHERE id = ?').get(CARS24_ID);
  if (!existingC24) {
    db.prepare(`
      INSERT INTO companies (id, name, contact_email, domain, max_seats, plan, is_paid, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(CARS24_ID, 'Cars24', 'admin@c24.com', 'cars24.com', 10, 'Enterprise', 1, 'active');
  }

  // ── 6. Promote aakash to superadmin (existing install) ───────────────────
  db.prepare(`
    UPDATE users SET role = 'superadmin', company_id = NULL
    WHERE email = 'aakash.srivastava@cars24.com'
  `).run();

  // ── 7. Assign all existing data to Cars24 ────────────────────────────────
  // Users (exclude the superadmin we just set)
  db.prepare(`
    UPDATE users SET company_id = ?
    WHERE company_id IS NULL AND role != 'superadmin'
  `).run(CARS24_ID);

  // All other tables — assign any unowned rows to Cars24
  const dataTablesMigrate = [
    'sites',
    'crawl_jobs',
    'invites',
    'schedules',
    'notifications',
    'task_status',
    'linear_tickets',
    'ai_suggestions',
    'ai_suggestion_feedback',
  ];
  for (const table of dataTablesMigrate) {
    db.prepare(`UPDATE ${table} SET company_id = ? WHERE company_id IS NULL`).run(CARS24_ID);
  }

  // ── 8. Create admin@c24.com as Cars24 admin (if not already exists) ───────
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@c24.com');
  if (!existingAdmin) {
    const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
    const hash = bcrypt.hashSync(seedAdminPassword, 12);
    const id   = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, company_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'admin@c24.com', hash, 'Cars24 Admin', 'admin', CARS24_ID, 'active');
  }

  // ── 9. Fresh install: no superadmin yet → create default superadmin ───────
  const superadminExists = db.prepare(
    `SELECT id FROM users WHERE role = 'superadmin'`
  ).get();

  if (!superadminExists) {
    const seedSuperadminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'SuperAdmin123!';
    const hash = bcrypt.hashSync(seedSuperadminPassword, 12);
    const id   = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, company_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'superadmin@localhost', hash, 'Super Admin', 'superadmin', null, 'active');
  }
}
