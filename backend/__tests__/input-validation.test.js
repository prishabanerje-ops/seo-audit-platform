/**
 * Input validation tests — verifies that Zod schemas reject malformed
 * input at route level before it reaches business logic.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('POST /api/auth/login — validation', () => {
  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'somepassword' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'somepassword' });
    expect(res.status).toBe(400);
  });

  it('rejects empty password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: '' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for valid shape but wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/invite/accept — validation', () => {
  it('rejects missing token', async () => {
    const res = await request(app)
      .post('/api/auth/invite/accept')
      .send({ name: 'Test', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/invite/accept')
      .send({ token: 'a'.repeat(32), name: 'Test', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/change-password — validation', () => {
  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'newpassword123' });
    expect(res.status).toBe(400);
  });

  it('rejects new password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ email: 'test@test.com', currentPassword: 'old', newPassword: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/errors — validation', () => {
  it('rejects invalid level enum', async () => {
    const res = await request(app)
      .post('/api/errors')
      .send({ message: 'test', level: 'invalid-level', source: 'frontend' });
    expect(res.status).toBe(400);
  });

  it('rejects message over 1000 chars', async () => {
    const res = await request(app)
      .post('/api/errors')
      .send({ message: 'x'.repeat(1001), source: 'frontend' });
    expect(res.status).toBe(400);
  });

  it('accepts valid error payload', async () => {
    const res = await request(app)
      .post('/api/errors')
      .send({ message: 'Test error', level: 'error', source: 'frontend' });
    expect(res.status).toBe(204);
  });
});
