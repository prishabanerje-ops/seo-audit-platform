import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, ChevronLeft, ChevronRight, Loader2, Filter } from 'lucide-react';
import api from '../api/index.js';

const ACTION_LABELS = {
  'company.create':        'Company created',
  'company.update':        'Company updated',
  'company.delete':        'Company deleted',
  'user.invite':           'User invited',
  'user.update':           'User updated',
  'user.delete':           'User deleted',
  'user.impersonate':      'Impersonation started',
  'user.impersonate_end':  'Impersonation ended',
  'user.password_changed': 'Password changed',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AuditLog() {
  const LIMIT = 50;
  const [entries,   setEntries]   = useState([]);
  const [total,     setTotal]     = useState(0);
  const [offset,    setOffset]    = useState(0);
  const [loading,   setLoading]   = useState(true);

  // Filters
  const [companies,  setCompanies]  = useState([]);
  const [filterComp, setFilterComp] = useState('');
  const [filterAct,  setFilterAct]  = useState('');

  // Load company list for filter dropdown
  useEffect(() => {
    api.get('/companies').then(r => setCompanies(r.data.companies || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset });
      if (filterComp) params.set('company_id', filterComp);
      if (filterAct)  params.set('action', filterAct);
      const res = await api.get(`/audit-log?${params}`);
      setEntries(res.data.entries || []);
      setTotal(res.data.total   || 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [offset, filterComp, filterAct]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = () => {
    setOffset(0); // reset to first page when filter changes
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Audit Log</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Superadmin action history — companies, users, and access changes.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Filter className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />

        <select
          value={filterComp}
          onChange={e => { setFilterComp(e.target.value); handleFilterChange(); }}
          className="h-8 px-3 rounded-md text-xs focus:outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={filterAct}
          onChange={e => { setFilterAct(e.target.value); handleFilterChange(); }}
          className="h-8 px-3 rounded-md text-xs focus:outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {total} total {total === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <ClipboardList className="w-10 h-10" style={{ color: 'var(--border-strong)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No audit log entries yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--bg-raised)' }}>
                {['Timestamp', 'Actor', 'Action', 'Target', 'Company', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                let metadata = null;
                try { metadata = e.metadata ? JSON.parse(e.metadata) : null; } catch { /* ignore */ }

                return (
                  <tr
                    key={e.id}
                    style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--border-default)' : 'none' }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(e.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-primary)' }}>
                      {e.actor_email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand-text)' }}
                      >
                        {ACTION_LABELS[e.action] || e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {e.target_type
                        ? <span className="capitalize">{e.target_type}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-primary)' }}>
                      {e.company_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {metadata
                        ? Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join(', ')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
              disabled={offset === 0}
              className="flex items-center gap-1 h-7 px-3 rounded-md text-xs font-medium disabled:opacity-40"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              onClick={() => setOffset(o => o + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="flex items-center gap-1 h-7 px-3 rounded-md text-xs font-medium disabled:opacity-40"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
