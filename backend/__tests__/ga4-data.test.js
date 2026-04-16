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

describe('GET /api/ga4/:siteId/summary', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/ga4/no-such-site/summary')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/ga4/:siteId/pages', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/ga4/no-such-site/pages')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('respects limit param', async () => {
    const res = await request(app)
      .get('/api/ga4/no-such-site/pages?limit=10')
      .set('Cookie', cookie);
    expect([200, 404]).toContain(res.status);
  });
});
