// backend/__tests__/reports-export.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';
import db from '../db/sqlite.js';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token  = jwt.sign(
  { sub: 'u1', email: 't@test.com', role: 'seo', company_id: 'company-export-test' },
  SECRET,
  { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

const SITE_ID = 'site-covered-test';
const COMPANY = 'company-export-test';

beforeAll(() => {
  db.prepare(`INSERT OR IGNORE INTO sites (id, label, url, company_id) VALUES (?, ?, ?, ?)`)
    .run(SITE_ID, 'Covered Test Site', 'https://example.com', COMPANY);
});

afterAll(() => {
  db.prepare('DELETE FROM sites WHERE id = ?').run(SITE_ID);
});

// ── /category — covered field ─────────────────────────────────────────────────
describe('GET /api/reports/:siteId/category — covered field', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/reports/no-such-site/category?section=Images')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 400 when section param is missing', async () => {
    const res = await request(app)
      .get('/api/reports/site-x/category')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('returns covered: false and jobId: null when site has no completed crawl', async () => {
    const res = await request(app)
      .get(`/api/reports/${SITE_ID}/category?section=Images`)
      .set('Cookie', cookie);
    // Site exists but has no crawl — should get a 200 with covered: false
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('covered', false);
    expect(res.body.jobId).toBeNull();
    expect(res.body.groups).toEqual([]);
  });
});
