/**
 * Auth guard tests — verifies that role-protected routes reject
 * unauthenticated and under-privileged requests.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';

// Cookie helper — simulates a signed JWT for a given role
import jwt from 'jsonwebtoken';

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

const readonlyToken = makeToken({ sub: 'user-readonly', email: 'r@test.com', role: 'readonly', company_id: 'company-1' });
const adminToken    = makeToken({ sub: 'user-admin',    email: 'a@test.com', role: 'admin',    company_id: 'company-1' });
const superToken    = makeToken({ sub: 'user-super',    email: 's@test.com', role: 'superadmin', company_id: null });

function cookie(token) {
  return `auth_token=${token}`;
}

describe('Unauthenticated requests', () => {
  it('GET /api/sites → 401 without cookie', async () => {
    const res = await request(app).get('/api/sites');
    expect(res.status).toBe(401);
  });

  it('GET /api/companies → 401 without cookie', async () => {
    const res = await request(app).get('/api/companies');
    expect(res.status).toBe(401);
  });

  it('GET /api/errors → 401 without cookie', async () => {
    const res = await request(app).get('/api/errors');
    expect(res.status).toBe(401);
  });

  it('GET /api/audit-log → 401 without cookie', async () => {
    const res = await request(app).get('/api/audit-log');
    expect(res.status).toBe(401);
  });
});

describe('Role enforcement', () => {
  it('GET /api/errors → 403 for readonly role', async () => {
    const res = await request(app)
      .get('/api/errors')
      .set('Cookie', cookie(readonlyToken));
    expect(res.status).toBe(403);
  });

  it('GET /api/errors → 200 for admin role', async () => {
    const res = await request(app)
      .get('/api/errors')
      .set('Cookie', cookie(adminToken));
    expect(res.status).toBe(200);
  });

  it('GET /api/companies → 403 for admin role', async () => {
    const res = await request(app)
      .get('/api/companies')
      .set('Cookie', cookie(adminToken));
    expect(res.status).toBe(403);
  });

  it('GET /api/companies → 200 for superadmin role', async () => {
    const res = await request(app)
      .get('/api/companies')
      .set('Cookie', cookie(superToken));
    expect(res.status).toBe(200);
  });

  it('GET /api/audit-log → 403 for admin role', async () => {
    const res = await request(app)
      .get('/api/audit-log')
      .set('Cookie', cookie(adminToken));
    expect(res.status).toBe(403);
  });
});

describe('Public routes', () => {
  it('GET /api/health → 200 without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('GET /api/auth/setup-status → 200 without auth', async () => {
    const res = await request(app).get('/api/auth/setup-status');
    expect(res.status).toBe(200);
  });

  it('POST /api/errors → 204 without auth (frontend error reporting)', async () => {
    const res = await request(app)
      .post('/api/errors')
      .send({ message: 'test error', level: 'error', source: 'frontend' });
    expect(res.status).toBe(204);
  });
});
