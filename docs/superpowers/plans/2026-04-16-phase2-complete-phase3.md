# Phase 2 Completion + Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Phase 2 (add impersonation) then implement Phase 3 (per-company settings, GSC/GA4 OAuth, Slack/Linear/SMTP, real Users page).

**Architecture:** Impersonation uses a JWT claim (`impersonated_by`) so the superadmin identity survives without a second cookie. Phase 3 adds a `company_settings` key-value table and a `company_oauth_tokens` table; all settings are scoped by `company_id`. GSC and GA4 use Google OAuth 2.0 per company, storing tokens in `company_oauth_tokens`.

**Tech Stack:** Node.js/Express (backend), React 18 + Vite + Tailwind via CSS vars (frontend), better-sqlite3 (sync DB), JWT httpOnly cookie, Google OAuth 2.0 via `googleapis` npm package.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `backend/db/migrations/012_company_settings.js` | `company_settings` + `company_oauth_tokens` tables |
| `backend/routes/settings.js` | GET/PUT per-company settings; global Anthropic key for superadmin |
| `backend/routes/gsc.js` | GSC OAuth initiation, callback, status, disconnect, properties |
| `backend/routes/ga4.js` | GA4 OAuth initiation, callback, status, disconnect, properties |
| `frontend/src/pages/Settings.jsx` | Full settings page (replaces stub) — tabs: Integrations, GSC, GA4, SMTP, Global |
| `frontend/src/pages/Users.jsx` | Full users page (replaces stub) — lists users + pending invites, invite flow |

### Modified files
| File | Change |
|------|--------|
| `backend/routes/auth.js` | Add `POST /api/auth/impersonate` + `POST /api/auth/impersonate/end` |
| `backend/middleware/auth.js` | Add GSC/GA4 callback paths to PUBLIC_PATHS |
| `backend/server.js` | Register settings, gsc, ga4 routes |
| `frontend/src/pages/Companies.jsx` | Add Impersonate button in UsersDrawer |
| `frontend/src/components/Header.jsx` | Add ImpersonationBanner strip |
| `frontend/src/context/AuthContext.jsx` | Add `isImpersonating`, `endImpersonation` |
| `frontend/src/pages/AuditLog.jsx` | Add `user.impersonate` + `user.impersonate_end` to ACTION_LABELS |
| `frontend/src/pages/stubs.jsx` | Remove `Settings` and `Users` exports |
| `frontend/src/router.jsx` | Import real `Settings` and `Users` pages |
| `PRD.md` | Update Phase 2 and Phase 3 sections |

---

## PHASE 2 COMPLETION

---

### Task 1: Backend — impersonation endpoints

**Files:**
- Modify: `backend/routes/auth.js` (add before `export default router;`)

- [ ] **Step 1: Add the two impersonation routes**

Add this block at the end of `backend/routes/auth.js` (before `export default router;`):

```js
// ─── POST /api/auth/impersonate ───────────────────────────────────────────────
const impersonateSchema = z.object({
  user_id: z.string().uuid(),
});

router.post('/impersonate', requireSuperAdmin, validate(impersonateSchema), (req, res) => {
  const { user_id } = req.body;

  if (user_id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot impersonate yourself.' });
  }

  const target = db.prepare(
    'SELECT id, email, name, role, company_id, status FROM users WHERE id = ?'
  ).get(user_id);

  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.status === 'inactive') {
    return res.status(400).json({ error: 'Cannot impersonate an inactive user.' });
  }
  if (target.role === 'superadmin') {
    return res.status(400).json({ error: 'Cannot impersonate another superadmin.' });
  }

  const token = jwt.sign(
    {
      sub:             target.id,
      email:           target.email,
      name:            target.name,
      role:            target.role,
      company_id:      target.company_id ?? null,
      impersonated_by: req.user.sub,
    },
    process.env.JWT_SECRET,
    { expiresIn: '4h', algorithm: 'HS256' }
  );

  res.cookie('auth_token', token, getCookieOptions(req));

  logAction(req.user, {
    action:     'user.impersonate',
    targetType: 'user',
    targetId:   target.id,
    companyId:  target.company_id,
    metadata:   { target_email: target.email, target_role: target.role },
  });

  res.json({
    user: {
      sub:             target.id,
      email:           target.email,
      name:            target.name,
      role:            target.role,
      company_id:      target.company_id ?? null,
      impersonated_by: req.user.sub,
    },
  });
});

// ─── POST /api/auth/impersonate/end ──────────────────────────────────────────
router.post('/impersonate/end', (req, res) => {
  if (!req.user?.impersonated_by) {
    return res.status(400).json({ error: 'Not currently impersonating anyone.' });
  }

  const superadmin = db.prepare(
    'SELECT id, email, name, role, company_id, status FROM users WHERE id = ?'
  ).get(req.user.impersonated_by);

  if (!superadmin || superadmin.role !== 'superadmin') {
    res.clearCookie('auth_token');
    return res.status(401).json({ error: 'Original superadmin session not found. Please log in again.' });
  }

  const token = signToken(superadmin);
  res.cookie('auth_token', token, getCookieOptions(req));

  logAction(
    { sub: superadmin.id, email: superadmin.email, role: superadmin.role, company_id: null },
    {
      action:     'user.impersonate_end',
      targetType: 'user',
      targetId:   req.user.sub,
      companyId:  req.user.company_id,
      metadata:   { was_impersonating: req.user.email },
    }
  );

  res.json({
    user: {
      sub:        superadmin.id,
      email:      superadmin.email,
      name:       superadmin.name,
      role:       superadmin.role,
      company_id: null,
    },
  });
});
```

- [ ] **Step 2: Verify server starts cleanly**

