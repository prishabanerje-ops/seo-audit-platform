/**
 * Crawl runner service.
 * Manages Playwright crawler jobs, emits Socket.io progress events,
 * and updates crawl_jobs in the database.
 */
import { mkdirSync }      from 'fs';
import { join }           from 'path';
import { fileURLToPath }  from 'url';
import { dirname }        from 'path';
import db                 from '../db/sqlite.js';
import { crawl }          from '../../playwright-crawler/src/index.js';
import { toSfFormat }     from '../../playwright-crawler/src/index.js';
import { parseAndStoreFromDatasets } from './audit-parser.service.js';
import { runRankingsAudit }          from './rankings-audit.service.js';
import { fetchUrlsFromSitemaps }     from './sitemap-fetcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Keep crawl-data dir for any job-level file storage needs
export const CRAWL_DATA_DIR = join(__dirname, '..', 'crawl-data');
mkdirSync(CRAWL_DATA_DIR, { recursive: true });

// Active AbortControllers — one per running job, used for cancellation
const activeControllers = new Map(); // jobId → AbortController

// Per-job URL buffer — replayed to clients that join mid-crawl or after completion
const urlBuffers = new Map(); // jobId → Array<payload>
const URL_BUFFER_MAX = 500;

/**
 * Return the buffered URL payloads for a job (for socket replay on join).
 * Returns [] if no buffer exists.
 */
export function getJobUrlBuffer(jobId) {
  return urlBuffers.get(jobId) || [];
}

// ─── Startup cleanup ──────────────────────────────────────────────────────────

/**
 * Called once at server startup.
 * Jobs left in queued/running/paused state from a previous server run are
 * stuck — reset them to 'failed'.
 */
export function resetStuckJobs() {
  const stuck = db.prepare(
    `SELECT id FROM crawl_jobs WHERE status IN ('queued', 'running', 'paused')`
  ).all();

  if (stuck.length) {
    const ids = stuck.map(j => j.id);
    db.prepare(
      `UPDATE crawl_jobs SET status = 'failed', error_message = ? WHERE id IN (${ids.map(() => '?').join(',')})`
    ).run('Server restarted while crawl was in progress.', ...ids);
    console.log(`[crawl-runner] Reset ${stuck.length} stuck job(s) to failed.`);
  }
}

// ─── Start crawl ──────────────────────────────────────────────────────────────

/**
 * Starts a Playwright crawl for the given job.
 * Updates DB and emits Socket.io events throughout.
 *
 * @param {object} job  - crawl_jobs row
 * @param {object} io   - Socket.io server instance
 */
