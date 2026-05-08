# Integration Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all third-party integrations into a single Integration Hub page at `/integrations` and slim Settings down to SMTP + Anthropic key only.

**Architecture:** The new `Integrations.jsx` page owns all third-party connection UI (GSC, GA4, PSI, Slack, Linear, Ads, and 19 "Coming Soon" placeholders) organised under a tab strip by category. `Settings.jsx` loses its Integrations/GSC/GA4 tabs and becomes a flat two-section page (SMTP + optional Global). Two backend callback redirects change from `/settings` to `/integrations`.

**Tech Stack:** React 18, react-router v7 (`import from 'react-router'`), Axios API client, better-sqlite3 (sync), CSS custom properties (`var(--...)`), lucide-react icons.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `backend/routes/gsc.js` | Modify | 5 redirect URLs: `/settings` → `/integrations` |
| `backend/routes/ga4.js` | Modify | 5 redirect URLs: `/settings` → `/integrations` |
| `frontend/src/pages/Integrations.jsx` | **Create** | Full Integration Hub — catalog, cards, expand panels, tab strip |
| `frontend/src/pages/Settings.jsx` | Modify | Remove Integrations/GSC/GA4 tabs; flatten to SMTP + Global |
| `frontend/src/pages/stubs.jsx` | Modify | Remove `PaidAdsSection` and `Integrations` export |
| `frontend/src/router.jsx` | Modify | Import `Integrations` from `./pages/Integrations.jsx` |

---

## Task 1: Fix OAuth callback redirects in backend

**Files:**
- Modify: `backend/routes/gsc.js`
- Modify: `backend/routes/ga4.js`

No test to write — this is a URL string change. Verify manually after Task 3 lands.

- [ ] **Step 1: Update gsc.js — replace all `/settings` redirect targets**

In `backend/routes/gsc.js`, every `res.redirect` call currently points to `/settings`. Change all five to `/integrations`:

```js
// Line 46 — was: `${frontendUrl}/settings?gsc_error=...`
return res.redirect(`${frontendUrl}/integrations?gsc_error=${encodeURIComponent(oauthError)}`);

// Line 47 — was: `${frontendUrl}/settings?gsc_error=missing_params`
if (!code || !state) return res.redirect(`${frontendUrl}/integrations?gsc_error=missing_params`);

// Line 51 — was: `${frontendUrl}/settings?gsc_error=invalid_state`
return res.redirect(`${frontendUrl}/integrations?gsc_error=invalid_state`);

// Line 54 — was: `${frontendUrl}/settings?gsc_error=invalid_state`
return res.redirect(`${frontendUrl}/integrations?gsc_error=invalid_state`);

// Line 86 — was: `${frontendUrl}/settings?gsc_connected=1`
res.redirect(`${frontendUrl}/integrations?gsc_connected=1`);

// Line 89 — was: `${frontendUrl}/settings?gsc_error=token_exchange_failed`
res.redirect(`${frontendUrl}/integrations?gsc_error=token_exchange_failed`);
```

- [ ] **Step 2: Update ga4.js — same change**

In `backend/routes/ga4.js`, replace all six `/settings` occurrences with `/integrations` (same line structure as gsc.js, with `ga4_` prefix):

```js
// Line 46
return res.redirect(`${frontendUrl}/integrations?ga4_error=${encodeURIComponent(oauthError)}`);
// Line 47
if (!code || !state) return res.redirect(`${frontendUrl}/integrations?ga4_error=missing_params`);
// Line 51
return res.redirect(`${frontendUrl}/integrations?ga4_error=invalid_state`);
// Line 54
return res.redirect(`${frontendUrl}/integrations?ga4_error=invalid_state`);
// Line 86
res.redirect(`${frontendUrl}/integrations?ga4_connected=1`);
// Line 89
res.redirect(`${frontendUrl}/integrations?ga4_error=token_exchange_failed`);
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/gsc.js backend/routes/ga4.js
git commit -m "fix(oauth): redirect callbacks to /integrations instead of /settings"
```

