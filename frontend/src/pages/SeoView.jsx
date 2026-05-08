/**
 * SeoView — two-tab page: Analytics (GA4) and Issues (audit + GSC).
 * Active site scoped.
 */
import { useState, useEffect } from 'react';
import { Link }                from 'react-router';
import { Activity, ChevronDown, ChevronRight } from 'lucide-react';
import api                from '../api/index.js';
import { useSites }       from '../context/SitesContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
      {['analytics', 'issues'].map(tab => (
        <button
          key={tab}
          type="button"
          className="px-4 py-2 text-sm font-medium capitalize transition-colors"
          style={{
            color: active === tab ? 'var(--brand)' : 'var(--text-muted)',
            borderBottom: active === tab ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1,
          }}
          onClick={() => onChange(tab)}
        >
          {tab === 'analytics' ? 'Analytics' : 'Issues'}
        </button>
      ))}
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ backgroundColor: 'var(--bg-raised)' }}
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
               : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
      </button>
      {open && <div style={{ backgroundColor: 'var(--bg-surface)' }}>{children}</div>}
    </div>
  );
}

function AnalyticsTab({ siteId }) {
  const [pages,   setPages]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [offset,  setOffset]  = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/ga4/${siteId}/pages?limit=50&offset=${offset}`)
      .then(r => {
        setPages(prev => offset === 0 ? r.data.pages : [...prev, ...r.data.pages]);
        setTotal(r.data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId, offset]);

  if (loading && pages.length === 0) return <LoadingSkeleton type="table" rows={8} columns={5} />;

  if (pages.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No GA4 data found.{' '}
          <Link to="/settings" style={{ color: 'var(--brand)' }}>Connect GA4 →</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>GA4 Page Performance</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['URL', 'Sessions', 'Engaged', 'Bounce Rate', 'Avg Duration'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pages.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="px-4 py-2 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{p.url}</td>
                <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.sessions?.toLocaleString()}</td>
                <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.engaged_sessions?.toLocaleString()}</td>
                <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.bounce_rate != null ? `${(p.bounce_rate * 100).toFixed(0)}%` : '—'}</td>
                <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.avg_session_duration != null ? `${Math.round(p.avg_session_duration)}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages.length < total && (
        <div className="flex justify-center py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className="text-xs px-4 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            onClick={() => setOffset(o => o + 50)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

function IssuesTab({ siteId }) {
  const [gscQueries, setGscQueries] = useState([]);
  const [gscPages,   setGscPages]   = useState([]);
  const [summary,    setSummary]    = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get(`/gsc/${siteId}/queries`),
      api.get(`/gsc/${siteId}/pages`),
      api.get(`/reports/${siteId}/summary`),
    ]).then(([q, p, s]) => {
      if (q.status === 'fulfilled') setGscQueries(q.value.data.queries || []);
      if (p.status === 'fulfilled') setGscPages(p.value.data.pages || []);
      if (s.status === 'fulfilled') setSummary(s.value.data);
    }).finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <LoadingSkeleton type="table" rows={5} columns={4} />;

  return (
    <div className="space-y-4">
      {/* Audit summary card */}
      {summary && (
        <div
          className="flex items-center justify-between p-4 rounded-xl"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.healthScore ?? '—'}
                <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/100</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Health score</p>
            </div>
            <div className="flex gap-4 text-xs">
              <span style={{ color: 'var(--severity-critical)' }}>{summary.totals?.critical || 0} critical</span>
              <span style={{ color: 'var(--severity-warning)' }}>{summary.totals?.warning || 0} warnings</span>
              <span style={{ color: 'var(--severity-info)' }}>{summary.totals?.info || 0} info</span>
            </div>
          </div>
          <Link to="/audit" className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--brand)', color: '#fff' }}>
            View full audit →
          </Link>
        </div>
      )}

      {/* Top GSC Queries */}
      <CollapsibleSection title="Top GSC Queries">
        {gscQueries.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No GSC query data.{' '}
              <Link to="/settings" style={{ color: 'var(--brand)' }}>Connect GSC →</Link>
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Query', 'Clicks', 'Impressions', 'CTR', 'Position'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gscQueries.map((q, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>{q.query}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{q.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{q.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{(q.ctr * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{q.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleSection>

      {/* Top Pages by Clicks */}
      <CollapsibleSection title="Top Pages by Clicks">
        {gscPages.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No GSC page data available.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['URL', 'Clicks', 'Impressions', 'CTR'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gscPages.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2 max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{p.url}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{(p.ctr * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleSection>
    </div>
  );
}

export function SeoView() {
  const { activeSite } = useSites();
  const [tab, setTab] = useState('analytics');

  if (!activeSite) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No site selected"
          description="Select a site from the header to view SEO data."
          action={{ label: 'Manage Sites', to: '/sites' }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>SEO Dashboard</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{activeSite.label}</p>
      <TabBar active={tab} onChange={setTab} />
      {tab === 'analytics'
        ? <AnalyticsTab siteId={activeSite.id} />
        : <IssuesTab    siteId={activeSite.id} />
      }
    </div>
  );
}