```bash
curl -s http://localhost:3001/health
```
Expected: `{"ok":true}`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/auth.js
git commit -m "feat(auth): add POST /api/auth/impersonate and /impersonate/end endpoints"
```

---

### Task 2: Frontend — impersonate button in Companies UsersDrawer

**Files:**
- Modify: `frontend/src/pages/Companies.jsx`

- [ ] **Step 1: Add `UserRoundCog` to lucide imports**

In the lucide-react import (line 6), add `UserRoundCog`:

```js
import {
  Building2, Plus, Pencil, Trash2, Users, Eye,
  CheckCircle2, XCircle, Loader2, ChevronRight, X, UserRoundCog,
} from 'lucide-react';
```

- [ ] **Step 2: Replace the entire `UsersDrawer` component**

Replace lines 249–333 with:

```jsx
function UsersDrawer({ company, onClose }) {
  const { setUser } = useAuth();
  const navigate    = useNavigate();

  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [impersonating, setImpersonating] = useState('');
  const [error,         setError]         = useState('');

  useEffect(() => {
    api.get(`/companies/${company.id}/users`)
      .then(res => setData(res.data))
      .catch(() => setData({ users: [], invites: [] }))
      .finally(() => setLoading(false));
  }, [company.id]);

  const handleImpersonate = async (userId) => {
    if (!window.confirm('Start an impersonation session as this user?')) return;
    setImpersonating(userId);
    setError('');
    try {
      const res = await api.post('/auth/impersonate', { user_id: userId });
      setUser(res.data.user);
      onClose();
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Impersonation failed.');
    } finally {
      setImpersonating('');
    }
  };

  const ROLE_COLOR = { admin: 'var(--brand)', seo: 'var(--severity-warning)', readonly: 'var(--text-muted)' };

  return (
    <div className="fixed inset-0 z-50 flex justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="w-96 h-full flex flex-col overflow-hidden shadow-xl"
        style={{ backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)' }}>

        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{company.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Users & Pending Invites</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="px-4 py-2 text-xs"
            style={{ backgroundColor: 'var(--severity-critical-bg)', color: 'var(--severity-critical-text)' }}>
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : (
            <>
              {data?.users?.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}>
                    Active Users ({data.users.length})
                  </p>
                  <div className="space-y-1">
                    {data.users.map(u => (
                      <div key={u.id}
                        className="flex items-center justify-between px-3 py-2 rounded-md"
                        style={{ backgroundColor: 'var(--bg-raised)' }}>
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs capitalize"
                            style={{ color: ROLE_COLOR[u.role] || 'var(--text-muted)' }}>
                            {u.role}
                          </span>
                          <button
                            onClick={() => handleImpersonate(u.id)}
                            disabled={!!impersonating}
                            title={`Impersonate ${u.name}`}
                            className="w-6 h-6 flex items-center justify-center rounded transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-base)'; e.currentTarget.style.color = 'var(--brand)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            {impersonating === u.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <UserRoundCog className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data?.invites?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}>
                    Pending Invites ({data.invites.length})
                  </p>
                  <div className="space-y-1">
                    {data.invites.map(inv => (
                      <div key={inv.id}
                        className="flex items-center justify-between px-3 py-2 rounded-md"
                        style={{ backgroundColor: 'var(--bg-raised)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{inv.email}</p>
                        <span className="text-xs capitalize" style={{ color: 'var(--severity-warning)' }}>{inv.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!data?.users?.length && !data?.invites?.length && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No users yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Companies.jsx
git commit -m "feat(companies): add impersonate button in users drawer"
```

---

### Task 3: Frontend — impersonation banner + AuthContext

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/components/Header.jsx`

- [ ] **Step 1: Replace full content of `frontend/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [viewingCompany, setViewingCompanyState] = useState(() => {
    try {
      const saved = localStorage.getItem('viewingCompany');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const setViewingCompany = (company) => {
    if (company) {
      localStorage.setItem('viewingCompany', JSON.stringify(company));
    } else {
      localStorage.removeItem('viewingCompany');
    }
    setViewingCompanyState(company);
  };

  useEffect(() => {
    if (user && user.role !== 'superadmin') setViewingCompany(null);
  }, [user]);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setViewingCompany(null);
    setUser(null);
  }, []);

  const isImpersonating = Boolean(user?.impersonated_by);

  const endImpersonation = useCallback(async () => {
    const res = await api.post('/auth/impersonate/end');
    setViewingCompany(null);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const companyId        = user?.company_id ?? null;
  const viewingCompanyId = viewingCompany?.id ?? null;

  return (
    <AuthContext.Provider value={{
      user, setUser,
      companyId,
      isLoading,
      logout,
      viewingCompany,
      viewingCompanyId,
      setViewingCompany,
      isImpersonating,
      endImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Add `Loader2` to lucide imports in `frontend/src/components/Header.jsx`**

Replace the lucide import line:
```js
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, Plus, Building2, X } from 'lucide-react';
```
With:
```js
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, Plus, Building2, X, Loader2 } from 'lucide-react';
```

- [ ] **Step 3: Add `ImpersonationBanner` component to Header.jsx**

Insert this component after the imports, before `function useTheme()`:

```jsx
function ImpersonationBanner() {
  const { user, endImpersonation } = useAuth();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await endImpersonation();
      navigate('/companies');
    } finally {
      setEnding(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 text-xs font-medium shrink-0"
      style={{ backgroundColor: 'var(--severity-warning)', color: '#000' }}
    >
      <span>
        Impersonating <strong>{user?.name}</strong> ({user?.email})
      </span>
      <button
        onClick={handleEnd}
        disabled={ending}
        className="flex items-center gap-1 px-2 py-0.5 rounded font-semibold"
        style={{ backgroundColor: 'rgba(0,0,0,0.15)', color: '#000', opacity: ending ? 0.6 : 1 }}
      >
        {ending && <Loader2 className="w-3 h-3 animate-spin" />}
        End Session
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add `isImpersonating` check and banner to `Header` function**

Inside `Header()`, add before the `return`:
```js
const { isImpersonating } = useAuth();
```

Then wrap the return in a fragment and prepend the banner:
```jsx
return (
  <>
    {isImpersonating && <ImpersonationBanner />}
    <header
      className="h-14 flex items-center px-4 gap-3 shrink-0 sticky top-0 z-10"
      style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}
    >
      {/* ... existing header content unchanged ... */}
    </header>
  </>
);
```

- [ ] **Step 5: Test impersonation end-to-end**

Start dev server, log in as superadmin → Companies → click Users icon on a company → click impersonate icon on a user → confirm dialog → verify orange banner appears at top with "End Session" button → click End Session → verify you're back on /companies as superadmin.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/components/Header.jsx
git commit -m "feat(impersonation): banner in header + endImpersonation in AuthContext"
```

---

### Task 4: AuditLog — add impersonation action labels

**Files:**
- Modify: `frontend/src/pages/AuditLog.jsx`

- [ ] **Step 1: Replace `ACTION_LABELS` (lines 5–12)**

```js
const ACTION_LABELS = {
  'company.create':        'Company created',
  'company.update':        'Company updated',
  'company.delete':        'Company deleted',
  'user.invite':           'User invited',
  'user.update':           'User updated',
  'user.delete':           'User deleted',
  'user.impersonate':      'Impersonation started',
  'user.impersonate_end':  'Impersonation ended',
  'user.password_changed': 'Password changed',
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/AuditLog.jsx
git commit -m "feat(audit-log): add impersonation action labels"
```

---

## PHASE 3 — PER-COMPANY INTEGRATIONS

---

### Task 5: Migration 012 — company_settings + company_oauth_tokens

**Files:**
- Create: `backend/db/migrations/012_company_settings.js`

- [ ] **Step 1: Write the migration**

```js
/**
 * Migration 012 — Per-company settings and OAuth tokens
 *
 * 1. company_settings — key-value store scoped per company
 * 2. company_oauth_tokens — GSC/GA4 OAuth tokens per company
 */

export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT    NOT NULL,
      key        TEXT    NOT NULL,
      value      TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, key),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS company_oauth_tokens (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id      TEXT NOT NULL,
      provider        TEXT NOT NULL,
      access_token    TEXT NOT NULL,
      refresh_token   TEXT,
      token_expiry    TEXT,
      scope           TEXT,
      connected_email TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, provider),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
  `).run();
}
```

- [ ] **Step 2: Run migration and verify**

```bash
cd /Users/a39326/Documents/Aakash/backend && node db/migrations/run.js
```
Expected: `Running migration 012... done`

```bash
node --input-type=module <<'EOF'
import db from './db/sqlite.js';
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('company_settings','company_oauth_tokens')").all();
console.log(t.map(r => r.name));
EOF
```
Expected: `[ 'company_settings', 'company_oauth_tokens' ]`

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/012_company_settings.js
git commit -m "feat(db): migration 012 — company_settings and company_oauth_tokens tables"
```

---

### Task 6: Backend — settings routes

**Files:**
- Create: `backend/routes/settings.js`
- Modify: `backend/server.js`

**Allowed company keys:** `slack_webhook_url`, `linear_api_key`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`, `psi_api_key`
**Allowed global keys (superadmin only):** `anthropic_api_key`

- [ ] **Step 1: Create `backend/routes/settings.js`**

```js
/**
 * @module routes/settings
 * Per-company settings CRUD.
 * Superadmin also reads/writes the global `settings` table (Anthropic key).
 */
import { Router }   from 'express';
import { z }        from 'zod';
import db           from '../db/sqlite.js';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const ALLOWED_COMPANY_KEYS = [
  'slack_webhook_url', 'linear_api_key',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
  'psi_api_key',
];

const ALLOWED_GLOBAL_KEYS = ['anthropic_api_key'];

// ── GET /api/settings ─────────────────────────────────────────────────────────
router.get('/', requireRole('admin', 'superadmin'), (req, res) => {
  const { role, company_id } = req.user;
  const targetCompanyId = role === 'superadmin'
    ? (req.query.company_id || company_id)
    : company_id;

  let companySettings = {};
  if (targetCompanyId) {
    const rows = db.prepare(
      'SELECT key, value FROM company_settings WHERE company_id = ?'
    ).all(targetCompanyId);
    companySettings = Object.fromEntries(rows.map(r => [r.key, r.value ?? '']));
  }

  const result = { settings: companySettings };

  if (role === 'superadmin') {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    result.global = Object.fromEntries(rows.map(r => [r.key, r.value ?? '']));
  }

  res.json(result);
});

// ── PUT /api/settings ─────────────────────────────────────────────────────────
const settingsSchema = z.object({
  settings: z.record(z.string(), z.string().max(2000)).optional().default({}),
  global:   z.record(z.string(), z.string().max(2000)).optional().default({}),
});

router.put('/', requireRole('admin', 'superadmin'), validate(settingsSchema), (req, res) => {
  const { role, company_id } = req.user;
  const { settings = {}, global = {} } = req.body;

  const targetCompanyId = role === 'superadmin'
    ? (req.query.company_id || company_id)
    : company_id;

  const now = new Date().toISOString();

  if (targetCompanyId) {
    const upsert = db.prepare(`
      INSERT INTO company_settings (company_id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(company_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    const saveMany = db.transaction((entries) => {
      for (const [key, value] of entries) {
        if (ALLOWED_COMPANY_KEYS.includes(key)) {
          upsert.run(targetCompanyId, key, value || null, now, now);
        }
      }
    });
    saveMany(Object.entries(settings));
  }

  if (role === 'superadmin' && Object.keys(global).length > 0) {
    const upsertGlobal = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    const saveGlobal = db.transaction((entries) => {
      for (const [key, value] of entries) {
        if (ALLOWED_GLOBAL_KEYS.includes(key)) upsertGlobal.run(key, value || null);
      }
    });
    saveGlobal(Object.entries(global));
  }

  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2: Register in `backend/server.js`**

Add import:
```js
import settingsRoutes from './routes/settings.js';
```

Add route:
```js
app.use('/api/settings', settingsRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/settings.js backend/server.js
git commit -m "feat(settings): per-company settings GET/PUT route"
```

---

### Task 7: Backend — GSC OAuth routes

**Files:**
- Create: `backend/routes/gsc.js`
- Modify: `backend/middleware/auth.js` (PUBLIC_PATHS)
- Modify: `backend/server.js`

- [ ] **Step 1: Check if `googleapis` is installed**

```bash
cd /Users/a39326/Documents/Aakash/backend && node --input-type=module -e "import('googleapis').then(() => console.log('ok')).catch(e => console.log('MISSING'))"
```

If `MISSING`, install it:
```bash
npm install googleapis
```

- [ ] **Step 2: Create `backend/routes/gsc.js`**

```js
/**
 * @module routes/gsc
 * Per-company Google Search Console OAuth.
 */
import { Router }     from 'express';
import { google }     from 'googleapis';
import db             from '../db/sqlite.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const GSC_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI_GSC
      || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/gsc/callback`,
  );
}

function resolveCompanyId(req) {
  return req.user.role === 'superadmin'
    ? (req.query.company_id || req.user.company_id)
    : req.user.company_id;
}

// GET /api/gsc/auth — initiate OAuth
router.get('/auth', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });
  const url = makeOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       GSC_SCOPES,
    state:       JSON.stringify({ company_id: cid, provider: 'gsc' }),
  });
  res.json({ authUrl: url });
});

// GET /api/gsc/callback — OAuth callback (PUBLIC, state-verified)
router.get('/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code, state, error: oauthError } = req.query;

  if (oauthError) return res.redirect(`${frontendUrl}/settings?gsc_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return res.redirect(`${frontendUrl}/settings?gsc_error=missing_params`);

  let parsed;
  try { parsed = JSON.parse(state); } catch {
    return res.redirect(`${frontendUrl}/settings?gsc_error=invalid_state`);
  }
  if (!parsed.company_id || parsed.provider !== 'gsc') {
    return res.redirect(`${frontendUrl}/settings?gsc_error=invalid_state`);
  }

  try {
    const oauth2 = makeOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const userInfo = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
    const connectedEmail = userInfo.data.email || null;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO company_oauth_tokens
        (company_id, provider, access_token, refresh_token, token_expiry, scope, connected_email, created_at, updated_at)
      VALUES (?, 'gsc', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_id, provider) DO UPDATE SET
        access_token    = excluded.access_token,
        refresh_token   = COALESCE(excluded.refresh_token, refresh_token),
        token_expiry    = excluded.token_expiry,
        scope           = excluded.scope,
        connected_email = excluded.connected_email,
        updated_at      = excluded.updated_at
    `).run(
      parsed.company_id,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      tokens.scope || GSC_SCOPES.join(' '),
      connectedEmail, now, now,
    );

    res.redirect(`${frontendUrl}/settings?gsc_connected=1`);
  } catch (err) {
    console.error('[GSC callback]', err.message);
    res.redirect(`${frontendUrl}/settings?gsc_error=token_exchange_failed`);
  }
});

// GET /api/gsc/status
router.get('/status', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.json({ connected: false });
  const row = db.prepare(
    "SELECT connected_email, updated_at FROM company_oauth_tokens WHERE company_id = ? AND provider = 'gsc'"
  ).get(cid);
  res.json({ connected: Boolean(row), connected_email: row?.connected_email || null, connected_at: row?.updated_at || null });
});

// DELETE /api/gsc/disconnect
router.delete('/disconnect', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });
  db.prepare("DELETE FROM company_oauth_tokens WHERE company_id = ? AND provider = 'gsc'").run(cid);
  res.json({ ok: true });
});

// GET /api/gsc/properties — list GSC properties for connected account
router.get('/properties', requireRole('admin', 'superadmin'), async (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });

  const row = db.prepare(
    "SELECT access_token, refresh_token, token_expiry FROM company_oauth_tokens WHERE company_id = ? AND provider = 'gsc'"
  ).get(cid);
  if (!row) return res.status(404).json({ error: 'GSC not connected.' });

  try {
    const oauth2 = makeOAuth2Client();
    oauth2.setCredentials({
      access_token:  row.access_token,
      refresh_token: row.refresh_token,
      expiry_date:   row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
    });
    oauth2.on('tokens', (t) => {
      if (t.access_token) {
        db.prepare(
          "UPDATE company_oauth_tokens SET access_token = ?, token_expiry = ?, updated_at = ? WHERE company_id = ? AND provider = 'gsc'"
        ).run(t.access_token, t.expiry_date ? new Date(t.expiry_date).toISOString() : null, new Date().toISOString(), cid);
      }
    });

    const sc = google.searchconsole({ version: 'v1', auth: oauth2 });
    const result = await sc.sites.list();
    const properties = (result.data.siteEntry || []).map(s => ({
      url:              s.siteUrl,
      permission_level: s.permissionLevel,
    }));
    res.json({ properties });
  } catch (err) {
    console.error('[GSC properties]', err.message);
    res.status(502).json({ error: 'Failed to fetch GSC properties. Try reconnecting.' });
  }
});