---

## Task 2: Slim down Settings.jsx

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`

Replace the current file entirely. Keep `Field`, `Input`, `SaveBtn`, `StatusMsg`, `SmtpTab`, `GlobalTab`. Remove `IntegrationsTab`, `OAuthCard`, and the tab strip.

- [ ] **Step 1: Rewrite Settings.jsx**

Replace the entire file with:

```jsx
import { useState, useEffect } from 'react';
import { Settings2, Loader2 } from 'lucide-react';
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
    <p className="text-xs" style={{ color: isErr ? 'var(--severity-critical)' : 'var(--severity-pass)' }}>
      {msg}
    </p>
  );
}

function SectionHeading({ title, description }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
    </div>
  );
}

function SmtpSection({ companyId }) {
  const [form,   setForm]   = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '' });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const qs = companyId ? `?company_id=${companyId}` : '';
    api.get(`/settings${qs}`).then(r => {
      const s = r.data.settings || {};
      setForm({
        smtp_host: s.smtp_host || '',
        smtp_port: s.smtp_port || '587',
        smtp_user: s.smtp_user || '',
        smtp_pass: s.smtp_pass || '',
        smtp_from: s.smtp_from || '',
      });
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
    <div
      className="rounded-xl p-5 max-w-lg"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <SectionHeading title="Email Delivery (SMTP)" description="Used for notification emails sent from the platform." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="SMTP Host"><Input value={form.smtp_host} onChange={v => set('smtp_host', v)} placeholder="smtp.example.com" /></Field>
          <Field label="Port"><Input value={form.smtp_port} onChange={v => set('smtp_port', v)} placeholder="587" /></Field>
        </div>
        <Field label="Username"><Input value={form.smtp_user} onChange={v => set('smtp_user', v)} placeholder="user@example.com" /></Field>
        <Field label="Password"><Input type="password" value={form.smtp_pass} onChange={v => set('smtp_pass', v)} placeholder="••••••••" /></Field>
        <Field label="From Address"><Input value={form.smtp_from} onChange={v => set('smtp_from', v)} placeholder="SEO Platform <noreply@example.com>" /></Field>
        <div className="flex items-center gap-3"><SaveBtn saving={saving} onClick={save} /><StatusMsg msg={msg} /></div>
      </div>
    </div>
  );
}

function GlobalSection() {
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
    <div
      className="rounded-xl p-5 max-w-lg mt-5"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <SectionHeading title="Global (Superadmin)" description="Instance-wide settings applied to all companies." />
      <div className="space-y-4">
        <Field label="Anthropic API Key">
          <Input type="password" value={key} onChange={setKey} placeholder="sk-ant-..." />
        </Field>
        <div className="flex items-center gap-3"><SaveBtn saving={saving} onClick={save} /><StatusMsg msg={msg} /></div>
      </div>
    </div>
  );
}

export function Settings() {
  const { user, companyId, viewingCompanyId } = useAuth();
  const isSuperAdmin    = user?.role === 'superadmin';
  const activeCompanyId = isSuperAdmin ? viewingCompanyId : companyId;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings2 className="w-5 h-5" style={{ color: 'var(--brand)' }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Platform configuration — email delivery and AI settings.
          </p>
        </div>
      </div>
      <SmtpSection companyId={activeCompanyId} />
      {isSuperAdmin && <GlobalSection />}
    </div>
  );
}
```

- [ ] **Step 2: Verify the frontend compiles**

```bash
cd /Users/a39326/Documents/Aakash/frontend && npm run build 2>&1 | tail -5
```

Expected: no errors. If there are import errors, check that `Settings2` and `Loader2` are available from `lucide-react`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.jsx
git commit -m "refactor(settings): remove integration tabs, flatten to SMTP + Global sections"
```

---

## Task 3: Create Integrations.jsx — Integration Hub

