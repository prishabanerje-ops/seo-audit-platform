/**
 * AdminView — cross-site dashboard for admins.
 * Shows: sites table (GSC + GA4), task KPI row, compact Kanban.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate }                from 'react-router';
import { Activity, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import api               from '../api/index.js';
import { useSites }      from '../context/SitesContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

const PRIORITY_COLORS = {
  critical: 'var(--severity-critical)',
  high:     'var(--severity-warning)',
  medium:   'var(--text-muted)',
  low:      'var(--text-muted)',
};

const STATUS_LABELS = {
  backlog:     'Backlog',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
};

function Delta({ value }) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-medium ml-1"
      style={{ color: positive ? 'var(--severity-pass)' : 'var(--severity-critical)' }}
    >
      {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {Math.abs(value).toLocaleString()}
    </span>
  );
}

function KpiCard({ label, count, status }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="flex-1 rounded-xl p-4 text-left transition-colors"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
      onClick={() => navigate(`/tasks?status=${status}`)}
    >
      <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {count}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </button>
  );
}

function TaskCard({ task }) {
  return (
    <Link
      to={`/tasks/${task.id}`}
      className="block rounded-lg p-3 transition-colors"
      style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}
    >
      <p
        className="text-xs font-medium leading-tight mb-2 line-clamp-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {task.title}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {task.site_color && (
          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: task.site_color }} />
            {task.site_label}
          </span>
        )}
        {task.priority && (
          <span className="text-[10px]" style={{ color: PRIORITY_COLORS[task.priority] || 'var(--text-muted)' }}>
            {task.priority}
          </span>
        )}
        {task.linear_url && (
          <a
            href={task.linear_url}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[10px] underline"
            style={{ color: 'var(--brand)' }}
          >
            Linear
          </a>
        )}
      </div>
    </Link>
  );
}

function KanbanColumn({ status, tasks }) {
  const label = STATUS_LABELS[status] || status;
  const shown = tasks.slice(0, 5);
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
        >
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {shown.map(t => <TaskCard key={t.id} task={t} />)}
        {tasks.length > 5 && (
          <Link
            to={`/tasks?status=${status}`}
            className="block text-center text-[11px] py-1"
            style={{ color: 'var(--brand)' }}
          >
            +{tasks.length - 5} more →
          </Link>
        )}
        {tasks.length === 0 && (
          <p className="text-[11px] text-center py-3" style={{ color: 'var(--text-muted)' }}>
            Nothing here
          </p>
        )}
      </div>
    </div>
  );
}

export function AdminView() {
  const { setActiveSite } = useSites();
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [kanban,  setKanban]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [dashRes, tasksRes] = await Promise.all([
        api.get('/dashboard/admin'),
        api.get('/tasks'),
      ]);
      setData(dashRes.data);
      setKanban(tasksRes.data.kanban);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <LoadingSkeleton type="table" rows={5} columns={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertTriangle} message="Failed to load" description={error} />
      </div>
    );
  }

  const { sites, task_summary } = data;

  if (!sites || sites.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          message="No sites yet"
          description="Add your first site to see the dashboard."
          action={{ label: 'Add Site', to: '/sites/new' }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>

      {/* Sites table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
        <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>All Sites</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Site', 'Health', 'Clicks', 'Impressions', 'CTR', 'Position', 'Sessions', 'Bounce', 'Last Crawl'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sites.map(site => (
                <tr
                  key={site.id}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => { setActiveSite(site); navigate('/audit'); }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: site.color || 'var(--text-muted)' }} />
                      <span className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{site.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.health_score != null ? `${site.health_score}/100` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.gsc
                      ? <>{site.gsc.clicks.toLocaleString()}<Delta value={site.gsc.clicks_delta} /></>
                      : <Link to="/settings" className="text-[10px]" style={{ color: 'var(--brand)' }}>Connect GSC</Link>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.gsc
                      ? <>{site.gsc.impressions.toLocaleString()}<Delta value={site.gsc.impressions_delta} /></>
                      : '—'
                    }
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.gsc ? `${(site.gsc.ctr * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.gsc ? site.gsc.position.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.ga4
                      ? site.ga4.sessions.toLocaleString()
                      : <Link to="/settings" className="text-[10px]" style={{ color: 'var(--brand)' }}>Connect GA4</Link>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {site.ga4 ? `${(site.ga4.bounce_rate * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {site.last_crawl
                      ? new Date(site.last_crawl).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task KPI row */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Task Summary</p>
        <div className="flex gap-3">
          <KpiCard label="Backlog"     count={task_summary.backlog}     status="backlog" />
          <KpiCard label="In Progress" count={task_summary.in_progress} status="in_progress" />
          <KpiCard label="Review"      count={task_summary.review}      status="review" />
          <KpiCard label="Done"        count={task_summary.done}        status="done" />
        </div>
      </div>

      {/* Compact Kanban */}
      {kanban && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Task Board</p>
            <Link to="/tasks" className="text-xs" style={{ color: 'var(--brand)' }}>View all →</Link>
          </div>
          <div className="p-4 grid grid-cols-4 gap-4">
            {['backlog', 'in_progress', 'review', 'done'].map(status => (
              <KanbanColumn key={status} status={status} tasks={kanban[status] || []} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
