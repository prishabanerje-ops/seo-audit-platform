/**
 * Migration 022 — Seed SEO test user for Cars24
 *
 * Creates seo@cars24.com as a Cars24 SEO-role user with default password SeoUser123!
 * Must reset password on first login (must_reset_password = 1).
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const id = '022_seed_seo_test_user';

const CARS24_ID = 'c24c0000-0000-0000-0000-000000000001';

export function up(db) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('seo@cars24.com');
  if (existing) return;

  const seedPassword = process.env.SEED_SEO_PASSWORD || 'SeoUser123!';
  const hash = bcrypt.hashSync(seedPassword, 12);
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, company_id, status, must_reset_password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), 'seo@cars24.com', hash, 'SEO Tester', 'seo', CARS24_ID, 'active', 1);
}
