import { Router }   from 'express';
import { z }         from 'zod';
import { v4 as uuidv4 } from 'uuid';
import db            from '../db/sqlite.js';
import { validate }  from '../middleware/validate.js';
import { startCrawl, cancelCrawl } from '../services/crawl-runner.js';

const router = Router();

// ─── GET /api/crawls ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { site_id, limit = 30, offset = 0 } = req.query;
  const { company_id: userCompanyId, role } = req.user;

  const company_id = role === 'superadmin' ? (req.query.company_id || null) : userCompanyId;
  if (!company_id) return res.json({ jobs: [], total: 0 });

  const params = [];
  let whereClause = 'WHERE j.company_id = ?';
  params.push(company_id);

  if (site_id) {
    whereClause += ' AND j.site_id = ?';
    params.push(site_id);
  }

  const sql = `
    SELECT j.*, s.label AS site_label, s.url AS site_url, s.color AS site_color
    FROM crawl_jobs j
    LEFT JOIN sites s ON j.site_id = s.id
    ${whereClause}
    ORDER BY j.started_at DESC LIMIT ? OFFSET ?
  `;
  params.push(Number(limit), Number(offset));

  const jobs = db.prepare(sql).all(...params);

  const countParams = [company_id];
  let countWhere = 'WHERE company_id = ?';
  if (site_id) { countWhere += ' AND site_id = ?'; countParams.push(site_id); }
  const { c: total } = db.prepare(`SELECT COUNT(*) AS c FROM crawl_jobs ${countWhere}`).get(...countParams);

  res.json({ jobs, total });
});

// ─── POST /api/crawls ─────────────────────────────────────────────────────────
const customHeaderSchema = z.object({
  name:  z.string().max(200),
  value: z.string().max(1000),
});

const customExtractionSchema = z.object({
  label:     z.string().max(100),
  selector:  z.string().max(500),
  extract:   z.enum(['text', 'html', 'attribute']).default('text'),
  attribute: z.string().max(100).optional().default(''),
});

const startCrawlSchema = z.object({
  site_id: z.string().min(1),
  mode:    z.enum(['spider', 'list', 'sitemap', 'sitemap-list']).default('spider'),
  config:  z.object({
    // ── List mode ─────────────────────────────────────────────────────────
    // Per-URL validation happens in crawl-runner via assertSafeOutboundUrl.
    list_urls:            z.array(z.string().url()).optional().default([]),
    // ── Sitemap mode — URLs must parse; scheme/host is re-validated server-side
    sitemap_url:          z.union([z.string().url(), z.literal('')]).optional().default(''),
    sitemap_urls:         z.array(z.string().url()).optional().default([]),
    // ── Limits ────────────────────────────────────────────────────────────
    max_depth:            z.number().int().min(1).max(25).optional().default(5),
    max_urls:             z.number().int().min(0).optional().default(0),
    // ── Spider flags ──────────────────────────────────────────────────────
    follow_internal:      z.boolean().optional().default(true),
    follow_external:      z.boolean().optional().default(false),
    crawl_images:         z.boolean().optional().default(true),
    crawl_css:            z.boolean().optional().default(true),
    crawl_javascript:     z.boolean().optional().default(false),
    crawl_pdfs:           z.boolean().optional().default(true),
    crawl_hreflang:       z.boolean().optional().default(true),
    crawl_canonicals:     z.boolean().optional().default(true),
    // ── User agent ────────────────────────────────────────────────────────
    user_agent:           z.string().max(500).optional().default(''),
    // ── URL patterns ──────────────────────────────────────────────────────
    include_patterns:     z.array(z.string()).optional().default([]),
    exclude_patterns:     z.array(z.string()).optional().default([]),
    // ── Concurrency ───────────────────────────────────────────────────────
    threads:              z.number().int().min(1).max(25).optional().default(5),
    // ── Custom headers ────────────────────────────────────────────────────
    custom_headers:       z.array(customHeaderSchema).optional().default([]),
    // ── Auth ──────────────────────────────────────────────────────────────
    basic_auth_user:      z.string().max(200).optional().default(''),
    basic_auth_pass:      z.string().max(200).optional().default(''),
    // ── Robots ────────────────────────────────────────────────────────────
    respect_robots_txt:   z.boolean().optional().default(true),
    obey_noindex:         z.boolean().optional().default(true),
    obey_nofollow:        z.boolean().optional().default(true),
    // ── URL rewriting ─────────────────────────────────────────────────────
    strip_params:         z.boolean().optional().default(false),
    strip_params_list:    z.array(z.string()).optional().default([]),
    // ── Custom extraction ─────────────────────────────────────────────────
    custom_extractions:   z.array(customExtractionSchema).optional().default([]),
  }).optional().default({}),
});

