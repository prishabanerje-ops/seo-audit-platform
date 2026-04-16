import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2, Plus, Pencil, Trash2, Users, Eye,
  CheckCircle2, XCircle, Loader2, ChevronRight, X, UserRoundCog,
} from 'lucide-react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Badge({ children, variant = 'default' }) {
  const styles = {
    default:  { backgroundColor: 'var(--bg-raised)',            color: 'var(--text-muted)',            border: '1px solid var(--border-default)' },
    success:  { backgroundColor: 'var(--severity-pass-bg)',     color: 'var(--severity-pass)',         border: '1px solid var(--severity-pass)' },
    warning:  { backgroundColor: 'var(--severity-warning-bg)',  color: 'var(--severity-warning)',      border: '1px solid var(--severity-warning)' },
    danger:   { backgroundColor: 'var(--severity-critical-bg)', color: 'var(--severity-critical-text)', border: '1px solid var(--severity-critical-border)' },
  };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={styles[variant]}
    >
      {children}
    </span>
  );
}

// ─── Company Form Modal ───────────────────────────────────────────────────────

function CompanyModal({ company, onClose, onSaved }) {
  const editing = Boolean(company?.id);

  const [form, setForm] = useState({
    name:          company?.name          ?? '',
    contact_email: company?.contact_email ?? '',
    domain:        company?.domain        ?? '',
    plan:          company?.plan          ?? 'Starter',
    max_seats:     company?.max_seats     ?? 10,
    is_paid:       company?.is_paid       != null ? Boolean(company.is_paid) : true,
    status:        company?.status        ?? 'active',
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/companies/${company.id}`, form);
      } else {
        await api.post('/companies', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-xl"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {editing ? 'Edit Company' : 'New Company'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Company Name *</label>
            <input
              value={form.name} onChange={e => set('name', e.target.value)} required
              className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
              onBlur={e  => e.currentTarget.style.boxShadow = ''}
            />
          </div>

          {/* Email + Domain */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Contact Email</label>
              <input
                type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
                className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Domain</label>
              <input
                value={form.domain} onChange={e => set('domain', e.target.value)} placeholder="example.com"
                className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
            </div>
          </div>

          {/* Plan + Max Seats */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Plan</label>
              <select
                value={form.plan} onChange={e => set('plan', e.target.value)}
                className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                {['Starter', 'Growth', 'Pro', 'Enterprise'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Max Seats</label>
              <input
                type="number" min={1} max={1000}
                value={form.max_seats} onChange={e => set('max_seats', Number(e.target.value))}
                className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px var(--brand)'}
                onBlur={e  => e.currentTarget.style.boxShadow = ''}
              />
            </div>
          </div>

          {/* is_paid + status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Access</label>
              <select
                value={form.is_paid ? 'paid' : 'unpaid'} onChange={e => set('is_paid', e.target.value === 'paid')}
                className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <option value="paid">Active (Paid)</option>
                <option value="unpaid">Expired (Unpaid)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Status</label>
              <select
                value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full h-9 px-3 rounded-md text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--severity-critical-text)' }}>{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="h-8 px-4 rounded-md text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="h-8 px-4 rounded-md text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--brand)', opacity: saving ? 0.7 : 1 }}
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ company, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/companies/${company.id}`);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-xl shadow-xl p-6"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <h2 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Delete "{company.name}"?</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          This is irreversible. All sites and crawl data for this company will be removed.
          The company must have no active users before it can be deleted.
        </p>
        {error && <p className="text-xs mb-3" style={{ color: 'var(--severity-critical-text)' }}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="h-8 px-4 rounded-md text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="h-8 px-4 rounded-md text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--severity-critical)', opacity: deleting ? 0.7 : 1 }}>
            {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Company Users Drawer ─────────────────────────────────────────────────────

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
    setError('');
    if (!window.confirm('Start an impersonation session as this user?')) return;
    setImpersonating(userId);
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Companies() {
  const { setViewingCompany } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Modal states
  const [editCompany,   setEditCompany]   = useState(null);   // null = closed, {} = new, {...} = editing
  const [deleteCompany, setDeleteCompany] = useState(null);
  const [usersCompany,  setUsersCompany]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/companies');
      setCompanies(res.data.companies || []);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSwitchTo = (company) => {
    setViewingCompany({ id: company.id, name: company.name });
    navigate('/admin');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Companies</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Manage all tenant companies and their access.
          </p>
        </div>
        <button
          onClick={() => setEditCompany({})}
          className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--brand)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--brand-hover)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--brand)'}
        >
          <Plus className="w-4 h-4" /> New Company
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Building2 className="w-10 h-10" style={{ color: 'var(--border-strong)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No companies yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--bg-raised)' }}>
                {['Company', 'Domain', 'Plan', 'Seats', 'Access', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: i < companies.length - 1 ? '1px solid var(--border-default)' : 'none',
                  }}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: 'var(--brand)' }}>
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                        {c.contact_email && (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.contact_email}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Domain */}
                  <td className="px-4 py-3">
                    <span style={{ color: 'var(--text-muted)' }}>{c.domain || '—'}</span>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3">
                    <span style={{ color: 'var(--text-primary)' }}>{c.plan}</span>
                  </td>

                  {/* Seats */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setUsersCompany(c)}
                      className="flex items-center gap-1 hover:underline"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Users className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      {c.user_count} / {c.max_seats}
                    </button>
                  </td>

                  {/* Access */}
                  <td className="px-4 py-3">
                    {c.is_paid
                      ? <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> Paid</Badge>
                      : <Badge variant="danger"><XCircle className="w-3 h-3" /> Expired</Badge>
                    }
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge variant={c.status === 'active' ? 'success' : 'warning'}>
                      {c.status}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => handleSwitchTo(c)}
                        title="View this company's data"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--bg-raised)] transition-colors"
                        style={{ color: 'var(--brand)' }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditCompany(c)}
                        title="Edit company"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--bg-raised)] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteCompany(c)}
                        title="Delete company"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--bg-raised)] transition-colors"
                        style={{ color: 'var(--severity-critical-text)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {editCompany !== null && (
        <CompanyModal
          company={editCompany?.id ? editCompany : null}
          onClose={() => setEditCompany(null)}
          onSaved={() => { setEditCompany(null); load(); }}
        />
      )}
      {deleteCompany && (
        <DeleteModal
          company={deleteCompany}
          onClose={() => setDeleteCompany(null)}
          onDeleted={() => { setDeleteCompany(null); load(); }}
        />
      )}
      {usersCompany && (
        <UsersDrawer company={usersCompany} onClose={() => setUsersCompany(null)} />
      )}
    </div>
  );
}
