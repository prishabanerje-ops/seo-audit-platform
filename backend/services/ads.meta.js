// backend/services/ads.meta.js
import db from '../db/sqlite.js';

const META_STATUS_MAP = {
  ACTIVE:   'active',
  PAUSED:   'paused',
  DELETED:  'ended',
  ARCHIVED: 'ended',
};

/**
 * Fetch metrics from Meta Marketing API for the selected ad account.
 * Returns normalized platform data object.
 */
export async function fetchMetaMetrics(connection, startDate, endDate) {
  if (!connection.selected_account_id) {
    throw new Error('No Meta ad account selected');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error('Invalid date format — expected YYYY-MM-DD');
  }

  const token     = connection.access_token;
  const accountId = connection.selected_account_id;
  const baseUrl   = 'https://graph.facebook.com/v21.0';

  // Fetch insights (metrics) for all ads
  const insightsUrl = `${baseUrl}/${accountId}/insights?` + new URLSearchParams({
    access_token: token,
    level:        'ad',
    fields:       'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,clicks,impressions,actions,spend',
    time_range:   JSON.stringify({ since: startDate, until: endDate }),
    limit:        '500',
  });

  const insightsRes = await fetch(insightsUrl);
  let insightsJson;
  try {
    insightsJson = await insightsRes.json();
  } catch {
    throw new Error('Failed to parse Meta insights response');
  }
  if (insightsJson.error) throw new Error(`Meta insights: ${insightsJson.error.message}`);
  const insights = insightsJson.data || [];

  // Fetch ad statuses (insights doesn't include status)
  const adsUrl = `${baseUrl}/${accountId}/ads?` + new URLSearchParams({
    access_token: token,
    fields:       'id,status',
    limit:        '500',
  });
  const adsRes = await fetch(adsUrl);
  let adsJson;
  try {
    adsJson = await adsRes.json();
  } catch {
    throw new Error('Failed to parse Meta ads response');
  }
  const adStatusMap = new Map(
    (adsJson.data || []).map(ad => [ad.id, META_STATUS_MAP[ad.status] || 'unknown'])
  );

  // Build nested structure: campaigns → adSets → ads
  const campaignMap = new Map();
  for (const row of insights) {
    const cId = row.campaign_id;
    if (!campaignMap.has(cId)) {
      campaignMap.set(cId, {
        id:     cId,
        name:   row.campaign_name,
        status: 'active', // Campaign status not in insights
        adSets: new Map(),
      });
    }
    const campaign = campaignMap.get(cId);

    const asId = row.adset_id;
    if (!campaign.adSets.has(asId)) {
      campaign.adSets.set(asId, {
        id:     asId,
        name:   row.adset_name,
        status: 'active',
        ads:    [],
      });
    }
    const adSet = campaign.adSets.get(asId);

    const conversions = (row.actions || [])
      .filter(a =>
        a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
        a.action_type === 'lead'
      )
      .reduce((sum, a) => sum + Number(a.value || 0), 0);

    adSet.ads.push({
      id:          row.ad_id,
      name:        row.ad_name || `Ad ${row.ad_id}`,
      status:      adStatusMap.get(row.ad_id) || 'unknown',
      clicks:      Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      conversions,
      spent:       Number(row.spend || 0),
    });
  }

  const account = db.prepare(
    'SELECT currency, account_name FROM ad_accounts WHERE connection_id = ? AND is_selected = 1'
  ).get(connection.id);

  return {
    platform:    'meta',
    accountName: account?.account_name || 'Meta Ads',
    currency:    account?.currency || 'USD',
    campaigns: Array.from(campaignMap.values()).map(c => ({
      ...c,
      adSets: Array.from(c.adSets.values()),
    })),
  };
}
