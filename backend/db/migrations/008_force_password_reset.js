/**
 * Migration 008 — Force password reset for seeded accounts
 *
 * 1. Adds `must_reset_password` column to users table
 * 2. Sets flag = 1 for admin@c24.com and superadmin@localhost —
 *    these accounts were seeded with publicly known default passwords
 *    and must change them on first login.
 */

export function up(db) {
  // ── 1. Add must_reset_password column (idempotent) ────────────────────────
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('must_reset_password')) {
    db.exec('ALTER TABLE users ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0');
  }

  // ── 2. Flag seeded accounts that have publicly known default passwords ─────
  db.prepare(`
    UPDATE users SET must_reset_password = 1
    WHERE email IN ('admin@c24.com', 'superadmin@localhost')
    AND must_reset_password = 0
  `).run();
}
