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
    destructive: { backgroundColor: 'var(--severity-critical-bg)', color: 'var(--severity-critical-text)', border: '1px solid var(--severity-critical-border)' },
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
  return <p className="text-xs" style={{ color: isErr ? 'var(--severity-critical-text)' : 'var(--severity-pass)' }}>{msg}</p>;
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

  const badgeBg    = isConnected ? 'var(--severity-pass-bg)'  : 'var(--bg-raised)';
  const badgeColor = isConnected ? 'var(--severity-pass)'     : 'var(--text-muted)';
  const badgeLabel = isConnected ? 'Connected'                : 'Not Connected';

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
          border: `1px solid var(--border-default)`,
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
