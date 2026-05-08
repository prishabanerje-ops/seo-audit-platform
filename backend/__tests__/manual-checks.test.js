import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token  = jwt.sign(
  { sub: 'u1', email: 'seo@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/sites/:siteId/manual-checks', () => {
  it('returns 404 for non-existent site', async () => {
    const res = await request(app)
      .get('/api/sites/999999/manual-checks')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/sites/:siteId/manual-checks/:checkNumber', () => {
  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .put('/api/sites/1/manual-checks/75')
      .set('Cookie', cookie)
      .send({ status: 'invalid_value' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent site', async () => {
    const res = await request(app)
      .put('/api/sites/999999/manual-checks/75')
      .set('Cookie', cookie)
      .send({ status: 'pass' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent or non-manual check_number', async () => {
    const res = await request(app)
      .put('/api/sites/1/manual-checks/999999')
      .set('Cookie', cookie)
      .send({ status: 'pass' });
    expect(res.status).toBe(404);
  });
});
