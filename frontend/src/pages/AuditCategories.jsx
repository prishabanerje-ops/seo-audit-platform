// frontend/src/pages/AuditCategories.jsx
/**
 * AuditCategories — flat list of all 20 audit categories sorted by severity.
 *
 * Sort order: critical → warning → info → pass (covered, 0 issues) → not audited
 * Not-audited rows are greyed out and non-clickable.
 * Data comes from GET /reports/:siteId/summary (same endpoint as AuditHealth).
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate }                       from 'react-router';
import { ChevronRight, Activity }            from 'lucide-react';
import api                                   from '../api/index.js';
import { useSites }                          from '../context/SitesContext.jsx';
import { LoadingSkeleton }                   from '../components/LoadingSkeleton.jsx';
import { EmptyState }                        from '../components/EmptyState.jsx';
import { SECTION_TO_SLUG }                   from '../lib/auditCategories.js';

// ── Severity badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ state }) {
  const map = {
    critical:    { label: 'CRITICAL',    color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    warning:     { label: 'WARNING',     color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
    info:        { label: 'INFO',        color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)'     },
    pass:        { label: '✓ PASS',      color: 'var(--severity-pass)',     bg: 'var(--severity-pass-bg)'     },
    notAudited:  { label: 'NOT AUDITED', color: 'var(--text-muted)',        bg: 'var(--bg-raised)'            },
  };
  const s = map[state] || map.notAudited;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

// ── Count pill ─────────────────────────────────────────────────────────────────
function CountPill({ count, type }) {
  if (!count) return null;
  const colors = {
    critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    warning:  { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
    info:     { color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)'     },
  };
  const c = colors[type];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium tabular-nums"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {count.toLocaleString()}
    </span>
  );
}

// ── Derive per-category state ──────────────────────────────────────────────────
function getCategoryState(counts, isCovered) {
  if (!isCovered) return 'notAudited';
  if (!counts)    return 'pass';
  if ((counts.critical || 0) > 0) return 'critical';
  if ((counts.warning  || 0) > 0) return 'warning';
  if ((counts.info     || 0) > 0) return 'info';
  return 'pass';
}

// Sort priority: critical=0, warning=1, info=2, pass=3, notAudited=4
const STATE_ORDER = { critical: 0, warning: 1, info: 2, pass: 3, notAudited: 4 };

// ── Left border color per state ────────────────────────────────────────────────
const BORDER_COLOR = {
  critical:   'var(--severity-critical)',
  warning:    'var(--severity-warning)',
  info:       'var(--severity-info)',
  pass:       'var(--severity-pass)',
  notAudited: 'var(--border-subtle)',
};

// ── Main page ──────────────────────────────────────────────────────────────────
export function AuditCategories() {
  const { activeSite }        = useSites();
  const navigate              = useNavigate();
  const [summary,  setSummary] = useState(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState(null);

  const load = useCallback(async () => {
    if (!activeSite) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/${activeSite.id}/summary`);
      setSummary(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, [activeSite]);

  useEffect(() => { load(); }, [load]);

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (!activeSite) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No site selected"
          description="Select a site from the header to view audit categories."
          action={{ label: 'Manage Sites', to: '/sites' }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <LoadingSkeleton type="table" rows={10} columns={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <EmptyState message="Failed to load categories" description={error} action={{ onClick: load, label: 'Retry' }} />
      </div>
    );
  }

  if (!summary?.jobId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No crawls yet"
          description={`No completed crawl found for ${activeSite.label}. Run your first crawl to see categories.`}
          action={{ label: 'Start a Crawl', to: '/crawl' }}
        />
      </div>
    );
  }

  // ── Build sorted category rows ──────────────────────────────────────────────
  const coveredSet = new Set(summary.coveredSections || []);
  const allCategories = [...new Set((summary.allChecks || []).map(c => c.category))];

  const rows = allCategories.map(cat => {
    const counts   = summary.sections?.[cat] || null;
    const covered  = coveredSet.has(cat);
    const state    = getCategoryState(counts, covered);
    const slug     = SECTION_TO_SLUG[cat];
    return { cat, counts, covered, state, slug };
  });

  // Sort by state priority, then by critical count desc within same state, then alpha
  rows.sort((a, b) => {
    const orderDiff = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (orderDiff !== 0) return orderDiff;
    if (a.state === 'critical') {
      return (b.counts?.critical || 0) - (a.counts?.critical || 0);
    }
    return a.cat.localeCompare(b.cat);
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Audit Categories
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {activeSite.label} · Last crawl:{' '}
          {summary.completedAt
            ? new Date(summary.completedAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
            : '—'}
        </p>
      </div>

      {/* Category list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border-default)' }}
      >
        {/* Table header */}
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}
        >
          <span className="flex-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Category
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider mr-2" style={{ color: 'var(--text-muted)' }}>
            Status
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider w-16 text-right" style={{ color: 'var(--text-muted)' }}>
            Issues
          </span>
        </div>

        {/* Rows */}
        {rows.map(({ cat, counts, state, slug }) => {
          const clickable = state !== 'notAudited' && slug;
          const path      = slug ? `/audit/${slug}` : null;

          const rowContent = (
            <>
              {/* Left border accent */}
              <span
                className="absolute left-0 top-0 bottom-0 w-0.5"
                style={{ backgroundColor: BORDER_COLOR[state] }}
              />
              <span className="flex-1 text-sm font-medium pl-2" style={{ color: clickable ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {cat}
              </span>
              <SeverityBadge state={state} />
              <div className="flex items-center gap-1 w-16 justify-end">
                {counts && (
                  <>
                    <CountPill count={counts.critical} type="critical" />
                    <CountPill count={counts.warning}  type="warning"  />
                    <CountPill count={counts.info}     type="info"     />
                  </>
                )}
              </div>
              {clickable && <ChevronRight className="w-4 h-4 shrink-0 ml-1" style={{ color: 'var(--text-muted)' }} />}
              {!clickable && <span className="w-5 ml-1" />}
            </>
          );

          const sharedStyle = {
            position: 'relative',
            borderBottom: '1px solid var(--border-subtle)',
            opacity: state === 'notAudited' ? 0.5 : 1,
          };

          if (clickable && path) {
            return (
              <div
                key={cat}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={sharedStyle}
                onClick={() => navigate(path)}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {rowContent}
              </div>
            );
          }

          return (
            <div
              key={cat}
              className="flex items-center gap-3 px-4 py-3"
              style={sharedStyle}
            >
              {rowContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
