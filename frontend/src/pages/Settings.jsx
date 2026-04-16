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
