/**
 * Startup-time security self-check.
 *
 * Run once from server.js after migrations and seed. Logs warnings to stderr
 * when the instance is still carrying development defaults into production.
 * Never throws; the server keeps booting either way so operators don't find
 * themselves locked out. The loud output is the nudge.
 */

import bcrypt from 'bcryptjs';

// Fallbacks baked into migration 006 / 008 when the corresponding env var is
// not set. Migration files are immutable (CLAUDE.md rule #9), so detection is
// runtime-only: we compare the stored bcrypt hash against these plaintexts.
const DEFAULT_SEED_PASSWORDS = [
  'ChangeMe123!',
  'SuperAdmin123!',
];

/**
 * Emit a warning if any seeded account is still using a known default password.
 * @param {import('better-sqlite3').Database} db
 */
export function auditSeededPasswords(db) {
  let flagged = [];
  try {
    const rows = db.prepare(
      "SELECT id, email, role, password_hash, must_reset_password FROM users WHERE role IN ('admin','superadmin')"
    ).all();

    for (const row of rows) {
      for (const plaintext of DEFAULT_SEED_PASSWORDS) {
        if (bcrypt.compareSync(plaintext, row.password_hash)) {
          flagged.push({ email: row.email, role: row.role, mustReset: !!row.must_reset_password });
          break;
        }
      }
    }
  } catch (err) {
    // Column missing on pre-migration DBs, or similar — log and move on.
    console.warn('[startup-audit] Skipping seed-password check:', err.message);
    return;
  }

  if (flagged.length === 0) return;

  const banner = '━'.repeat(72);
  console.warn('\n' + banner);
  console.warn('[startup-audit]  ⚠  SECURITY WARNING — default seeded password detected');
  console.warn(banner);
  for (const f of flagged) {
    const suffix = f.mustReset ? '(must_reset_password=1)' : '(must_reset_password=0 — attacker could log in directly)';
    console.warn(`  • ${f.role.padEnd(10)}  ${f.email}  ${suffix}`);
  }
  console.warn('');
  console.warn('  Rotate the password immediately:');
  console.warn('    1. Log in with the default, or use POST /api/auth/change-password');
  console.warn('    2. For fresh installs, set SEED_ADMIN_PASSWORD and');
  console.warn('       SEED_SUPERADMIN_PASSWORD env vars before first boot.');
  console.warn(banner + '\n');
}
