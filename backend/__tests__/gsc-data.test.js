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

const tokenCompanyB = jwt.sign(
  { sub: 'u2', email: 'other@test.com', role: 'seo', company_id: 'company-other' },
  SECRET, { expiresIn: '1h' }
);
const cookieB = `auth_token=${tokenCompanyB}`;

describe('GET /api/gsc/:siteId/summary', () => {
  it('returns 404 for unknown site', async () => {
    const res = await request(app)
      .get('/api/gsc/no-such-site/summary')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown site id "site-fake"', async () => {
    const res = await request(app)
      .get('/api/gsc/site-fake/summary')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/gsc/:siteId/summary — access control', () => {
  it('returns 404 (not 500) for company-B user on unknown site', async () => {
    const res = await request(app)
      .get('/api/gsc/no-such-site/summary')
      .set('Cookie', cookieB);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/gsc/:siteId/summary — superadmin', () => {
  it('superadmin gets 404 (not 403) on unknown site — bypass active', async () => {
    const superToken = jwt.sign(
      { sub: 'sa1', email: 'sa@test.com', role: 'superadmin', company_id: 'any' },
      SECRET, { expiresIn: '1h' }
    );
    const res = await request(app)
      .get('/api/gsc/no-such-site/summary')
      .set('Cookie', `auth_token=${superToken}`);
    // Superadmin bypasses company check — should hit 404 (site not found) not 403 (wrong company)
    expect(res.status).toBe(404);
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
