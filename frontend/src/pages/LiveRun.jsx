import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate }  from 'react-router';
import { io }                      from 'socket.io-client';
import {
  Radio, XCircle, ArrowLeft, CheckCircle2, AlertCircle, Clock,
  Globe, Zap,
} from 'lucide-react';
import api         from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button }   from '../components/ui/Button.jsx';

const STATUS_META = {
  queued:    { label: 'Queued',    icon: Clock,        color: 'var(--severity-info)' },
  running:   { label: 'Running',   icon: Radio,        color: 'var(--severity-info)' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'var(--severity-pass)' },
  failed:    { label: 'Failed',    icon: AlertCircle,  color: 'var(--severity-critical)' },
  cancelled: { label: 'Cancelled', icon: XCircle,      color: 'var(--text-muted)' },
};

function StatusBadge({ code }) {
  const n = parseInt(code, 10);
  const color = n >= 500 ? 'var(--severity-critical)'
              : n >= 400 ? 'var(--severity-warning)'
              : n >= 300 ? 'var(--severity-info)'
              : n >= 200 ? 'var(--severity-pass)'
              : 'var(--text-muted)';
  const bg    = n >= 500 ? 'var(--severity-critical-bg)'
              : n >= 400 ? 'var(--severity-warning-bg)'
              : n >= 300 ? 'var(--severity-info-bg)'
              : n >= 200 ? 'var(--severity-pass-bg)'
              : 'var(--bg-raised)';
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono font-semibold"
      style={{ color, backgroundColor: bg }}
    >
      {code || '—'}
    </span>
  );
}

function IndexBadge({ value }) {
  const isIndexable = value === 'Indexable';
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
      style={{
        color:           isIndexable ? 'var(--severity-pass)'           : value ? 'var(--severity-warning)'           : 'var(--text-muted)',
        backgroundColor: isIndexable ? 'var(--severity-pass-bg)'        : value ? 'var(--severity-warning-bg)'        : 'transparent',
      }}
    >
      {value || '—'}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div
      className="flex flex-col gap-1.5 p-3 rounded-lg"
      style={{ backgroundColor: 'var(--bg-raised)' }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: color || 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <span className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
      </span>
    </div>
  );
}

