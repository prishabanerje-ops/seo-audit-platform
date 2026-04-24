/**
 * Migration 019 — users.password_version
 *
 * Adds a monotonically increasing counter on the users row that is embedded
 * into every JWT (`pv` claim) and checked by authMiddleware on every
 * request. change-password bumps the counter so existing tokens issued
 * against the old password are invalidated server-side.
 *
 * DEFAULT 0 matches the value that authMiddleware uses for pre-migration
 * tokens (`decoded.pv ?? 0`), so users whose sessions pre-date this
 * migration stay logged in until they change their password or expire.
 */

export const id = '019_password_version';

export function up(db) {
  db.prepare('ALTER TABLE users ADD COLUMN password_version INTEGER NOT NULL DEFAULT 0').run();
}
