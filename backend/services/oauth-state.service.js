/**
 * @module services/oauth-state
 *
 * Generic server-bound OAuth state for any provider (google-ads, meta, linkedin,
 * gsc, ga4). The state token is random 32 bytes hex, stored in the shared
 * ad_oauth_state table with a 10-minute expiry and single-use semantics
 * (DELETE-on-consume).
 *
 * The `platform` column doubles as a provider + context encoder:
 *   "google"                              → provider=google, context={}
 *   "gsc|{\"companyId\":\"abc-123\"}"     → provider=gsc,    context={companyId:"abc-123"}
 *
 * This encoding keeps GSC/GA4 (company-scoped) and ads (user-scoped) on the
 * same table without a schema change while still giving the callback all the
 * context it needs to resolve the target company.
 */

import { randomBytes } from 'crypto';
import db from '../db/sqlite.js';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function encodeProvider(provider, context) {
  if (!context || Object.keys(context).length === 0) return provider;
  return `${provider}|${JSON.stringify(context)}`;
}

function decodeProvider(encoded) {
  const sep = encoded.indexOf('|');
  if (sep < 0) return { provider: encoded, context: {} };
  const provider = encoded.slice(0, sep);
  try {
    const context = JSON.parse(encoded.slice(sep + 1));
    return { provider, context };
  } catch {
    return { provider, context: {} };
  }
}

/**
 * Create a server-bound OAuth state. Returns the opaque state token.
 * @param {string}  userId   user who initiated the flow
 * @param {string}  provider e.g. 'google' | 'meta' | 'linkedin' | 'gsc' | 'ga4'
 * @param {object}  context  optional extras to retrieve at callback (e.g. {companyId})
 */
export function createState(userId, provider, context = {}) {
  const state = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
  db.prepare(
    'INSERT INTO ad_oauth_state (state, user_id, platform, expires_at) VALUES (?, ?, ?, ?)'
  ).run(state, userId, encodeProvider(provider, context), expiresAt);
  return state;
}

/**
 * Consume a state token. Throws on unknown, expired, or mismatched provider.
 * Returns { userId, provider, context }.
 * @param {string} state
 * @param {string} [expectedProvider] if given, throws unless decoded provider matches
 */
export function consumeState(state, expectedProvider) {
  if (!state) throw new Error('Missing OAuth state');

  const row = db.prepare('SELECT * FROM ad_oauth_state WHERE state = ?').get(state);
  if (!row) throw new Error('Invalid OAuth state');

  // Delete first to make the state single-use even if further checks fail
  db.prepare('DELETE FROM ad_oauth_state WHERE state = ?').run(state);

  if (new Date(row.expires_at) < new Date()) throw new Error('OAuth state expired');

  const { provider, context } = decodeProvider(row.platform);
  if (expectedProvider && provider !== expectedProvider) {
    throw new Error('OAuth state provider mismatch');
  }

  return { userId: row.user_id, provider, context };
}

/**
 * Best-effort GC — delete any expired states. Safe to call on a schedule or
 * opportunistically from any route; does not throw.
 */
export function pruneExpiredStates() {
  try {
    db.prepare("DELETE FROM ad_oauth_state WHERE expires_at < datetime('now')").run();
  } catch { /* ignore */ }
}
