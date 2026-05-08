import { Router } from 'express';
import db from '../db/sqlite.js';
import { requireRole } from '../middleware/auth.js';
import {
  createOAuthState, consumeOAuthState,
  saveConnection, getConnection, listConnections, deleteConnection,
  saveSnapshot, getCachedSnapshot, getDateRange,
  fetchMetricsForCompany, refreshMetricsForCompany,
} from '../services/ads.service.js';

const router = Router();

const VALID_PLATFORMS = ['google', 'meta', 'linkedin'];

function validatePlatform(req, res, next) {
  if (!VALID_PLATFORMS.includes(req.params.platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }
  next();
}

// ── Connections ────────────────────────────────────────────────────────────

router.get('/connections', (req, res) => {
  const connections = listConnections(req.user.company_id);
  res.json({ connections });
});

router.post('/connect/:platform', requireRole('admin', 'superadmin'), validatePlatform, (req, res) => {
  const { platform } = req.params;
  const state = createOAuthState(req.user.sub, platform);
  let authUrl;

  if (platform === 'google')        authUrl = buildGoogleAuthUrl(state);
  else if (platform === 'meta')     authUrl = buildMetaAuthUrl(state);
  else if (platform === 'linkedin') authUrl = buildLinkedInAuthUrl(state);

  res.json({ authUrl });
});

router.get('/callback/:platform', validatePlatform, async (req, res) => {
  const { platform } = req.params;
  try {
    if (platform === 'google')        await handleGoogleCallback(req, res);
    else if (platform === 'meta')     await handleMetaCallback(req, res);
    else if (platform === 'linkedin') await handleLinkedInCallback(req, res);
  } catch (err) {
    console.error(`[ads] ${platform} callback error:`, err.message);
    res.redirect(`${process.env.FRONTEND_URL}/integrations?ads_error=${encodeURIComponent(err.message)}`);
  }
});

router.delete('/connections/:platform', requireRole('admin', 'superadmin'), validatePlatform, (req, res) => {
  deleteConnection(req.user.company_id, req.params.platform);
  res.json({ ok: true });
});

router.get('/accounts/:platform', validatePlatform, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM ad_accounts
    WHERE connection_id IN (
      SELECT id FROM ad_connections WHERE company_id = ? AND platform = ?
    )
  `).all(req.user.company_id, req.params.platform);
  res.json({ accounts: rows });
});

router.post('/accounts/:platform/select', requireRole('admin', 'superadmin'), validatePlatform, (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const conn = getConnection(req.user.company_id, req.params.platform);
  if (!conn) return res.status(404).json({ error: 'Not connected' });
  db.prepare('UPDATE ad_connections SET selected_account_id = ? WHERE id = ?').run(accountId, conn.id);
  db.prepare('UPDATE ad_accounts SET is_selected = (account_id = ?) WHERE connection_id = ?').run(accountId, conn.id);
  res.json({ ok: true });
});

router.get('/metrics', async (req, res) => {
  const dateRange = req.query.range || 'last30d';
  try {
    const data = await fetchMetricsForCompany(req.user.company_id, dateRange);
    res.json(data);
  } catch (err) {
    console.error('[ads] metrics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/metrics/refresh', async (req, res) => {
  const dateRange = req.query.range || 'last30d';
  const io = req.app.get('io');
  res.json({ ok: true, message: 'Sync started' });
  refreshMetricsForCompany(req.user.company_id, dateRange, io).catch(err => {
    console.error('[ads] refresh error:', err.message);
  });
});

// ── OAuth URL builders ─────────────────────────────────────────────────────

function buildGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/ads/callback/google`,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/adwords',
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function buildMetaAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:    process.env.META_APP_ID,
    redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/ads/callback/meta`,
    scope:        'ads_read,business_management',
    state,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

function buildLinkedInAuthUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.LINKEDIN_CLIENT_ID,
    redirect_uri:  `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/ads/callback/linkedin`,
    scope:         'r_ads r_ads_reporting',
    state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

// ── Callback handlers (implemented in Tasks 5-8) ─────────────────────────

async function handleGoogleCallback(req, res) {
  const { code, state, error } = req.query;
  if (error) throw new Error(`Google OAuth error: ${error}`);
  if (!code || !state) throw new Error('Missing code or state');

  const { userId, platform } = consumeOAuthState(state);
  if (platform !== 'google') throw new Error('State platform mismatch');

  // Exchange code for tokens
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  `${backendUrl}/api/ads/callback/google`,
      grant_type:    'authorization_code',
    }),
  });
  let tokens;
  try {
    tokens = await tokenRes.json();
  } catch {
    throw new Error('Failed to parse token response from Google');
  }
  if (tokens.error) throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error}`);

  const user = db.prepare('SELECT company_id FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  saveConnection({
    companyId:      user.company_id,
    platform:       'google',
    accessToken:    tokens.access_token,
    refreshToken:   tokens.refresh_token,
    tokenExpiresAt: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null,
  });

  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations?ads_connected=google`);
}

async function handleMetaCallback(req, res) {
  const { code, state, error } = req.query;
  if (error) throw new Error(`Meta OAuth error: ${error}`);
  if (!code || !state) throw new Error('Missing code or state');

  const { userId, platform } = consumeOAuthState(state);
  if (platform !== 'meta') throw new Error('State platform mismatch');

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const redirectUri = `${backendUrl}/api/ads/callback/meta`;

  // Exchange code for short-lived token
  const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?` +
    new URLSearchParams({
      client_id:     process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri:  redirectUri,
      code,
    });
  const tokenRes = await fetch(tokenUrl);
  if (!tokenRes.ok) throw new Error(`Meta token request failed: ${tokenRes.status}`);
  let tokens;
  try {
    tokens = await tokenRes.json();
  } catch {
    throw new Error('Failed to parse token response from Meta');
  }
  if (tokens.error) throw new Error(`Meta token exchange: ${tokens.error.message}`);

  // Exchange short-lived token for long-lived token (60 days)
  const llUrl = `https://graph.facebook.com/v21.0/oauth/access_token?` +
    new URLSearchParams({
      grant_type:        'fb_exchange_token',
      client_id:         process.env.META_APP_ID,
      client_secret:     process.env.META_APP_SECRET,
      fb_exchange_token: tokens.access_token,
    });
  const llRes = await fetch(llUrl);
  if (!llRes.ok) throw new Error(`Meta long-lived token request failed: ${llRes.status}`);
  let llTokens;
  try {
    llTokens = await llRes.json();
  } catch {
    throw new Error('Failed to parse long-lived token response from Meta');
  }

  const user = db.prepare('SELECT company_id FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  saveConnection({
    companyId:      user.company_id,
    platform:       'meta',
    accessToken:    llTokens.access_token || tokens.access_token,
    refreshToken:   null, // Meta does not issue refresh tokens
    tokenExpiresAt: llTokens.expires_in
      ? new Date(Date.now() + llTokens.expires_in * 1000).toISOString()
      : null,
  });

  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations?ads_connected=meta`);
}

async function handleLinkedInCallback(req, res) {
  const { code, state, error } = req.query;
  if (error) throw new Error(`LinkedIn OAuth error: ${error}`);
  if (!code || !state) throw new Error('Missing code or state');

  const { userId, platform } = consumeOAuthState(state);
  if (platform !== 'linkedin') throw new Error('State platform mismatch');

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const redirectUri = `${backendUrl}/api/ads/callback/linkedin`;

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }),
  });
  let tokens;
  try {
    tokens = await tokenRes.json();
  } catch {
    throw new Error('Failed to parse token response from LinkedIn');
  }
  if (tokens.error) throw new Error(`LinkedIn token exchange: ${tokens.error_description || tokens.error}`);

  const user = db.prepare('SELECT company_id FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  saveConnection({
    companyId:      user.company_id,
    platform:       'linkedin',
    accessToken:    tokens.access_token,
    refreshToken:   tokens.refresh_token || null,
    tokenExpiresAt: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null,
  });

  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations?ads_connected=linkedin`);
}

export default router;
