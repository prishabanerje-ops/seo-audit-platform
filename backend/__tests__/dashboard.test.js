import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';

function makeToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken({ sub: 'a1', email: 'admin@test.com', role: 'admin', company_id: 'company-test' });
const seoToken   = makeToken({ sub: 's1', email: 'seo@test.com',   role: 'seo',   company_id: 'company-test' });

describe('GET /api/dashboard/admin', () => {
  it('returns 403 for non-admin role', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Cookie', `auth_token=${seoToken}`);
    expect(res.status).toBe(403);
  });

  it('returns sites array and task_summary for admin', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Cookie', `auth_token=${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sites');
    expect(res.body).toHaveProperty('task_summary');
    expect(Array.isArray(res.body.sites)).toBe(true);
    expect(res.body.task_summary).toHaveProperty('backlog');
    expect(res.body.task_summary).toHaveProperty('in_progress');
    expect(res.body.task_summary).toHaveProperty('review');
    expect(res.body.task_summary).toHaveProperty('done');
  });
});
