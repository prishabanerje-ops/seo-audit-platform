// backend/services/ads.google.js
import { GoogleAdsApi } from 'google-ads-api';
import db from '../db/sqlite.js';

const GOOGLE_STATUS_MAP = {
  ENABLED: 'active',
  PAUSED:  'paused',
  REMOVED: 'ended',
};

/**
 * Fetch metrics for the selected Google Ads account.
 * Returns normalized platform data object.
 */
export async function fetchGoogleMetrics(connection, startDate, endDate) {
  if (!connection.selected_account_id) {
    throw new Error('No Google Ads account selected');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error('Invalid date format — expected YYYY-MM-DD');
  }

  const client = new GoogleAdsApi({
    client_id:       process.env.GOOGLE_CLIENT_ID,
    client_secret:   process.env.GOOGLE_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customer = client.Customer({
    customer_id:   connection.selected_account_id,
    refresh_token: connection.refresh_token,
  });

  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      ad_group_ad.status,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.cost_micros
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  `);

  const campaignMap = new Map();

  for (const row of rows) {
    const cId = String(row.campaign.id);
    if (!campaignMap.has(cId)) {
      campaignMap.set(cId, {
        id:     cId,
        name:   row.campaign.name,
        status: GOOGLE_STATUS_MAP[row.campaign.status] || 'unknown',
        adSets: new Map(),
      });
    }
    const campaign = campaignMap.get(cId);

    const agId = String(row.ad_group.id);
    if (!campaign.adSets.has(agId)) {
      campaign.adSets.set(agId, {
        id:     agId,
        name:   row.ad_group.name,
        status: GOOGLE_STATUS_MAP[row.ad_group.status] || 'unknown',
        ads:    [],
      });
    }
    const adSet = campaign.adSets.get(agId);

    adSet.ads.push({
      id:          String(row.ad_group_ad.ad.id),
      name:        row.ad_group_ad.ad.name || `Ad ${row.ad_group_ad.ad.id}`,
      status:      GOOGLE_STATUS_MAP[row.ad_group_ad.status] || 'unknown',
      clicks:      Number(row.metrics.clicks),
      impressions: Number(row.metrics.impressions),
      conversions: Number(row.metrics.conversions),
      spent:       Number(row.metrics.cost_micros) / 1_000_000,
    });
  }

  const campaigns = Array.from(campaignMap.values()).map(c => ({
    ...c,
    adSets: Array.from(c.adSets.values()),
  }));

  const account = db.prepare(
    'SELECT currency, account_name FROM ad_accounts WHERE connection_id = ? AND is_selected = 1'
  ).get(connection.id);

  return {
    platform:    'google',
    accountName: account?.account_name || 'Google Ads',
    currency:    account?.currency || 'USD',
    campaigns,
  };
}
