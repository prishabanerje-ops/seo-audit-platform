/**
 * Ga4Overlay — Google Analytics 4 performance overlay page.
 *
 * Shows:
 * - KPI cards (Sessions, Bounce Rate, Avg Session Duration)
 * - Paginated pages table (URL, Sessions, Engaged Sessions, Engagement Rate, Bounce Rate, Avg Duration)
 *
 * Connection logic:
 * - Admin/superadmin: calls /api/ga4/status to determine connected state
 * - SEO/readonly: skips /api/ga4/status (403); shows data if present, "no data" if empty
 */
import { useState, useEffect, useCallback } from 'react';
import { Link }                             from 'react-router';
import { BarChart2, AlertTriangle } from 'lucide-react';
import api                 from '../api/index.js';
import { useSites }        from '../context/SitesContext.jsx';
import { useAuth }         from '../context/AuthContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  const s = Math.round(seconds ?? 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value }) {
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
          fontSize:           '22px',
          fontWeight:         700,
          fontVariantNumeric: 'tabular-nums',
          color:              'var(--text-primary)',
          margin:             0,
          display:            'flex',
          alignItems:         'center',
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
        {label}
      </p>
    </div>
  );
}

// ── Pages table ───────────────────────────────────────────────────────────────

const TABLE_HEADERS = ['URL', 'Sessions', 'Engaged Sessions', 'Engagement Rate', 'Bounce Rate', 'Avg Duration'];

