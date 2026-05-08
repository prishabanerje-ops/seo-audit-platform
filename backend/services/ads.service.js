import { randomBytes } from 'crypto';
import db from '../db/sqlite.js';
import { encryptToken, decryptToken } from './ads.crypto.js';

const IST_OFFSET_MINUTES = 330; // UTC+5:30

/**
 * Returns { startDate, endDate } as 'YYYY-MM-DD' strings in IST.
 * @param {'last7d'|'last30d'|'thisMonth'} range
 */
export function getDateRange(range) {
  const nowUtc = new Date();
  const istNow = new Date(nowUtc.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const year  = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth(); // 0-based
  const day   = istNow.getUTCDate();

  const todayIST = new Date(Date.UTC(year, month, day));

  let startDate;
  const endDate = todayIST;

  if (range === 'last7d') {
    startDate = new Date(Date.UTC(year, month, day - 6));
  } else if (range === 'last30d') {
    startDate = new Date(Date.UTC(year, month, day - 29));
  } else if (range === 'thisMonth') {
    startDate = new Date(Date.UTC(year, month, 1));
  } else {
    throw new Error(`Unknown date range: ${range}`);
  }

  const fmt = d => d.toISOString().slice(0, 10);
  return { startDate: fmt(startDate), endDate: fmt(endDate) };
}

// ── OAuth State ────────────────────────────────────────────────────────────

export function createOAuthState(userId, platform) {
  const state = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO ad_oauth_state (state, user_id, platform, expires_at) VALUES (?, ?, ?, ?)')
    .run(state, userId, platform, expiresAt);
  return state;
}

export function consumeOAuthState(state) {
  const row = db.prepare('SELECT * FROM ad_oauth_state WHERE state = ?').get(state);
  if (!row) throw new Error('Invalid OAuth state');
  if (new Date(row.expires_at) < new Date()) throw new Error('OAuth state expired');
  db.prepare('DELETE FROM ad_oauth_state WHERE state = ?').run(state);
  return { userId: row.user_id, platform: row.platform };
}

// ── Connections ───────────────────────────────────────────────────────────

export function saveConnection({ companyId, platform, accessToken, refreshToken, tokenExpiresAt }) {
  const id = randomBytes(16).toString('hex');
  const encAccess  = encryptToken(accessToken);
  const encRefresh = refreshToken ? encryptToken(refreshToken) : null;

  db.prepare(`
    INSERT INTO ad_connections (id, company_id, platform, access_token, refresh_token, token_expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, platform) DO UPDATE SET
      access_token     = excluded.access_token,
      refresh_token    = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at,
      updated_at       = datetime('now')
  `).run(id, companyId, platform, encAccess, encRefresh, tokenExpiresAt || null);

  return getConnection(companyId, platform);
}

export function getConnection(companyId, platform) {
  const row = db.prepare('SELECT * FROM ad_connections WHERE company_id = ? AND platform = ?')
    .get(companyId, platform);
  if (!row) return null;
  return {
    ...row,
    access_token:  decryptToken(row.access_token),
    refresh_token: row.refresh_token ? decryptToken(row.refresh_token) : null,
  };
}

export function listConnections(companyId) {
  return db.prepare('SELECT id, company_id, platform, selected_account_id, created_at, updated_at FROM ad_connections WHERE company_id = ?')
    .all(companyId);
}

export function deleteConnection(companyId, platform) {
  db.prepare('DELETE FROM ad_connections WHERE company_id = ? AND platform = ?')
    .run(companyId, platform);
}

// ── Snapshot Cache ─────────────────────────────────────────────────────────

export function saveSnapshot(connectionId, dateRange, data) {
  const id = randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO ad_snapshots (id, connection_id, date_range, data, fetched_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(connection_id, date_range) DO UPDATE SET
      data       = excluded.data,
      fetched_at = excluded.fetched_at
  `).run(id, connectionId, dateRange, JSON.stringify(data));
}

export function getCachedSnapshot(connectionId, dateRange) {
  const row = db.prepare(`
    SELECT data, fetched_at FROM ad_snapshots
    WHERE connection_id = ? AND date_range = ?
      AND fetched_at > datetime('now', '-1 hour')
  `).get(connectionId, dateRange);
  return row ? JSON.parse(row.data) : null;
}

// ── Metric orchestration (stubs — implemented in Tasks 6-8, 11) ───────────

export async function fetchMetricsForCompany(companyId, dateRange) {
  const { startDate, endDate } = getDateRange(dateRange);
  const connections = listConnections(companyId);
  const results = [];

  for (const conn of connections) {
    try {
      const full = getConnection(companyId, conn.platform);
      const cached = getCachedSnapshot(conn.id, dateRange);
      if (cached) { results.push(cached); continue; }

      let data;
      if (conn.platform === 'google') {
        const { fetchGoogleMetrics } = await import('./ads.google.js');
        data = await fetchGoogleMetrics(full, startDate, endDate);
      } else if (conn.platform === 'meta') {
        const { fetchMetaMetrics } = await import('./ads.meta.js');
        data = await fetchMetaMetrics(full, startDate, endDate);
      } else if (conn.platform === 'linkedin') {
        const { fetchLinkedInMetrics } = await import('./ads.linkedin.js');
        data = await fetchLinkedInMetrics(full, startDate, endDate);
      } else {
        continue;
      }
      saveSnapshot(conn.id, dateRange, data);
      results.push(data);
    } catch (err) {
      console.error(`[ads] Failed to fetch metrics for ${conn.platform}:`, err.message);
      // Continue — partial failures should not block other platforms
    }
  }

  return { platforms: results };
}

export async function refreshMetricsForCompany(companyId, dateRange, io) {
  const { startDate, endDate } = getDateRange(dateRange);
  const connections = listConnections(companyId);
  const room = `company:${companyId}`;

  for (const conn of connections) {
    try {
      const full = getConnection(companyId, conn.platform);
      let data;
      if (conn.platform === 'google') {
        const { fetchGoogleMetrics } = await import('./ads.google.js');
        data = await fetchGoogleMetrics(full, startDate, endDate);
      } else if (conn.platform === 'meta') {
        const { fetchMetaMetrics } = await import('./ads.meta.js');
        data = await fetchMetaMetrics(full, startDate, endDate);
      } else if (conn.platform === 'linkedin') {
        const { fetchLinkedInMetrics } = await import('./ads.linkedin.js');
        data = await fetchLinkedInMetrics(full, startDate, endDate);
      } else {
        continue;
      }
      saveSnapshot(conn.id, dateRange, data);
      io?.to(room).emit('ads:sync:progress', { platform: conn.platform, status: 'done', data });
    } catch (err) {
      console.error(`[ads] refresh ${conn.platform} error:`, err.message);
      io?.to(room).emit('ads:sync:progress', { platform: conn.platform, status: 'error', error: err.message });
    }
  }

  io?.to(room).emit('ads:sync:complete', { dateRange });
}
