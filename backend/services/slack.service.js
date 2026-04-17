import db from '../db/sqlite.js';

/**
 * Resolve the Slack webhook URL for a given company.
 * Checks company_settings first; falls back to process.env.SLACK_WEBHOOK_URL.
 *
 * @param {string|null} companyId
 * @returns {string|null}
 */
function getWebhookUrl(companyId) {
  if (companyId) {
    const row = db
      .prepare(
        `SELECT value FROM company_settings WHERE company_id = ? AND key = 'slack_webhook_url'`
      )
      .get(companyId);
    if (row?.value) return row.value;
  }
  return process.env.SLACK_WEBHOOK_URL || null;
}

/**
 * Send a Slack notification about a completed schedule run.
 * Looks up the webhook URL from company_settings, falls back to env var.
 * Silently returns if no webhook is configured.
 *
 * @param {object} schedule - Row from schedules table
 * @param {Array}  results  - Per-site crawl results from this run
 */
export async function sendScheduleNotification(schedule, results) {
  try {
    const webhookUrl = getWebhookUrl(schedule.company_id);

    if (!webhookUrl) {
      console.warn(
        `[slack] No webhook URL configured for schedule ${schedule.id} (company_id=${schedule.company_id ?? 'none'}) — skipping notification`
      );
      return;
    }

    const statusEmoji = { queued: '✅', skipped: '⏭', error: '❌' };

    const resultLines = results.map((r) => {
      const emoji = statusEmoji[r.status] ?? '❓';
      const detail = r.job_id
        ? `job #${r.job_id}`
        : r.reason || r.error || r.status;
      return `${emoji} Site ${r.site_id} — ${detail}`;
    });

    // Slack mrkdwn text fields are capped at 3,000 chars.
    // Truncate to the first 20 lines and add a suffix if needed.
    const MAX_RESULT_LINES = 20;
    const truncated = resultLines.length > MAX_RESULT_LINES;
    const displayLines = truncated ? resultLines.slice(0, MAX_RESULT_LINES) : resultLines;
    if (truncated) {
      displayLines.push(`_…and ${resultLines.length - MAX_RESULT_LINES} more site(s)_`);
    }

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Scheduled Crawl Complete',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Schedule ID:* ${schedule.id}`,
            },
            {
              type: 'mrkdwn',
              text: `*Cron:* \`${schedule.cron_expression}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Company:* ${schedule.company_id ?? 'global'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Sites processed:* ${results.length}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: displayLines.length > 0 ? displayLines.join('\n') : '_No results_',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Run at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|${new Date().toISOString()}>`,
            },
          ],
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log('[slack] Notification sent for schedule:', schedule.id);
    } else {
      const body = await res.text().catch(() => '');
      console.warn(`[slack] Failed to send notification: ${res.status} ${body}`);
    }
  } catch (err) {
    console.warn('[slack] sendScheduleNotification error:', err.message);
  }
}