export default router;
```

- [ ] **Step 3: Add GSC + GA4 callback paths to `PUBLIC_PATHS` in `backend/middleware/auth.js`**

Add these two entries to the `PUBLIC_PATHS` array:
```js
{ method: 'GET', path: '/api/gsc/callback' },
{ method: 'GET', path: '/api/ga4/callback' },
```

- [ ] **Step 4: Register GSC route in `backend/server.js`**

```js
import gscRoutes from './routes/gsc.js';
// ...
app.use('/api/gsc', gscRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add backend/routes/gsc.js backend/middleware/auth.js backend/server.js
git commit -m "feat(gsc): per-company GSC OAuth routes"
```

---

### Task 8: Backend — GA4 OAuth routes

**Files:**
- Create: `backend/routes/ga4.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create `backend/routes/ga4.js`**

```js
/**
 * @module routes/ga4
 * Per-company Google Analytics 4 OAuth — mirrors gsc.js, different scope + API.
 */
import { Router }      from 'express';
import { google }      from 'googleapis';
import db              from '../db/sqlite.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI_GA4
      || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/ga4/callback`,
  );
}

function resolveCompanyId(req) {
  return req.user.role === 'superadmin'
    ? (req.query.company_id || req.user.company_id)
    : req.user.company_id;
}

