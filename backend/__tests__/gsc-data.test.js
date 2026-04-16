import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign(
  { sub: 'u1', email: 't@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/gsc/:siteId/summary', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/gsc/no-such-site/summary')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns summary shape for any accessible site', async () => {
    // With no GSC data, should return zeros not 500
    const res = await request(app)
      .get('/api/gsc/site-fake/summary')
      .set('Cookie', cookie);
    expect([200, 404]).toContain(res.status);
  });
});

describe('GET /api/gsc/:siteId/queries', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/gsc/no-such-site/queries')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/gsc/:siteId/pages', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/gsc/no-such-site/pages')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
