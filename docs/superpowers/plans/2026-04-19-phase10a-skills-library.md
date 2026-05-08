# Phase 10a — Skills Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a platform-wide AI instruction layer (Skills Library) that automatically injects configurable skill instructions into all AI prompts — both audit check suggestions and (later) content pipeline steps.

**Architecture:** A single `content_skills` DB table (migration `017`) stores skills scoped to either a company or the whole platform (global). The existing `POST /api/ai/suggest` route is updated to load relevant skills by audit category and prepend them to the Claude system prompt. A new `/api/skills` route handles CRUD with role-gated access. Eight global skills are pre-seeded from the existing audit knowledge base. A new `/skills` frontend page lets admins manage their skill library with a two-column layout (list left, editor right).

**Tech Stack:** Node.js + Express + better-sqlite3 (synchronous API only), React 18 + Vite, Zod validation, Vitest + Supertest (tests), lucide-react icons, CSS custom properties (`var(--)` — no Tailwind color classes directly).

---

## File Structure

**Create:**
- `backend/db/migrations/017_skills_library.js` — `content_skills` table + indexes + seed 8 global skills
- `backend/routes/skills.js` — GET / POST / PATCH / DELETE `/api/skills`
- `backend/__tests__/skills.test.js` — route tests
- `frontend/src/pages/SkillsLibrary.jsx` — Skills Library page

**Modify:**
- `backend/server.js` — import and register `/api/skills`
- `backend/routes/ai.js` — load relevant skills and inject into system prompt
- `frontend/src/router.jsx` — add `/skills` route inside `RequireCompany`
- `frontend/src/components/Sidebar.jsx` — add CONTENT nav section with Skills Library link

---

### Task 1: DB Migration — content_skills table + seed

**Files:**
- Create: `backend/db/migrations/017_skills_library.js`

- [ ] **Step 1: Create the migration file**

