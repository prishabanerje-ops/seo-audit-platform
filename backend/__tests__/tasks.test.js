import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';
const token = jwt.sign(
  { sub: 'u1', email: 'seo@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
);
const cookie = `auth_token=${token}`;

describe('GET /api/tasks', () => {
  it('returns tasks and kanban structure', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tasks');
    expect(res.body).toHaveProperty('kanban');
    expect(res.body.kanban).toHaveProperty('backlog');
    expect(res.body.kanban).toHaveProperty('in_progress');
    expect(res.body.kanban).toHaveProperty('review');
    expect(res.body.kanban).toHaveProperty('done');
  });
});

describe('POST /api/tasks', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ description: 'No title' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when site_id is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ title: 'Task without site' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-does-not-exist')
      .set('Cookie', cookie)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .patch('/api/tasks/any-id')
      .set('Cookie', cookie)
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .get('/api/tasks/task-does-not-exist')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tasks/:id/comments', () => {
  it('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .post('/api/tasks/task-does-not-exist/comments')
      .set('Cookie', cookie)
      .send({ body: 'A comment' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/tasks/any-id/comments')
      .set('Cookie', cookie)
      .send({ body: '' });
    expect(res.status).toBe(400);
  });
});
