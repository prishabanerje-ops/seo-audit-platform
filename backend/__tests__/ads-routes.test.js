import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('GET /api/ads/connections — auth guard', () => {
  it('returns 401 when no cookie', async () => {
    const res = await request(app).get('/api/ads/connections');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/ads/connect/google — auth guard', () => {
  it('returns 401 when no cookie', async () => {
    const res = await request(app).post('/api/ads/connect/google');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/ads/callback/google — public route', () => {
  it('is NOT 401 (callback is in PUBLIC_PATHS)', async () => {
    const res = await request(app).get('/api/ads/callback/google?state=bad&code=bad');
    expect(res.status).not.toBe(401);
  });
});

describe('GET /api/ads/callback/invalid — invalid platform', () => {
  it('returns 400', async () => {
    const res = await request(app).get('/api/ads/callback/invalid');
    expect(res.status).toBe(400);
  });
});
