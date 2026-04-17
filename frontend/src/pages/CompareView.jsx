/**
 * CompareView — compare two completed crawl jobs.
 *
 * Picks any two completed jobs from all accessible sites,
 * shows delta summary cards, and a filterable issue-type diff table.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { GitCompareArrows, ArrowUp, ArrowDown } from 'lucide-react';
import api                 from '../api/index.js';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function jobLabel(job) {
  return `${job.siteLabel} · ${fmtDate(job.startedAt)} · ${(job.totalUrls || 0).toLocaleString()} URLs${job.healthScore != null ? ` · Score ${job.healthScore}` : ''}`;
}

// ── Delta card ────────────────────────────────────────────────────────────────

function DeltaCard({ label, delta, invertColor }) {
  // invertColor=true means negative delta is good (fewer issues = better)
  const isGood    = invertColor ? delta < 0 : delta > 0;
  const isBad     = invertColor ? delta > 0 : delta < 0;
  const isNeutral = delta === 0;

  const bg    = isNeutral ? 'var(--bg-surface)'           : isGood ? 'var(--severity-pass-bg)'     : 'var(--severity-critical-bg)';
  const color = isNeutral ? 'var(--text-muted)'           : isGood ? 'var(--severity-pass)'         : 'var(--severity-critical)';
  const sign  = delta > 0 ? '+' : '';

  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center justify-center gap-1"
      style={{ backgroundColor: bg, border: '1px solid var(--border-default)' }}
    >
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>
        {isNeutral ? '—' : `${sign}${delta}`}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

// ── Severity pill ─────────────────────────────────────────────────────────────

function SeverityPill({ severity }) {
  const styles = {
    critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    warning:  { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
    info:     { color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)'     },
  };
  const s = styles[severity] || styles.info;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {severity}
    </span>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function DeltaBadge({ countA, countB, delta }) {
  if (countA === 0 && countB > 0) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
        style={{ color: 'var(--severity-info)', backgroundColor: 'var(--severity-info-bg)' }}
      >
        NEW
      </span>
    );
  }
  if (countB === 0 && countA > 0) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
        style={{ color: 'var(--severity-pass)', backgroundColor: 'var(--severity-pass-bg)' }}
      >
        GONE
      </span>
    );
  }
  if (delta === 0) {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  }
  const improved = delta < 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 font-semibold text-sm tabular-nums"
      style={{ color: improved ? 'var(--severity-pass)' : 'var(--severity-critical)' }}
    >
      {improved
        ? <ArrowDown className="w-3 h-3" />
        : <ArrowUp   className="w-3 h-3" />}
      {Math.abs(delta)}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CompareView() {
  const [jobs,        setJobs]        = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobIdA,      setJobIdA]      = useState('');
  const [jobIdB,      setJobIdB]      = useState('');
  const [comparison,  setComparison]  = useState(null);
  const [cmpLoading,  setCmpLoading]  = useState(false);

  // Filter state
  const [sectionFilter,  setSectionFilter]  = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [changedOnly,    setChangedOnly]    = useState(true);
  const [sortAsc,        setSortAsc]        = useState(false); // false = largest change first

  // Load all accessible completed jobs on mount
  useEffect(() => {
    const controller = new AbortController();
    api.get('/compare/jobs', { signal: controller.signal })
      .then(res => setJobs(res.data.jobs || []))
      .catch(err => { if (err.name !== 'CanceledError') { /* interceptor handles toast */ } })
      .finally(() => setJobsLoading(false));
    return () => controller.abort();
  }, []);

  // Load comparison whenever both jobs are selected
  const loadComparison = useCallback(async (idA, idB, signal) => {
    setCmpLoading(true);
    setComparison(null);
    try {
      const res = await api.get('/compare', { params: { jobA: idA, jobB: idB }, signal });
      setComparison(res.data);
    } catch (err) {
      if (err.name !== 'CanceledError') { /* interceptor handles toast */ }
    } finally {
      setCmpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jobIdA || !jobIdB) {
      setComparison(null); // clear stale result when either picker is reset
      return;
    }
    const controller = new AbortController();
    loadComparison(jobIdA, jobIdB, controller.signal);
    return () => controller.abort();
  }, [jobIdA, jobIdB, loadComparison]);

  // Derived: sections present in the comparison result
  const availableSections = useMemo(() => {
    if (!comparison) return [];
    return [...new Set(comparison.rows.map(r => r.section))].sort();
  }, [comparison]);

  // Derived: filtered + sorted rows
  const filteredRows = useMemo(() => {
    if (!comparison) return [];
    let rows = comparison.rows;
    if (changedOnly)     rows = rows.filter(r => r.delta !== 0);
    if (sectionFilter)   rows = rows.filter(r => r.section === sectionFilter);
    if (severityFilter)  rows = rows.filter(r => r.severity === severityFilter);
    const sorted = [...rows].sort((a, b) =>
      sortAsc
        ? Math.abs(a.delta) - Math.abs(b.delta)
        : Math.abs(b.delta) - Math.abs(a.delta)
    );
    return sorted;
  }, [comparison, changedOnly, sectionFilter, severityFilter, sortAsc]);

  if (jobsLoading) {
    return <div className="p-6"><LoadingSkeleton type="table" rows={3} cols={1} /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Compare Crawls</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Select two completed crawl jobs to compare issue counts.
        </p>
      </div>

      {/* Job pickers */}
      <div
        className="rounded-xl p-5 mb-5"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        {jobs.length < 2 ? (
          <EmptyState
            icon={GitCompareArrows}
            message="Not enough crawls"
            description="You need at least 2 completed crawls to compare. Run more crawls first."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Picker A */}
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Baseline (A)
              </label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                value={jobIdA}
                onChange={e => setJobIdA(e.target.value)}
              >
                <option value="">Select a job…</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id} disabled={j.id === jobIdB}>
                    {jobLabel(j)}
                  </option>
                ))}
              </select>
            </div>

            {/* Picker B */}
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Comparison (B)
              </label>
              <select
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                value={jobIdB}
                onChange={e => setJobIdB(e.target.value)}
              >
                <option value="">Select a job…</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id} disabled={j.id === jobIdA}>
                    {jobLabel(j)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Comparison results */}
      {(jobIdA && jobIdB) && (
        cmpLoading ? (
          <LoadingSkeleton type="table" rows={6} cols={4} />
        ) : comparison ? (
          <>
            {/* Summary delta cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <DeltaCard label="Health Score"     delta={comparison.summary.scoreDelta}    invertColor={false} />
              <DeltaCard label="Critical Issues"  delta={comparison.summary.criticalDelta} invertColor={true}  />
              <DeltaCard label="Warnings"         delta={comparison.summary.warningDelta}  invertColor={true}  />
              <DeltaCard label="Info"             delta={comparison.summary.infoDelta}     invertColor={true}  />
            </div>

            {/* Diff table */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border-default)' }}
            >
              {/* Filter bar */}
              <div
                className="flex flex-wrap items-center gap-3 px-4 py-3"
                style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}
              >
                {/* Section filter */}
                <select
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                  value={sectionFilter}
                  onChange={e => setSectionFilter(e.target.value)}
                >
                  <option value="">All sections</option>
                  {availableSections.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Severity filter */}
                <select
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                  value={severityFilter}
                  onChange={e => setSeverityFilter(e.target.value)}
                >
                  <option value="">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>

                {/* Changed only toggle */}
                <label
                  className="flex items-center gap-1.5 cursor-pointer text-xs select-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <input
                    type="checkbox"
                    checked={changedOnly}
                    onChange={e => setChangedOnly(e.target.checked)}
                  />
                  Changed only
                </label>

                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                  {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              <table className="w-full text-sm" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
                    {['Issue Type', 'Section', 'Severity', 'Before', 'After'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                    <th
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide cursor-pointer select-none"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => setSortAsc(v => !v)}
                      title="Toggle sort direction"
                    >
                      Δ {sortAsc ? '↑' : '↓'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        No issues match the current filters
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, i) => (
                      <tr
                        key={`${row.section}-${row.issue_type}-${row.severity}`}
                        style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                      >
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
                          {row.issue_type}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {row.section}
                        </td>
                        <td className="px-4 py-2.5">
                          <SeverityPill severity={row.severity} />
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {row.countA.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {row.countB.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <DeltaBadge countA={row.countA} countB={row.countB} delta={row.delta} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null
      )}
    </div>
  );
}
