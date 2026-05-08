/**
 * Crawl lifecycle tests — verifies job state management without
 * requiring a real crawler binary.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';

function makeToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

function cookie(token) {
  return `auth_token=${token}`;
}

const seoToken = makeToken({ sub: 'seo-1', email: 'seo@test.com', role: 'seo', company_id: 'company-test' });

describe('GET /api/crawls — list crawls', () => {
  it('returns paginated list with total', async () => {
    const res = await request(app)
      .get('/api/crawls')
      .set('Cookie', cookie(seoToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jobs');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });

  it('respects limit and offset params', async () => {
    const res = await request(app)
      .get('/api/crawls?limit=5&offset=0')
      .set('Cookie', cookie(seoToken));
    expect(res.status).toBe(200);
    expect(res.body.jobs.length).toBeLessThanOrEqual(5);
  });
});

describe('POST /api/crawls — start crawl validation', () => {
  it('rejects missing site_id', async () => {
    const res = await request(app)
      .post('/api/crawls')
      .set('Cookie', cookie(seoToken))
      .send({ config: { maxUrls: 500 } });
    expect(res.status).toBe(400);
  });

  it('rejects crawl for a site the user does not own', async () => {
    // site-other-company does not belong to company-test
    const res = await request(app)
      .post('/api/crawls')
      .set('Cookie', cookie(seoToken))
      .send({ site_id: 'site-other-company', config: { maxUrls: 500 } });
    // Expect 404 (site not found for this company) or 403
    expect([403, 404]).toContain(res.status);
  });
});
