import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';
import db from '../db/sqlite.js';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const cookie = `auth_token=${jwt.sign(
  { sub: 'u1', email: 'test@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
)}`;

describe('Migration 016 — sheets_spreadsheet_id', () => {
  it('sites table has sheets_spreadsheet_id column', () => {
    const cols = db.pragma('table_info(sites)').map(c => c.name);
    expect(cols).toContain('sheets_spreadsheet_id');
  });
});

describe('GET /api/exports/jobs', () => {
  it('returns 400 when siteId is missing', async () => {
    const res = await request(app).get('/api/exports/jobs').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/siteId/i);
  });

  it('returns 404 for non-existent site', async () => {
    const res = await request(app).get('/api/exports/jobs?siteId=no-such-site').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/exports/sections', () => {
  it('returns 400 when jobId is missing', async () => {
    const res = await request(app).get('/api/exports/sections').set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobId/i);
  });

  it('returns 404 for non-existent job', async () => {
    const res = await request(app).get('/api/exports/sections?jobId=no-such-job').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/exports/csv', () => {
  it('returns 400 when jobId is missing', async () => {
    const res = await request(app).get('/api/exports/csv').set('Cookie', cookie);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent job', async () => {
    const res = await request(app).get('/api/exports/csv?jobId=no-such-job').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/exports/csv?jobId=any');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/exports/sheets', () => {
  it('returns 400 when jobId is missing', async () => {
    const res = await request(app)
      .post('/api/exports/sheets')
      .set('Cookie', cookie)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/jobId/i);
  });

  it('returns 404 for non-existent job', async () => {
    const res = await request(app)
      .post('/api/exports/sheets')
      .set('Cookie', cookie)
      .send({ jobId: 'no-such-job' });
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/exports/sheets')
      .send({ jobId: 'any' });
    expect(res.status).toBe(401);
  });
});