router.post('/', validate(startCrawlSchema), (req, res) => {
  const { site_id, mode, config } = req.body;

  // Mode-specific input validation
  if (mode === 'list' && (!config.list_urls || config.list_urls.length === 0)) {
    return res.status(400).json({ error: 'At least one URL is required for list mode.' });
  }
  if (mode === 'sitemap' && !config.sitemap_url) {
    return res.status(400).json({ error: 'sitemap_url is required for sitemap mode.' });
  }
  if (mode === 'sitemap-list' && (!config.sitemap_urls || config.sitemap_urls.length === 0)) {
    return res.status(400).json({ error: 'At least one sitemap URL is required for sitemap-list mode.' });
  }

  const { company_id, role } = req.user;
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(site_id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (role !== 'superadmin' && site.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Prevent duplicate active crawls for the same site
  const active = db.prepare(
    `SELECT id FROM crawl_jobs WHERE site_id = ? AND status IN ('queued', 'running')`
  ).get(site_id);
  if (active) {
    return res.status(409).json({ error: 'A crawl is already in progress for this site', jobId: active.id });
  }

  const jobId     = uuidv4();
  const jobConfig = JSON.stringify({ url: site.url, mode, ...config });

  db.prepare(`
    INSERT INTO crawl_jobs (id, site_id, company_id, status, mode, config, started_at)
    VALUES (?, ?, ?, 'queued', ?, ?, ?)
  `).run(jobId, site_id, site.company_id, mode, jobConfig, new Date().toISOString());

  const job = db.prepare('SELECT * FROM crawl_jobs WHERE id = ?').get(jobId);
  const io  = req.app.get('io');
  setImmediate(() => startCrawl(job, io));

  res.status(201).json(job);
});

// ─── GET /api/crawls/:id ──────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const { company_id, role } = req.user;
  const job = db.prepare(`
    SELECT j.*, s.label AS site_label, s.url AS site_url, s.color AS site_color
    FROM crawl_jobs j
    LEFT JOIN sites s ON j.site_id = s.id
    WHERE j.id = ?
  `).get(req.params.id);

  if (!job) return res.status(404).json({ error: 'Crawl job not found' });
  if (role !== 'superadmin' && job.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(job);
});

// ─── POST /api/crawls/:id/cancel ─────────────────────────────────────────────
router.post('/:id/cancel', (req, res) => {
  const { company_id, role } = req.user;
  const job = db.prepare('SELECT * FROM crawl_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Crawl job not found' });
  if (role !== 'superadmin' && job.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!['queued', 'running'].includes(job.status)) {
    return res.status(400).json({ error: `Cannot cancel a job with status: ${job.status}` });
  }

  cancelCrawl(req.params.id);
  const io = req.app.get('io');
  io.emit('crawl:updated', { jobId: req.params.id, status: 'cancelled' });
  res.json({ success: true });
});

// ─── DELETE /api/crawls/:id ───────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { company_id, role } = req.user;
  const job = db.prepare('SELECT * FROM crawl_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Crawl job not found' });
  if (role !== 'superadmin' && job.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (['queued', 'running'].includes(job.status)) cancelCrawl(req.params.id);

  db.prepare('DELETE FROM crawl_jobs WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
