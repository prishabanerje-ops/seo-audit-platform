import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const cookie = `auth_token=${jwt.sign(
  { sub: 'u1', email: 'test@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
)}`;

describe('GET /api/compare/jobs', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/compare/jobs');
    expect(res.status).toBe(401);
  });

  it('returns 200 with jobs array when authenticated', async () => {
    const res = await request(app).get('/api/compare/jobs').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jobs');
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });
});

describe('GET /api/compare', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/compare?jobA=a&jobB=b');
    expect(res.status).toBe(401);
  });

  it('returns 400 when jobA is missing', async () => {
    const res = await request(app).get('/api/compare?jobB=b').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobA/i);
  });

  it('returns 400 when jobB is missing', async () => {
    const res = await request(app).get('/api/compare?jobA=a').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobB/i);
  });

  it('returns 400 when jobA === jobB', async () => {
    const res = await request(app).get('/api/compare?jobA=same&jobB=same').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/itself/i);
  });

  it('returns 404 when jobA does not exist', async () => {
    const res = await request(app).get('/api/compare?jobA=no-such-job&jobB=also-no').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
