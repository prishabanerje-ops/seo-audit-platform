/**
 * @module routes/ai
 * Per-URL AI recommendations via Claude (SSE streaming + cache).
 */
import { Router }     from 'express';
import { randomUUID } from 'crypto';
import Anthropic      from '@anthropic-ai/sdk';
import db             from '../db/sqlite.js';
import { aiLimiter }  from '../middleware/rateLimiter.js';
import { requireRole } from '../middleware/auth.js';
import { getGlobalSetting } from '../services/secret-store.js';

const router = Router();

// Only users who can act on findings should call the AI endpoint.
// Readonly users view but cannot trigger paid Anthropic calls.
const AI_ROLES = ['admin', 'seo', 'superadmin'];

// ─── GET /api/ai/suggest?result_id=:id ───────────────────────────────────────
// Cache lookup — returns cached suggestion or { suggestion: null }
router.get('/suggest', (req, res) => {
  const { result_id } = req.query;
  if (!result_id) return res.status(400).json({ error: 'result_id is required' });

  const { role, company_id } = req.user;

  const row = db.prepare(`
    SELECT s.id, s.response_text AS suggestion, s.feedback
    FROM ai_suggestions s
    JOIN audit_results r ON r.id = s.result_id
    WHERE s.result_id = ?
      AND (? = 'superadmin' OR r.company_id = ?)
  `).get(result_id, role, company_id);

  if (!row) return res.json({ suggestion: null });
  res.json({ suggestion: row.suggestion, id: row.id, feedback: row.feedback });
});

// ─── POST /api/ai/suggest ─────────────────────────────────────────────────────
router.post('/suggest', requireRole(...AI_ROLES), aiLimiter, async (req, res) => {
  const { result_id } = req.body;
  if (!result_id) return res.status(400).json({ error: 'result_id is required' });

  const { company_id, role } = req.user;

  // 1. Fetch audit result
  const result = db.prepare(`
    SELECT id, url, issue_type, section, severity, data, company_id,
           crawl_job_id, site_id
    FROM audit_results WHERE id = ?
  `).get(result_id);
  if (!result) return res.status(404).json({ error: 'Result not found' });
  if (role !== 'superadmin' && result.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // 2. Cache fast-path
  const cached = db.prepare(`
    SELECT id, response_text AS suggestion
    FROM ai_suggestions WHERE result_id = ?
  `).get(result_id);
  if (cached) {
    return res.json({ cached: true, id: cached.id, suggestion: cached.suggestion });
  }

  // 3. Fetch matching audit check (by name = issue_type)
  const check = db.prepare(`
    SELECT id, name, description, seo_impact, implementation_rule
    FROM audit_checks WHERE name = ?
  `).get(result.issue_type);

  // 4. Resolve Anthropic API key (env overrides settings table; DB value is
  // auto-decrypted by the secret-store if it was written through setters).
  const apiKey = process.env.ANTHROPIC_API_KEY || getGlobalSetting('anthropic_api_key');
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI recommendations require an Anthropic API key. Configure it in Settings.',
    });
  }

  // 5. Parse detected data
  let parsedData;
  try {
    parsedData = JSON.parse(result.data);
  } catch {
    parsedData = result.data;
  }

  // 6. Build prompt
  const promptLines = [
    check ? `Issue type: ${check.name}` : `Issue type: ${result.issue_type}`,
  ];
  if (check?.description)         promptLines.push(`Description: ${check.description}`);
  if (check?.seo_impact)          promptLines.push(`Why it matters: ${check.seo_impact}`);
  if (check?.implementation_rule) promptLines.push(`How to fix: ${check.implementation_rule}`);
  promptLines.push('');
  promptLines.push(`Affected page URL: ${result.url}`);
  promptLines.push(`Detected data: ${JSON.stringify(parsedData)}`);
  promptLines.push('');
  promptLines.push('Give a concise, actionable recommendation (3–5 sentences) to fix this issue on this exact page.');
  promptLines.push('Use the detected data values — do not give generic advice.');
  const prompt = promptLines.join('\n');

  // ── Point of no return: SSE headers committed below — no further JSON errors possible ──
  // 7. Stream SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // prevent nginx buffering

  const client = new Anthropic({ apiKey });
  let fullText = '';

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are an SEO expert reviewing a specific page issue found by an automated audit.',
      messages: [{ role: 'user', content: prompt }],
    });

    // Abort Anthropic stream if client disconnects mid-stream
    req.on('close', () => { stream.abort?.(); });

    for await (const event of stream) {
      if (res.writableEnded) break; // client disconnected
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const text = event.delta.text;
        fullText += text;
        res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
    }

    if (!res.writableEnded) {
      // Persist to cache
      const suggestionId = randomUUID();
      db.prepare(`
        INSERT INTO ai_suggestions
          (id, result_id, check_id, job_id, site_id, section, response_text, company_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        suggestionId,
        result.id,
        check?.id || null,
        result.crawl_job_id,
        result.site_id,
        result.section,
        fullText,
        result.company_id,
      );

      res.write(`data: ${JSON.stringify({ type: 'done', id: suggestionId })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  }
});

// ─── POST /api/ai/suggest/:id/feedback ───────────────────────────────────────
router.post('/suggest/:id/feedback', requireRole(...AI_ROLES), (req, res) => {
  const { id } = req.params;
  const { value } = req.body;
  const { company_id, role } = req.user;

  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: 'value must be 1 (thumbs up) or -1 (thumbs down)' });
  }

  const suggestion = db.prepare(
    'SELECT id, company_id FROM ai_suggestions WHERE id = ?'
  ).get(id);
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' });
  if (role !== 'superadmin' && suggestion.company_id !== company_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare('UPDATE ai_suggestions SET feedback = ? WHERE id = ?').run(value, id);
  res.json({ ok: true });
});

export default router;
