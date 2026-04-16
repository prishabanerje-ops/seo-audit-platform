/**
 * @module routes/ga4
 * Per-company Google Analytics 4 OAuth — mirrors gsc.js, different scope + API.
 */
import { Router }      from 'express';
import { google }      from 'googleapis';
import db              from '../db/sqlite.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI_GA4
      || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/ga4/callback`,
  );
}

function resolveCompanyId(req) {
  return req.user.role === 'superadmin'
    ? (req.query.company_id || req.user.company_id)
    : req.user.company_id;
}

// GET /api/ga4/auth
router.get('/auth', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });
  const url = makeOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       GA4_SCOPES,
    state:       JSON.stringify({ company_id: cid, provider: 'ga4' }),
  });
  res.json({ authUrl: url });
});

// GET /api/ga4/callback (PUBLIC)
router.get('/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code, state, error: oauthError } = req.query;

  if (oauthError) return res.redirect(`${frontendUrl}/settings?ga4_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return res.redirect(`${frontendUrl}/settings?ga4_error=missing_params`);

  let parsed;
  try { parsed = JSON.parse(state); } catch {
    return res.redirect(`${frontendUrl}/settings?ga4_error=invalid_state`);
  }
  if (!parsed.company_id || parsed.provider !== 'ga4') {
    return res.redirect(`${frontendUrl}/settings?ga4_error=invalid_state`);
  }

  try {
    const oauth2 = makeOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const userInfo = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
    const connectedEmail = userInfo.data.email || null;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO company_oauth_tokens
        (company_id, provider, access_token, refresh_token, token_expiry, scope, connected_email, created_at, updated_at)
      VALUES (?, 'ga4', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_id, provider) DO UPDATE SET
        access_token    = excluded.access_token,
        refresh_token   = COALESCE(excluded.refresh_token, refresh_token),
        token_expiry    = excluded.token_expiry,
        scope           = excluded.scope,
        connected_email = excluded.connected_email,
        updated_at      = excluded.updated_at
    `).run(
      parsed.company_id,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      tokens.scope || GA4_SCOPES.join(' '),
      connectedEmail, now, now,
    );

    res.redirect(`${frontendUrl}/settings?ga4_connected=1`);
  } catch (err) {
    console.error('[GA4 callback]', err.message);
    res.redirect(`${frontendUrl}/settings?ga4_error=token_exchange_failed`);
  }
});

// GET /api/ga4/status
router.get('/status', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.json({ connected: false });
  const row = db.prepare(
    "SELECT connected_email, updated_at FROM company_oauth_tokens WHERE company_id = ? AND provider = 'ga4'"
  ).get(cid);
  res.json({ connected: Boolean(row), connected_email: row?.connected_email || null, connected_at: row?.updated_at || null });
});

// DELETE /api/ga4/disconnect
router.delete('/disconnect', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });
  db.prepare("DELETE FROM company_oauth_tokens WHERE company_id = ? AND provider = 'ga4'").run(cid);
  res.json({ ok: true });
});

// GET /api/ga4/properties
router.get('/properties', requireRole('admin', 'superadmin'), async (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });

  const row = db.prepare(
    "SELECT access_token, refresh_token, token_expiry FROM company_oauth_tokens WHERE company_id = ? AND provider = 'ga4'"
  ).get(cid);
  if (!row) return res.status(404).json({ error: 'GA4 not connected.' });

  try {
    const oauth2 = makeOAuth2Client();
    oauth2.setCredentials({
      access_token:  row.access_token,
      refresh_token: row.refresh_token,
      expiry_date:   row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
    });
    oauth2.on('tokens', (t) => {
      if (t.access_token) {
        db.prepare(
          "UPDATE company_oauth_tokens SET access_token = ?, token_expiry = ?, updated_at = ? WHERE company_id = ? AND provider = 'ga4'"
        ).run(t.access_token, t.expiry_date ? new Date(t.expiry_date).toISOString() : null, new Date().toISOString(), cid);
      }
    });

    const admin = google.analyticsadmin({ version: 'v1beta', auth: oauth2 });
    const result = await admin.properties.list({ filter: 'parent:accounts/-' });
    const properties = (result.data.properties || []).map(p => ({
      name:         p.name,
      display_name: p.displayName,
      property_id:  p.name.replace('properties/', ''),
    }));
    res.json({ properties });
  } catch (err) {
    console.error('[GA4 properties]', err.message);
    res.status(502).json({ error: 'Failed to fetch GA4 properties. Try reconnecting.' });
  }
});

export default router;