// GET /api/ga4/auth
router.get('/auth', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });
  const url = makeOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       GA4_SCOPES,
    state:       JSON.stringify({ company_id: cid, provider: 'ga4' }),
  });
  res.json({ authUrl: url });
});

// GET /api/ga4/callback (PUBLIC)
router.get('/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code, state, error: oauthError } = req.query;

  if (oauthError) return res.redirect(`${frontendUrl}/settings?ga4_error=${encodeURIComponent(oauthError)}`);
  if (!code || !state) return res.redirect(`${frontendUrl}/settings?ga4_error=missing_params`);

  let parsed;
  try { parsed = JSON.parse(state); } catch {
    return res.redirect(`${frontendUrl}/settings?ga4_error=invalid_state`);
  }
  if (!parsed.company_id || parsed.provider !== 'ga4') {
    return res.redirect(`${frontendUrl}/settings?ga4_error=invalid_state`);
  }

  try {
    const oauth2 = makeOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const userInfo = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
    const connectedEmail = userInfo.data.email || null;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO company_oauth_tokens
        (company_id, provider, access_token, refresh_token, token_expiry, scope, connected_email, created_at, updated_at)
      VALUES (?, 'ga4', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_id, provider) DO UPDATE SET
        access_token    = excluded.access_token,
        refresh_token   = COALESCE(excluded.refresh_token, refresh_token),
        token_expiry    = excluded.token_expiry,
        scope           = excluded.scope,
        connected_email = excluded.connected_email,
        updated_at      = excluded.updated_at
    `).run(
      parsed.company_id,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      tokens.scope || GA4_SCOPES.join(' '),
      connectedEmail, now, now,
    );

    res.redirect(`${frontendUrl}/settings?ga4_connected=1`);
  } catch (err) {
    console.error('[GA4 callback]', err.message);
    res.redirect(`${frontendUrl}/settings?ga4_error=token_exchange_failed`);
  }
});

// GET /api/ga4/status
router.get('/status', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.json({ connected: false });
  const row = db.prepare(
    "SELECT connected_email, updated_at FROM company_oauth_tokens WHERE company_id = ? AND provider = 'ga4'"
  ).get(cid);
  res.json({ connected: Boolean(row), connected_email: row?.connected_email || null, connected_at: row?.updated_at || null });
});

// DELETE /api/ga4/disconnect
router.delete('/disconnect', requireRole('admin', 'superadmin'), (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });
  db.prepare("DELETE FROM company_oauth_tokens WHERE company_id = ? AND provider = 'ga4'").run(cid);
  res.json({ ok: true });
});

// GET /api/ga4/properties
router.get('/properties', requireRole('admin', 'superadmin'), async (req, res) => {
  const cid = resolveCompanyId(req);
  if (!cid) return res.status(400).json({ error: 'company_id required.' });

  const row = db.prepare(
    "SELECT access_token, refresh_token, token_expiry FROM company_oauth_tokens WHERE company_id = ? AND provider = 'ga4'"
  ).get(cid);
  if (!row) return res.status(404).json({ error: 'GA4 not connected.' });

  try {
    const oauth2 = makeOAuth2Client();
    oauth2.setCredentials({
      access_token:  row.access_token,
      refresh_token: row.refresh_token,
      expiry_date:   row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
    });
    oauth2.on('tokens', (t) => {
      if (t.access_token) {
        db.prepare(
          "UPDATE company_oauth_tokens SET access_token = ?, token_expiry = ?, updated_at = ? WHERE company_id = ? AND provider = 'ga4'"
        ).run(t.access_token, t.expiry_date ? new Date(t.expiry_date).toISOString() : null, new Date().toISOString(), cid);
      }
    });

    const admin = google.analyticsadmin({ version: 'v1beta', auth: oauth2 });
    const result = await admin.properties.list({ filter: 'parent:accounts/-' });
    const properties = (result.data.properties || []).map(p => ({
      name:         p.name,
      display_name: p.displayName,
      property_id:  p.name.replace('properties/', ''),
    }));
    res.json({ properties });
  } catch (err) {
    console.error('[GA4 properties]', err.message);
    res.status(502).json({ error: 'Failed to fetch GA4 properties. Try reconnecting.' });
  }
});

export default router;
```

- [ ] **Step 2: Register in `backend/server.js`**

```js
import ga4Routes from './routes/ga4.js';
// ...
app.use('/api/ga4', ga4Routes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/ga4.js backend/server.js
git commit -m "feat(ga4): per-company GA4 OAuth routes"
```

---

### Task 9: Frontend — Settings page

**Files:**
- Create: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/pages/stubs.jsx` — remove `Settings` export
- Modify: `frontend/src/router.jsx` — import real `Settings`

**Tabs:** Integrations (Slack + Linear), GSC, GA4, SMTP, Global (superadmin-only)

- [ ] **Step 1: Create `frontend/src/pages/Settings.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import {
  Settings2, Link2, Search, BarChart3, Mail, Key,
  CheckCircle2, XCircle, Loader2, ExternalLink,
} from 'lucide-react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
      style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
      onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
      onBlur={e  => e.currentTarget.style.boxShadow = ''}
    />
  );
}

