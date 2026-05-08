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
    <p className="text-xs" style={{ color: isErr ? 'var(--severity-critical-text)' : 'var(--severity-pass)' }}>
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

// Sentinel the backend returns for secrets that are stored but must not be
// echoed back in cleartext. Keeping it straight through the form and sending
// it back on PUT means the backend skips the field and preserves the value.
const SECRET_SET_SENTINEL = '__set__';

function SmtpSection({ companyId }) {
  const [form,   setForm]   = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '' });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const passIsStored = form.smtp_pass === SECRET_SET_SENTINEL;

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
        <Field label="Password">
          <Input
            type="password"
            value={passIsStored ? '' : form.smtp_pass}
            onChange={v => set('smtp_pass', v)}
            placeholder={passIsStored ? '•••••••• (saved — type to replace)' : '••••••••'}
          />
        </Field>
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
  const keyIsStored = key === SECRET_SET_SENTINEL;

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
      <SectionHeading title="Global" description="Instance-wide settings applied to all companies." />
      <div className="space-y-4">
        <Field label="Anthropic API Key">
          <Input
            type="password"
            value={keyIsStored ? '' : key}
            onChange={setKey}
            placeholder={keyIsStored ? '•••••••• (saved — type to replace)' : 'sk-ant-...'}
          />
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
