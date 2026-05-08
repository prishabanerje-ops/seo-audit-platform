# Integration Hub & Settings Consolidation Design

## Overview

Consolidate all third-party service connections into a single **Integration Hub** page at `/integrations`, and slim the **Settings** page down to platform-only config (SMTP + Anthropic API key). Adds placeholder cards for ~20 future marketing integrations so the page reads as a product roadmap.

---

## Problem Being Solved

Currently:
- **Settings page** has 4 tabs: Integrations (Slack + Linear), GSC, GA4, SMTP — plus a Global tab for superadmin
- **Integrations page** only shows Paid Ads (Google/Meta/LinkedIn)
- PSI API key is supported by the backend (`ALLOWED_COMPANY_KEYS`) but has no frontend UI
- No coherent home for all third-party connections

After this change:
- **Integrations page** = every third-party service (live + coming soon)
- **Settings page** = SMTP + Anthropic API key only (flat, no tabs)

---

## Architecture

### Files

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/pages/Integrations.jsx` | **Create** | Full Integration Hub page |
| `frontend/src/pages/Settings.jsx` | **Modify** | Remove Integrations/GSC/GA4 tabs; flatten to SMTP + Global |
| `frontend/src/pages/stubs.jsx` | **Modify** | Remove `PaidAdsSection` and `Integrations` export |
| `frontend/src/router.jsx` | **Modify** | Import `Integrations` from `./pages/Integrations.jsx` instead of stubs |
| `backend/routes/gsc.js` | **Modify** | Change OAuth callback redirect from `/settings` to `/integrations` |
| `backend/routes/ga4.js` | **Modify** | Change OAuth callback redirect from `/settings` to `/integrations` |

No new backend routes. No DB migrations. PSI API key already has a backend slot (`psi_api_key` in `ALLOWED_COMPANY_KEYS`).

---

## Integration Hub Page (`/integrations`)

### Layout

```
Page header: "Integration Hub" + subtitle
─────────────────────────────────────────────────────
Tab strip: [All] [SEO Data] [Analytics] [Advertising] [CRM] [Communication] [Developer]
─────────────────────────────────────────────────────
SEO Data  ────────────────────────────────────────────
[GSC ✓] [PSI ○] [Ahrefs soon] [SEMrush soon] [Moz soon]

Analytics ────────────────────────────────────────────
[GA4 ✓] [Mixpanel soon] [Amplitude soon] [Adobe soon]

Advertising ──────────────────────────────────────────
[Google Ads ○] [Meta Ads ○] [LinkedIn Ads ○] [TikTok soon] [Pinterest soon] [Snapchat soon]

CRM ──────────────────────────────────────────────────
[HubSpot soon] [Salesforce soon] [Zoho soon] [Pipedrive soon]

Communication & Workflow ─────────────────────────────
[Slack ✓] [Linear ○] [Jira soon] [Asana soon] [Teams soon]