function SaveBtn({ saving, onClick }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="flex items-center gap-1.5 h-8 px-4 rounded-md text-xs font-semibold text-white"
      style={{ backgroundColor: 'var(--brand)', opacity: saving ? 0.7 : 1 }}>
      {saving && <Loader2 className="w-3 h-3 animate-spin" />}
      Save
    </button>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  const isErr = msg.startsWith('Error');
  return (
    <p className="text-xs" style={{ color: isErr ? 'var(--severity-critical-text)' : 'var(--severity-pass)' }}>
      {msg}
    </p>
  );
}

// ── Integrations tab (Slack + Linear) ─────────────────────────────────────────
function IntegrationsTab({ companyId }) {
  const [form,   setForm]   = useState({ slack_webhook_url: '', linear_api_key: '' });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  useEffect(() => {
    const qs = companyId ? `?company_id=${companyId}` : '';
    api.get(`/settings${qs}`).then(r => {
      const s = r.data.settings || {};
      setForm({ slack_webhook_url: s.slack_webhook_url || '', linear_api_key: s.linear_api_key || '' });
    }).catch(() => {});
  }, [companyId]);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const qs = companyId ? `?company_id=${companyId}` : '';
      await api.put(`/settings${qs}`, { settings: form });
      setMsg('Saved.');
    } catch { setMsg('Error: Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Slack</h3>
        <Field label="Webhook URL">
          <Input value={form.slack_webhook_url} onChange={v => setForm(f => ({ ...f, slack_webhook_url: v }))}
            placeholder="https://hooks.slack.com/services/..." />
        </Field>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Linear</h3>
        <Field label="API Key">
          <Input type="password" value={form.linear_api_key} onChange={v => setForm(f => ({ ...f, linear_api_key: v }))}
            placeholder="lin_api_..." />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SaveBtn saving={saving} onClick={save} />
        <StatusMsg msg={msg} />
      </div>
    </div>
  );
}

