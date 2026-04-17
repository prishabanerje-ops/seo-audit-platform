/**
 * GscOverlay — Google Search Console performance overlay page.
 *
 * Shows:
 * - KPI cards (Clicks, Impressions, CTR, Avg Position) with delta badges
 * - Tab bar: Top Pages | Top Queries
 * - Data table that switches based on active tab
 *
 * Connection logic:
 * - Admin/superadmin: calls /api/gsc/status to determine connected state
 * - SEO/readonly: skips /api/gsc/status (403); shows data if present, "no data" if empty
 */
import { useState, useEffect, useCallback } from 'react';
import { Link }                             from 'react-router';
import { TrendingUp, TrendingDown, Search, AlertTriangle } from 'lucide-react';
import api                from '../api/index.js';
import { useSites }       from '../context/SitesContext.jsx';
import { useAuth }        from '../context/AuthContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

// ── Delta badge ────────────────────────────────────────────────────────────────

function DeltaBadge({ value }) {
  if (value === null || value === undefined || value === 0) return null;
  const positive = value > 0;
  return (
    <span
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '2px',
        fontSize:       '11px',
        fontWeight:     500,
        marginLeft:     '6px',
        color: positive ? 'var(--severity-pass)' : 'var(--severity-critical)',
      }}
    >
      {positive
        ? <TrendingUp  style={{ width: 10, height: 10 }} />
        : <TrendingDown style={{ width: 10, height: 10 }} />}
      {positive ? '+' : ''}{value.toLocaleString()}
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, delta }) {
  return (
    <div
      style={{
        flex:            '1 1 0',
        minWidth:        '140px',
        backgroundColor: 'var(--bg-surface)',
        border:          '1px solid var(--border)',
        borderRadius:    '12px',
        padding:         '16px',
      }}
    >
      <p
        style={{
          fontSize:    '22px',
          fontWeight:  700,
          fontVariantNumeric: 'tabular-nums',
          color:       'var(--text-primary)',
          margin:      0,
          display:     'flex',
          alignItems:  'center',
        }}
      >
        {value}
        {delta !== undefined && <DeltaBadge value={delta} />}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
        {label}
      </p>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'pages',   label: 'Top Pages'   },
  { id: 'queries', label: 'Top Queries' },
];

