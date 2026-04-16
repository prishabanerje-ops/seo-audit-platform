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