```javascript
// backend/db/migrations/017_skills_library.js

export function up(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS content_skills (
      id                    TEXT PRIMARY KEY,
      company_id            TEXT REFERENCES companies(id) ON DELETE CASCADE,
      name                  TEXT NOT NULL,
      description           TEXT NOT NULL DEFAULT '',
      skill_type            TEXT NOT NULL CHECK(skill_type IN (
                              'writing_style','seo_rules','brand_voice',
                              'reference','tone','custom')),
      content               TEXT NOT NULL,
      applies_to_steps      TEXT,
      applies_to_categories TEXT,
      is_global             INTEGER NOT NULL DEFAULT 0,
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_by            TEXT,
      created_at            TIMESTAMP DEFAULT (datetime('now')),
      updated_at            TIMESTAMP DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_skills_company
    ON content_skills(company_id, is_active)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_skills_global
    ON content_skills(is_global, is_active)
  `).run();

  // Seed 8 global skills — idempotent: skip if already present
  const existing = db.prepare(
    `SELECT COUNT(*) AS cnt FROM content_skills WHERE is_global = 1`
  ).get();
  if (existing.cnt > 0) return;

  const insert = db.prepare(`
    INSERT INTO content_skills
      (id, company_id, name, description, skill_type, content,
       applies_to_steps, applies_to_categories, is_global, is_active, created_by)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 1, 1, NULL)
  `);

  const seedMany = db.transaction((skills) => {
    for (const s of skills) {
      insert.run(
        s.id, s.name, s.description, s.skill_type, s.content,
        s.steps, s.cats
      );
    }
  });

  seedMany([
    {
      id:          'skill-global-001',
      name:        'Title Tag Rules',
      description: 'SEO best practices for page title tags',
      skill_type:  'seo_rules',
      content:     'Title tags must be 30–60 characters. Include the primary keyword naturally. Make each title unique across all pages. Avoid keyword stuffing. Do not use dynamic parameters or special symbols. The title must accurately describe the page content.',
      steps:       JSON.stringify([4, 7]),
      cats:        JSON.stringify(['Title Tags']),
    },
    {
      id:          'skill-global-002',
      name:        'Meta Description Rules',
      description: 'SEO best practices for meta descriptions',
      skill_type:  'seo_rules',
      content:     'Meta descriptions must be 70–160 characters. Each page must have a unique meta description. Write for CTR — engaging and descriptive, not generic. Include the primary keyword naturally. Match the search intent. Avoid duplicates across pages.',
      steps:       JSON.stringify([4, 7]),
      cats:        JSON.stringify(['Meta Description']),
    },
    {
      id:          'skill-global-003',
      name:        'Heading Structure Rules',
      description: 'H1–H3 hierarchy and keyword placement rules',
      skill_type:  'seo_rules',
      content:     'Every indexable page must have exactly one visible H1 containing the primary keyword. H2 and H3 must follow a logical hierarchy — never skip levels. Use 3–7 H2 sections per page. Headings must reflect content structure, not be keyword-stuffed.',
      steps:       JSON.stringify([4, 5, 7]),
      cats:        JSON.stringify(['Headings']),
    },
    {
      id:          'skill-global-004',
      name:        'E-E-A-T Compliance Guidelines',
      description: 'Experience, Expertise, Authoritativeness, Trustworthiness signals',
      skill_type:  'seo_rules',
      content:     'Content must demonstrate E-E-A-T: include author credentials or expertise signals, cite authoritative sources for factual claims, use specific verifiable data, show first-hand experience where relevant. Do not publish content with unverified claims. YMYL topics require extra scrutiny.',
      steps:       JSON.stringify([4, 5, 7]),
      cats:        JSON.stringify(['Content']),
    },
    {
      id:          'skill-global-005',
      name:        'Keyword Density Rules',
      description: 'Primary and secondary keyword distribution guidelines',
      skill_type:  'seo_rules',
      content:     'Primary keyword density: 0.5%–3% of word count. Use primary keyword in first 100 words. Never exceed 3% — that is keyword stuffing. Use semantic variations throughout. Secondary keywords appear naturally. URL, title, H1, and body must all reference the primary keyword consistently.',
      steps:       JSON.stringify([5, 7]),
      cats:        JSON.stringify(['Content']),
    },
    {
      id:          'skill-global-006',
      name:        'Internal Linking Strategy',
      description: 'Hub-and-spoke internal linking structure',
      skill_type:  'seo_rules',
      content:     'Use contextual internal links within body content — not just footer or sidebar. Link hub pages from cluster pages and vice versa. Maximum 3 clicks from homepage to any important page. Use descriptive anchor text — avoid generic "click here". No orphan pages. Suggest 2–5 internal link opportunities per page.',
      steps:       JSON.stringify([5, 7]),
      cats:        JSON.stringify(['Internal Linking']),
    },
    {
      id:          'skill-global-007',
      name:        'Schema Markup Guidelines',
      description: 'JSON-LD structured data implementation rules',
      skill_type:  'seo_rules',
      content:     'Include JSON-LD schema appropriate to page type: Article for blog, Product for product pages, LocalBusiness for location pages, ItemList for category or comparison pages, WebPage for landing pages, FAQPage when a FAQ section is present. Schema must validate against Schema.org. Include all required properties for the chosen type.',
      steps:       JSON.stringify([7]),
      cats:        JSON.stringify(['Schema / Structured Data']),
    },
    {
      id:          'skill-global-008',
      name:        'AIO Content Quality Framework',
      description: 'AI Answer Engine Optimization for LLM visibility',
      skill_type:  'seo_rules',
      content:     'Optimise for AI Answer Engines (Google AI Overviews, ChatGPT, Perplexity). Write clear direct answers early in the content. Include FAQ sections with concise factual answers. Use well-labelled sections that can be extracted as standalone answers. Ensure robots.txt allows: GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, Google-Extended. Minimum 300 words for indexable content.',
      steps:       JSON.stringify([4, 5]),
      cats:        JSON.stringify(['LLM / AI Crawlers', 'Content']),
    },
  ]);
}
```

- [ ] **Step 2: Verify migration applies and skills are seeded**

```bash
cd /Users/a39326/Documents/Aakash/backend && node --input-type=module <<'EOF'
import db from './db/sqlite.js';
const rows = db.prepare('SELECT id, name, is_global FROM content_skills').all();
console.log('Skills seeded:', rows.length);
rows.forEach(r => console.log(' ', r.id, '-', r.name));
EOF
```

Expected output:
```
Skills seeded: 8
  skill-global-001 - Title Tag Rules
  skill-global-002 - Meta Description Rules
  skill-global-003 - Heading Structure Rules
  skill-global-004 - E-E-A-T Compliance Guidelines
  skill-global-005 - Keyword Density Rules
  skill-global-006 - Internal Linking Strategy
  skill-global-007 - Schema Markup Guidelines
  skill-global-008 - AIO Content Quality Framework
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/017_skills_library.js
git commit -m "feat(skills): migration 017 — content_skills table + 8 pre-seeded global skills"
```

---

### Task 2: Backend route — /api/skills CRUD

**Files:**
- Create: `backend/routes/skills.js`
- Create: `backend/__tests__/skills.test.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Write the failing tests**