function TabBar({ active, onChange }) {
  return (
    <div
      style={{
        display:      'flex',
        gap:          '0',
        borderBottom: '1px solid var(--border)',
        marginBottom: '0',
      }}
    >
      {TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              padding:         '10px 18px',
              fontSize:        '13px',
              fontWeight:      isActive ? 600 : 400,
              color:           isActive ? 'var(--brand)' : 'var(--text-muted)',
              background:      'none',
              border:          'none',
              borderBottom:    isActive ? '2px solid var(--brand)' : '2px solid transparent',
              marginBottom:    '-1px',
              cursor:          'pointer',
              transition:      'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Data table ────────────────────────────────────────────────────────────────

const TABLE_HEADERS = {
  pages:   ['URL', 'Clicks', 'Impressions', 'CTR', 'Position'],
  queries: ['Query', 'Clicks', 'Impressions', 'CTR', 'Position'],
};

function DataTable({ activeTab, pages, queries }) {
  const rows    = activeTab === 'pages' ? pages : queries;
  const headers = TABLE_HEADERS[activeTab];

  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No data available for this tab.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {headers.map(h => (
              <th
                key={h}
                style={{
                  padding:   '10px 14px',
                  textAlign: h === headers[0] ? 'left' : 'right',
                  fontSize:  '11px',
                  fontWeight: 500,
                  color:     'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const primaryValue = activeTab === 'pages' ? row.url : row.query;
            return (
              <tr
                key={idx}
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* URL / Query column */}
                <td
                  style={{
                    padding:       '10px 14px',
                    color:         'var(--text-primary)',
                    overflow:      'hidden',
                    textOverflow:  'ellipsis',
                    whiteSpace:    'nowrap',
                    maxWidth:      '320px',
                  }}
                  title={primaryValue}
                >
                  {primaryValue}
                </td>
                {/* Clicks */}
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.clicks.toLocaleString()}
                </td>
                {/* Impressions */}
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.impressions.toLocaleString()}
                </td>
                {/* CTR */}
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {(row.ctr * 100).toFixed(1)}%
                </td>
                {/* Position */}
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.position.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Connect prompt card ───────────────────────────────────────────────────────

function ConnectPrompt() {
  return (
    <div
      style={{
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             '12px',
        padding:         '48px 24px',
        backgroundColor: 'var(--bg-surface)',
        border:          '1px solid var(--border)',
        borderRadius:    '12px',
        textAlign:       'center',
      }}
    >
      <Search style={{ width: 40, height: 40, color: 'var(--text-muted)' }} />
      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        Google Search Console not connected
      </p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '360px' }}>
        Connect your GSC account in Settings to start seeing search performance data for this site.
      </p>
      <Link
        to="/settings"
        style={{
          marginTop:       '4px',
          display:         'inline-block',
          padding:         '8px 20px',
          backgroundColor: 'var(--brand)',
          color:           '#fff',
          borderRadius:    '8px',
          fontSize:        '13px',
          fontWeight:      600,
          textDecoration:  'none',
        }}
      >
        Go to Settings
      </Link>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GscOverlay() {
  const { activeSite }     = useSites();
  const { user }           = useAuth();

  const [summary,  setSummary]  = useState(null);
  const [pages,    setPages]    = useState([]);
  const [queries,  setQueries]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  /** null = unknown, true = connected, false = not connected */
  const [gscConnected, setGscConnected] = useState(null);
  const [activeTab, setActiveTab] = useState('pages');

  const isAdminLike = user?.role === 'admin' || user?.role === 'superadmin';

  const load = useCallback(async () => {
    if (!activeSite) return;

    setLoading(true);
    setError(null);
    setSummary(null);
    setPages([]);
    setQueries([]);
    setGscConnected(null);

    try {
      // For admins: check GSC connection status in parallel with data fetch
      const requests = [
        api.get(`/gsc/${activeSite.id}/summary`),
        api.get(`/gsc/${activeSite.id}/pages`),
        api.get(`/gsc/${activeSite.id}/queries`),
      ];

      if (isAdminLike) {
        requests.push(api.get('/gsc/status'));
      }

      const results = await Promise.all(requests);
      const [summaryRes, pagesRes, queriesRes, statusRes] = results;

      setSummary(summaryRes.data);
      setPages(pagesRes.data.pages   || []);
      setQueries(queriesRes.data.queries || []);

      if (isAdminLike && statusRes) {
        setGscConnected(statusRes.data.connected === true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load Search Console data');
    } finally {
      setLoading(false);
    }
  }, [activeSite, isAdminLike]);

  useEffect(() => { load(); }, [load]);

  // ── Render guards ──────────────────────────────────────────────────────────

  if (!activeSite) {
    return (
      <div style={{ padding: '24px' }}>
        <EmptyState
          icon={Search}
          message="Select a site to view Search Console data"
          description="Choose a site from the site selector to see search performance metrics."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        <LoadingSkeleton rows={6} columns={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <EmptyState
          icon={AlertTriangle}
          message="Failed to load Search Console data"
          description={error}
        />
      </div>
    );
  }

  // Admin sees connect prompt if explicitly not connected
  if (isAdminLike && gscConnected === false) {
    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Search Console
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Last 28 days of search performance data
          </p>
        </div>
        <ConnectPrompt />
      </div>
    );
  }

  // Connected but data is empty (sync may still be in progress)
  const hasData = summary && (
    summary.clicks > 0 ||
    summary.impressions > 0 ||
    pages.length > 0 ||
    queries.length > 0
  );

  if (!hasData) {
    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Search Console
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Last 28 days of search performance data
          </p>
        </div>
        <EmptyState
          icon={Search}
          message="No Search Console data available"
          description="Data sync may still be in progress. Check back shortly."
        />
      </div>
    );
  }

  // ── Full data view ─────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Search Console
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
          Last 28 days of search performance data
        </p>
      </div>

      {/* KPI cards row */}
      <div
        style={{
          display:       'flex',
          flexWrap:      'wrap',
          gap:           '12px',
          marginBottom:  '28px',
        }}
      >
        <KpiCard
          label="Clicks"
          value={summary.clicks.toLocaleString()}
          delta={summary.clicks_delta}
        />
        <KpiCard
          label="Impressions"
          value={summary.impressions.toLocaleString()}
          delta={summary.impressions_delta}
        />
        <KpiCard
          label="CTR"
          value={`${(summary.ctr * 100).toFixed(1)}%`}
        />
        <KpiCard
          label="Avg Position"
          value={summary.position.toFixed(1)}
        />
      </div>

      {/* Table card */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border:          '1px solid var(--border)',
          borderRadius:    '12px',
          overflow:        'hidden',
        }}
      >
        {/* Tab bar */}
        <div style={{ padding: '0 16px', backgroundColor: 'var(--bg-raised)' }}>
          <TabBar active={activeTab} onChange={setActiveTab} />
        </div>

        {/* Table */}
        <DataTable
          activeTab={activeTab}
          pages={pages}
          queries={queries}
        />
      </div>
    </div>
  );
}
