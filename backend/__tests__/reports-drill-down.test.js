import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign(
  { sub: 'u1', email: 't@test.com', role: 'seo', company_id: 'company-test' },
  SECRET,
  { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/reports/:siteId/category', () => {
  it('returns 400 when section param is missing', async () => {
    const res = await request(app)
      .get('/api/reports/site-fake/category')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/reports/site-does-not-exist/category?section=Title+Tags')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/reports/:siteId/issues', () => {
  it('returns 400 when section param is missing', async () => {
    const res = await request(app)
      .get('/api/reports/site-fake/issues?issue_type=Missing+Title')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('returns 400 when issue_type param is missing', async () => {
    const res = await request(app)
      .get('/api/reports/site-fake/issues?section=Title+Tags')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/reports/results/:resultId', () => {
  it('returns 404 for non-existent resultId', async () => {
    const res = await request(app)
      .get('/api/reports/results/9999999')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