```javascript
// backend/__tests__/skills.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'test-secret';

const adminCookie = `auth_token=${jwt.sign(
  { sub: 'u-admin', email: 'admin@test.com', role: 'admin', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
)}`;

const seoCookie = `auth_token=${jwt.sign(
  { sub: 'u-seo', email: 'seo@test.com', role: 'seo', company_id: 'company-test' },
  SECRET, { expiresIn: '1h' }
)}`;

const superCookie = `auth_token=${jwt.sign(
  { sub: 'u-super', email: 'super@test.com', role: 'superadmin', company_id: null },
  SECRET, { expiresIn: '1h' }
)}`;

describe('GET /api/skills', () => {
  it('returns global skills for seo role', async () => {
    const res = await request(app).get('/api/skills').set('Cookie', seoCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.skills)).toBe(true);
    const globals = res.body.skills.filter(s => s.is_global === 1);
    expect(globals.length).toBeGreaterThanOrEqual(8);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/skills');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/skills', () => {
  it('returns 403 for seo role', async () => {
    const res = await request(app)
      .post('/api/skills')
      .set('Cookie', seoCookie)
      .send({ name: 'Test', skill_type: 'custom', content: 'Do this.' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(app)
      .post('/api/skills')
      .set('Cookie', adminCookie)
      .send({ name: 'Incomplete', skill_type: 'custom' });
    expect(res.status).toBe(400);
  });

  it('returns 403 when admin tries to set is_global true', async () => {
    const res = await request(app)
      .post('/api/skills')
      .set('Cookie', adminCookie)
      .send({ name: 'Try Global', skill_type: 'seo_rules', content: 'Rule.', is_global: true });
    expect(res.status).toBe(403);
  });

  it('admin creates a company skill successfully', async () => {
    const res = await request(app)
      .post('/api/skills')
      .set('Cookie', adminCookie)
      .send({ name: 'Brand Voice Test', skill_type: 'brand_voice', content: 'Be friendly and concise.' });
    expect(res.status).toBe(201);
    expect(res.body.skill.name).toBe('Brand Voice Test');
    expect(res.body.skill.is_global).toBe(0);
    expect(res.body.skill.company_id).toBe('company-test');
  });
});

describe('PATCH /api/skills/:id', () => {
  it('returns 404 for non-existent skill', async () => {
    const res = await request(app)
      .patch('/api/skills/does-not-exist')
      .set('Cookie', adminCookie)
      .send({ is_active: false });
    expect(res.status).toBe(404);
  });

  it('returns 403 when admin tries to edit a global skill', async () => {
    const res = await request(app)
      .patch('/api/skills/skill-global-001')
      .set('Cookie', adminCookie)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when no fields provided', async () => {
    const res = await request(app)
      .patch('/api/skills/skill-global-001')
      .set('Cookie', superCookie)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/skills/:id', () => {
  it('returns 403 when deleting a pre-seeded global skill', async () => {
    const res = await request(app)
      .delete('/api/skills/skill-global-001')
      .set('Cookie', superCookie);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent skill', async () => {
    const res = await request(app)
      .delete('/api/skills/does-not-exist')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test -- skills.test
```

Expected: FAIL — `/api/skills` returns 404 (route not registered yet).

- [ ] **Step 3: Create `backend/routes/skills.js`**

```javascript
// backend/routes/skills.js
/**
 * @module routes/skills
 * Platform-wide AI instruction layer — CRUD for content_skills.
 * Global skills (is_global=1): superadmin only can create/edit/delete.
 * Company skills (is_global=0): admin or superadmin of that company.
 * All authed users can GET (view).
 */
import { Router }     from 'express';
import { randomUUID } from 'crypto';
import { z }          from 'zod';
import db             from '../db/sqlite.js';
import { requireRole }  from '../middleware/auth.js';
import { validate }     from '../middleware/validate.js';

const router = Router();

// ── GET /api/skills ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { role, company_id } = req.user;
  const targetCompanyId = role === 'superadmin'
    ? (req.query.company_id || null)
    : company_id;

  const skills = db.prepare(`
    SELECT id, company_id, name, description, skill_type, content,
           applies_to_steps, applies_to_categories, is_global, is_active,
           created_by, created_at, updated_at
    FROM content_skills
    WHERE is_global = 1
       OR (is_global = 0 AND company_id = ?)
    ORDER BY is_global DESC, skill_type, name
  `).all(targetCompanyId);

  res.json({ skills });
});

// ── POST /api/skills ──────────────────────────────────────────────────────────
const createSchema = z.object({
  name:                  z.string().min(1).max(200),
  skill_type:            z.enum(['writing_style','seo_rules','brand_voice','reference','tone','custom']),
  content:               z.string().min(1).max(10000),
  description:           z.string().max(500).optional().default(''),
  applies_to_steps:      z.array(z.number().int().min(1).max(8)).nullable().optional(),
  applies_to_categories: z.array(z.string()).nullable().optional(),
  is_global:             z.boolean().optional().default(false),
});

router.post('/', requireRole('admin', 'superadmin'), validate(createSchema), (req, res) => {
  const { role, company_id, sub: created_by } = req.user;
  const { name, skill_type, content, description,
          applies_to_steps, applies_to_categories, is_global } = req.body;

  if (is_global && role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can create global skills.' });
  }

  const id             = randomUUID();
  const skillCompanyId = is_global ? null : company_id;

  db.prepare(`
    INSERT INTO content_skills
      (id, company_id, name, description, skill_type, content,
       applies_to_steps, applies_to_categories, is_global, is_active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id, skillCompanyId, name, description, skill_type, content,
    applies_to_steps      ? JSON.stringify(applies_to_steps)      : null,
    applies_to_categories ? JSON.stringify(applies_to_categories) : null,
    is_global ? 1 : 0,
    created_by,
  );

  const skill = db.prepare('SELECT * FROM content_skills WHERE id = ?').get(id);
  res.status(201).json({ skill });
});