Developer & Data ─────────────────────────────────────
[Zapier soon] [Make soon] [Webhooks soon]
```

**Tab behavior:**
- "All" tab (default): renders all 6 category sections with section headings
- Specific tab: renders only that category's cards as a flat grid (no section heading needed)
- Active tab highlighted with brand underline — same pattern as existing Settings tabs

### Integration Card States

Three visual states, all using the same card component:

**1. Connected** (green)
- Badge: green "Connected"
- Button: "Manage" — clicking toggles an inline expand panel showing connection details + disconnect action

**2. Not Connected** (purple)
- Badge: purple "Not Connected"
- Button: "Connect" — action depends on integration type (see below)

**3. Coming Soon** (dimmed)
- Card opacity: 50%
- Badge: muted grey "Soon"
- Button: disabled "Coming Soon"

### Integration Card Component

```jsx
// Props shape
{
  logo: string,          // emoji or icon
  name: string,          // display name
  description: string,   // one-line description
  status: 'connected' | 'disconnected' | 'coming-soon',
  children: ReactNode,   // expanded content (manage/connect form)
}
```

Card renders logo + name + description + badge + button. When "Manage" or "Connect" is clicked, an inline expanded section appears below the card content (no modal, no navigation). Clicking again collapses it.

### Per-Integration Expanded Content

#### Google Search Console (SEO Data)
- Reuse `OAuthCard` logic from current `Settings.jsx`
- Shows: connected email, Disconnect button
- Connect flow: `GET /api/gsc/auth?company_id=X` → redirect to Google

#### PageSpeed Insights (SEO Data)
- API key text input + Save button
- `GET /api/settings` on expand to prefill existing key
- `PUT /api/settings` with `{ settings: { psi_api_key: '...' } }` on save
- Status: Connected if `psi_api_key` is non-empty in settings, otherwise Not Connected

#### Google Analytics 4 (Analytics)
- Same as GSC — reuse `OAuthCard` logic with `provider="ga4"`
- Connect flow: `GET /api/ga4/auth?company_id=X`

#### Slack (Communication)
- Webhook URL text input + Save button
- `GET /api/settings` on expand to prefill
- `PUT /api/settings` with `{ settings: { slack_webhook_url: '...' } }` on save
- Status: Connected if `slack_webhook_url` is non-empty

#### Linear (Communication)
- API key password input + Save button
- `GET /api/settings` on expand to prefill
- `PUT /api/settings` with `{ settings: { linear_api_key: '...' } }` on save
- Status: Connected if `linear_api_key` is non-empty

#### Google Ads / Meta Ads / LinkedIn Ads (Advertising)
- Reuse `PaidAdsSection` logic from current `stubs.jsx`
- Per-card: shows connection status, Connect (OAuth redirect) or Disconnect button
- Existing `POST /api/ads/connect/:platform` and `DELETE /api/ads/connections/:platform`

#### All Coming Soon cards
- No backend interaction
- Card renders in dimmed state, no expand panel

### OAuth Callback Redirect Fix

The GSC and GA4 backends currently redirect back to `/settings?gsc_connected=1`. Since OAuthCard moves to Integrations, both callback handlers must redirect to `/integrations` instead:

**`backend/routes/gsc.js`** — callback success redirect:
```js
// Before
res.redirect(`${process.env.FRONTEND_URL}/settings?gsc_connected=1`);
// After
res.redirect(`${process.env.FRONTEND_URL}/integrations?gsc_connected=1`);
```

**`backend/routes/ga4.js`** — same change with `ga4_connected=1`.

The OAuthCard `useEffect` that reads `searchParams` for `gsc_connected` / `ga4_connected` works identically — just runs on the Integrations page URL instead of Settings.

### Complete Integration Catalog

| Category | Name | Status | Backend |
|----------|------|--------|---------|
| SEO Data | Google Search Console | Live | `GET/DELETE /api/gsc/*` |
| SEO Data | PageSpeed Insights | Live (needs UI) | `PUT /api/settings` → `psi_api_key` |
| SEO Data | Ahrefs | Coming Soon | — |
| SEO Data | SEMrush | Coming Soon | — |
| SEO Data | Moz | Coming Soon | — |
| Analytics | Google Analytics 4 | Live | `GET/DELETE /api/ga4/*` |
| Analytics | Mixpanel | Coming Soon | — |
| Analytics | Amplitude | Coming Soon | — |
| Analytics | Adobe Analytics | Coming Soon | — |
| Advertising | Google Ads | Live | `POST/DELETE /api/ads/*` |
| Advertising | Meta Ads | Live | `POST/DELETE /api/ads/*` |
| Advertising | LinkedIn Ads | Live | `POST/DELETE /api/ads/*` |
| Advertising | TikTok Ads | Coming Soon | — |
| Advertising | Pinterest Ads | Coming Soon | — |
| Advertising | Snapchat Ads | Coming Soon | — |
| CRM | HubSpot | Coming Soon | — |
| CRM | Salesforce | Coming Soon | — |
| CRM | Zoho CRM | Coming Soon | — |
| CRM | Pipedrive | Coming Soon | — |
| Communication | Slack | Live | `PUT /api/settings` → `slack_webhook_url` |
| Communication | Linear | Live | `PUT /api/settings` → `linear_api_key` |
| Communication | Jira | Coming Soon | — |
| Communication | Asana | Coming Soon | — |
| Communication | Microsoft Teams | Coming Soon | — |
| Developer | Zapier | Coming Soon | — |
| Developer | Make | Coming Soon | — |
| Developer | Webhooks | Coming Soon | — |

---

## Settings Page (`/settings`)

### New layout — flat, no tabs

```
Page header: "Settings" + subtitle "Platform configuration"
──────────────────────────────────────────────────────────
SMTP  ─────────────────────────────────────────────────────
Host, Port, Username, Password, From Address fields
[Save]

(superadmin only)
Global ────────────────────────────────────────────────────
Anthropic API Key field
[Save]
```

- Remove the tab strip entirely
- Remove `IntegrationsTab`, `OAuthCard` from this file (moved to Integrations.jsx)
- Keep `SmtpTab` content, rendered directly (not in a tab)
- Keep `GlobalTab` content for superadmin, rendered below SMTP as a second section
- Keep helper components `Field`, `Input`, `SaveBtn`, `StatusMsg` in this file (used by SMTP form)
- Update subtitle from "Configure integrations and platform settings." → "Platform configuration — email delivery and AI settings."

---

## Company Scoping

No changes needed. The `viewingCompanyId` / `companyId` pattern from `useAuth()` carries through identically. All API calls on the Integrations page append `?company_id=X` for superadmin viewing another company, same as Settings does today.

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Settings API save fails | Inline error message below Save button (existing `StatusMsg` pattern) |
| OAuth connect fails | Backend redirects back with `?gsc_error=...`; OAuthCard shows error message |
| OAuth disconnect fails | Inline error message |
| Paid Ads connect fails | Existing toast via axios interceptor |
| Coming Soon card clicked | No action — button is `disabled` |

---

## Out of Scope

- Adding real backends for any Coming Soon integration
- Custom ordering or pinning of integrations
- Search/filter within the Integration Hub
- Integration health monitoring (token expiry warnings, re-auth prompts) — future phase
- Google Sheets integration — listed as a platform feature in CLAUDE.md but no backend route exists; left as Coming Soon
