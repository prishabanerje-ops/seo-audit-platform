// backend/services/ads.linkedin.js
import db from '../db/sqlite.js';

const LI_BASE    = 'https://api.linkedin.com/v2';
const LI_VERSION = '202501';

const LI_STATUS_MAP = {
  ACTIVE:    'active',
  PAUSED:    'paused',
  ARCHIVED:  'ended',
  CANCELED:  'ended',
  DRAFT:     'paused',
  COMPLETED: 'ended',
};

function liHeaders(accessToken) {
  return {
    Authorization:                 `Bearer ${accessToken}`,
    'LinkedIn-Version':            LI_VERSION,
    'X-Restli-Protocol-Version':   '2.0.0',
  };
}

/**
 * Fetch metrics from LinkedIn Campaign Manager for the selected account.
 * Returns normalized platform data object.
 */
export async function fetchLinkedInMetrics(connection, startDate, endDate) {
  if (!connection.selected_account_id) {
    throw new Error('No LinkedIn ad account selected');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error('Invalid date format — expected YYYY-MM-DD');
  }

  const token     = connection.access_token;
  const accountId = connection.selected_account_id;
  const headers   = liHeaders(token);

  async function liGet(url) {
    const res = await fetch(url, { headers });
    let json;
    try { json = await res.json(); } catch { throw new Error(`Failed to parse LinkedIn response for ${url}`); }
    if (json.status && json.status >= 400) throw new Error(`LinkedIn API error: ${json.message || json.status}`);
    return json;
  }

  // 1. Fetch campaign groups (map to campaigns)
  const groupsJson = await liGet(
    `${LI_BASE}/adCampaignGroups?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`
  );
  const groups = groupsJson.elements || [];

  // 2. Fetch campaigns (map to adSets)
  const campaignsJson = await liGet(
    `${LI_BASE}/adCampaigns?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`
  );
  const liCampaigns = campaignsJson.elements || [];

  // 3. Fetch creatives (map to ads)
  const creativesJson = await liGet(
    `${LI_BASE}/adCreatives?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`
  );
  const creatives = creativesJson.elements || [];

  // 4. Fetch analytics for creatives
  const [sy, sm, sd] = startDate.split('-');
  const [ey, em, ed] = endDate.split('-');
  const creativeIds = creatives.map(c => c.id).filter(Boolean).join(',');

  let analyticsElements = [];
  if (creativeIds) {
    const analyticsJson = await liGet(
      `${LI_BASE}/adAnalytics?q=analytics&pivot=CREATIVE` +
      `&dateRange.start.year=${sy}&dateRange.start.month=${parseInt(sm)}&dateRange.start.day=${parseInt(sd)}` +
      `&dateRange.end.year=${ey}&dateRange.end.month=${parseInt(em)}&dateRange.end.day=${parseInt(ed)}` +
      `&timeGranularity=ALL&creatives=List(${creativeIds})`
    );
    analyticsElements = analyticsJson.elements || [];
  }

  const analyticsMap = new Map(
    analyticsElements.map(a => [a.pivotValues?.[0], a])
  );

  // Map creative → campaign, campaign → group
  const campaignGroupMap = new Map(liCampaigns.map(c => [String(c.id), c.campaignGroup]));
  const creativeCampaignMap = new Map(creatives.map(c => [String(c.id), c.campaign]));

  // Build nested structure
  const groupMap = new Map(
    groups.map(g => [String(g.id), {
      id:     String(g.id),
      name:   g.name,
      status: LI_STATUS_MAP[g.status] || 'unknown',
      adSets: new Map(),
    }])
  );

  for (const campaign of liCampaigns) {
    const groupUrn = campaignGroupMap.get(String(campaign.id));
    const groupId = groupUrn?.split(':').pop();
    if (!groupMap.has(groupId)) continue;
    groupMap.get(groupId).adSets.set(String(campaign.id), {
      id:     String(campaign.id),
      name:   campaign.name,
      status: LI_STATUS_MAP[campaign.status] || 'unknown',
      ads:    [],
    });
  }

  for (const creative of creatives) {
    const campaignUrn = creativeCampaignMap.get(String(creative.id));
    const campaignId  = campaignUrn?.split(':').pop();
    const groupUrn    = campaignGroupMap.get(campaignId);
    const groupId     = groupUrn?.split(':').pop();
    if (!groupMap.has(groupId)) continue;
    const adSet = groupMap.get(groupId).adSets.get(campaignId);
    if (!adSet) continue;

    const analytics = analyticsMap.get(creative.id) || {};
    adSet.ads.push({
      id:          String(creative.id),
      name:        creative.name || `Creative ${creative.id}`,
      status:      LI_STATUS_MAP[creative.status] || 'unknown',
      clicks:      Number(analytics.clicks || 0),
      impressions: Number(analytics.impressions || 0),
      conversions: Number(analytics.externalWebsiteConversions || 0),
      spent:       Number(analytics.costInLocalCurrency || 0),
    });
  }

  const account = db.prepare(
    'SELECT currency, account_name FROM ad_accounts WHERE connection_id = ? AND is_selected = 1'
  ).get(connection.id);

  return {
    platform:    'linkedin',
    accountName: account?.account_name || 'LinkedIn Ads',
    currency:    account?.currency || 'USD',
    campaigns: Array.from(groupMap.values()).map(g => ({
      ...g,
      adSets: Array.from(g.adSets.values()),
    })),
  };
}