// ── OAuth connect card (shared by GSC + GA4) ──────────────────────────────────
function OAuthCard({ icon: Icon, label, provider, companyId }) {
  const [status,    setStatus]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [actioning, setActioning] = useState(false);
  const [msg,       setMsg]       = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const connKey = `${provider}_connected`;
    const errKey  = `${provider}_error`;
    if (searchParams.get(connKey)) { setMsg(`${label} connected.`); setSearchParams({}); }
    if (searchParams.get(errKey))  { setMsg(`Error: ${searchParams.get(errKey)}`); setSearchParams({}); }
  }, [searchParams, setSearchParams, provider, label]);

  const load = useCallback(() => {
    setLoading(true);
    const qs = companyId ? `?company_id=${companyId}` : '';
    api.get(`/${provider}/status${qs}`)
      .then(r => setStatus(r.data))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, [provider, companyId]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setActioning(true);
    try {
      const qs = companyId ? `?company_id=${companyId}` : '';
      const r = await api.get(`/${provider}/auth${qs}`);
      window.location.href = r.data.authUrl;
    } catch { setActioning(false); }
  };

  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${label}?`)) return;
    setActioning(true);
    try {
      const qs = companyId ? `?company_id=${companyId}` : '';
      await api.delete(`/${provider}/disconnect${qs}`);
      setMsg(`${label} disconnected.`);
      load();
    } catch { setMsg('Error: Disconnect failed.'); }
    finally { setActioning(false); }
  };

  if (loading) return <div className="p-4"><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;

  return (
    <div className="space-y-3 max-w-lg">
      <div className="p-4 rounded-lg flex items-start gap-4"
        style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
        <Icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
          {status?.connected ? (
            <>
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--severity-pass)' }} />
                <span className="text-xs" style={{ color: 'var(--severity-pass)' }}>Connected</span>
                {status.connected_email && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {status.connected_email}</span>
                )}
              </div>
              <button onClick={disconnect} disabled={actioning}
                className="mt-3 h-7 px-3 rounded text-xs font-medium flex items-center gap-1"
                style={{ backgroundColor: 'var(--severity-critical-bg)', color: 'var(--severity-critical-text)', border: '1px solid var(--severity-critical-border)' }}>
                {actioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Disconnect
              </button>
            </>
          ) : (
            <>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {provider === 'gsc' ? 'Connect to overlay Search Console data on your audit results.' : 'Connect to see GA4 traffic data alongside your audit results.'}
              </p>
              <button onClick={connect} disabled={actioning}
                className="mt-3 h-7 px-3 rounded text-xs font-semibold text-white flex items-center gap-1"
                style={{ backgroundColor: 'var(--brand)', opacity: actioning ? 0.7 : 1 }}>
                {actioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                Connect with Google
              </button>
            </>
          )}
        </div>
      </div>
      <StatusMsg msg={msg} />
    </div>
  );
}

// ── SMTP tab ──────────────────────────────────────────────────────────────────
function SmtpTab({ companyId }) {
  const [form,   setForm]   = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '' });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const qs = companyId ? `?company_id=${companyId}` : '';
    api.get(`/settings${qs}`).then(r => {
      const s = r.data.settings || {};
      setForm({ smtp_host: s.smtp_host || '', smtp_port: s.smtp_port || '587', smtp_user: s.smtp_user || '', smtp_pass: s.smtp_pass || '', smtp_from: s.smtp_from || '' });
    }).catch(() => {});
  }, [companyId]);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const qs = companyId ? `?company_id=${companyId}` : '';
      await api.put(`/settings${qs}`, { settings: form });
      setMsg('Saved.');
    } catch { setMsg('Error: Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        <Field label="SMTP Host"><Input value={form.smtp_host} onChange={v => set('smtp_host', v)} placeholder="smtp.example.com" /></Field>
        <Field label="Port"><Input value={form.smtp_port} onChange={v => set('smtp_port', v)} placeholder="587" /></Field>
      </div>
      <Field label="Username"><Input value={form.smtp_user} onChange={v => set('smtp_user', v)} placeholder="user@example.com" /></Field>
      <Field label="Password"><Input type="password" value={form.smtp_pass} onChange={v => set('smtp_pass', v)} placeholder="••••••••" /></Field>
      <Field label="From Address"><Input value={form.smtp_from} onChange={v => set('smtp_from', v)} placeholder="SEO Platform <noreply@example.com>" /></Field>
      <div className="flex items-center gap-3"><SaveBtn saving={saving} onClick={save} /><StatusMsg msg={msg} /></div>
    </div>
  );
}

// ── Global tab (superadmin only) ──────────────────────────────────────────────
function GlobalTab() {
  const [key,    setKey]    = useState('');
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  useEffect(() => {
    api.get('/settings').then(r => setKey(r.data.global?.anthropic_api_key || '')).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put('/settings', { global: { anthropic_api_key: key } });
      setMsg('Saved.');
    } catch { setMsg('Error: Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Global settings apply to all companies on this instance.</p>
      <Field label="Anthropic API Key">
        <Input type="password" value={key} onChange={setKey} placeholder="sk-ant-..." />
      </Field>
      <div className="flex items-center gap-3"><SaveBtn saving={saving} onClick={save} /><StatusMsg msg={msg} /></div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'integrations', label: 'Integrations', icon: Link2     },
  { id: 'gsc',          label: 'GSC',          icon: Search    },
  { id: 'ga4',          label: 'GA4',          icon: BarChart3 },
  { id: 'smtp',         label: 'SMTP',         icon: Mail      },
];

export function Settings() {
  const { user, companyId, viewingCompanyId } = useAuth();
  const isSuperAdmin   = user?.role === 'superadmin';
  const activeCompanyId = isSuperAdmin ? viewingCompanyId : companyId;
  const allTabs = isSuperAdmin ? [...TABS, { id: 'global', label: 'Global', icon: Key }] : TABS;
  const [activeTab, setActiveTab] = useState('integrations');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings2 className="w-5 h-5" style={{ color: 'var(--brand)' }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Configure integrations and platform settings.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border-default)' }}>
        {allTabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium -mb-px"
              style={{ color: active ? 'var(--brand)' : 'var(--text-muted)', borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent' }}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'integrations' && <IntegrationsTab companyId={activeCompanyId} />}
      {activeTab === 'gsc'          && <OAuthCard icon={Search} label="Google Search Console" provider="gsc" companyId={activeCompanyId} />}
      {activeTab === 'ga4'          && <OAuthCard icon={BarChart3} label="Google Analytics 4" provider="ga4" companyId={activeCompanyId} />}
      {activeTab === 'smtp'         && <SmtpTab companyId={activeCompanyId} />}
      {activeTab === 'global' && isSuperAdmin && <GlobalTab />}
    </div>
  );
}
```

- [ ] **Step 2: Remove `Settings` export from stubs.jsx**

Delete this line from `frontend/src/pages/stubs.jsx`:
```js
export function Settings()         { return <Stub title="Settings"           description="Platform-wide settings and configuration." />; }
```

- [ ] **Step 3: Update `frontend/src/router.jsx`**

Add import:
```js
import { Settings } from './pages/Settings.jsx';
```

Remove `Settings` from the stubs destructure import.

- [ ] **Step 4: Navigate to `/settings` and verify all 4 tabs render**

No console errors. Save buttons work. GSC/GA4 connect buttons redirect to Google.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Settings.jsx frontend/src/pages/stubs.jsx frontend/src/router.jsx
git commit -m "feat(settings): real Settings page — Integrations, GSC, GA4, SMTP, Global tabs"
```

---

### Task 10: Frontend — Users page

**Files:**
- Create: `frontend/src/pages/Users.jsx`
- Modify: `frontend/src/pages/stubs.jsx` — remove `Users` export
- Modify: `frontend/src/router.jsx` — import real `Users`

- [ ] **Step 1: Create `frontend/src/pages/Users.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import {
  Users as UsersIcon, Plus, Trash2, Mail, Pencil,
  CheckCircle2, XCircle, Clock, Loader2, X, Copy,
} from 'lucide-react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

function InviteModal({ companyId, onClose, onInvited }) {
  const [form,   setForm]   = useState({ email: '', role: 'seo' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error,  setError]  = useState('');

  const send = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { ...form };
      if (companyId) body.company_id = companyId;
      const res = await api.post('/auth/invite', body);
      setResult(res.data);
      onInvited?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Invite failed.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-xl shadow-xl"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Invite User</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
        </div>
        {result ? (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--severity-pass)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Invite created!</p>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
              <p className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)' }}>{result.inviteUrl}</p>
              <button onClick={() => navigator.clipboard.writeText(result.inviteUrl)} style={{ color: 'var(--text-muted)' }}>
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <button onClick={onClose} className="h-8 px-4 rounded-md text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Email *</label>
              <input type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Role *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full h-9 px-3 rounded-md text-sm"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                <option value="seo">SEO</option>
                <option value="readonly">Readonly</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-xs" style={{ color: 'var(--severity-critical-text)' }}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-8 px-4 rounded-md text-xs font-medium"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="h-8 px-4 rounded-md text-xs font-semibold text-white flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--brand)', opacity: saving ? 0.7 : 1 }}>
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Send Invite
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const ROLE_COLOR = { admin: 'var(--brand)', seo: 'var(--severity-warning)', readonly: 'var(--text-muted)' };

export function Users() {
  const { user, companyId, viewingCompanyId } = useAuth();
  const isSuperAdmin   = user?.role === 'superadmin';
  const isAdmin        = user?.role === 'admin' || isSuperAdmin;
  const targetCompanyId = isSuperAdmin ? viewingCompanyId : companyId;

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [patching,   setPatching]   = useState('');
  const [deleting,   setDeleting]   = useState('');

  const load = useCallback(async () => {
    if (!targetCompanyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/auth/users?company_id=${targetCompanyId}`);
      setData(res.data);
    } catch { setData({ users: [], invites: [], total: 0 }); }
    finally { setLoading(false); }
  }, [targetCompanyId]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (userId, role) => {
    setPatching(userId);
    try { await api.patch(`/auth/users/${userId}`, { role }); load(); }
    finally { setPatching(''); }
  };

  const handleStatusToggle = async (u) => {
    setPatching(u.id);
    try { await api.patch(`/auth/users/${u.id}`, { status: u.status === 'active' ? 'inactive' : 'active' }); load(); }
    finally { setPatching(''); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    setDeleting(u.id);
    try { await api.delete(`/auth/users/${u.id}`); load(); }
    finally { setDeleting(''); }
  };

  if (!targetCompanyId) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Select a company from the header to manage its users.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Users</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage team members for this company.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--brand)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--brand-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--brand)'}>
            <Plus className="w-4 h-4" /> Invite User
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
      ) : (
        <>
          <div className="rounded-lg overflow-hidden mb-6"
            style={{ border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--bg-raised)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Active Users ({data?.users?.length || 0})
              </p>
            </div>
            {!data?.users?.length ? (
              <div className="flex flex-col items-center py-10 gap-2">
                <UsersIcon className="w-8 h-8" style={{ color: 'var(--border-strong)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No users yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                    {['Name', 'Email', 'Role', 'Status', 'Last Active', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < data.users.length - 1 ? '1px solid var(--border-default)' : 'none' }}>
                      <td className="px-4 py-3 font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{u.name}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                      <td className="px-4 py-3">
                        {isAdmin && u.id !== user?.sub ? (
                          <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                            disabled={!!patching} className="h-7 px-2 rounded text-xs"
                            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: ROLE_COLOR[u.role] || 'var(--text-primary)' }}>
                            <option value="admin">admin</option>
                            <option value="seo">seo</option>
                            <option value="readonly">readonly</option>
                          </select>
                        ) : (
                          <span className="text-xs capitalize" style={{ color: ROLE_COLOR[u.role] || 'var(--text-muted)' }}>{u.role}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs"
                          style={{ color: u.status === 'active' ? 'var(--severity-pass)' : 'var(--text-muted)' }}>
                          {u.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && u.id !== user?.sub && (
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleStatusToggle(u)} disabled={!!patching}
                              title={u.status === 'active' ? 'Deactivate' : 'Activate'}
                              className="w-6 h-6 flex items-center justify-center rounded"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--brand)'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                              {patching === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pencil className="w-3 h-3" />}
                            </button>
                            <button onClick={() => handleDelete(u)} disabled={!!deleting}
                              title="Delete" className="w-6 h-6 flex items-center justify-center rounded"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--severity-critical-bg)'; e.currentTarget.style.color = 'var(--severity-critical-text)'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                              {deleting === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data?.invites?.length > 0 && (
            <div className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--bg-raised)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Pending Invites ({data.invites.length})
                </p>
              </div>
              {data.invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{inv.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs capitalize" style={{ color: ROLE_COLOR[inv.role] || 'var(--text-muted)' }}>{inv.role}</span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--severity-warning)' }}>
                      <Clock className="w-3 h-3" />
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showInvite && (
        <InviteModal
          companyId={targetCompanyId}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); load(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove `Users` from stubs.jsx**

Delete:
```js
export function Users()            { return <Stub title="Users"              description="Manage team members and pending invites." />; }
```

- [ ] **Step 3: Update router.jsx**

Add:
```js
import { Users } from './pages/Users.jsx';
```
Remove `Users` from stubs destructure.

- [ ] **Step 4: Verify the page works**

Navigate to `/users`. Verify table renders, invite modal shows invite URL, role selector works.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Users.jsx frontend/src/pages/stubs.jsx frontend/src/router.jsx
git commit -m "feat(users): real Users page with invite, role change, deactivate, delete"
```

---

### Task 11: Update PRD.md

- [ ] **Step 1: Update Phase 2 status**

Find the Phase 2 section and mark it COMPLETE. Add impersonation feature:
- `POST /api/auth/impersonate` — superadmin-only, issues JWT with `impersonated_by` claim, logs audit event
- `POST /api/auth/impersonate/end` — restores original superadmin session
- Impersonation banner in header with End Session button
- `user.impersonate` + `user.impersonate_end` in audit log

- [ ] **Step 2: Update Phase 3 status**

Mark Phase 3 COMPLETE. Add:
- Migration 012: `company_settings` (key-value per company) + `company_oauth_tokens` (GSC/GA4 tokens per company)
- `GET/PUT /api/settings` — per-company settings, superadmin global settings
- `GET/POST/DELETE /api/gsc/*` — GSC OAuth per company
- `GET/POST/DELETE /api/ga4/*` — GA4 OAuth per company
- Real Settings page (tabs: Integrations/GSC/GA4/SMTP/Global)
- Real Users page (invite, role change, deactivate, delete)

- [ ] **Step 3: Commit**

```bash
git add PRD.md
git commit -m "docs(prd): Phase 2 and Phase 3 marked complete"
```

---

## Self-Review

### Spec coverage
- [x] Impersonation: backend endpoints, frontend button, banner, audit log, end session
- [x] `company_settings` table (migration 012)
- [x] `company_oauth_tokens` table (migration 012)
- [x] Per-company settings API (GET/PUT with key whitelist)
- [x] GSC OAuth per company (auth, callback, status, disconnect, properties)
- [x] GA4 OAuth per company (auth, callback, status, disconnect, properties)
- [x] Slack webhook + Linear API key in settings
- [x] SMTP config in settings
- [x] Global Anthropic key — superadmin-only tab
- [x] Real Settings page with 5 tabs
- [x] Real Users page with full CRUD
- [x] PRD updated

### Naming consistency
- `impersonated_by` — consistent across JWT payload, AuthContext, banner, backend
- `resolveCompanyId(req)` helper — identical in gsc.js and ga4.js
- `requireRole('admin', 'superadmin')` — matches existing pattern in auth.js / companies.js
- `logAction(req.user, { ... })` — matches audit-log.service.js signature exactly
- `db.prepare(...).run()` — used instead of `db.exec()` to keep single-statement DDL readable

### Edge cases handled
- Impersonating self → 400
- Impersonating inactive user → 400
- Impersonating superadmin → 400
- GSC/GA4 callback OAuth error → redirect to /settings?provider_error=...
- Settings PUT with unknown keys → silently ignored (ALLOWED_COMPANY_KEYS whitelist)
- Users page without a selected company (superadmin) → prompt to select one
- Impersonate/end with no `impersonated_by` → 400
- Impersonate/end with missing superadmin → clear cookie + 401 (force re-login)
