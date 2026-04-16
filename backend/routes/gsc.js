/**
 * @module routes/gsc
 * Per-company Google Search Console OAuth.
 */
import { Router }     from 'express';
import { google }     from 'googleapis';
import db             from '../db/sqlite.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const GSC_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI_GSC
      || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/gsc/callback`,
  );
}

function resolveCompanyId(req) {
  return req.user.role === 'superadmin'
    ? (req.query.company_id || req.user.company_id)
    : req.user.company_id;
}

// GET /api/gsc/auth — initiate OAuth
router.get('/auth', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });
  const url = makeOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       GSC_SCOPES,
    state:       JSON.stringify({ company_id: cid, provider: 'gsc' }),
  });
  res.json({ authUrl: url });
});

// GET /api/gsc/callback — OAuth callback (PUBLIC, state-verified)
router.get('/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code, state, error: oauthError } = req.query;

  if (oauthError) return res.redirect(`${frontendUrl}/settings?gsc_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return res.redirect(`${frontendUrl}/settings?gsc_error=missing_params`);

  let parsed;
  try { parsed = JSON.parse(state); } catch {
    return res.redirect(`${frontendUrl}/settings?gsc_error=invalid_state`);
  }
  if (!parsed.company_id || parsed.provider !== 'gsc') {
    return res.redirect(`${frontendUrl}/settings?gsc_error=invalid_state`);
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
      VALUES (?, 'gsc', ?, ?, ?, ?, ?, ?, ?)
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
      tokens.scope || GSC_SCOPES.join(' '),
      connectedEmail, now, now,
    );

    res.redirect(`${frontendUrl}/settings?gsc_connected=1`);
  } catch (err) {
    console.error('[GSC callback]', err.message);
    res.redirect(`${frontendUrl}/settings?gsc_error=token_exchange_failed`);
  }
});

// GET /api/gsc/status
router.get('/status', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.json({ connected: false });
  const row = db.prepare(
    "SELECT connected_email, updated_at FROM company_oauth_tokens WHERE company_id = ? AND provider = 'gsc'"
  ).get(cid);
  res.json({ connected: Boolean(row), connected_email: row?.connected_email || null, connected_at: row?.updated_at || null });
});

// DELETE /api/gsc/disconnect
router.delete('/disconnect', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });
  db.prepare("DELETE FROM company_oauth_tokens WHERE company_id = ? AND provider = 'gsc'").run(cid);
  res.json({ ok: true });
});

// GET /api/gsc/properties — list GSC properties for connected account
router.get('/properties', requireRole('admin', 'superadmin'), async (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });

  const row = db.prepare(
    "SELECT access_token, refresh_token, token_expiry FROM company_oauth_tokens WHERE company_id = ? AND provider = 'gsc'"
  ).get(cid);
  if (!row) return res.status(404).json({ error: 'GSC not connected.' });

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
          "UPDATE company_oauth_tokens SET access_token = ?, token_expiry = ?, updated_at = ? WHERE company_id = ? AND provider = 'gsc'"
        ).run(t.access_token, t.expiry_date ? new Date(t.expiry_date).toISOString() : null, new Date().toISOString(), cid);
      }
    });

    const sc = google.searchconsole({ version: 'v1', auth: oauth2 });
    const result = await sc.sites.list();
    const properties = (result.data.siteEntry || []).map(s => ({
      url:              s.siteUrl,
      permission_level: s.permissionLevel,
    }));
    res.json({ properties });
  } catch (err) {
    console.error('[GSC properties]', err.message);
    res.status(502).json({ error: 'Failed to fetch GSC properties. Try reconnecting.' });
  }
});

// ─── GET /api/gsc/:siteId/summary ────────────────────────────────────────────
router.get('/:siteId/summary', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const current = db.prepare(`
    SELECT
      COALESCE(SUM(clicks), 0)      AS clicks,
      COALESCE(SUM(impressions), 0) AS impressions,
      CASE WHEN COALESCE(SUM(impressions), 0) > 0
           THEN CAST(SUM(clicks) AS REAL) / SUM(impressions)
           ELSE 0 END               AS ctr,
      COALESCE(AVG(position), 0)    AS position
    FROM gsc_cache WHERE site_id = ? AND period = 'current'
  `).get(siteId);

  const previous = db.prepare(`
    SELECT
      COALESCE(SUM(clicks), 0)      AS clicks,
      COALESCE(SUM(impressions), 0) AS impressions
    FROM gsc_cache WHERE site_id = ? AND period = 'previous'
  `).get(siteId);

  res.json({
    clicks:            current.clicks,
    impressions:       current.impressions,
    ctr:               current.ctr,
    position:          current.position,
    clicks_delta:      current.clicks - previous.clicks,
    impressions_delta: current.impressions - previous.impressions,
  });
});

// ─── GET /api/gsc/:siteId/queries ────────────────────────────────────────────
router.get('/:siteId/queries', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const queries = db.prepare(`
    SELECT
      top_query                                                     AS query,
      SUM(clicks)                                                   AS clicks,
      SUM(impressions)                                              AS impressions,
      CASE WHEN SUM(impressions) > 0
           THEN CAST(SUM(clicks) AS REAL) / SUM(impressions)
           ELSE 0 END                                               AS ctr,
      AVG(position)                                                 AS position
    FROM gsc_cache
    WHERE site_id = ? AND period = 'current' AND top_query IS NOT NULL
    GROUP BY top_query
    ORDER BY clicks DESC
    LIMIT 25
  `).all(siteId);

  res.json({ queries });
});

// ─── GET /api/gsc/:siteId/pages ──────────────────────────────────────────────
router.get('/:siteId/pages', (req, res) => {
  const { siteId } = req.params;
  const { company_id, role } = req.user;

  const site = db.prepare('SELECT id, company_id FROM sites WHERE id = ?').get(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const pages = db.prepare(`
    SELECT
      url,
      SUM(clicks)      AS clicks,
      SUM(impressions) AS impressions,
      CASE WHEN SUM(impressions) > 0
           THEN CAST(SUM(clicks) AS REAL) / SUM(impressions)
           ELSE 0 END  AS ctr,
      AVG(position)    AS position
    FROM gsc_cache WHERE site_id = ? AND period = 'current'
    GROUP BY url
    ORDER BY clicks DESC
    LIMIT 50
  `).all(siteId);

  res.json({ pages });
});

export default router;