**Files:**
- Create: `frontend/src/pages/Integrations.jsx`

This is the main task. The file contains the integration catalog, card component, expand panels for each integration type, tab filtering, and the page shell.

- [ ] **Step 1: Create the file with catalog and helpers**

Create `frontend/src/pages/Integrations.jsx` with this complete content:

```jsx
/**
 * Integrations — Integration Hub page.
 * All third-party service connections in one place.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, XCircle, Loader2, ExternalLink, ChevronDown, ChevronUp, Plug } from 'lucide-react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

// ── Catalog ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',           label: 'All'                    },
  { id: 'seo',           label: 'SEO Data'               },
  { id: 'analytics',     label: 'Analytics'              },
  { id: 'advertising',   label: 'Advertising'            },
  { id: 'crm',           label: 'CRM'                    },
  { id: 'communication', label: 'Communication'          },
  { id: 'developer',     label: 'Developer'              },
];

const CATEGORY_LABELS = {
  seo:           'SEO Data',
  analytics:     'Analytics',
  advertising:   'Advertising',
  crm:           'CRM',
  communication: 'Communication & Workflow',
  developer:     'Developer & Data',
};

// type: 'oauth' | 'apikey' | 'ads' | 'soon'
const INTEGRATIONS = [
  // SEO Data
  { id: 'gsc',          name: 'Google Search Console', desc: 'Index coverage, clicks, impressions, and ranking data.',            category: 'seo',           type: 'oauth',  provider: 'gsc',                logo: '🔍' },
  { id: 'psi',          name: 'PageSpeed Insights',    desc: 'Core Web Vitals and performance scores via PSI API key.',           category: 'seo',           type: 'apikey', settingKey: 'psi_api_key',      placeholder: 'AIza...', logo: '⚡' },
  { id: 'ahrefs',       name: 'Ahrefs',                desc: 'Backlink profiles, keyword rankings, and domain authority.',        category: 'seo',           type: 'soon',   logo: '📊' },
  { id: 'semrush',      name: 'SEMrush',               desc: 'Competitor analysis, site audits, and keyword research.',           category: 'seo',           type: 'soon',   logo: '🌐' },
  { id: 'moz',          name: 'Moz',                   desc: 'Domain Authority, spam score, and link metrics.',                   category: 'seo',           type: 'soon',   logo: '🔗' },
  // Analytics
  { id: 'ga4',          name: 'Google Analytics 4',    desc: 'Sessions, conversions, traffic sources, and user behaviour.',       category: 'analytics',     type: 'oauth',  provider: 'ga4',                logo: '📈' },
  { id: 'mixpanel',     name: 'Mixpanel',              desc: 'Product analytics, funnels, and event-based tracking.',             category: 'analytics',     type: 'soon',   logo: '🎯' },
  { id: 'amplitude',    name: 'Amplitude',             desc: 'Behavioural analytics, retention, and cohort analysis.',            category: 'analytics',     type: 'soon',   logo: '📉' },
  { id: 'adobe',        name: 'Adobe Analytics',       desc: 'Enterprise-grade digital analytics and segmentation.',              category: 'analytics',     type: 'soon',   logo: '☁️' },
  // Advertising
  { id: 'google_ads',   name: 'Google Ads',            desc: 'Campaign performance, spend, impressions, and conversions.',        category: 'advertising',   type: 'ads',    platform: 'google',             logo: '🟢' },
  { id: 'meta_ads',     name: 'Meta Ads',              desc: 'Facebook and Instagram ad performance and audience data.',          category: 'advertising',   type: 'ads',    platform: 'meta',               logo: '🔵' },
  { id: 'linkedin_ads', name: 'LinkedIn Ads',          desc: 'B2B ad performance, lead gen forms, and company targeting.',        category: 'advertising',   type: 'ads',    platform: 'linkedin',           logo: '💼' },
  { id: 'tiktok',       name: 'TikTok Ads',            desc: 'Short-form video ad performance and audience insights.',            category: 'advertising',   type: 'soon',   logo: '🎵' },
  { id: 'pinterest',    name: 'Pinterest Ads',         desc: 'Visual discovery ad campaigns and Pin performance.',                category: 'advertising',   type: 'soon',   logo: '📌' },
  { id: 'snapchat',     name: 'Snapchat Ads',          desc: 'Story and AR ad campaigns for younger demographics.',               category: 'advertising',   type: 'soon',   logo: '👻' },
  // CRM
  { id: 'hubspot',      name: 'HubSpot',               desc: 'Contacts, deals, and marketing campaign attribution.',              category: 'crm',           type: 'soon',   logo: '🧡' },
  { id: 'salesforce',   name: 'Salesforce',            desc: 'Enterprise CRM — leads, pipeline, and revenue attribution.',        category: 'crm',           type: 'soon',   logo: '☁️' },
  { id: 'zoho',         name: 'Zoho CRM',              desc: 'Sales automation, contacts, and lead management.',                  category: 'crm',           type: 'soon',   logo: '🔶' },
  { id: 'pipedrive',    name: 'Pipedrive',             desc: 'Visual sales pipeline and activity-based selling.',                 category: 'crm',           type: 'soon',   logo: '🟠' },
  // Communication & Workflow
  { id: 'slack',        name: 'Slack',                 desc: 'Crawl alerts, issue notifications, and weekly digests.',            category: 'communication', type: 'apikey', settingKey: 'slack_webhook_url', placeholder: 'https://hooks.slack.com/services/...', logo: '💬' },
  { id: 'linear',       name: 'Linear',                desc: 'Push SEO issues directly to Linear as tracked tickets.',            category: 'communication', type: 'apikey', settingKey: 'linear_api_key',    placeholder: 'lin_api_...', logo: '🔺' },
  { id: 'jira',         name: 'Jira',                  desc: 'Create and track SEO issues in your Jira project board.',           category: 'communication', type: 'soon',   logo: '🟦' },
  { id: 'asana',        name: 'Asana',                 desc: 'Assign SEO tasks to team members as Asana tasks.',                  category: 'communication', type: 'soon',   logo: '🟣' },
  { id: 'msteams',      name: 'Microsoft Teams',       desc: 'Crawl alerts and digest notifications via Teams channels.',         category: 'communication', type: 'soon',   logo: '💙' },
  // Developer & Data
  { id: 'zapier',       name: 'Zapier',                desc: 'Trigger workflows in 6,000+ apps from crawl events.',               category: 'developer',     type: 'soon',   logo: '⚡' },
  { id: 'make',         name: 'Make',                  desc: 'Visual automation workflows triggered by SEO events.',              category: 'developer',     type: 'soon',   logo: '🔀' },
  { id: 'webhooks',     name: 'Webhooks',              desc: 'Push crawl events and alerts to any custom endpoint.',              category: 'developer',     type: 'soon',   logo: '🪝' },
];

// ── Shared helpers ────────────────────────────────────────────────────────────

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

function SmallBtn({ onClick, disabled, loading, children, variant = 'primary' }) {
  const styles = {
    primary:     { backgroundColor: 'var(--brand)', color: '#fff', border: 'none' },
    destructive: { backgroundColor: 'var(--severity-critical-bg)', color: 'var(--severity-critical)', border: '1px solid var(--severity-critical-border)' },
    secondary:   { backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="flex items-center gap-1.5 h-7 px-3 rounded text-xs font-semibold"
      style={{ ...styles[variant], opacity: (disabled || loading) ? 0.6 : 1, cursor: (disabled || loading) ? 'not-allowed' : 'pointer' }}>
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
      {children}
    </button>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  const isErr = msg.startsWith('Error');
  return <p className="text-xs" style={{ color: isErr ? 'var(--severity-critical)' : 'var(--severity-pass)' }}>{msg}</p>;
}

// ── Expand panels (one per integration type) ──────────────────────────────────

function OAuthPanel({ integration, companyId, oauthStatus, onRefresh }) {
  const [actioning, setActioning] = useState(false);
  const [msg,       setMsg]       = useState('');
  const { provider, name } = integration;
  const qs = companyId ? `?company_id=${companyId}` : '';

  const connect = async () => {
    setActioning(true);
    try {
      const r = await api.get(`/${provider}/auth${qs}`);
      window.location.href = r.data.authUrl;
    } catch { setActioning(false); }
  };

  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${name}?`)) return;
    setActioning(true);
    try {
      await api.delete(`/${provider}/disconnect${qs}`);
      setMsg(`${name} disconnected.`);
      onRefresh();
    } catch { setMsg('Error: Disconnect failed.'); }
    finally { setActioning(false); }
  };

  const connected = oauthStatus?.connected;
  return (
    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      {connected ? (
        <>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--severity-pass)' }} />
            <span className="text-xs" style={{ color: 'var(--severity-pass)' }}>Connected</span>
            {oauthStatus.connected_email && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {oauthStatus.connected_email}</span>
            )}
          </div>
          <SmallBtn onClick={disconnect} loading={actioning} variant="destructive">
            <XCircle className="w-3 h-3" /> Disconnect
          </SmallBtn>
        </>
      ) : (
        <>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {provider === 'gsc'
              ? 'Connect to overlay Search Console data on your audit results.'
              : 'Connect to see GA4 traffic data alongside your audit results.'}
          </p>
          <SmallBtn onClick={connect} loading={actioning}>
            <ExternalLink className="w-3 h-3" /> Connect with Google
          </SmallBtn>
        </>
      )}
      <StatusMsg msg={msg} />
    </div>
  );
}

