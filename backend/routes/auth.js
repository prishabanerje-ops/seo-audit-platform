/**
 * @module routes/auth
 * Authentication routes: login, logout, register, invite flow, user management.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import db from '../db/sqlite.js';
import { validate } from '../middleware/validate.js';
import { requireRole, requireSuperAdmin } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { logAction } from '../services/audit-log.service.js';

const router = Router();

// Cookie options are built per-request so that secure=true is set whenever
// the connection is HTTPS — including ngrok tunnels which set x-forwarded-proto.
function getCookieOptions(req) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    ...(isHttps ? { secure: true } : {}),
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role, company_id: user.company_id ?? null },
    process.env.JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
}

// ─── GET /api/auth/setup-status ──────────────────────────────────────────────
/**
 * @route GET /api/auth/setup-status
 * @desc  Returns whether a superadmin exists. needsSetup=true only on fresh install.
 * @access PUBLIC
 */
router.get('/setup-status', (req, res) => {
  const superadmin = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'superadmin'").get();
  res.json({ needsSetup: superadmin.cnt === 0 });
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
/**
 * @route POST /api/auth/register
 * @desc  Permanently disabled. Superadmin is bootstrapped via migration 006.
 * @access DISABLED
 */
router.post('/register', (req, res) => {
  res.status(403).json({ error: 'Self-registration is disabled. Contact your superadmin.' });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
/**
 * @route POST /api/auth/login
 * @desc  Authenticates a user with email + password.
 * @access PUBLIC
 */
const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  if (user.status === 'inactive') {
    return res.status(403).json({ error: 'Account deactivated' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  // Force password reset for seeded accounts with known default passwords
  if (user.must_reset_password) {
    return res.status(403).json({ error: 'password_reset_required', message: 'You must change your password before continuing.' });
  }

  // Non-superadmin users: check company payment status before issuing token
  if (user.role !== 'superadmin' && user.company_id) {
    const company = db.prepare('SELECT is_paid, status FROM companies WHERE id = ?').get(user.company_id);
    if (!company || company.status === 'inactive' || !company.is_paid) {
      return res.status(402).json({ error: 'access_expired', message: 'Your account access has expired. Please contact your administrator.' });
    }
  }

  const token = signToken(user);
  res.cookie('auth_token', token, getCookieOptions(req));

  res.json({
    user: { sub: user.id, email: user.email, name: user.name, role: user.role, company_id: user.company_id ?? null },
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
/**
 * @route POST /api/auth/logout
 * @desc  Clears the auth cookie.
 * @access PUBLIC
 */
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ ok: true });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
/**
 * @route GET /api/auth/me
 * @desc  Returns current user from cookie, or null if not authenticated.
 * @access PUBLIC (returns null, not 401, when no session)
 */
router.get('/me', (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.json({ user: null });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare(
      'SELECT id, email, name, role, company_id, avatar_url, status FROM users WHERE id = ?'
    ).get(decoded.sub);

    if (!user || user.status === 'inactive') return res.json({ user: null });

    res.json({
      user: { sub: user.id, email: user.email, name: user.name, role: user.role, company_id: user.company_id ?? null, avatar_url: user.avatar_url },
    });
  } catch {
    res.json({ user: null });
  }
});

// ─── POST /api/auth/invite ────────────────────────────────────────────────────
/**
 * @route POST /api/auth/invite
 * @desc  Creates an invite token and (optionally) sends email.
 *        Admin: invites seo/readonly for their own company.
 *        Superadmin: invites admin for a specified company (company_id required).
 * @access admin | superadmin
 */
const inviteSchema = z.object({
  email:      z.string().email(),
  role:       z.enum(['admin', 'seo', 'readonly']),
  company_id: z.string().uuid().optional(),
});

router.post('/invite', requireRole('admin', 'superadmin'), validate(inviteSchema), (req, res) => {
  const { email, role, company_id: bodyCompanyId } = req.body;
  const { role: actorRole, company_id: actorCompanyId } = req.user;

  // Admins can only invite seo/readonly — not other admins
  if (actorRole === 'admin' && role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot invite other admins.' });
  }

  // Superadmin must supply company_id when inviting an admin
  if (actorRole === 'superadmin' && role === 'admin' && !bodyCompanyId) {
    return res.status(400).json({ error: 'company_id is required when inviting an admin.' });
  }

  // Resolve which company this invite belongs to
  const targetCompanyId = actorRole === 'superadmin' ? bodyCompanyId : actorCompanyId;

  if (!targetCompanyId) {
    return res.status(400).json({ error: 'Cannot determine company for this invite.' });
  }

  // Verify the target company exists
  const company = db.prepare('SELECT id, name, max_seats FROM companies WHERE id = ?').get(targetCompanyId);
  if (!company) return res.status(404).json({ error: 'Company not found.' });

  // Enforce seat limit: count active users + pending invites for this company
  const { activeUsers } = db.prepare(
    "SELECT COUNT(*) AS activeUsers FROM users WHERE company_id = ? AND status = 'active'"
  ).get(targetCompanyId);
  const { pendingInvites } = db.prepare(
    "SELECT COUNT(*) AS pendingInvites FROM invites WHERE company_id = ? AND accepted = 0 AND expires_at > ?"
  ).get(targetCompanyId, new Date().toISOString());

  if ((activeUsers + pendingInvites) >= company.max_seats) {
    return res.status(400).json({ error: 'Seat limit reached. Contact your superadmin.' });
  }

  // 48-hour expiry
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const token     = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''); // 64-char hex
  const id        = uuidv4();

  db.prepare(
    'INSERT INTO invites (id, email, role, company_id, token, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, email.toLowerCase(), role, targetCompanyId, token, req.user.sub, expiresAt);

  logAction(req.user, {
    action:     'user.invite',
    targetType: 'invite',
    targetId:   id,
    companyId:  targetCompanyId,
    metadata:   { email: email.toLowerCase(), role },
  });

  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${token}`;

  // Email delivery via SMTP is handled when SMTP settings are configured.
  // If SMTP is not configured, inviteUrl is returned for manual sharing.

  res.status(201).json({ inviteUrl, token, expiresAt, companyName: company.name });
});

// ─── GET /api/auth/invite/validate ───────────────────────────────────────────
/**
 * @route GET /api/auth/invite/validate?token=...
 * @desc  Validates a pending invite token and returns the invited email + role.
 * @access PUBLIC
 */
router.get('/invite/validate', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token is required' });

  const invite = db.prepare(
    'SELECT email, role, company_id, expires_at FROM invites WHERE token = ? AND accepted = 0'
  ).get(token);

  if (!invite) return res.status(400).json({ error: 'Invalid or expired invite link' });
  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Invite link has expired' });
  }

  const company = invite.company_id
    ? db.prepare('SELECT name FROM companies WHERE id = ?').get(invite.company_id)
    : null;

  res.json({ email: invite.email, role: invite.role, company_name: company?.name ?? null });
});

// ─── POST /api/auth/invite/accept ────────────────────────────────────────────
/**
 * @route POST /api/auth/invite/accept
 * @desc  Accepts an invite and creates the user account.
 * @access PUBLIC
 */
const acceptInviteSchema = z.object({
  token:    z.string().min(32),
  name:     z.string().min(1).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/invite/accept', authLimiter, validate(acceptInviteSchema), async (req, res) => {
  const { token, name, password } = req.body;

  const invite = db.prepare(
    'SELECT * FROM invites WHERE token = ? AND accepted = 0'
  ).get(token);

  if (!invite) return res.status(400).json({ error: 'Invalid or expired invite link' });
  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Invite link has expired' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(invite.email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, role, company_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, invite.email, hash, name, invite.role, invite.company_id ?? null, 'active');

  db.prepare('UPDATE invites SET accepted = 1 WHERE id = ?').run(invite.id);

  const user = db.prepare('SELECT id, email, name, role, company_id FROM users WHERE id = ?').get(id);
  const jwtToken = signToken(user);

  res.cookie('auth_token', jwtToken, getCookieOptions(req));
  res.status(201).json({
    user: { sub: user.id, email: user.email, name: user.name, role: user.role, company_id: user.company_id ?? null },
  });
});

// ─── GET /api/auth/users ──────────────────────────────────────────────────────
/**
 * @route GET /api/auth/users
 * @desc  Lists users + pending invites scoped to the caller's company.
 *        Superadmin must pass ?company_id= to scope the query.
 * @access admin | superadmin
 */
router.get('/users', requireRole('admin', 'superadmin'), (req, res) => {
  const { role, company_id: actorCompanyId } = req.user;

  // Resolve target company
  const targetCompanyId = role === 'superadmin' ? req.query.company_id : actorCompanyId;

  if (!targetCompanyId) {
    return res.status(400).json({ error: 'company_id query param is required for superadmin.' });
  }

  const limit  = Math.min(Math.max(parseInt(req.query.limit  || '200', 10), 1), 500);
  const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);

  const users = db.prepare(
    'SELECT id, email, name, role, company_id, avatar_url, status, last_active_at, created_at FROM users WHERE company_id = ? ORDER BY created_at LIMIT ? OFFSET ?'
  ).all(targetCompanyId, limit, offset);

  const { total } = db.prepare(
    'SELECT COUNT(*) AS total FROM users WHERE company_id = ?'
  ).get(targetCompanyId);

  const invites = db.prepare(
    'SELECT id, email, role, company_id, expires_at, created_at FROM invites WHERE company_id = ? AND accepted = 0 AND expires_at > ? ORDER BY created_at DESC'
  ).all(targetCompanyId, new Date().toISOString());

  res.json({ users, invites, total, limit, offset });
});

// ─── PATCH /api/auth/users/:id ────────────────────────────────────────────────
/**
 * @route PATCH /api/auth/users/:id
 * @desc  Updates a user's role or status.
 *        Admin: cannot modify own role; target must share same company_id.
 *        Superadmin: unrestricted across companies.
 * @access admin | superadmin
 */
const patchUserSchema = z.object({
  role:   z.enum(['admin', 'seo', 'readonly']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  name:   z.string().min(1).max(100).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' });

const ALLOWED_USER_PATCH_FIELDS = ['role', 'status', 'name'];

router.patch('/users/:id', requireRole('admin', 'superadmin'), validate(patchUserSchema), (req, res) => {
  const { id } = req.params;
  const { role: actorRole, company_id: actorCompanyId } = req.user;

  // Guard: cannot change own role
  if (req.body.role && id === req.user.sub) {
    return res.status(403).json({ error: 'You cannot modify your own role' });
  }

  const user = db.prepare('SELECT id, company_id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Admin can only modify users in their own company
  if (actorRole === 'admin' && user.company_id !== actorCompanyId) {
    return res.status(403).json({ error: 'You do not have permission to modify this user' });
  }

  // Use an explicit whitelist (matches pattern in sites.js) to prevent
  // column injection if patchUserSchema is ever extended carelessly.
  const fields = Object.entries(req.body)
    .filter(([k]) => ALLOWED_USER_PATCH_FIELDS.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

  const setClause = fields.map(([k]) => `${k} = ?`).join(', ');
  const vals = [...fields.map(([, v]) => v), id];
  db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...vals);

  const updated = db.prepare(
    'SELECT id, email, name, role, company_id, status, last_active_at FROM users WHERE id = ?'
  ).get(id);

  logAction(req.user, {
    action:     'user.update',
    targetType: 'user',
    targetId:   id,
    companyId:  updated.company_id,
    metadata:   req.body,
  });

  res.json({ user: updated });
});

// ─── DELETE /api/auth/users/:id ───────────────────────────────────────────────
/**
 * @route DELETE /api/auth/users/:id
 * @desc  Deletes a user account.
 *        Admin: target must share same company_id.
 *        Superadmin: unrestricted.
 * @access admin | superadmin
 */
router.delete('/users/:id', requireRole('admin', 'superadmin'), (req, res) => {
  const { id } = req.params;
  const { role: actorRole, company_id: actorCompanyId } = req.user;

  if (id === req.user.sub) {
    return res.status(403).json({ error: 'You cannot delete your own account' });
  }

  const user = db.prepare('SELECT id, email, company_id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Admin can only delete users in their own company
  if (actorRole === 'admin' && user.company_id !== actorCompanyId) {
    return res.status(403).json({ error: 'You do not have permission to delete this user' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);

  logAction(req.user, {
    action:     'user.delete',
    targetType: 'user',
    targetId:   id,
    companyId:  user.company_id,
    metadata:   { email: user.email },
  });

  res.json({ ok: true });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
/**
 * @route POST /api/auth/change-password
 * @desc  Forced password reset for seeded accounts with must_reset_password = 1.
 *        Verifies current password, then replaces it with the new one.
 * @access PUBLIC (user cannot log in until this is done)
 */
const changePasswordSchema = z.object({
  email:           z.string().email(),
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
});

router.post('/change-password', authLimiter, validate(changePasswordSchema), async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  if (!user.must_reset_password) {
    return res.status(400).json({ error: 'Password change not required for this account.' });
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  if (await bcrypt.compare(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'New password must be different from your current password.' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?').run(hash, user.id);

  logAction({ sub: user.id, email: user.email, role: user.role, company_id: user.company_id }, {
    action:     'user.password_changed',
    targetType: 'user',
    targetId:   user.id,
    companyId:  user.company_id,
    metadata:   { forced_reset: true },
  });

  res.json({ ok: true });
});

export default router;