export async function startCrawl(job, io) {
  const config = JSON.parse(job.config || '{}');
  const {
    url,
    max_urls           = 0,
    max_depth          = 10,
    threads            = 5,
    respect_robots_txt = true,
    follow_external    = false,
    include_patterns   = [],
    exclude_patterns   = [],
    custom_headers     = [],   // [{name, value}]
    basic_auth_user    = '',
    basic_auth_pass    = '',
    crawl_canonicals   = true,
    crawl_hreflang     = true,
    user_agent         = '',
    list_urls          = [],
    sitemap_url        = '',
    sitemap_urls       = [],
  } = config;

  // Convert custom_headers array [{name, value}] → object { Name: value }
  const httpHeaders = {};
  for (const { name, value } of custom_headers) {
    if (name && name.trim()) httpHeaders[name.trim()] = value || '';
  }

  const crawlMode = job.mode || 'spider'; // spider | list | sitemap | sitemap-list

  // Mark running
  db.prepare(`UPDATE crawl_jobs SET status = 'running', started_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), job.id);

  const controller = new AbortController();
  activeControllers.set(job.id, controller);
  urlBuffers.set(job.id, []); // reset buffer for this run

  let urlCount = 0;

  const emit = (msg) =>
    io.to(`job:${job.id}`).emit('crawl:progress', {
      jobId:   job.id,
      urlCount,
      message: msg,
      status:  'running',
    });

  emit('Crawler starting\u2026');

  try {
    // Determine the start URL and seed URLs for the crawler based on mode
    let startUrl    = url;
    let seedUrls    = [];
    let followLinks = true; // list/sitemap modes disable link following

    if (crawlMode === 'list') {
      // Crawl only the provided URLs — no link following
      startUrl    = list_urls[0] || url;
      seedUrls    = list_urls.slice(1);
      followLinks = false;

    } else if (crawlMode === 'sitemap' || crawlMode === 'sitemap-list') {
      // Fetch URLs from the sitemap(s) first, then audit only those pages
      const sitemapTargets = crawlMode === 'sitemap'
        ? [sitemap_url || url]
        : sitemap_urls;

      emit('Fetching sitemap\u2026');
      console.log(`[crawl-runner] Job ${job.id}: fetching sitemap(s): ${sitemapTargets.join(', ')}`);

      const sitemapPageUrls = await fetchUrlsFromSitemaps(sitemapTargets);

      if (sitemapPageUrls.length === 0) {
        throw new Error('No URLs found in the provided sitemap(s).');
      }

      console.log(`[crawl-runner] Job ${job.id}: ${sitemapPageUrls.length} URLs extracted from sitemap`);
      emit(`Found ${sitemapPageUrls.length.toLocaleString()} URLs in sitemap\u2026`);

      startUrl    = sitemapPageUrls[0];
      seedUrls    = sitemapPageUrls.slice(1);
      followLinks = false;
    }

    console.log(`[crawl-runner] Job ${job.id}: starting ${crawlMode} crawl of ${startUrl}`);

    const { pages, siteData } = await crawl({
      startUrl,
      seedUrls,
      followLinks,
      maxUrls:         max_urls > 0                                            ? max_urls
                       : crawlMode === 'list'                                   ? list_urls.length
                       : crawlMode === 'sitemap' || crawlMode === 'sitemap-list' ? 1 + seedUrls.length
                       : 500,
      maxDepth:        max_depth || 10,
      maxConcurrency:  threads || 5,
      timeoutSecs:     30,
      respectRobotsTxt: respect_robots_txt !== false,
      followExternal:  follow_external === true,
      includePatterns: include_patterns,
      excludePatterns: exclude_patterns,
      customHeaders:   httpHeaders,
      basicAuthUser:   basic_auth_user,
      basicAuthPass:   basic_auth_pass,
      crawlCanonicals: crawl_canonicals !== false,
      crawlHreflang:   crawl_hreflang !== false,
      userAgent:       user_agent || undefined,
      signal:          controller.signal,
      onProgress: (crawled, _queued, url, record) => {
        urlCount = crawled;
        db.prepare('UPDATE crawl_jobs SET total_urls = ? WHERE id = ?').run(urlCount, job.id);
        emit(`Crawled: ${urlCount.toLocaleString()} URLs`);
        if (url) {
          const payload = {
            jobId:        job.id,
            url,
            statusCode:   record?.['Status Code']   || '',
            title:        record?.['Title 1']        || '',
            h1:           record?.['H1-1']           || '',
            indexability: record?.['Indexability']   || '',
            responseTime: record?.['Response Time']  || '',
          };
          // Buffer for clients that join late
          const buf = urlBuffers.get(job.id) || [];
          buf.push(payload);
          if (buf.length > URL_BUFFER_MAX) buf.shift();
          urlBuffers.set(job.id, buf);
          io.to(`job:${job.id}`).emit('crawl:url', payload);
        }
      },
    });

    // Bail out silently if cancelled during the crawl
    if (controller.signal.aborted) {
      activeControllers.delete(job.id);
      return;
    }

    urlCount = pages.length;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE crawl_jobs SET status = 'completed', completed_at = ?, total_urls = ?
      WHERE id = ?
    `).run(now, urlCount, job.id);

    io.to(`job:${job.id}`).emit('crawl:complete', { jobId: job.id, totalUrls: urlCount });
    io.emit('crawl:updated', { jobId: job.id, status: 'completed', totalUrls: urlCount });
    console.log(`[crawl-runner] Job ${job.id} completed. URLs: ${urlCount}`);

    // Parse in memory — no CSV files written to disk
    emit('Analysing results\u2026');
    const datasets = toSfFormat(pages);
    const count = parseAndStoreFromDatasets(datasets, job.id, job.site_id, job.company_id || null, siteData);

    const rankingsCount = runRankingsAudit(job.site_id, job.id, job.company_id || null);
    const totalCount    = count + rankingsCount;

    console.log(`[crawl-runner] Parsed ${count} findings + ${rankingsCount} rankings findings for job ${job.id}`);
    io.to(`job:${job.id}`).emit('crawl:parsed', { jobId: job.id, findings: totalCount });
    io.emit('crawl:updated', { jobId: job.id, status: 'completed', findings: totalCount });

  } catch (err) {
    // Ignore errors that are just a side-effect of cancellation
    if (controller.signal.aborted) {
      activeControllers.delete(job.id);
      urlBuffers.delete(job.id);
      return;
    }

    console.error(`[crawl-runner] Job ${job.id} failed:`, err.message);
    _failJob(job.id, err.message);
    io.to(`job:${job.id}`).emit('crawl:error', { jobId: job.id, error: err.message });
    io.emit('crawl:updated', { jobId: job.id, status: 'failed' });
  } finally {
    activeControllers.delete(job.id);
    // Keep buffer briefly so any in-flight client joins can still replay it,
    // then purge after 60 s to avoid memory leaks.
    setTimeout(() => urlBuffers.delete(job.id), 60_000);
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

/**
 * Aborts a running crawl and marks the job as cancelled.
 * Returns true if the job was actively running and aborted.
 */
export function cancelCrawl(jobId) {
  const controller = activeControllers.get(jobId);

  if (controller) {
    controller.abort();
    activeControllers.delete(jobId);
  }

  db.prepare(`UPDATE crawl_jobs SET status = 'cancelled', completed_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), jobId);

  return !!controller;
}

// ─── Private ──────────────────────────────────────────────────────────────────

function _failJob(jobId, message) {
  db.prepare(`UPDATE crawl_jobs SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?`)
    .run(new Date().toISOString(), String(message).slice(0, 500), jobId);
}