function ApiKeyPanel({ integration, companyId, isConnected, onRefresh }) {
  const [value,  setValue]  = useState('');
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const { settingKey, placeholder, name } = integration;
  const qs = companyId ? `?company_id=${companyId}` : '';

  useEffect(() => {
    api.get(`/settings${qs}`).then(r => {
      setValue(r.data.settings?.[settingKey] || '');
    }).catch(() => {});
  }, [qs, settingKey]);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put(`/settings${qs}`, { settings: { [settingKey]: value } });
      setMsg('Saved.');
      onRefresh();
    } catch { setMsg('Error: Save failed.'); }
    finally { setSaving(false); }
  };

  const clear = async () => {
    if (!window.confirm(`Remove ${name} connection?`)) return;
    setSaving(true); setMsg('');
    try {
      await api.put(`/settings${qs}`, { settings: { [settingKey]: '' } });
      setValue('');
      setMsg('Removed.');
      onRefresh();
    } catch { setMsg('Error: Remove failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <Input
        type={settingKey.includes('key') || settingKey.includes('pass') ? 'password' : 'text'}
        value={value}
        onChange={setValue}
        placeholder={placeholder}
      />
      <div className="flex items-center gap-2">
        <SmallBtn onClick={save} loading={saving}>Save</SmallBtn>
        {isConnected && (
          <SmallBtn onClick={clear} disabled={saving} variant="destructive">Remove</SmallBtn>
        )}
        <StatusMsg msg={msg} />
      </div>
    </div>
  );
}

function AdsPanel({ integration, isConnected, isAdmin, onRefresh }) {
  const [actioning, setActioning] = useState(false);
  const { platform, name } = integration;

  const connect = async () => {
    setActioning(true);
    try {
      const { data } = await api.post(`/ads/connect/${platform}`);
      window.location.href = data.authUrl;
    } catch { setActioning(false); }
  };

  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${name}? This will remove stored tokens and cached metrics.`)) return;
    setActioning(true);
    try {
      await api.delete(`/ads/connections/${platform}`);
      onRefresh();
    } catch { setActioning(false); }
  };

  if (!isAdmin) {
    return (
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {isConnected ? 'Connected via OAuth.' : 'Contact your admin to connect this integration.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      {isConnected ? (
        <SmallBtn onClick={disconnect} loading={actioning} variant="destructive">
          <XCircle className="w-3 h-3" /> Disconnect
        </SmallBtn>
      ) : (
        <SmallBtn onClick={connect} loading={actioning}>
          <ExternalLink className="w-3 h-3" /> Connect
        </SmallBtn>
      )}
    </div>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────

function IntegrationCard({ integration, connectionStatus, companyId, isAdmin, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const { id, name, desc, logo, type } = integration;

  if (type === 'soon') {
    return (
      <div
        className="rounded-xl p-4 flex flex-col gap-2"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', opacity: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-lg">{logo}</span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
          >
            Soon
          </span>
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</p>
        <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>{desc}</p>
        <button disabled className="mt-auto h-7 px-3 rounded text-xs font-semibold"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)', cursor: 'not-allowed' }}>
          Coming Soon
        </button>
      </div>
    );
  }

  // Determine connected state
  let isConnected = false;
  if (type === 'oauth')  isConnected = !!connectionStatus[integration.provider]?.connected;
  if (type === 'apikey') isConnected = !!connectionStatus[id];
  if (type === 'ads')    isConnected = connectionStatus.ads?.has(integration.platform) ?? false;

  const badgeBg    = isConnected ? 'var(--severity-pass-bg)'      : 'var(--bg-raised)';
  const badgeColor = isConnected ? 'var(--severity-pass)'         : 'var(--text-muted)';
  const badgeLabel = isConnected ? 'Connected'                    : 'Not Connected';

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ backgroundColor: 'var(--bg-surface)', border: `1px solid ${expanded ? 'var(--brand)' : 'var(--border-default)'}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg">{logo}</span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: badgeBg, color: badgeColor }}
        >
          {badgeLabel}
        </span>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</p>
      <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      <button
        onClick={() => setExpanded(v => !v)}
        className="mt-auto h-7 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1"
        style={{
          backgroundColor: isConnected ? 'var(--severity-pass-bg)' : 'var(--bg-raised)',
          color:            isConnected ? 'var(--severity-pass)'    : 'var(--text-primary)',
          border: `1px solid ${isConnected ? 'var(--severity-pass-border, var(--border-default))' : 'var(--border-default)'}`,
        }}
      >
        {isConnected ? 'Manage' : 'Connect'}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && type === 'oauth' && (
        <OAuthPanel
          integration={integration}
          companyId={companyId}
          oauthStatus={connectionStatus[integration.provider]}
          onRefresh={() => { setExpanded(false); onRefresh(); }}
        />
      )}
      {expanded && type === 'apikey' && (
        <ApiKeyPanel
          integration={integration}
          companyId={companyId}
          isConnected={isConnected}
          onRefresh={() => { onRefresh(); }}
        />
      )}
      {expanded && type === 'ads' && (
        <AdsPanel
          integration={integration}
          isConnected={isConnected}
          isAdmin={isAdmin}
          onRefresh={() => { setExpanded(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({ categoryId, connectionStatus, companyId, isAdmin, onRefresh }) {
  const integrations = INTEGRATIONS.filter(i => i.category === categoryId);
  return (
    <div className="mb-8">
      <p
        className="text-xs font-bold uppercase tracking-widest mb-3 pb-2"
        style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        {CATEGORY_LABELS[categoryId]}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {integrations.map(i => (
          <IntegrationCard
            key={i.id}
            integration={i}
            connectionStatus={connectionStatus}
            companyId={companyId}
            isAdmin={isAdmin}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Integrations() {
  const { user, companyId, viewingCompanyId } = useAuth();
  const isSuperAdmin    = user?.role === 'superadmin';
  const activeCompanyId = isSuperAdmin ? viewingCompanyId : companyId;
  const isAdmin         = user?.role === 'admin' || isSuperAdmin;

  const [activeTab,        setActiveTab]        = useState('all');
  const [connectionStatus, setConnectionStatus] = useState({ ads: new Set() });
  const [loadingStatus,    setLoadingStatus]    = useState(true);
  const [searchParams,     setSearchParams]     = useSearchParams();

  const loadStatus = useCallback(() => {
    const qs = activeCompanyId ? `?company_id=${activeCompanyId}` : '';
    setLoadingStatus(true);
    Promise.all([
      api.get(`/gsc/status${qs}`).catch(() => ({ data: { connected: false } })),
      api.get(`/ga4/status${qs}`).catch(() => ({ data: { connected: false } })),
      api.get(`/settings${qs}`).catch(() => ({ data: { settings: {} } })),
      api.get('/ads/connections').catch(() => ({ data: { connections: [] } })),
    ]).then(([gsc, ga4, settings, ads]) => {
      const s = settings.data.settings || {};
      setConnectionStatus({
        gsc:    gsc.data,
        ga4:    ga4.data,
        psi:    !!s.psi_api_key,
        slack:  !!s.slack_webhook_url,
        linear: !!s.linear_api_key,
        ads:    new Set((ads.data.connections || []).map(c => c.platform)),
      });
    }).finally(() => setLoadingStatus(false));
  }, [activeCompanyId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Detect OAuth callback redirects (?gsc_connected=1, ?ga4_error=..., etc.)
  useEffect(() => {
    const callbackParams = ['gsc_connected', 'ga4_connected', 'gsc_error', 'ga4_error'];
    if (callbackParams.some(p => searchParams.get(p))) {
      setSearchParams({});
      loadStatus();
    }
  }, [searchParams, setSearchParams, loadStatus]);

  const visibleCategoryIds = activeTab === 'all'
    ? CATEGORIES.filter(c => c.id !== 'all').map(c => c.id)
    : [activeTab];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Plug className="w-5 h-5" style={{ color: 'var(--brand)' }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Integration Hub</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Connect your tools. All credentials are stored per company and never shared.
          </p>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: 'var(--border-default)' }}>
        {CATEGORIES.map(cat => {
          const active = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className="px-4 py-2.5 text-sm font-medium -mb-px whitespace-nowrap"
              style={{
                color:        active ? 'var(--brand)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loadingStatus ? (
        <div className="flex items-center gap-2 py-12" style={{ color: 'var(--text-muted)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading integrations…</span>
        </div>
      ) : (
        visibleCategoryIds.map(catId => (
          <CategorySection
            key={catId}
            categoryId={catId}
            connectionStatus={connectionStatus}
            companyId={activeCompanyId}
            isAdmin={isAdmin}
            onRefresh={loadStatus}
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the frontend compiles**

```bash
cd /Users/a39326/Documents/Aakash/frontend && npm run build 2>&1 | tail -10
```

Expected: no errors. Common issues to check:
- `Plug` icon: if missing from lucide-react, replace with `Link2` (already used in old Settings)
- `var(--severity-pass-border)` and `var(--severity-critical-border)`: these may not exist; replace with `var(--border-default)` if build warns

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Integrations.jsx
git commit -m "feat(integrations): Integration Hub — tab strip, 26 integrations, inline expand panels"
```

---

## Task 4: Wire up router + clean stubs.jsx

**Files:**
- Modify: `frontend/src/router.jsx`
- Modify: `frontend/src/pages/stubs.jsx`

- [ ] **Step 1: Update router.jsx — import Integrations from its own file**

In `frontend/src/router.jsx`, line 28-32 currently reads:

```js
import {
  Integrations, SystemHealth,
  ErrorLog,
  AuditCustomExtraction, AuditLogFile,
} from './pages/stubs.jsx';
```

Change to:

```js
import { Integrations } from './pages/Integrations.jsx';
import {
  SystemHealth,
  ErrorLog,
  AuditCustomExtraction, AuditLogFile,
} from './pages/stubs.jsx';
```

- [ ] **Step 2: Remove PaidAdsSection and Integrations export from stubs.jsx**

In `frontend/src/pages/stubs.jsx`:

1. Remove the `ADS_PLATFORMS` constant (lines 34–38)
2. Remove the entire `PaidAdsSection` function (lines 40–166)
3. Remove the `Integrations` export function (lines 168–177)
4. Remove unused imports — `useEffect` is still used by nothing now, check: `ScheduledCrawls` still uses nothing from `useEffect` or `api`. Remove both `useEffect` and `api` imports and `useAuth` import if only `PaidAdsSection` used them.

After cleanup, `stubs.jsx` should look like:

```jsx
/**
 * Route stub pages — placeholder shells for all routes not yet built.
 * Each exports a named component. Replace one at a time with the real page.
 */

function Stub({ title, description }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div
          className="w-12 h-12 rounded-xl mx-auto mb-4"
          style={{ backgroundColor: 'var(--bg-raised)' }}
        />
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        {description && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
        <p className="text-xs mt-4" style={{ color: 'var(--border-strong)' }}>
          Coming in a later phase
        </p>
      </div>
    </div>
  );
}

export function ScheduledCrawls()       { return <Stub title="Scheduled Crawls"        description="Recurring crawl schedules and history." />; }
export function SystemHealth()          { return <Stub title="System Health"           description="Backend service status and diagnostics." />; }
export function ErrorLog()              { return <Stub title="Error Log"               description="Frontend and backend error log viewer." />; }
export function AuditCustomExtraction() { return <Stub title="Custom Extraction"       description="Extract custom data points from crawled pages." />; }
export function AuditLogFile()          { return <Stub title="Log File Intelligence"   description="Analyse server logs for crawl budget insights." />; }
```

- [ ] **Step 3: Build to confirm no broken imports**

```bash
cd /Users/a39326/Documents/Aakash/frontend && npm run build 2>&1 | tail -10
```

Expected: clean build, no "Module not found" or "does not provide an export" errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/router.jsx frontend/src/pages/stubs.jsx
git commit -m "refactor: wire Integrations from own page, clean stubs"
```

---

## Manual Verification Checklist

After all 4 tasks are done, start the dev server (`npm run dev` from project root) and check:

**Settings page (`/settings`):**
- [ ] No tabs — just a flat page with SMTP fields
- [ ] Superadmin sees a second "Global" section with Anthropic API key
- [ ] Non-superadmin does NOT see the Global section
- [ ] SMTP save works (enter values, click Save, reload — values persist)

**Integration Hub (`/integrations`) — All tab:**
- [ ] All 6 category sections visible with section headings
- [ ] Live integrations show "Connected" (green) or "Not Connected" badge
- [ ] Coming Soon integrations are dimmed with grey badge, button disabled
- [ ] Clicking "Connect" or "Manage" on a live card expands an inline panel
- [ ] Clicking the button again collapses the panel

**Integration Hub — specific tab:**
- [ ] Clicking "SEO Data" shows only SEO Data cards (no section heading needed)
- [ ] Clicking "Advertising" shows Google Ads, Meta, LinkedIn + 3 coming soon

**OAuth flow (GSC/GA4):**
- [ ] Clicking "Connect with Google" initiates OAuth redirect
- [ ] After authorising, browser lands at `/integrations?gsc_connected=1` (not `/settings`)
- [ ] Card updates to "Connected" state automatically

**PSI API key:**
- [ ] PSI card starts "Not Connected"
- [ ] Enter a key, click Save — card refreshes to "Connected"
- [ ] Expand again → "Remove" button appears; clicking it clears the key

**Slack / Linear:**
- [ ] Same inline API key flow as PSI

**Ads (Google/Meta/LinkedIn):**
- [ ] Connected platforms show "Manage" → expand shows Disconnect
- [ ] Non-connected show "Connect" → expand shows Connect button
- [ ] Non-admin users see a read-only message instead of buttons
