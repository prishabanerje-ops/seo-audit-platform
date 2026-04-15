# AIO — AI Answer Engine Optimization Features Plan

> Reference app: https://grievance-insight-engine-production.up.railway.app/
> Stack: React + Vite + Tailwind + Node.js on Railway
> Goal: Replicate all functionality inside the existing SEO Audit Platform

---

## What We Are Replicating

The reference app has two core audit tools plus supporting features:

| Tool | Description |
|---|---|
| AEO Audit | Audits a URL for AI Answer Engine Optimization — checks robots.txt bot access, structured data, schema, crawlability, content quality, technical SEO |
| Page Resource Audit | Scans a page's JS/CSS/font resources — classifies each as critical / deferrable / safe to block / removable, estimates CWV impact |
| AEO Strategy Assistant | Conversational chat UI powered by Claude AI for AEO strategy advice |
| Score Breakdown | Category scores — AI Bot Access, Content Quality, Technical SEO, Schema Markup, Crawlability |
| Email Report | Send audit report via email |
| Competitor Comparison | Run audits on multiple URLs and diff the results |
| Bulk URL Scanning | Scan multiple URLs in one job |

---

## Gap Analysis vs Current Platform

| Feature | Already Built? | Gap |
|---|---|---|
| AEO bot access checks (GPTBot, ClaudeBot, PerplexityBot, Bingbot, Bytespider) | Partial | Need per-bot robots.txt parsing |
| llms.txt detection | No | New check |
| Schema / Structured Data checks | Yes (11 checks) | No gap |
| Technical SEO scoring | Yes | No gap |
| Page Resource Audit (JS/CSS per-resource classification) | No | New feature |
| CWV impact per resource | Partial | PSI gives page-level only, not per-resource |
| AEO Strategy Chat Assistant | No | New page — conversational Claude UI |
| Email report | Yes (SMTP in settings) | No gap |
| Score breakdown by category | Yes | No gap |
| Competitor Comparison | No | New feature |
| Bulk URL scanning | Yes | No gap |
| Auth (Login/Signup) | Yes | No gap |
| Stripe / Pricing tiers | No | Out of scope unless needed |

---

## Implementation Plan

### Phase 1 — AEO Audit Checks (New Audit Category)

Add a new audit category `AEO & AI Visibility` to the existing check registry.

**New checks to add:**

| Check | How to Implement |
|---|---|
| GPTBot allowed in robots.txt | Fetch `/robots.txt`, parse user-agent rules for `GPTBot` |
| ClaudeBot allowed in robots.txt | Parse user-agent rules for `ClaudeBot` / `anthropic-ai` |
| PerplexityBot allowed in robots.txt | Parse user-agent rules for `PerplexityBot` |
| Bingbot allowed in robots.txt | Parse user-agent rules for `Bingbot` |
| Bytespider allowed in robots.txt | Parse user-agent rules for `Bytespider` |
| Googlebot allowed in robots.txt | Parse user-agent rules for `Googlebot` |
| llms.txt file present | Fetch `domain/llms.txt`, check if exists and is valid |
| JSON-LD structured data present | DOM extraction — check for `<script type="application/ld+json">` |
| Schema types appropriate for page type | Validate schema @type matches page intent |
| OG tags present | Check `og:title`, `og:description`, `og:image` |
| Twitter/X card tags present | Check `twitter:card`, `twitter:title` |
| Canonical tag present | Already exists — link to existing check |
| Page indexable by AI bots | Cross-check noindex + robots rules |
| Content-to-template ratio | Measure text content vs boilerplate |
| FAQ schema present | Check for FAQPage schema (boosts AI citation chance) |

**Files to modify:**
- `backend/db/seed/audit-checks.js` — add new checks
- `backend/services/aeo.service.js` — new service to fetch + parse robots.txt, llms.txt, DOM
- `backend/routes/aeo.js` — new route `POST /api/aeo/audit`
- `frontend/src/pages/AEOAudit.jsx` — new page
- `frontend/src/components/AEOScore.jsx` — score breakdown component

---

### Phase 2 — Page Resource Audit

A standalone tool (not tied to a crawl job) that takes a URL, fetches the page, and classifies all JS/CSS/font resources.

**Classification logic:**

| Label | Criteria |
|---|---|
| Critical | Render-blocking, in `<head>`, no `defer`/`async` |
| Deferrable | In `<head>` but could have `defer`/`async` |
| Safe to Block | Third-party, non-essential (analytics, ads, social widgets) |
| Removable | Unused, duplicate, or very small third-party scripts |

