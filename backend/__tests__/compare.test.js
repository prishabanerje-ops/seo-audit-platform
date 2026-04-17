import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';
import db from '../db/sqlite.js';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const COMPANY = 'company-compare-test';
const cookie = `auth_token=${jwt.sign(
  { sub: 'u1', email: 'test@test.com', role: 'seo', company_id: COMPANY },
  SECRET, { expiresIn: '1h' }
)}`;

// ─── Test data ────────────────────────────────────────────────────────────────

const SITE_ID = 'site-compare-test';
const JOB_A   = 'job-compare-a';
const JOB_B   = 'job-compare-b';

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO sites (id, label, url, company_id) VALUES (?, ?, ?, ?)`)
    .run(SITE_ID, 'Compare Test Site', 'https://example.com', COMPANY);

  db.prepare(`INSERT OR IGNORE INTO crawl_jobs
    (id, site_id, status, started_at, total_urls, health_score, company_id)
    VALUES (?, ?, 'completed', '2026-04-01T10:00:00Z', 100, 70, ?)`)
    .run(JOB_A, SITE_ID, COMPANY);

  db.prepare(`INSERT OR IGNORE INTO crawl_jobs
    (id, site_id, status, started_at, total_urls, health_score, company_id)
    VALUES (?, ?, 'completed', '2026-04-15T10:00:00Z', 120, 80, ?)`)
    .run(JOB_B, SITE_ID, COMPANY);

  // Job A: 45 "Missing title tag" (critical) — all same URL for simplicity
  for (let i = 0; i < 45; i++) {
    db.prepare(`INSERT OR IGNORE INTO audit_results
      (id, crawl_job_id, site_id, section, url, severity, issue_type, company_id)
      VALUES (?, ?, ?, 'Title Tags', 'https://example.com/a' || ?, 'critical', 'Missing title tag', ?)`)
      .run(`ar-a-title-${i}`, JOB_A, SITE_ID, i, COMPANY);
  }
  // Job B: 23 "Missing title tag" (critical)
  for (let i = 0; i < 23; i++) {
    db.prepare(`INSERT OR IGNORE INTO audit_results
      (id, crawl_job_id, site_id, section, url, severity, issue_type, company_id)
      VALUES (?, ?, ?, 'Title Tags', 'https://example.com/b' || ?, 'critical', 'Missing title tag', ?)`)
      .run(`ar-b-title-${i}`, JOB_B, SITE_ID, i, COMPANY);
  }
  // Job B only: 5 "4xx response code" (warning) — NEW issue
  for (let i = 0; i < 5; i++) {
    db.prepare(`INSERT OR IGNORE INTO audit_results
      (id, crawl_job_id, site_id, section, url, severity, issue_type, company_id)
      VALUES (?, ?, ?, 'Response Codes', 'https://example.com/c' || ?, 'warning', '4xx response code', ?)`)
      .run(`ar-b-4xx-${i}`, JOB_B, SITE_ID, i, COMPANY);
  }
});

afterAll(() => {
  db.prepare(`DELETE FROM audit_results WHERE crawl_job_id IN (?, ?)`).run(JOB_A, JOB_B);
  db.prepare(`DELETE FROM crawl_jobs WHERE id IN (?, ?)`).run(JOB_A, JOB_B);
  db.prepare(`DELETE FROM sites WHERE id = ?`).run(SITE_ID);
});

// ─── GET /api/compare/jobs ────────────────────────────────────────────────────

describe('GET /api/compare/jobs', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/compare/jobs');
    expect(res.status).toBe(401);
  });

  it('returns 200 with camelCase job fields', async () => {
    const res = await request(app).get('/api/compare/jobs').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);
    const job = res.body.jobs.find(j => j.id === JOB_B);
    expect(job).toBeDefined();
    expect(job).toHaveProperty('siteId');
    expect(job).toHaveProperty('siteLabel');
    expect(job).toHaveProperty('startedAt');
    expect(job).toHaveProperty('totalUrls');
    expect(job).toHaveProperty('healthScore');
    // Verify no snake_case leakage
    expect(job).not.toHaveProperty('site_id');
    expect(job).not.toHaveProperty('started_at');
    expect(job).not.toHaveProperty('total_urls');
    expect(job).not.toHaveProperty('health_score');
  });
});

// ─── GET /api/compare ─────────────────────────────────────────────────────────

describe('GET /api/compare', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/compare?jobA=a&jobB=b');
    expect(res.status).toBe(401);
  });

  it('returns 400 when jobA is missing', async () => {
    const res = await request(app).get('/api/compare?jobB=b').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobA/i);
  });

  it('returns 400 when jobB is missing', async () => {
    const res = await request(app).get('/api/compare?jobA=a').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobB/i);
  });

  it('returns 400 when jobA === jobB', async () => {
    const res = await request(app).get('/api/compare?jobA=same&jobB=same').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/itself/i);
  });

  it('returns 404 when jobA does not exist', async () => {
    const res = await request(app).get('/api/compare?jobA=no-such-job&jobB=also-no').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns correct shape and delta arithmetic for a valid pair', async () => {
    const res = await request(app)
      .get(`/api/compare?jobA=${JOB_A}&jobB=${JOB_B}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    // Top-level keys
    expect(res.body).toHaveProperty('jobA');
    expect(res.body).toHaveProperty('jobB');
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('rows');

    // Job metadata shape
    expect(res.body.jobA.id).toBe(JOB_A);
    expect(res.body.jobA).toHaveProperty('siteLabel');
    expect(res.body.jobA).toHaveProperty('startedAt');
    expect(res.body.jobA).toHaveProperty('totalUrls');
    expect(res.body.jobA).toHaveProperty('healthScore');

    // Summary deltas: scoreDelta = 80 - 70 = +10
    expect(res.body.summary.scoreDelta).toBe(10);
    // urlsDelta = 120 - 100 = +20
    expect(res.body.summary.urlsDelta).toBe(20);
    // criticalDelta = 23 - 45 = -22 (improvement)
    expect(res.body.summary.criticalDelta).toBe(-22);
    // warningDelta = 5 - 0 = +5 (regression, new 4xx issues)
    expect(res.body.summary.warningDelta).toBe(5);

    // Rows
    expect(Array.isArray(res.body.rows)).toBe(true);
    const titleRow = res.body.rows.find(r => r.issue_type === 'Missing title tag');
    expect(titleRow).toBeDefined();
    expect(titleRow.countA).toBe(45);
    expect(titleRow.countB).toBe(23);
    expect(titleRow.delta).toBe(-22); // B - A

    const fourxxRow = res.body.rows.find(r => r.issue_type === '4xx response code');
    expect(fourxxRow).toBeDefined();
    expect(fourxxRow.countA).toBe(0); // not in job A
    expect(fourxxRow.countB).toBe(5);
    expect(fourxxRow.delta).toBe(5);

    // Rows sorted by |delta| descending: |-22| > |5|
    const firstRow = res.body.rows[0];
    expect(Math.abs(firstRow.delta)).toBeGreaterThanOrEqual(Math.abs(res.body.rows[1].delta));
  });
});
