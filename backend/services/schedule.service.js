/**
 * Schedule service — singleton cron scheduler for automated site crawls.
 * Uses node-cron to register, run, and manage schedules stored in the DB.
 */
import cron from 'node-cron';
import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// scheduleId → node-cron task
const tasks = new Map();

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Called once on server start.
 * Loads all enabled schedules from DB and registers each with node-cron.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {import('socket.io').Server} [io]
 */
export function initScheduler(db, io) {
  const schedules = db.prepare(
    `SELECT * FROM schedules WHERE enabled = 1`
  ).all();

  console.log(`[schedule] Initialising scheduler — ${schedules.length} active schedule(s)`);

  for (const schedule of schedules) {
    registerSchedule(schedule, db, io);
  }
}

// ─── Register ────────────────────────────────────────────────────────────────

/**
 * Registers a single schedule with node-cron.
 *
 * @param {object} schedule  - Row from the schedules table
 * @param {import('better-sqlite3').Database} db
 * @param {import('socket.io').Server} [io]
 */
export function registerSchedule(schedule, db, io) {
  if (!cron.validate(schedule.cron_expression)) {
    console.warn(`[schedule] Invalid cron expression for schedule ${schedule.id}: "${schedule.cron_expression}" — skipping`);
    return;
  }

  // Ensure no duplicate registration
  unregisterSchedule(schedule.id);

  const task = cron.schedule(schedule.cron_expression, async () => {
    const now = new Date().toISOString();
    console.log(`[schedule] Running schedule ${schedule.id} for sites: ${schedule.site_ids}`);

    // Update last_run synchronously before async work begins
    db.prepare(`UPDATE schedules SET last_run = ? WHERE id = ?`).run(now, schedule.id);

    const siteIds = _parseSiteIds(schedule.site_ids);
    const results = [];

    for (const siteId of siteIds) {
      try {
        // Look up site to get its URL and company_id
        const site = db.prepare(`SELECT * FROM sites WHERE id = ?`).get(siteId);
        if (!site) {
          console.warn(`[schedule] Schedule ${schedule.id}: site ${siteId} not found — skipping`);
          results.push({ site_id: siteId, status: 'skipped', reason: 'site not found', timestamp: now });
          continue;
        }

        // Skip if a crawl is already running for this site
        const active = db.prepare(
          `SELECT id FROM crawl_jobs WHERE site_id = ? AND status IN ('queued', 'running')`
        ).get(siteId);

        if (active) {
          console.warn(`[schedule] Schedule ${schedule.id}: crawl already running for site ${siteId} — skipping`);
          results.push({ site_id: siteId, status: 'skipped', reason: 'crawl already running', timestamp: now });
          continue;
        }

        // Create a queued crawl job (spider mode, default config)
        const jobId = uuidv4();
        const jobConfig = JSON.stringify({ url: site.url });

        db.prepare(`
          INSERT INTO crawl_jobs (id, site_id, company_id, status, mode, config, started_at)
          VALUES (?, ?, ?, 'queued', 'spider', ?, ?)
        `).run(jobId, siteId, site.company_id, jobConfig, now);

        const job = db.prepare(`SELECT * FROM crawl_jobs WHERE id = ?`).get(jobId);

        // Start crawl asynchronously — import crawl-runner lazily to avoid circular deps
        const { startCrawl } = await import('./crawl-runner.js');
        setImmediate(() => startCrawl(job, io || _noopIo()));

        console.log(`[schedule] Schedule ${schedule.id}: queued crawl job ${jobId} for site ${siteId}`);
        results.push({ site_id: siteId, job_id: jobId, status: 'queued', timestamp: now });

      } catch (err) {
        console.error(`[schedule] Schedule ${schedule.id}: error queuing crawl for site ${siteId}:`, err.message);
        results.push({ site_id: siteId, status: 'error', error: err.message, timestamp: now });
      }
    }

    // Append to crawl_results — keep last 20 entries
    try {
      const row = db.prepare(`SELECT crawl_results FROM schedules WHERE id = ?`).get(schedule.id);
      const existing = _parseCrawlResults(row?.crawl_results);
      const updated = [...existing, ...results].slice(-20);
      db.prepare(`UPDATE schedules SET crawl_results = ? WHERE id = ?`)
        .run(JSON.stringify(updated), schedule.id);
    } catch (err) {
      console.error(`[schedule] Failed to update crawl_results for schedule ${schedule.id}:`, err.message);
    }

    // Slack notification (defensive — skip if service not yet available)
    if (schedule.notify_slack) {
      try {
        const { sendScheduleNotification } = await import('./slack.service.js');
        await sendScheduleNotification(schedule, results);
      } catch {
        // Slack service not yet available — silently skip
      }
    }
  });

  tasks.set(schedule.id, task);
  console.log(`[schedule] Registered schedule ${schedule.id} (${schedule.cron_expression})`);
}

// ─── Unregister ──────────────────────────────────────────────────────────────

/**
 * Stops and removes a node-cron task by schedule ID.
 *
 * @param {string} id  - schedule.id
 */
export function unregisterSchedule(id) {
  const existing = tasks.get(id);
  if (existing) {
    existing.stop();
    tasks.delete(id);
    console.log(`[schedule] Unregistered schedule ${id}`);
  }
}

// ─── Reload ──────────────────────────────────────────────────────────────────

/**
 * Unregisters the existing task (if any) and re-registers from the updated row.
 * Call this after a PATCH to apply changes immediately.
 *
 * @param {object} scheduleRow  - Updated row from the schedules table
 * @param {import('better-sqlite3').Database} db
 * @param {import('socket.io').Server} [io]
 */
export function reloadSchedule(scheduleRow, db, io) {
  unregisterSchedule(scheduleRow.id);
  if (scheduleRow.enabled) {
    registerSchedule(scheduleRow, db, io);
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────

/**
 * Returns the internal task map — useful for health checks.
 * Keys are schedule IDs, values are node-cron task objects.
 *
 * @returns {Map<string, object>}
 */
export function getActiveTasks() {
  return tasks;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _parseSiteIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _parseCrawlResults(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Returns a no-op io stub when Socket.io is not available
 * (e.g. during cron-triggered crawls before io is passed through).
 */
function _noopIo() {
  const stub = { to: () => stub, emit: () => {} };
  return stub;
}
