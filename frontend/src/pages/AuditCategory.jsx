/**
 * AuditCategory — generic drill-down page for all 20 audit category routes.
 *
 * Route pattern: /audit/:slug  (static paths like /audit/title-tags)
 * Slug is extracted from location.pathname — NOT from useParams().
 *
 * Behaviour:
 * - Fetches issue-type groups for the active site + section on mount
 * - Lazy-loads URL rows per group when the accordion is first expanded
 * - Supports "Load more" pagination within each expanded group
 * - Each URL row navigates to the issue detail page with context params
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link }   from 'react-router';
import {
  ChevronDown, ChevronRight, AlertTriangle,
  Info, FileSearch, ArrowLeft, Loader2,
} from 'lucide-react';
import api               from '../api/index.js';
import { useSites }      from '../context/SitesContext.jsx';
import { EmptyState }    from '../components/EmptyState.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { SLUG_TO_SECTION } from '../lib/auditCategories.js';

const PAGE_LIMIT = 50;

// ── Severity badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const map = {
    critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    warning:  { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
    info:     { color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)'     },
  };
  const s = map[severity] || map.info;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide shrink-0"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {severity || 'info'}
    </span>
  );
}

// ── Parse row.data safely ──────────────────────────────────────────────────────
function parseRowData(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── URL row inside an expanded accordion ──────────────────────────────────────
function UrlRow({ row, index, onClick }) {
  // v2 check results store a human-readable description in `message`
  // v1 legacy results store structured metadata in `data` (JSON blob)
  const message = row.message || null;
  const data = !message ? parseRowData(row.data) : null;
  const dataEntries = data ? Object.entries(data).slice(0, 4) : [];

  return (
    <div
      className="px-6 py-3 cursor-pointer transition-colors"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'transparent',
      }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {/* URL — fall back to details for site-level checks (e.g. sitemap_exists) */}
      <p
        className="text-xs font-mono break-all leading-relaxed"
        style={{ color: 'var(--brand)' }}
      >
        {row.url || row.page_url || row.details || '—'}
      </p>

      {/* v2: plain message string */}
      {message && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {message}
        </p>
      )}

      {/* v1 legacy: inline key-value pairs */}
      {!message && dataEntries.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
          {dataEntries.map(([k, v]) => (
            <span key={k} className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{k}:</span>{' '}
              {String(v).slice(0, 120)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Accordion group row ────────────────────────────────────────────────────────
function GroupAccordion({ group, urlEntry, onExpand, onLoadMore, onUrlClick, onRetry, siteId, sectionName }) {
  const isOpen     = urlEntry !== undefined;
  const isLoading  = urlEntry?.loading;
  const results    = urlEntry?.results || [];
  const total      = urlEntry?.total   ?? group.count;
  const hasMore    = total > results.length;
  const remaining  = total - results.length;

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: 'transparent' }}
        onClick={onExpand}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {isOpen
            ? <ChevronDown  className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </span>

        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {group.issue_type}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          <SeverityBadge severity={group.severity} />
          <span
            className="text-xs font-medium tabular-nums px-2 py-0.5 rounded"
            style={{
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-raised)',
            }}
          >
            {group.count?.toLocaleString()} URL{group.count !== 1 ? 's' : ''}
          </span>
          {/* CSV export */}
          {siteId && sectionName && (
            <a
              href={`/api/reports/${siteId}/issues/export?section=${encodeURIComponent(sectionName)}&issue_type=${encodeURIComponent(group.issue_type)}`}
              download
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
              style={{
                color: 'var(--brand)',
                backgroundColor: 'var(--brand-subtle)',
                textDecoration: 'none',
              }}
              title={`Download ${group.issue_type} URLs as CSV`}
            >
              ⬇ CSV
            </a>
          )}
        </div>
      </button>

      {/* Expanded area */}
      {isOpen && (
        <div style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
          {urlEntry?.error ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--severity-critical)' }}>
              Failed to load URLs.{' '}
              <button
                onClick={onRetry}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0 }}
              >
                Retry
              </button>
            </div>
          ) : isLoading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading URLs…</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No URLs found for this issue.</p>
            </div>
          ) : (
            <>
              {results.map((row, idx) => (
                <UrlRow
                  key={row.id ?? idx}
                  row={row}
                  index={idx}
                  onClick={() => onUrlClick(row, idx, group)}
                />
              ))}

              {/* Load more */}
              {hasMore && (
                <div
                  className="flex items-center justify-center px-6 py-3"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <button
                    type="button"
                    className="text-xs font-medium px-3 py-1.5 rounded transition-opacity"
                    style={{ color: 'var(--brand)', backgroundColor: 'var(--bg-raised)' }}
                    onClick={onLoadMore}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? 'Loading…'
                      : `Load more (${remaining.toLocaleString()} remaining)`
                    }
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function AuditCategory() {
  const location           = useLocation();
  const navigate           = useNavigate();
  const { activeSite }     = useSites();

  // Extract slug from static path e.g. /audit/title-tags
  const slug        = location.pathname.replace('/audit/', '').split('/')[0];
  const sectionName = SLUG_TO_SECTION[slug];

  const [loading, setLoading] = useState(true);
  const [groups,  setGroups]  = useState([]);
  const [jobId,   setJobId]   = useState(null);
  const [covered, setCovered] = useState(null);
  const [error,   setError]   = useState(null);

  // expanded: Set of issue_types whose accordion is open
  const [expanded, setExpanded] = useState(new Set());

  // urlMap: { [issue_type]: { results, total, loading, offset } }
  const [urlMap, setUrlMap] = useState({});

  // ── Fetch group summary ──────────────────────────────────────────────────────
  const loadGroups = useCallback(async () => {
    if (!activeSite || !sectionName) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    setGroups([]);
    setJobId(null);
    setCovered(null);
    setExpanded(new Set());
    setUrlMap({});
    try {
      const res = await api.get(`/reports/${activeSite.id}/category`, {
        params: { section: sectionName },
      });
      setGroups(res.data.groups  || []);
      setJobId(res.data.jobId    ?? null);
      setCovered(res.data.covered ?? false);
    } catch (err) {
      setGroups([]);
      setJobId(null);
      setError(err?.response?.data?.error || 'Failed to load audit results. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeSite, sectionName]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // ── Lazy-load URLs for an issue_type ────────────────────────────────────────
  const loadUrls = useCallback(async (issueType, offset = 0) => {
    if (!activeSite) return;
    setUrlMap(prev => ({
      ...prev,
      [issueType]: {
        results: prev[issueType]?.results || [],
        total:   prev[issueType]?.total   ?? 0,
        offset,
        loading: true,
      },
    }));

    try {
      const res = await api.get(`/reports/${activeSite.id}/issues`, {
        params: { section: sectionName, issue_type: issueType, limit: PAGE_LIMIT, offset },
      });
      const incoming = res.data.results || [];
      const total    = res.data.total    ?? incoming.length;

      setUrlMap(prev => {
        const existing = offset === 0 ? [] : (prev[issueType]?.results || []);
        return {
          ...prev,
          [issueType]: {
            results: [...existing, ...incoming],
            total,
            offset:  offset + incoming.length,
            loading: false,
          },
        };
      });
    } catch {
      setUrlMap(prev => ({
        ...prev,
        [issueType]: { ...(prev[issueType] || {}), loading: false, error: true },
      }));
    }
  }, [activeSite, sectionName]);

  // ── Toggle accordion expand ──────────────────────────────────────────────────
  const handleExpand = useCallback((issueType) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(issueType)) {
        next.delete(issueType);
      } else {
        next.add(issueType);
        // Lazy-load only if not already fetched
        if (!urlMap[issueType]) {
          loadUrls(issueType, 0);
        }
      }
      return next;
    });
  }, [urlMap, loadUrls]);

  // ── Load more ────────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback((issueType) => {
    const current = urlMap[issueType];
    if (!current || current.loading) return;
    loadUrls(issueType, current.offset);
  }, [urlMap, loadUrls]);

  // ── URL row click ─────────────────────────────────────────────────────────────
  const handleUrlClick = useCallback((row, index, group) => {
    const params = new URLSearchParams({
      from:      slug,
      issueType: group.issue_type,
      pos:       String(index),
      total:     String(group.count),
    });
    navigate(`/audit/issue/${row.id}?${params.toString()}`);
  }, [navigate, slug]);

  // ── Guard: unknown slug ──────────────────────────────────────────────────────
  if (!sectionName) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileSearch}
          message="Unknown category"
          description={`"${slug}" is not a recognised audit category.`}
          action={{ label: '← Audit Health', to: '/audit' }}
        />
      </div>
    );
  }

  // ── Guard: no site selected ──────────────────────────────────────────────────
  if (!activeSite) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileSearch}
          message="No site selected"
          description="Select a site from the header to view audit results."
        />
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <LoadingSkeleton type="table" rows={6} columns={3} />
      </div>
    );
  }

  // ── Group fetch error ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          message="Failed to load audit data"
          description={error}
          action={{ onClick: loadGroups, label: 'Retry' }}
        />
      </div>
    );
  }

  // ── No completed crawl ───────────────────────────────────────────────────────
  if (jobId === null) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileSearch}
          message="No completed crawl"
          description={`No completed crawl found for ${activeSite.label}. Start a crawl to see results.`}
          action={{ label: 'Start a Crawl', to: '/crawl' }}
        />
      </div>
    );
  }

  // ── No issues in this category ───────────────────────────────────────────────
  if (groups.length === 0) {
    return (
      <div className="p-6">
        <nav className="mb-4">
          <Link
            to="/audit/categories"
            className="inline-flex items-center gap-1 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Audit Categories
          </Link>
        </nav>
        {covered ? (
          <EmptyState
            icon={FileSearch}
            message={`No ${sectionName} issues found`}
            description="No issues were detected in the latest crawl. Run a new crawl to check again."
            action={{ label: 'Start a Crawl', to: '/crawl' }}
          />
        ) : (
          <EmptyState
            icon={FileSearch}
            message={`No data collected for ${sectionName} yet`}
            description="This category will be populated automatically once the crawler supports it."
          />
        )}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const criticalCount = groups.filter(g => g.severity === 'critical').reduce((s, g) => s + (g.count || 0), 0);
  const warningCount  = groups.filter(g => g.severity === 'warning').reduce((s, g) => s + (g.count || 0), 0);
  const totalUrls     = groups.reduce((s, g) => s + (g.count || 0), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="mb-4">
        <Link
          to="/audit"
          className="inline-flex items-center gap-1 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Audit Health
        </Link>
      </nav>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {sectionName}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {activeSite.label} · {groups.length} issue type{groups.length !== 1 ? 's' : ''} · {totalUrls.toLocaleString()} affected URL{totalUrls !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 mt-1 shrink-0">
          {criticalCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ color: 'var(--severity-critical)', backgroundColor: 'var(--severity-critical-bg)' }}
            >
              <AlertTriangle className="w-3 h-3" />
              {criticalCount.toLocaleString()} critical
            </span>
          )}
          {warningCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ color: 'var(--severity-warning)', backgroundColor: 'var(--severity-warning-bg)' }}
            >
              <Info className="w-3 h-3" />
              {warningCount.toLocaleString()} warnings
            </span>
          )}
        </div>
      </div>

      {/* Issue-type accordion list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border-default)' }}
      >
        {/* Table header */}
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{
            backgroundColor: 'var(--bg-raised)',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <span className="flex-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Issue type
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Severity
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider ml-2" style={{ color: 'var(--text-muted)' }}>
            Count
          </span>
        </div>

        {/* Accordion rows */}
        <div style={{ backgroundColor: 'var(--bg-surface)' }}>
          {groups.map(group => (
            <GroupAccordion
              key={group.issue_type}
              group={group}
              urlEntry={expanded.has(group.issue_type) ? (urlMap[group.issue_type] || { results: [], total: group.count, loading: true, offset: 0 }) : undefined}
              onExpand={() => handleExpand(group.issue_type)}
              onLoadMore={() => handleLoadMore(group.issue_type)}
              onUrlClick={handleUrlClick}
              onRetry={() => {
                setUrlMap(prev => ({ ...prev, [group.issue_type]: undefined }));
                loadUrls(group.issue_type, 0);
              }}
              siteId={activeSite?.id}
              sectionName={sectionName}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
