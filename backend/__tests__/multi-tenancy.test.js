/**
 * Multi-tenancy isolation tests — verifies that users cannot access
 * data belonging to other companies.
 */

import { describe, it, expect } from 'vitest';
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

describe('GET /api/sites — company isolation', () => {
  it('returns only sites for the user\'s own company', async () => {
    const token = makeToken({ sub: 'u1', email: 'u1@a.com', role: 'seo', company_id: 'company-a' });
    const res = await request(app)
      .get('/api/sites')
      .set('Cookie', cookie(token));
    expect(res.status).toBe(200);
    // All returned sites must belong to company-a
    const sites = res.body.data || [];
    for (const site of sites) {
      expect(site.company_id).toBe('company-a');
    }
  });

  it('superadmin without ?company_id returns empty list, not all companies', async () => {
    const token = makeToken({ sub: 'su', email: 'su@su.com', role: 'superadmin', company_id: null });
    const res = await request(app)
      .get('/api/sites')
      .set('Cookie', cookie(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/auth/users — company isolation', () => {
  it('returns 400 for superadmin without ?company_id', async () => {
    const token = makeToken({ sub: 'su', email: 'su@su.com', role: 'superadmin', company_id: null });
    const res = await request(app)
      .get('/api/auth/users')
      .set('Cookie', cookie(token));
    expect(res.status).toBe(400);
  });

  it('admin cannot request a different company\'s users via query param', async () => {
    const token = makeToken({ sub: 'u1', email: 'u1@a.com', role: 'admin', company_id: 'company-a' });
    const res = await request(app)
      .get('/api/auth/users?company_id=company-b')
      .set('Cookie', cookie(token));
    // Admin's company_id from JWT is used, query param is ignored for non-superadmin
    expect(res.status).toBe(200);
    const users = res.body.users || [];
    for (const user of users) {
      expect(user.company_id).toBe('company-a');
    }
  });
});
