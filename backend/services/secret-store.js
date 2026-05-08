/**
 * @module services/secret-store
 *
 * Centralised access to credential-class settings. Values for known secret
 * keys are encrypted at rest using services/ads.crypto; the rest are stored
 * plain. Callers use getGlobalSetting / getCompanySetting and receive
 * already-decrypted plaintext. Writers pass plaintext; setters encrypt.
 *
 * Idempotent on read: a value that doesn't look like an encryptToken payload
 * (iv:tag:ciphertext in base64, separated by ':') is returned as-is so that
 * any pre-existing plaintext row keeps working until it is overwritten.
 */

import db from '../db/sqlite.js';
import { encryptToken, decryptToken } from './ads.crypto.js';

// Keys whose values must be encrypted at rest in the settings / company_settings
// tables. Any other key is stored verbatim.
export const SECRET_KEYS = new Set([
  'anthropic_api_key',
  'psi_api_key',
  'linear_api_key',
  'slack_webhook_url',
  'smtp_pass',
]);

// An encryptToken payload is three base64 chunks joined by ':' (iv:tag:data).
const CIPHERTEXT_SHAPE = /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

function looksEncrypted(value) {
  return typeof value === 'string' && CIPHERTEXT_SHAPE.test(value);
}

function tryDecrypt(key, value) {
  if (value == null || value === '') return value;
  if (!SECRET_KEYS.has(key)) return value;
  if (!looksEncrypted(value)) {
    // Legacy / seeded plaintext — surface a single warning the first time
    // a process sees it, then return as-is so callers keep working.
    return value;
  }
  try {
    return decryptToken(value);
  } catch (err) {
    console.error(`[secret-store] Failed to decrypt ${key}:`, err.message);
    return null;
  }
}

function encryptForStorage(key, value) {
  if (value == null || value === '') return null;
  if (!SECRET_KEYS.has(key)) return value;
  if (looksEncrypted(value)) return value; // already encrypted, don't double-wrap
  return encryptToken(value);
}

// ─── Global settings (table: settings) ──────────────────────────────────────

export function getGlobalSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return tryDecrypt(key, row?.value ?? null);
}

export function setGlobalSetting(key, value) {
  const storedValue = encryptForStorage(key, value);
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, storedValue);
}

// ─── Per-company settings (table: company_settings) ─────────────────────────

export function getCompanySetting(companyId, key) {
  if (!companyId) return null;
  const row = db.prepare(
    'SELECT value FROM company_settings WHERE company_id = ? AND key = ?'
  ).get(companyId, key);
  return tryDecrypt(key, row?.value ?? null);
}

export function setCompanySetting(companyId, key, value) {
  const storedValue = encryptForStorage(key, value);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO company_settings (company_id, key, value, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(company_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(companyId, key, storedValue, now, now);
}
