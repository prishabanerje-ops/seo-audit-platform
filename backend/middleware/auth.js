import jwt from 'jsonwebtoken';
import db from '../db/sqlite.js';

/**
 * Paths that bypass JWT verification.
 * Everything else requires a valid auth_token cookie.
 */
const PUBLIC_PATHS = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'GET',  path: '/api/auth/me' },
  { method: 'POST', path: '/api/auth/register' },
  { method: 'GET',  path: '/api/auth/setup-status' },
  { method: 'GET',  path: '/api/auth/invite/validate' },
  { method: 'POST', path: '/api/auth/invite/accept' },
  { method: 'POST', path: '/api/auth/change-password' },
  { method: 'GET',  path: '/api/health' },
  { method: 'POST', path: '/api/errors' },
  { method: 'GET',  path: '/api/ads/callback/' },
];

/**
 * Global auth middleware — applied to every request.
 * Routes opt OUT via PUBLIC_PATHS, not opt IN.
 */
export function authMiddleware(req, res, next) {
  // Non-API routes (static files, SPA routes) are publicly reachable —
  // the frontend handles auth redirects client-side.
  if (!req.path.startsWith('/api')) return next();

  const isPublic = PUBLIC_PATHS.some(
    p => p.method === req.method && req.path.startsWith(p.path)
  );
  if (isPublic) return next();

  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { sub, email, name, role, company_id }

    // Non-blocking last_active update
    setImmediate(() => {
      try {
        db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
          .run(new Date().toISOString(), decoded.sub);
      } catch (_) {}
    });

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role guard factory.
 * @param  {...string} roles - allowed roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Superadmin-only guard.
 * Convenience alias for requireRole('superadmin').
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
}
