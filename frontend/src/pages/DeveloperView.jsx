/**
 * DeveloperView — technical health for the active site.
 * Shows: crawl health, response code breakdown, top issues, custom extraction.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link }                              from 'react-router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, AlertTriangle }           from 'lucide-react';
import api                from '../api/index.js';
import { useSites }       from '../context/SitesContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

const SEVERITY_COLORS = {
  critical: 'var(--severity-critical)',
  warning:  'var(--severity-warning)',
  info:     'var(--severity-info)',
};

const RC_COLORS = {
  '2xx': '#22c55e',
  '3xx': '#f59e0b',
  '4xx': '#ef4444',
  '5xx': '#7f1d1d',
};

function StatCard({ label, value }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
    >
      <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {value ?? '—'}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      </div>
      <div style={{ backgroundColor: 'var(--bg-surface)' }}>{children}</div>
    </div>
  );
}

export function DeveloperView() {
  const { activeSite } = useSites();
  const [devData, setDevData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    if (!activeSite) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/reports/${activeSite.id}/developer-summary`);
      setDevData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load developer data');
    } finally {
      setLoading(false);
    }
  }, [activeSite]);

  useEffect(() => { load(); }, [load]);

  if (!activeSite) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No site selected"
          description="Select a site to view technical health."
          action={{ label: 'Manage Sites', to: '/sites' }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <LoadingSkeleton type="table" rows={4} columns={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertTriangle} message="Error" description={error} />
      </div>
    );
  }

  if (!devData?.job) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No crawl data"
          description={`No completed crawl found for ${activeSite.label}. Run a crawl to see technical health.`}
          action={{ label: 'Start Crawl', to: '/crawl' }}
        />
      </div>
    );
  }

  const { job, response_codes, top_issues, custom_extraction } = devData;

  const rcChartData = Object.entries(response_codes)
    .filter(([, v]) => v > 0)
    .map(([code, count]) => ({ code, count }));

  const durationMin = job.duration_seconds != null
    ? `${Math.floor(job.duration_seconds / 60)}m ${job.duration_seconds % 60}s`
    : '—';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Developer View</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{activeSite.label}</p>
      </div>

      {/* Card 1: Crawl Health */}
      <SectionCard title="Crawl Health">
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total URLs" value={job.total_urls?.toLocaleString()} />
          <StatCard label="Health Score" value={job.health_score != null ? `${job.health_score}/100` : null} />
          <StatCard label="Duration" value={durationMin} />
          <StatCard
            label="Completed"
            value={job.completed_at
              ? new Date(job.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : '—'}
          />
        </div>
      </SectionCard>

      {/* Card 2: Response Code Breakdown */}
      <SectionCard title="Response Code Breakdown">
        {rcChartData.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No response code data in this crawl.</p>
          </div>
        ) : (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={rcChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v.toLocaleString(), 'URLs']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {rcChartData.map((entry) => (
                    <Cell key={entry.code} fill={RC_COLORS[entry.code] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Card 3: Top Issues */}
      <SectionCard title="Top Issues by Severity">
        {top_issues.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No issues found — great crawl!</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Issue', 'Section', 'Severity', 'Count'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top_issues.map((issue, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2 max-w-xs" style={{ color: 'var(--text-primary)' }}>{issue.issue_type}</td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/audit/${issue.slug}`}
                      className="text-[10px] underline"
                      style={{ color: 'var(--brand)' }}
                    >
                      {issue.section}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase"
                      style={{
                        color: SEVERITY_COLORS[issue.severity] || 'var(--text-muted)',
                        backgroundColor: `${SEVERITY_COLORS[issue.severity] || 'var(--text-muted)'}18`,
                      }}
                    >
                      {issue.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                    {issue.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Card 4: Custom Extraction */}
      <SectionCard title="Custom Extraction Results">
        {custom_extraction.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No custom extraction data.{' '}
              <Link to="/crawl" style={{ color: 'var(--brand)' }}>Configure extractions in crawl config →</Link>
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Type', 'URL', 'Data'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {custom_extraction.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>{row.issue_type}</td>
                  <td className="px-4 py-2 max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>{row.url}</td>
                  <td className="px-4 py-2 font-mono text-[10px] max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>{row.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
