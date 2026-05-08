/**
 * Migration 023 — Reset test account credentials
 *
 * Replaces seeded accounts with user-specified credentials:
 *   Superadmin → aakashsuperadmin@audit.com / 12345678
 *   Admin      → aakashadmin@audit.com      / 12345678
 *   SEO        → aakashseo@audit.com        / 12345678
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const id = '023_reset_test_credentials';

const CARS24_ID = 'c24c0000-0000-0000-0000-000000000001';
const PASSWORD   = '12345678';

export function up(db) {
  const hash = bcrypt.hashSync(PASSWORD, 12);

  // ── 1. Update existing superadmin (UPDATE preserves the unique-index constraint) ──
  db.prepare(`
    UPDATE users
    SET email = ?, password_hash = ?, name = ?, must_reset_password = 0
    WHERE role = 'superadmin'
  `).run('aakashsuperadmin@audit.com', hash, 'Aakash Superadmin');

  // ── 2. Remove old admin seeds, insert new ────────────────────────────────────
  db.prepare(`DELETE FROM users WHERE email IN ('admin@c24.com')`).run();
  const existingAdmin = db.prepare(`SELECT id FROM users WHERE email = ?`).get('aakashadmin@audit.com');
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, company_id, status, must_reset_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), 'aakashadmin@audit.com', hash, 'Aakash Admin', 'admin', CARS24_ID, 'active', 0);
  }

  // ── 3. Remove old SEO seeds, insert new ──────────────────────────────────────
  db.prepare(`DELETE FROM users WHERE email IN ('seo@cars24.com')`).run();
  const existingSeo = db.prepare(`SELECT id FROM users WHERE email = ?`).get('aakashseo@audit.com');
  if (!existingSeo) {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, company_id, status, must_reset_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), 'aakashseo@audit.com', hash, 'Aakash SEO', 'seo', CARS24_ID, 'active', 0);
  }
}