**Known third-party categories to detect:**
- Analytics: Google Analytics, GTM, Hotjar, Mixpanel
- Ads: DoubleClick, AdSense, Outbrain
- Social: Facebook Pixel, Twitter widget, LinkedIn
- Fonts: Google Fonts, Typekit
- CDN libs: jQuery, Lodash (flag if bundled separately)

**CWV Impact mapping:**
- Render-blocking JS → LCP impact
- Layout-shifting resources → CLS impact
- Large images / unoptimized fonts → LCP + CLS

**Files to create:**
- `backend/services/resource-audit.service.js` — fetch page, parse `<script>` + `<link>` tags, classify
- `backend/routes/resource-audit.js` — `POST /api/resource-audit`
- `frontend/src/pages/ResourceAudit.jsx` — new page
- `frontend/src/components/ResourceTable.jsx` — sortable table with verdict badges

---

### Phase 3 — AEO Strategy Chat Assistant

A dedicated chat interface using the existing Claude AI integration (SSE streaming).

- Conversational UI — not per-issue like current AI recommendations
- System prompt focused on AEO / AI search visibility strategy
- Context-aware: pass current audit results as context to Claude
- Persistent chat history per session (store in `ai_suggestions` table or new `chat_sessions` table)

**Files to create:**
- `frontend/src/pages/AEOChat.jsx` — chat UI with message thread
- `backend/routes/aeo-chat.js` — `POST /api/aeo/chat` (SSE streaming)
- Update `backend/services/ai.service.js` — add AEO chat system prompt

---

### Phase 4 — Competitor Comparison

Run AEO audits on 2–5 URLs and show a side-by-side diff of scores per category.

**Files to create:**
- `frontend/src/pages/CompetitorComparison.jsx`
- Reuse `aeo.service.js` — run audit for each URL, store results, diff scores

---

## Score Breakdown Categories (AEO Audit)

| Category | Weight | Checks |
|---|---|---|
| AI Bot Access | 30% | robots.txt rules for all major AI bots |
| Crawlability | 20% | indexability, canonical, noindex conflicts |
| Schema Markup | 20% | JSON-LD present, valid, appropriate type |
| Content Quality | 15% | content-to-template ratio, FAQ schema, word count |
| Technical SEO | 15% | OG tags, Twitter cards, canonical, page speed |

---

## Bot Reference List

| Bot | Company | User-Agent |
|---|---|---|
| GPTBot | OpenAI | `GPTBot` |
| ChatGPT-User | OpenAI | `ChatGPT-User` |
| OAI-SearchBot | OpenAI | `OAI-SearchBot` |
| ClaudeBot | Anthropic | `ClaudeBot` |
| anthropic-ai | Anthropic | `anthropic-ai` |
| PerplexityBot | Perplexity | `PerplexityBot` |
| Googlebot | Google | `Googlebot` |
| Google-Extended | Google (AI) | `Google-Extended` |
| Bingbot | Microsoft | `Bingbot` |
| Bytespider | ByteDance/TikTok | `Bytespider` |
| CCBot | Common Crawl | `CCBot` |
| FacebookBot | Meta | `FacebookBot` |
| Applebot | Apple | `Applebot` |

---

## Navigation Changes

Add to the existing sidebar under a new section `AIO / GEO`:

```
AIO / GEO
├── AEO Audit          → /aeo-audit
├── Resource Audit     → /resource-audit
├── AEO Chat           → /aeo-chat
└── Competitor Compare → /competitor-compare
```

---

## DB Changes Required

| Change | Type | Notes |
|---|---|---|
| New table `aeo_audits` | New migration | Store AEO audit results per URL |
| New table `resource_audits` | New migration | Store resource scan results per URL |
| New table `aeo_chat_sessions` | New migration | Store chat history |
| Add `aeo` category to `audit_checks` seed | Seed update | 15 new checks |

---

## Out of Scope (for now)

- Stripe / paid pricing tiers
- `llms.txt` auto-generation (detection only)
- Browser extension
- Scheduled AEO audits (can reuse existing `schedules` table later)

---

## Priority Order

1. Phase 1 — AEO Audit Checks (highest value, directly maps to existing architecture)
2. Phase 2 — Page Resource Audit (standalone, self-contained)
3. Phase 3 — AEO Strategy Chat (reuses existing AI infra)
4. Phase 4 — Competitor Comparison (depends on Phase 1)
