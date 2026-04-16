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

describe('GET /api/ai/suggest', () => {
  it('returns 400 when result_id is missing', async () => {
    const res = await request(app)
      .get('/api/ai/suggest')
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('returns { suggestion: null } when result_id has no cached suggestion', async () => {
    const res = await request(app)
      .get('/api/ai/suggest?result_id=9999999')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestion: null });
  });
});

describe('POST /api/ai/suggest', () => {
  it('returns 400 when result_id is missing from body', async () => {
    const res = await request(app)
      .post('/api/ai/suggest')
      .set('Cookie', cookie)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when result_id does not exist', async () => {
    const res = await request(app)
      .post('/api/ai/suggest')
      .set('Cookie', cookie)
      .send({ result_id: 9999999 });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/ai/suggest/:id/feedback', () => {
  it('returns 400 when value is not 1 or -1', async () => {
    const res = await request(app)
      .post('/api/ai/suggest/fake-id/feedback')
      .set('Cookie', cookie)
      .send({ value: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when suggestion id does not exist', async () => {
    const res = await request(app)
      .post('/api/ai/suggest/does-not-exist/feedback')
      .set('Cookie', cookie)
      .send({ value: 1 });
    expect(res.status).toBe(404);
  });
});
