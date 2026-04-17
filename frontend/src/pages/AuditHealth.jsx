/**
 * AuditHealth — site health overview page.
 *
 * Shows:
 * - Health score ring + KPI summary cards
 * - Per-category issue accordion
 * - Health score trend chart (last 10 crawls)
 * - SEO checklist registry badge
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link }                 from 'react-router';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ChevronDown, ChevronRight, AlertTriangle,
  Info, CheckCircle2, RefreshCw, Activity, Download,
} from 'lucide-react';
import api                from '../api/index.js';
import { useSites }       from '../context/SitesContext.jsx';
import { HealthRing }     from '../components/HealthRing.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';
import { Button }          from '../components/ui/Button.jsx';

// ── Category → audit route map ────────────────────────────────────────────────
const CATEGORY_ROUTES = {
  // Core technical
  'Response Codes':           '/audit/response-codes',
  'Canonical':                '/audit/canonicals',
  'Robots / Indexability':    '/audit/robots',
  'Sitemap':                  '/audit/sitemap',
  'URL Structure':            '/audit/crawl-depth',

  // On-page
  'Title Tags':               '/audit/title-tags',
  'Meta Description':         '/audit/meta-desc',
  'Headings':                 '/audit/headings',
  'Internal Linking':         '/audit/links',
  'Images':                   '/audit/images',
  'Schema / Structured Data': '/audit/structured-data',
  'Content':                  '/audit/content',

  // Performance & rendering
  'Speed & Performance':      '/audit/page-speed',
  'Mobile SEO':               '/audit/mobile',
  'JavaScript Rendering':     '/audit/custom',

  // Advanced (no dedicated detail page yet)
  'International SEO':        '/audit/custom',
  'Rankings & Traffic Drops': '/audit/custom',
  'Monitoring & Operations':  '/audit/custom',
  'LLM / AI Crawlers':        '/audit/custom',
};

// ── Helper components ─────────────────────────────────────────────────────────

function SeverityCount({ count, type }) {
  if (!count) return null;
  const styles = {
    critical: { color: 'var(--severity-critical)',  bg: 'var(--severity-critical-bg)'  },
    warning:  { color: 'var(--severity-warning)',   bg: 'var(--severity-warning-bg)'   },
    info:     { color: 'var(--severity-info)',      bg: 'var(--severity-info-bg)'      },
    ok:       { color: 'var(--severity-pass)',      bg: 'var(--severity-pass-bg)'      },
  };
  const s = styles[type] || styles.info;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {count.toLocaleString()}
    </span>
  );
}

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {value ?? '—'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  );
}

// Status pill for an individual check
function CheckStatus({ count, noData }) {
  if (noData) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium font-mono"
        style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}
      >
        —
      </span>
    );
  }
  if (count > 0) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium font-mono"
        style={{ color: 'var(--severity-critical)', backgroundColor: 'var(--severity-critical-bg)' }}
      >
        {count.toLocaleString()}
      </span>
    );
  }
  return (
    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--severity-pass)' }} />
  );
}

function AccordionRow({ category, counts, checks, issueCountMap, isCovered, routePath, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const critical = counts?.critical || 0;
  const warning  = counts?.warning  || 0;
  const info     = counts?.info     || 0;
  const total    = critical + warning + info;
  const checkTotal = checks?.length || 0;

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: 'transparent' }}
        onClick={() => setOpen(v => !v)}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {category}
        </span>
        <span className="text-xs mr-3" style={{ color: 'var(--text-muted)' }}>
          {checkTotal} check{checkTotal !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          {critical > 0 && <SeverityCount count={critical} type="critical" />}
          {warning  > 0 && <SeverityCount count={warning}  type="warning"  />}
          {info     > 0 && <SeverityCount count={info}     type="info"     />}
          {total === 0   && <SeverityCount count="✓" type="ok" />}
        </div>
      </button>

      {/* Expanded check list */}
      {open && (
        <div style={{ backgroundColor: 'var(--bg-raised)', borderTop: '1px solid var(--border-subtle)' }}>
          {/* Individual check rows */}
          {(checks || []).map((chk, i) => {
            const count  = issueCountMap?.[chk.name] ?? 0;
            const noData = !isCovered;
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-6 py-2"
                style={{
                  borderBottom: i < checks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {chk.name}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded shrink-0 mr-2"
                  style={{
                    color: chk.severity_default === 'critical' ? 'var(--severity-critical)'
                         : chk.severity_default === 'warning'  ? 'var(--severity-warning)'
                         : 'var(--severity-info)',
                    backgroundColor: chk.severity_default === 'critical' ? 'var(--severity-critical-bg)'
                                   : chk.severity_default === 'warning'  ? 'var(--severity-warning-bg)'
                                   : 'var(--severity-info-bg)',
                  }}
                >
                  {chk.severity_default}
                </span>
                <CheckStatus count={count} noData={noData} />
              </div>
            );
          })}

          {/* Footer: view details link */}
          {routePath && (
            <div
              className="flex justify-end px-6 py-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <Link
                to={routePath}
                className="text-xs font-medium"
                style={{ color: 'var(--brand)' }}
              >
                View details →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrendChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          height: '180px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Run at least 2 crawls to see the trend chart
        </p>
      </div>
    );
  }

  const chartData = data.map(j => ({
    date:  new Date(j.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: j.health_score ?? 0,
  }));

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        Health score trend
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
            formatter={(v) => [`${v}/100`, 'Health score']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--brand)"
            strokeWidth={2}
            dot={{ fill: 'var(--brand)', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: 'var(--brand)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AuditHealth() {
  const navigate                  = useNavigate();
  const { activeSite }            = useSites();
  const [summary,    setSummary]  = useState(null);
  const [trend,      setTrend]    = useState([]);
  const [checksTotal, setChecksTotal] = useState(null);
  const [loading,    setLoading]  = useState(true);
  const [error,      setError]    = useState(null);

  const load = useCallback(async () => {
    if (!activeSite) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [summaryRes, trendRes, checksRes] = await Promise.all([
        api.get(`/reports/${activeSite.id}/summary`),
        api.get(`/reports/${activeSite.id}/trend`),
        api.get('/reports/checks/count'),
      ]);
      setSummary(summaryRes.data);
      setTrend(trendRes.data.trend || []);
      setChecksTotal(checksRes.data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, [activeSite]);

  // Build derived lookups from summary data (computed once per load)
  const checksByCategory  = {};   // category → [{ name, severity_default }]
  const issueCountMap     = {};   // issue_type name → count
  const coveredSet        = new Set(); // set of sections that have audit data
  if (summary) {
    for (const chk of summary.allChecks || []) {
      if (!checksByCategory[chk.category]) checksByCategory[chk.category] = [];
      checksByCategory[chk.category].push(chk);
    }
    for (const row of summary.issueTypeCounts || []) {
      issueCountMap[row.issue_type] = row.count;
    }
    for (const sec of summary.coveredSections || []) {
      coveredSet.add(sec);
    }
  }

  useEffect(() => { load(); }, [load]);

  // ── No site selected ─────────────────────────────────────────────────────
  if (!activeSite) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No site selected"
          description="Select a site from the header to view its audit health."
          action={{ label: 'Manage Sites', to: '/sites' }}
        />
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <LoadingSkeleton type="ring" />
        <LoadingSkeleton type="table" rows={8} cols={4} />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ backgroundColor: 'var(--severity-critical-bg)', border: '1px solid var(--severity-critical-border)' }}
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--severity-critical)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--severity-critical-text)' }}>{error}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── No crawl yet ──────────────────────────────────────────────────────────
  if (!summary?.jobId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No crawls yet"
          description={`No completed crawl found for ${activeSite.label}. Run your first crawl to see audit health.`}
          action={{ label: 'Start a Crawl', to: '/crawl' }}
        />
      </div>
    );
  }

  // ── Build accordion data ──────────────────────────────────────────────────
  // All categories that appear in either checks or audit_results
  const allCategories = Array.from(new Set([
    ...Object.keys(checksByCategory),
    ...Object.keys(summary.sections || {}),
  ])).sort();

  const { totals, healthScore } = summary;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Audit Health</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {activeSite.label} · Last crawl:{' '}
            {summary.completedAt
              ? new Date(summary.completedAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={load}
          >
            Refresh
          </Button>
          <Link to={`/exports?siteId=${activeSite.id}`}>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Download className="w-3.5 h-3.5" />}
            >
              Export
            </Button>
          </Link>
        </div>
      </div>

      {/* Top section: health ring + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Health ring */}
        <div
          className="lg:col-span-1 flex flex-col items-center justify-center rounded-xl p-6"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <HealthRing score={healthScore} size={120} strokeWidth={10} />
          <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
            {summary.totalUrls?.toLocaleString()} URLs crawled
          </p>
        </div>

        {/* KPI cards */}
        <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard
            label="Critical issues"
            value={totals.critical?.toLocaleString()}
            icon={AlertTriangle}
            color="var(--severity-critical)"
          />
          <KpiCard
            label="Warnings"
            value={totals.warning?.toLocaleString()}
            icon={AlertTriangle}
            color="var(--severity-warning)"
          />
          <KpiCard
            label="Info"
            value={totals.info?.toLocaleString()}
            icon={Info}
            color="var(--severity-info)"
          />
        </div>
      </div>

      {/* Trend chart */}
      <div className="mb-6">
        <TrendChart data={trend} />
      </div>

      {/* Accordion */}
      <div
        className="rounded-xl overflow-hidden mb-6"
        style={{ border: '1px solid var(--border-default)' }}
      >
        {/* Accordion header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            SEO Checklist Registry
          </p>
          {checksTotal != null && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'var(--brand-subtle)', color: 'var(--brand)' }}
            >
              {checksTotal} checks loaded
            </span>
          )}
        </div>

        {/* Category rows */}
        <div style={{ backgroundColor: 'var(--bg-surface)' }}>
          {allCategories.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No audit data yet for this crawl.
              </p>
            </div>
          ) : (
            allCategories.map(cat => (
              <AccordionRow
                key={cat}
                category={cat}
                counts={summary.sections?.[cat]}
                checks={checksByCategory[cat] || []}
                issueCountMap={issueCountMap}
                isCovered={coveredSet.has(cat)}
                routePath={CATEGORY_ROUTES[cat] || '/audit/custom'}
                defaultOpen={false}
              />
            ))
          )}
        </div>
      </div>

      {/* Start new crawl CTA */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Ready to crawl again?
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Run a fresh crawl to update these results.
          </p>
        </div>
        <Button
          iconLeft={<Activity className="w-4 h-4" />}
          onClick={() => navigate('/crawl')}
          size="sm"
        >
          Start crawl
        </Button>
      </div>
    </div>
  );
}