function PagesTable({ pages }) {
  if (!pages || pages.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No page data available.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {TABLE_HEADERS.map(h => (
              <th
                key={h}
                scope="col"
                style={{
                  padding:    '10px 14px',
                  textAlign:  h === 'URL' ? 'left' : 'right',
                  fontSize:   '11px',
                  fontWeight: 500,
                  color:      'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.map((row, idx) => (
            <tr
              key={row.url ?? idx}
              style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {/* URL column */}
              <td
                style={{
                  padding:      '10px 14px',
                  color:        'var(--text-primary)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  maxWidth:     '320px',
                }}
                title={row.url}
              >
                {row.url}
              </td>
              {/* Sessions */}
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {(row.sessions ?? 0).toLocaleString()}
              </td>
              {/* Engaged Sessions */}
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {(row.engaged_sessions ?? 0).toLocaleString()}
              </td>
              {/* Engagement Rate */}
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {((row.engagement_rate ?? 0) * 100).toFixed(1)}%
              </td>
              {/* Bounce Rate */}
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {((row.bounce_rate ?? 0) * 100).toFixed(1)}%
              </td>
              {/* Avg Duration */}
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(row.avg_session_duration)}
              </td>
            </tr>
          ))}
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
      <BarChart2 style={{ width: 40, height: 40, color: 'var(--text-muted)' }} />
      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        Google Analytics 4 not connected
      </p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '360px' }}>
        Connect your GA4 account in Settings to start seeing sessions, engagement, and traffic data for this site.
      </p>
      <Link
        to="/settings"
        style={{
          marginTop:       '4px',
          display:         'inline-block',
          padding:         '8px 20px',
          backgroundColor: 'var(--brand)',
          color:           'var(--text-inverse)',
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

export function Ga4Overlay() {
  const { activeSite } = useSites();
  const { user }       = useAuth();

  const [summary,      setSummary]      = useState(null);
  const [pages,        setPages]        = useState([]);
  const [total,        setTotal]        = useState(0);
  const [offset,       setOffset]       = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  /** null = unknown, true = connected, false = not connected */
  const [ga4Connected, setGa4Connected] = useState(null);

  const isAdminLike = user?.role === 'admin' || user?.role === 'superadmin';

  const pageHeader = (
    <div style={{ marginBottom: '24px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
        Google Analytics 4
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
        Sessions, engagement, and traffic data
      </p>
    </div>
  );

  const load = useCallback(async () => {
    if (!activeSite) return;

    setLoading(true);
    setError(null);
    setSummary(null);
    setPages([]);
    setGa4Connected(null);

    try {
      const requests = [
        api.get(`/ga4/${activeSite.id}/summary`),
        api.get(`/ga4/${activeSite.id}/pages`, { params: { limit: 50, offset } }),
      ];

      if (isAdminLike) {
        requests.push(api.get('/ga4/status'));
      }

      const results = await Promise.all(requests);
      const [summaryRes, pagesRes, statusRes] = results;

      setSummary(summaryRes.data);
      setPages(pagesRes.data.pages || []);
      setTotal(pagesRes.data.total || 0);

      if (isAdminLike && statusRes) {
        setGa4Connected(statusRes.data.connected === true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load GA4 data');
    } finally {
      setLoading(false);
    }
  }, [activeSite, isAdminLike, offset]);

  useEffect(() => { load(); }, [load]);

  // Reset offset when site changes
  useEffect(() => { setOffset(0); }, [activeSite]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const hasPrev = offset > 0;
  const hasNext = offset + 50 < total;

  // ── Render guards ──────────────────────────────────────────────────────────

  if (!activeSite) {
    return (
      <div style={{ padding: '24px' }}>
        <EmptyState
          icon={BarChart2}
          message="Select a site to view GA4 data"
          description="Choose a site from the site selector to see sessions, engagement, and traffic metrics."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        <LoadingSkeleton rows={6} columns={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <EmptyState
          icon={AlertTriangle}
          message="Failed to load GA4 data"
          description={error}
        />
      </div>
    );
  }

  // Admin sees connect prompt if explicitly not connected
  if (isAdminLike && ga4Connected === false) {
    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        {pageHeader}
        <ConnectPrompt />
      </div>
    );
  }

  // Connected but data is empty (sync may still be in progress)
  const hasData = summary && (
    summary.sessions > 0 ||
    pages.length > 0
  );

  if (!hasData) {
    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        {pageHeader}
        <EmptyState
          icon={BarChart2}
          message="No GA4 data available — sync may still be in progress"
        />
      </div>
    );
  }

  // ── Full data view ─────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>

      {pageHeader}

      {/* KPI cards row */}
      <div
        style={{
          display:      'flex',
          flexWrap:     'wrap',
          gap:          '12px',
          marginBottom: '28px',
        }}
      >
        <KpiCard
          label="Sessions"
          value={(summary.sessions ?? 0).toLocaleString()}
        />
        <KpiCard
          label="Bounce Rate"
          value={`${((summary.bounce_rate ?? 0) * 100).toFixed(1)}%`}
        />
        <KpiCard
          label="Avg Session Duration"
          value={formatDuration(summary.avg_duration)}
        />
      </div>

      {/* Pages table card */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border:          '1px solid var(--border)',
          borderRadius:    '12px',
          overflow:        'hidden',
        }}
      >
        <PagesTable pages={pages} />

        {/* Pagination */}
        {total > 50 && (
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '12px 16px',
              borderTop:      '1px solid var(--border)',
              fontSize:       '13px',
              color:          'var(--text-muted)',
            }}
          >
            <span>
              Showing {offset + 1}–{Math.min(offset + 50, total)} of {total}
            </span>
            {(hasPrev || hasNext) && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => setOffset(o => Math.max(0, o - 50))}
                  style={{
                    padding:         '5px 14px',
                    fontSize:        '13px',
                    fontWeight:      500,
                    border:          '1px solid var(--border)',
                    borderRadius:    '6px',
                    backgroundColor: 'var(--bg-surface)',
                    color:           hasPrev ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor:          hasPrev ? 'pointer' : 'not-allowed',
                    opacity:         hasPrev ? 1 : 0.5,
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => setOffset(o => o + 50)}
                  style={{
                    padding:         '5px 14px',
                    fontSize:        '13px',
                    fontWeight:      500,
                    border:          '1px solid var(--border)',
                    borderRadius:    '6px',
                    backgroundColor: 'var(--bg-surface)',
                    color:           hasNext ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor:          hasNext ? 'pointer' : 'not-allowed',
                    opacity:         hasNext ? 1 : 0.5,
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