// ── PATCH /api/skills/:id ─────────────────────────────────────────────────────
const updateSchema = z.object({
  name:                  z.string().min(1).max(200).optional(),
  skill_type:            z.enum(['writing_style','seo_rules','brand_voice','reference','tone','custom']).optional(),
  content:               z.string().min(1).max(10000).optional(),
  description:           z.string().max(500).optional(),
  applies_to_steps:      z.array(z.number().int().min(1).max(8)).nullable().optional(),
  applies_to_categories: z.array(z.string()).nullable().optional(),
  is_active:             z.boolean().optional(),
});

router.patch('/:id', requireRole('admin', 'superadmin'), validate(updateSchema), (req, res) => {
  const { id }               = req.params;
  const { role, company_id } = req.user;

  const skill = db.prepare('SELECT * FROM content_skills WHERE id = ?').get(id);
  if (!skill) return res.status(404).json({ error: 'Skill not found.' });

  if (skill.is_global && role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can edit global skills.' });
  }
  if (!skill.is_global && role !== 'superadmin' && skill.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const { name, skill_type, content, description,
          applies_to_steps, applies_to_categories, is_active } = req.body;

  const updates = [];
  const values  = [];

  if (name        !== undefined) { updates.push('name = ?');        values.push(name); }
  if (skill_type  !== undefined) { updates.push('skill_type = ?');  values.push(skill_type); }
  if (content     !== undefined) { updates.push('content = ?');     values.push(content); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (is_active   !== undefined) { updates.push('is_active = ?');   values.push(is_active ? 1 : 0); }

  if ('applies_to_steps' in req.body) {
    updates.push('applies_to_steps = ?');
    values.push(applies_to_steps ? JSON.stringify(applies_to_steps) : null);
  }
  if ('applies_to_categories' in req.body) {
    updates.push('applies_to_categories = ?');
    values.push(applies_to_categories ? JSON.stringify(applies_to_categories) : null);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE content_skills SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM content_skills WHERE id = ?').get(id);
  res.json({ skill: updated });
});

// ── DELETE /api/skills/:id ────────────────────────────────────────────────────
router.delete('/:id', requireRole('admin', 'superadmin'), (req, res) => {
  const { id }               = req.params;
  const { role, company_id } = req.user;

  const skill = db.prepare('SELECT * FROM content_skills WHERE id = ?').get(id);
  if (!skill) return res.status(404).json({ error: 'Skill not found.' });

  // Pre-seeded global skills are identified by their fixed ID prefix — never deletable
  if (skill.id.startsWith('skill-global-')) {
    return res.status(403).json({ error: 'Pre-seeded platform skills cannot be deleted.' });
  }
  if (skill.is_global && role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can delete global skills.' });
  }
  if (!skill.is_global && role !== 'superadmin' && skill.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  db.prepare('DELETE FROM content_skills WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Register route in `backend/server.js`**

Find the existing AI route import (search for `import aiRouter`). Add immediately after it:

```javascript
import skillsRouter from './routes/skills.js';
```

Find the existing `app.use('/api/ai', aiRouter)` line. Add immediately after it:

```javascript
app.use('/api/skills', skillsRouter);
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd /Users/a39326/Documents/Aakash/backend && npm test -- skills.test
```

Expected: All 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/skills.js backend/__tests__/skills.test.js backend/server.js
git commit -m "feat(skills): /api/skills CRUD with role-gated access (admin/superadmin write, all read)"
```

---

### Task 3: Inject skills into audit AI suggestions

**Files:**
- Modify: `backend/routes/ai.js`

The audit check's category (from `audit_checks.category`) is used to match skills. Skills with `applies_to_categories IS NULL` apply to all checks. Skills with a JSON array apply only when the check's category appears in that array.

- [ ] **Step 1: Add skill loading after the audit check fetch**

Open `backend/routes/ai.js`. Find the comment `// 3. Fetch matching audit check` block (around line 55). After that block ends (after the `db.prepare(...).get(result.issue_type)` line), add:

```javascript
  // 3b. Load active skills relevant to this audit category
  const checkCategory = check?.category || result.section || '';
  const activeSkills = db.prepare(`
    SELECT content FROM content_skills
    WHERE is_active = 1
      AND (is_global = 1 OR company_id = ?)
      AND (
        applies_to_categories IS NULL
        OR applies_to_categories LIKE ?
      )
    ORDER BY is_global DESC, name
  `).all(result.company_id, `%"${checkCategory}"%`);
```

- [ ] **Step 2: Replace the hardcoded system prompt string**

Find the `client.messages.stream({` call in the same file. Find the line:

```javascript
      system: 'You are an SEO expert reviewing a specific page issue found by an automated audit.',
```

Replace it with:

```javascript
      system: (() => {
        let s = 'You are an SEO expert reviewing a specific page issue found by an automated audit.';
        if (activeSkills.length > 0) {
          s += '\n\n## Platform Instructions\n' + activeSkills.map(sk => sk.content).join('\n\n');
        }
        return s;
      })(),
```

- [ ] **Step 3: Verify the DB query returns skills correctly**

```bash
cd /Users/a39326/Documents/Aakash/backend && node --input-type=module <<'EOF'
import db from './db/sqlite.js';
// Simulate what the route does for a "Content" category check
const category = 'Content';
const companyId = 'any-company-id';
const skills = db.prepare(`
  SELECT content FROM content_skills
  WHERE is_active = 1
    AND (is_global = 1 OR company_id = ?)
    AND (applies_to_categories IS NULL OR applies_to_categories LIKE ?)
  ORDER BY is_global DESC, name
`).all(companyId, `%"${category}"%`);
console.log('Skills for Content category:', skills.length);
skills.forEach((s, i) => console.log(i + 1, s.content.slice(0, 60) + '...'));
EOF
```

Expected: Prints 3 skills (E-E-A-T Guidelines, Keyword Density Rules, AIO Content Quality Framework — all have 'Content' in their categories).

- [ ] **Step 4: Commit**

```bash
git add backend/routes/ai.js
git commit -m "feat(skills): inject active skills into audit AI suggestion system prompt"
```

---

### Task 4: Frontend — SkillsLibrary page

**Files:**
- Create: `frontend/src/pages/SkillsLibrary.jsx`

- [ ] **Step 1: Create the page**

```jsx
// frontend/src/pages/SkillsLibrary.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Globe, ToggleLeft, ToggleRight,
  Trash2, Loader2, Check, X,
} from 'lucide-react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

const SKILL_TYPES = ['writing_style','seo_rules','brand_voice','reference','tone','custom'];

const SKILL_TYPE_LABELS = {
  writing_style: 'Writing Style',
  seo_rules:     'SEO Rules',
  brand_voice:   'Brand Voice',
  reference:     'Reference',
  tone:          'Tone',
  custom:        'Custom',
};

const AUDIT_CATEGORIES = [
  'Response Codes','Canonical','Robots / Indexability','Sitemap','URL Structure',
  'Title Tags','Meta Description','Headings','Internal Linking','Images',
  'Schema / Structured Data','Content','Speed & Performance','Mobile SEO',
  'JavaScript Rendering','International SEO','Rankings & Traffic Drops',
  'Monitoring & Operations','LLM / AI Crawlers',
];

const PIPELINE_STEPS = [
  { n: 1, label: 'Keyword Expansion' },
  { n: 2, label: 'Funnel Mapping' },
  { n: 3, label: 'Intent Classification' },
  { n: 4, label: 'Content Brief' },
  { n: 5, label: 'Content Generation' },
  { n: 6, label: 'Trust Layer' },
  { n: 7, label: 'SEO Optimization' },
  { n: 8, label: 'Publish' },
];

const TYPE_COLORS = {
  writing_style: 'var(--brand)',
  seo_rules:     'var(--severity-info)',
  brand_voice:   'var(--severity-pass)',
  reference:     'var(--severity-warning)',
  tone:          '#8b5cf6',
  custom:        'var(--text-muted)',
};

const EMPTY_FORM = {
  name: '', skill_type: 'custom', content: '', description: '',
  applies_to_steps: null, applies_to_categories: null, is_global: false,
};

function TypeBadge({ type }) {
  const color = TYPE_COLORS[type] || 'var(--text-muted)';
  return (
    <span className="px-1.5 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}>
      {SKILL_TYPE_LABELS[type] || type}
    </span>
  );
}

function SkillRow({ skill, selected, onSelect, onToggle, onDelete, canEdit }) {
  const isPreSeeded = skill.id.startsWith('skill-global-');

  return (
    <button
      onClick={() => onSelect(skill)}
      className="w-full text-left px-3 py-2.5 rounded-md transition-colors"
      style={{
        backgroundColor: selected ? 'var(--brand-subtle)' : 'transparent',
        border: selected ? '1px solid var(--brand)' : '1px solid transparent',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {skill.name}
            </span>
            {skill.is_global === 1 && (
              <Globe className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <TypeBadge type={skill.skill_type} />
            {skill.description ? (
              <span className="text-xs truncate" style={{ color: 'var(--text-muted)', maxWidth: '120px' }}>
                {skill.description}
              </span>
            ) : null}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onToggle(skill)}
              title={skill.is_active ? 'Disable skill' : 'Enable skill'}
              style={{ color: skill.is_active ? 'var(--severity-pass)' : 'var(--text-muted)' }}
            >
              {skill.is_active
                ? <ToggleRight className="w-4 h-4" />
                : <ToggleLeft  className="w-4 h-4" />}
            </button>
            {!isPreSeeded && (
              <button
                onClick={() => onDelete(skill)}
                title="Delete skill"
                style={{ color: 'var(--severity-critical-text)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function SkillEditor({ skill, onSave, onCancel, isSuperadmin }) {
  const isGlobalReadOnly = skill?.is_global === 1 && !isSuperadmin;

  const [form, setForm] = useState(() => skill ? {
    name:                  skill.name,
    skill_type:            skill.skill_type,
    content:               skill.content,
    description:           skill.description || '',
    applies_to_steps:      skill.applies_to_steps
                             ? JSON.parse(skill.applies_to_steps) : null,
    applies_to_categories: skill.applies_to_categories
                             ? JSON.parse(skill.applies_to_categories) : null,
    is_global:             skill.is_global === 1,
  } : { ...EMPTY_FORM });

  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  function toggleStep(n) {
    const current = form.applies_to_steps || [];
    const next    = current.includes(n)
      ? current.filter(x => x !== n)
      : [...current, n].sort((a, b) => a - b);
    setForm(f => ({ ...f, applies_to_steps: next.length ? next : null }));
  }

  function toggleCategory(cat) {
    const current = form.applies_to_categories || [];
    const next    = current.includes(cat)
      ? current.filter(x => x !== cat)
      : [...current, cat].sort();
    setForm(f => ({ ...f, applies_to_categories: next.length ? next : null }));
  }

  async function handleSave() {
    if (!form.name.trim())    { setMsg('Name is required.');    return; }
    if (!form.content.trim()) { setMsg('Content is required.'); return; }
    setSaving(true);
    setMsg('');
    try {
      await onSave(form);
    } catch (e) {
      setMsg('Error: ' + (e?.response?.data?.error || 'Save failed.'));
      setSaving(false);
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-raised)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
  };
  const focusOn  = e => { if (!isGlobalReadOnly) e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'; };
  const focusOff = e => { e.currentTarget.style.boxShadow = ''; };

  return (
    <div className="flex flex-col gap-4">
      {isGlobalReadOnly && (
        <div className="px-3 py-2 rounded-md text-xs"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
          Platform skill — read only. Only superadmin can edit global skills.
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label>
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          disabled={isGlobalReadOnly}
          className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
          style={inputStyle}
          onFocus={focusOn} onBlur={focusOff}
        />
      </div>

      {/* Skill Type */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
        <select
          value={form.skill_type}
          onChange={e => setForm(f => ({ ...f, skill_type: e.target.value }))}
          disabled={isGlobalReadOnly}
          className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
          style={inputStyle}
        >
          {SKILL_TYPES.map(t => (
            <option key={t} value={t}>{SKILL_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
        <input
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          disabled={isGlobalReadOnly}
          placeholder="One-line summary (shown in the list)"
          className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
          style={inputStyle}
          onFocus={focusOn} onBlur={focusOff}
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Instruction Content *{' '}
          <span style={{ color: 'var(--text-muted)' }}>(injected into AI prompts)</span>
        </label>
        <textarea
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          disabled={isGlobalReadOnly}
          rows={6}
          className="w-full px-3 py-2 rounded-md text-sm focus:outline-none resize-none"
          style={inputStyle}
          onFocus={focusOn} onBlur={focusOff}
        />
      </div>

      {/* Applies to Pipeline Steps */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Applies to Pipeline Steps{' '}
          <span style={{ color: 'var(--text-muted)' }}>(blank = all steps)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PIPELINE_STEPS.map(({ n, label }) => {
            const active = (form.applies_to_steps || []).includes(n);
            return (
              <button
                key={n}
                disabled={isGlobalReadOnly}
                onClick={() => toggleStep(n)}
                className="px-2 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--brand)' : 'var(--bg-raised)',
                  color:           active ? 'var(--brand-fg,#fff)' : 'var(--text-secondary)',
                  border:          `1px solid ${active ? 'var(--brand)' : 'var(--border-default)'}`,
                }}
              >
                {n} · {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Applies to Audit Categories */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Applies to Audit Categories{' '}
          <span style={{ color: 'var(--text-muted)' }}>(blank = all categories)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AUDIT_CATEGORIES.map(cat => {
            const active = (form.applies_to_categories || []).includes(cat);
            return (
              <button
                key={cat}
                disabled={isGlobalReadOnly}
                onClick={() => toggleCategory(cat)}
                className="px-2 py-1 rounded text-xs transition-colors"
                style={{
                  backgroundColor: active ? 'var(--brand-subtle)' : 'var(--bg-raised)',
                  color:           active ? 'var(--brand-text)'   : 'var(--text-secondary)',
                  border:          `1px solid ${active ? 'var(--brand)' : 'var(--border-default)'}`,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Is Global — superadmin creating a new skill only */}
      {isSuperadmin && !skill && (
        <label className="flex items-center gap-2 text-xs cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={form.is_global}
            onChange={e => setForm(f => ({ ...f, is_global: e.target.checked }))}
          />
          Platform skill — visible to all companies, only superadmin can edit
        </label>
      )}

      {/* Actions */}
      {!isGlobalReadOnly && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 h-8 px-4 rounded-md text-xs font-semibold"
            style={{
              backgroundColor: 'var(--brand)',
              color: 'var(--brand-fg,#fff)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Check   className="w-3 h-3" />}
            {skill ? 'Save Changes' : 'Create Skill'}
          </button>

          <button
            onClick={onCancel}
            className="h-8 px-3 rounded-md text-xs"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
          >
            Cancel
          </button>

          {msg && (
            <p className="text-xs"
              style={{ color: msg.startsWith('Error') ? 'var(--severity-critical-text)' : 'var(--severity-pass)' }}>
              {msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SkillsLibrary() {
  const { user }                       = useAuth();
  const [skills,   setSkills]          = useState([]);
  const [loading,  setLoading]         = useState(true);
  const [filter,   setFilter]          = useState('all');
  const [selected, setSelected]        = useState(null);
  const [creating, setCreating]        = useState(false);

  const isSuperadmin = user?.role === 'superadmin';
  const canEdit      = user?.role === 'admin' || isSuperadmin;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/skills');
      setSkills(data.skills);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs     = ['all', ...SKILL_TYPES];
  const filtered = filter === 'all' ? skills : skills.filter(s => s.skill_type === filter);

  async function handleToggle(skill) {
    await api.patch(`/skills/${skill.id}`, { is_active: !skill.is_active });
    const next = s => s.id === skill.id ? { ...s, is_active: s.is_active ? 0 : 1 } : s;
    setSkills(prev => prev.map(next));
    if (selected?.id === skill.id) setSelected(prev => next(prev));
  }

  async function handleDelete(skill) {
    if (!window.confirm(`Delete "${skill.name}"? This cannot be undone.`)) return;
    await api.delete(`/skills/${skill.id}`);
    setSkills(prev => prev.filter(s => s.id !== skill.id));
    if (selected?.id === skill.id) setSelected(null);
  }

  async function handleSave(form) {
    if (selected && !creating) {
      const { data } = await api.patch(`/skills/${selected.id}`, form);
      setSkills(prev => prev.map(s => s.id === selected.id ? data.skill : s));
      setSelected(data.skill);
    } else {
      const { data } = await api.post('/skills', form);
      setSkills(prev => [...prev, data.skill]);
      setSelected(data.skill);
      setCreating(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}>
            <BookOpen className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            Skills Library
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Instructions automatically injected into AI prompts across the platform
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setCreating(true); setSelected(null); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold"
            style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-fg,#fff)' }}
          >
            <Plus className="w-3.5 h-3.5" /> New Skill
          </button>
        )}
      </div>

      <div className="flex gap-6" style={{ minHeight: '60vh' }}>
        {/* Left: list */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          {/* Type filter tabs */}
          <div className="flex flex-wrap gap-1">
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: filter === t ? 'var(--brand)' : 'var(--bg-raised)',
                  color:           filter === t ? 'var(--brand-fg,#fff)' : 'var(--text-secondary)',
                }}
              >
                {t === 'all' ? 'All' : SKILL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Skill list */}
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs"
              style={{ color: 'var(--text-muted)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading skills...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs py-4" style={{ color: 'var(--text-muted)' }}>
              No skills in this category.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map(skill => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  selected={selected?.id === skill.id && !creating}
                  onSelect={s => { setSelected(s); setCreating(false); }}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  canEdit={canEdit && (isSuperadmin || !skill.is_global)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: detail / editor panel */}
        <div className="flex-1 rounded-lg p-5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
          {creating ? (
            <>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                New Skill
              </h2>
              <SkillEditor
                skill={null}
                onSave={handleSave}
                onCancel={() => setCreating(false)}
                isSuperadmin={isSuperadmin}
              />
            </>
          ) : selected ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {selected.name}
                </h2>
                {selected.is_global === 1 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                    <Globe className="w-3 h-3" /> Platform
                  </span>
                )}
              </div>
              <SkillEditor
                skill={selected}
                onSave={handleSave}
                onCancel={() => setSelected(null)}
                isSuperadmin={isSuperadmin}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-16"
              style={{ color: 'var(--text-muted)' }}>
              <BookOpen className="w-8 h-8" />
              <p className="text-sm">Select a skill to view or edit</p>
              {canEdit && (
                <p className="text-xs">or click "New Skill" to create one</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/SkillsLibrary.jsx
git commit -m "feat(skills): SkillsLibrary page — two-column layout, type filter, CRUD, platform badge"
```

---

### Task 5: Wire router + sidebar

**Files:**
- Modify: `frontend/src/router.jsx`
- Modify: `frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: Add import + route in `frontend/src/router.jsx`**

Add to the imports block (after the existing page imports):

```javascript
import { SkillsLibrary } from './pages/SkillsLibrary.jsx';
```

Inside the `RequireCompany` children array (add after the `{ path: '/exports', ... }` line):

```javascript
          { path: '/skills', element: <SkillsLibrary /> },
```

- [ ] **Step 2: Add CONTENT section + icon import in `frontend/src/components/Sidebar.jsx`**

Find the import line for lucide-react icons at the top. Add `BookOpen` to the existing import (it is not yet imported):

```javascript
import {
  LayoutDashboard, Code2, TrendingUp, Globe, Activity,
  Heart, FolderKanban, Gauge, FileCode2, FileText,
  List, FileOutput, Calendar, Bell, Plug,
  Stethoscope, Users, Settings, ChevronLeft, ChevronRight,
  Building2, ClipboardList, BarChart3, GitCompareArrows,
  BookOpen,
} from 'lucide-react';
```

In the `NAV_SECTIONS` array, add the CONTENT section between WORKFLOW and SYSTEM:

```javascript
  {
    label: 'CONTENT',
    items: [
      { label: 'Skills Library', icon: BookOpen, path: '/skills' },
    ],
  },
```

- [ ] **Step 3: Start dev server and verify**

```bash
cd /Users/a39326/Documents/Aakash && npm run dev
```

Open `http://localhost:5173/skills` in the browser.

Verify:
1. Page loads without errors
2. Left panel shows 8 pre-seeded global skills with Platform globe icon
3. Type filter tabs (All, SEO Rules, etc.) filter the list correctly
4. Clicking a skill opens the editor panel on the right
5. Global skill editor shows "read only" notice for admin users
6. "New Skill" button visible for admin
7. Creating a new company skill works (fills form, submit, skill appears in list)
8. Active toggle works (toggles 0/1, color changes)
9. Sidebar shows CONTENT section with "Skills Library" link

- [ ] **Step 4: Commit**

```bash
git add frontend/src/router.jsx frontend/src/components/Sidebar.jsx
git commit -m "feat(skills): wire /skills route and add CONTENT nav section to sidebar"
```

---

## Self-Review

**1. Spec coverage:**

| Requirement (from PRD Phase 10a) | Task |
|---|---|
| `content_skills` table with all columns | Task 1 |
| `idx_skills_company` and `idx_skills_global` indexes | Task 1 |
| 8 pre-seeded global skills (idempotent seed) | Task 1 |
| `GET /api/skills` — returns global + company skills | Task 2 |
| `POST /api/skills` — admin/superadmin only | Task 2 |
| `is_global = true` requires superadmin | Task 2 |
| `PATCH /api/skills/:id` — admin blocked from editing global | Task 2 |
| `DELETE /api/skills/:id` — pre-seeded skills protected | Task 2 |
| seo role: 403 on POST | Task 2 (test + route) |
| Skills injected into `POST /api/ai/suggest` by category match | Task 3 |
| Global + company skills both loaded | Task 3 |
| Skills with null categories apply to all checks | Task 3 |
| `/skills` page — two-column layout | Task 4 |
| Type filter tabs (All + 6 types) | Task 4 |
| Active toggle per skill | Task 4 |
| Platform badge on global skills | Task 4 |
| Read-only view for non-superadmin on global skills | Task 4 |
| Create new skill form | Task 4 |
| Applies-to-steps multi-select (8 steps) | Task 4 |
| Applies-to-categories multi-select (19 categories) | Task 4 |
| Is-global checkbox for superadmin only | Task 4 |
| Sidebar CONTENT section | Task 5 |
| `/skills` route wired | Task 5 |

**2. Placeholder scan:** No TBDs, TODOs, or "handle edge cases" statements found. Every code block is complete and executable.

**3. Type consistency:**
- `skill.is_global` is `INTEGER` (0 or 1) from SQLite — compared as `=== 1` in JSX, not `=== true`
- `applies_to_steps` and `applies_to_categories` stored as JSON strings in DB — `JSON.parse()` called in frontend when populating edit form
- Route returns raw SQLite rows — frontend handles string-to-array conversion
- `created_by` uses `req.user.sub` (matches JWT payload shape `{ sub, email, name, role, company_id }`)
- `requireRole('admin', 'superadmin')` signature matches how it is used in `settings.js`