export function LiveRun() {
  const { jobId }   = useParams();
  const navigate    = useNavigate();
  const { toast }   = useToast();
  const urlEndRef   = useRef(null);
  const socketRef   = useRef(null);

  const [job,        setJob]       = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [urlCount,   setUrlCount]  = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [liveUrls,   setLiveUrls]  = useState([]);   // { url, ts }[]
  const [crawlSpeed, setCrawlSpeed] = useState(0);   // URLs/sec

  const prevCountRef = useRef(0);
  const prevTickRef  = useRef(null);

  // Fetch initial job state
  const fetchJob = useCallback(async () => {
    try {
      const res = await api.get(`/crawls/${jobId}`);
      setJob(res.data);
      setUrlCount(res.data.total_urls || 0);
    } catch {
      toast.error('Crawl job not found');
      navigate('/crawl/status');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  // Polling fallback — if the Socket.io completion event was missed (e.g. tunnel
  // restart dropped the WebSocket), poll the API every 3 s until the job settles.
  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/crawls/${jobId}`);
        const latest = res.data;
        if (!['queued', 'running'].includes(latest.status)) {
          setJob(latest);
          setUrlCount(latest.total_urls || 0);
          setCrawlSpeed(0);
        }
      } catch { /* ignore — socket events will still update if connected */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [job?.status, jobId]);

  // Socket.io
  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => { socket.emit('join:job', jobId); });

    socket.on('crawl:progress', (data) => {
      if (data.jobId !== jobId) return;
      if (typeof data.urlCount === 'number') {
        const now = Date.now();
        setUrlCount(data.urlCount);

        // Compute rolling URLs/sec
        if (prevTickRef.current) {
          const dtSec = (now - prevTickRef.current) / 1000;
          const delta = data.urlCount - prevCountRef.current;
          if (dtSec > 0 && delta >= 0) setCrawlSpeed(Math.round(delta / dtSec));
        }
        prevCountRef.current = data.urlCount;
        prevTickRef.current  = now;
      }
    });

    // Replay of buffered URLs — sent immediately on join (catches up late-joiners)
    socket.on('crawl:urls:replay', (items) => {
      setLiveUrls(items.map(d => ({
        url:          d.url,
        statusCode:   d.statusCode   || '',
        title:        d.title        || '',
        h1:           d.h1           || '',
        indexability: d.indexability || '',
        responseTime: d.responseTime || '',
        ts:           '—',
      })));
    });

    // Per-URL event — streams each page as it's crawled in real time
    socket.on('crawl:url', (data) => {
      if (data.jobId !== jobId) return;
      setLiveUrls(prev => {
        const next = [...prev, {
          url:          data.url,
          statusCode:   data.statusCode   || '',
          title:        data.title        || '',
          h1:           data.h1           || '',
          indexability: data.indexability || '',
          responseTime: data.responseTime || '',
          ts:           new Date().toLocaleTimeString(),
        }];
        return next.slice(-500);
      });
    });

    socket.on('crawl:complete', (data) => {
      if (data.jobId !== jobId) return;
      setUrlCount(data.totalUrls || 0);
      setCrawlSpeed(0);
      setJob(prev => prev ? { ...prev, status: 'completed', total_urls: data.totalUrls } : prev);
    });

    socket.on('crawl:error', (data) => {
      if (data.jobId !== jobId) return;
      setJob(prev => prev ? { ...prev, status: 'failed' } : prev);
    });

    socket.on('crawl:updated', (data) => {
      if (data.jobId !== jobId) return;
      if (data.status) setJob(prev => prev ? { ...prev, status: data.status } : prev);
    });

    return () => {
      socket.emit('leave:job', jobId);
      socket.disconnect();
    };
  }, [jobId]);

  // Auto-scroll live URL feed
  useEffect(() => {
    urlEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveUrls]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/crawls/${jobId}/cancel`);
      toast.success('Crawl cancelled');
      setJob(prev => prev ? { ...prev, status: 'cancelled' } : prev);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Radio className="w-5 h-5 animate-pulse" style={{ color: 'var(--brand)' }} />
      </div>
    );
  }

  const statusMeta = STATUS_META[job?.status] || STATUS_META.queued;
  const StatusIcon = statusMeta.icon;
  const isActive   = ['queued', 'running'].includes(job?.status);
  const isRunning  = job?.status === 'running';

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => navigate('/crawl/status')}
        className="flex items-center gap-1.5 text-sm mb-5 w-fit"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft className="w-4 h-4" /> Back to jobs
      </button>

      {/* Job header */}
      <div
        className="rounded-xl p-5 mb-4"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: job?.site_color || 'var(--brand)' }} />
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {job?.site_label || 'Unknown Site'}
              </span>
            </div>
            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{jobId}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold font-mono leading-none" style={{ color: 'var(--text-primary)' }}>
                {urlCount.toLocaleString()}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>URLs found</p>
            </div>

            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-raised)' }}
            >
              <StatusIcon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} style={{ color: statusMeta.color }} />
              <span className="text-sm font-medium" style={{ color: statusMeta.color }}>{statusMeta.label}</span>
            </div>

            {isActive && (
              <Button
                variant="destructive" size="sm"
                loading={cancelling}
                iconLeft={<XCircle className="w-3.5 h-3.5" />}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            )}

            {job?.status === 'completed' && (
              <Button size="sm" onClick={() => navigate('/audit')}>View Audit →</Button>
            )}
          </div>
        </div>

        {job?.error_message && (
          <div className="mt-3 p-3 rounded-md text-sm"
            style={{ backgroundColor: 'var(--severity-critical-bg)', color: 'var(--severity-critical-text)' }}>
            {job.error_message}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard icon={Globe} label="URLs Crawled" value={urlCount}                                    color="var(--brand)" />
        <StatCard icon={Zap}   label="URLs / sec"   value={isRunning ? crawlSpeed : '—'}               color="var(--severity-info)" />
      </div>

      {/* Progress bar — indeterminate while running */}
      <div
        className="rounded-xl p-4 mb-3"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Crawl Progress
          </span>
          <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
            {job?.status === 'completed' ? 'Complete' : isActive ? 'In progress…' : statusMeta.label}
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-raised)' }}>
          {job?.status === 'completed' ? (
            <div className="h-full w-full rounded-full" style={{ backgroundColor: 'var(--severity-pass)' }} />
          ) : isActive ? (
            <div
              className="h-full rounded-full"
              style={{
                width: '40%',
                backgroundColor: 'var(--brand)',
                animation: 'indeterminate 1.6s ease-in-out infinite',
              }}
            />
          ) : null}
        </div>
      </div>

      {/* Live URL table */}
      <div
        className="flex-1 rounded-xl flex flex-col min-h-0 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        {/* Table header bar */}
        <div
          className="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--bg-raised)' }}
        >
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Live Crawl
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}
            >
              {liveUrls.length}
            </span>
          </div>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--severity-pass)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--severity-pass)' }} />
              Live
            </span>
          )}
        </div>

        {liveUrls.length === 0 ? (
          <div className="flex items-center justify-center flex-1" style={{ color: 'var(--text-muted)' }}>
            {isActive ? (
              <div className="flex items-center gap-2 text-sm">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Waiting for URLs…</span>
              </div>
            ) : (
              <span className="text-sm">No URLs captured.</span>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-xs border-collapse" style={{ minWidth: '700px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
                  {['Status', 'URL', 'Title', 'H1', 'Indexability', 'Time (ms)'].map(col => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-semibold whitespace-nowrap sticky top-0"
                      style={{
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-raised)',
                        borderBottom: '1px solid var(--border-default)',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveUrls.map((row, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid var(--border-subtle, var(--border-default))' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                  >
                    {/* Status code */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <StatusBadge code={row.statusCode} />
                    </td>
                    {/* URL */}
                    <td className="px-3 py-1.5 font-mono max-w-xs">
                      <span className="block truncate" title={row.url} style={{ color: 'var(--brand)' }}>
                        {row.url}
                      </span>
                    </td>
                    {/* Title */}
                    <td className="px-3 py-1.5 max-w-[200px]">
                      <span className="block truncate" title={row.title} style={{ color: 'var(--text-primary)' }}>
                        {row.title || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </span>
                    </td>
                    {/* H1 */}
                    <td className="px-3 py-1.5 max-w-[160px]">
                      <span className="block truncate" title={row.h1} style={{ color: 'var(--text-secondary)' }}>
                        {row.h1 || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </span>
                    </td>
                    {/* Indexability */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <IndexBadge value={row.indexability} />
                    </td>
                    {/* Response time */}
                    <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {row.responseTime || '—'}
                    </td>
                  </tr>
                ))}
                <tr><td colSpan={6}><div ref={urlEndRef} /></td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Indeterminate progress bar animation */}
      <style>{`
        @keyframes indeterminate {
          0%   { margin-left: -40%; }
          60%  { margin-left: 120%; }
          100% { margin-left: 120%; }
        }
      `}</style>
    </div>
  );
}
