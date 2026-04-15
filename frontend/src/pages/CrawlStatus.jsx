import { useState, useEffect, useCallback } from 'react';
import { useNavigate }   from 'react-router';
import { io }            from 'socket.io-client';
import { Activity, Plus, Clock, Radio, Trash2, XCircle, PauseCircle, PlayCircle } from 'lucide-react';
import api               from '../api/index.js';
import { useSites }      from '../context/SitesContext.jsx';
import { useToast }      from '../context/ToastContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';
import { Button }          from '../components/ui/Button.jsx';
import { Modal }           from '../components/ui/Modal.jsx';

const STATUS_META = {
  queued:    { label: 'Queued',    color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)' },
  running:   { label: 'Running',   color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)' },
  paused:    { label: 'Paused',    color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)' },
  completed: { label: 'Completed', color: 'var(--severity-pass)',     bg: 'var(--severity-pass-bg)' },
  failed:    { label: 'Failed',    color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--text-muted)',        bg: 'var(--bg-raised)' },
  imported:  { label: 'Imported',  color: 'var(--severity-pass)',     bg: 'var(--severity-pass-bg)' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.cancelled;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ color: m.color, backgroundColor: m.bg }}>
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: m.color }} />
      )}
      {m.label}
    </span>
  );
}

function formatDuration(startedAt, completedAt) {
  if (!startedAt) return '—';
  const end = completedAt ? new Date(completedAt) : new Date();
  const s   = Math.floor((end - new Date(startedAt)) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function CrawlStatus() {
  const navigate                   = useNavigate();
  const { activeSite }             = useSites();
  const { toast }                  = useToast();

  const [jobs,        setJobs]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [showAll,     setShowAll]     = useState(!activeSite);

  const fetchJobs = useCallback(async () => {
    try {
      const params = showAll ? {} : { site_id: activeSite?.id };
      const res = await api.get('/crawls', { params });
      setJobs(res.data.jobs || []);
      setTotal(res.data.total || 0);
    } catch {
      // silently handled by api interceptor
    } finally {
      setLoading(false);
    }
  }, [activeSite, showAll]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Live updates via Socket.io
  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socket.on('crawl:updated', () => fetchJobs());
    socket.on('crawl:complete', () => fetchJobs());
    return () => socket.disconnect();
  }, [fetchJobs]);

  const handleCancel = async (job) => {
    try {
      await api.post(`/crawls/${job.id}/cancel`);
      toast.success('Crawl cancelled');
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancel failed');
    }
  };

  const handlePause = async (job) => {
    try {
      await api.post(`/crawls/${job.id}/pause`);
      toast.success('Crawl paused');
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Pause failed');
    }
  };

  const handleResume = async (job) => {
    try {
      await api.post(`/crawls/${job.id}/resume`);
      toast.success('Crawl resumed');
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Resume failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/crawls/${deleteTarget.id}`);
      toast.success('Job deleted');
      setDeleteTarget(null);
      fetchJobs();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const hasRunning = jobs.some(j => ['queued', 'running'].includes(j.status));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Crawl Jobs</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {total} job{total !== 1 ? 's' : ''}{activeSite && !showAll ? ` for ${activeSite.label}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSite && (
            <Button
              variant="secondary" size="sm"
              onClick={() => setShowAll(v => !v)}
            >
              {showAll ? 'This site only' : 'All sites'}
            </Button>
          )}
          <Button
            iconLeft={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/crawl')}
          >
            New Crawl
          </Button>
        </div>
      </div>

      {/* Running banner */}
      {hasRunning && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg mb-4"
          style={{ backgroundColor: 'var(--severity-info-bg)', border: '1px solid var(--severity-info-border)' }}
        >
          <Radio className="w-4 h-4 animate-pulse" style={{ color: 'var(--severity-info)' }} />
          <p className="text-sm" style={{ color: 'var(--severity-info-text)' }}>
            A crawl is in progress. Live view updates automatically.
          </p>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton type="table" rows={5} cols={6} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Activity}
          message="No crawl jobs yet"
          description="Start a crawl to begin auditing your site."
          action={{ label: 'Start Crawl', to: '/crawl' }}
        />
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border-default)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
                {['Site', 'Status', 'Mode', 'URLs', 'Started', 'Duration', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ backgroundColor: 'var(--bg-surface)' }}>
              {jobs.map((job, i) => (
                <tr key={job.id}
                  style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                >
                  {/* Site */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: job.site_color || 'var(--brand)' }} />
                      <span className="font-medium truncate max-w-[140px]"
                        style={{ color: 'var(--text-primary)' }}>
                        {job.site_label || '—'}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>

                  {/* Mode */}
                  <td className="px-4 py-3">
                    <span className="capitalize text-xs" style={{ color: 'var(--text-muted)' }}>
                      {job.mode || 'spider'}
                    </span>
                  </td>

                  {/* URLs */}
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {job.total_urls?.toLocaleString() || '—'}
                  </td>

                  {/* Started */}
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      {formatDate(job.started_at)}
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {formatDuration(job.started_at, job.completed_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {['queued', 'running', 'paused'].includes(job.status) && (
                        <>
                          <Button
                            variant="ghost" size="sm"
                            iconLeft={<Radio className="w-3.5 h-3.5" />}
                            onClick={() => navigate(`/crawl/${job.id}/live`)}
                          >
                            Live
                          </Button>
                          {job.status === 'running' && (
                            <Button
                              variant="ghost" size="sm"
                              iconLeft={<PauseCircle className="w-3.5 h-3.5" />}
                              onClick={() => handlePause(job)}
                            >
                              Pause
                            </Button>
                          )}
                          {job.status === 'paused' && (
                            <Button
                              variant="ghost" size="sm"
                              iconLeft={<PlayCircle className="w-3.5 h-3.5" />}
                              onClick={() => handleResume(job)}
                            >
                              Resume
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            iconLeft={<XCircle className="w-3.5 h-3.5" />}
                            onClick={() => handleCancel(job)}
                            style={{ color: 'var(--severity-critical)' }}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {job.status === 'completed' && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => navigate('/audit')}
                        >
                          View Audit
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        iconLeft={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => setDeleteTarget(job)}
                        disabled={['queued', 'running'].includes(job.status)}
                        style={{ color: 'var(--severity-critical)' }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete job" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Permanently delete this crawl job and all its audit results?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
