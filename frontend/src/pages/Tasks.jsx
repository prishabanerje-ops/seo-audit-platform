/**
 * Tasks — full 4-column Kanban board with drag-and-drop.
 * Reads from /api/tasks, writes via PATCH for status changes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams }                     from 'react-router';
import { Plus, X }                                   from 'lucide-react';
import { toast }                                     from 'sonner';
import api            from '../api/index.js';
import { useSites }   from '../context/SitesContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';

const VALID_STATUSES   = ['backlog', 'in_progress', 'review', 'done'];
const STATUS_LABELS    = { backlog: 'Backlog', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const PRIORITY_COLORS  = { critical: 'var(--severity-critical)', high: 'var(--severity-warning)', medium: 'var(--text-muted)', low: 'var(--text-muted)' };

function PriorityBadge({ priority }) {
  return (
    <span className="text-[10px] font-medium capitalize" style={{ color: PRIORITY_COLORS[priority] || 'var(--text-muted)' }}>
      {priority}
    </span>
  );
}

function TaskCard({ task, isDragging, onDragStart, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="rounded-lg p-3 cursor-grab active:cursor-grabbing transition-opacity"
      style={{
        backgroundColor: 'var(--bg-page)',
        border: '1px solid var(--border-subtle)',
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <Link
        to={`/tasks/${task.id}`}
        style={{ textDecoration: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-medium leading-tight mb-2 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
          {task.title}
        </p>
      </Link>
      <div className="flex items-center gap-2 flex-wrap">
        {task.site_color && (
          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: task.site_color }} />
            {task.site_label}
          </span>
        )}
        {task.priority && <PriorityBadge priority={task.priority} />}
        {task.assignee_name && (
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{task.assignee_name}</span>
        )}
        {task.due_date && (
          <span
            className="text-[10px]"
            style={{
              color: new Date(task.due_date) < new Date() ? 'var(--severity-critical)' : 'var(--text-muted)',
            }}
          >
            {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        {task.linear_url && (
          <a
            href={task.linear_url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] underline"
            style={{ color: 'var(--brand)' }}
            onClick={e => e.stopPropagation()}
          >
            Linear
          </a>
        )}
      </div>
    </div>
  );
}

function NewTaskModal({ sites, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', site_id: sites[0]?.id || '', description: '', priority: 'medium' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/tasks', form);
      onCreated(res.data.task);
      onClose();
    } catch {
      // error toast shown by api interceptor
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl w-full max-w-md"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Task</p>
          <button type="button" onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title *</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Site *</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              value={form.site_id}
              onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
              required
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Priority</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
            >
              {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--brand)', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KanbanColumn({ status, tasks, draggingId, onDragStart, onDrop, onDragEnd }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className="flex-1 min-w-0 flex flex-col"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(status); }}
      style={{
        backgroundColor: dragOver ? 'var(--bg-raised)' : 'transparent',
        borderRadius: 8,
        transition: 'background-color 0.15s',
        minHeight: 200,
        padding: '0 4px',
      }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {STATUS_LABELS[status]}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
        >
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2 flex-1">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isDragging={draggingId === task.id}
            onDragStart={() => onDragStart(task.id)}
            onDragEnd={onDragEnd}
          />
        ))}
        {tasks.length === 0 && !dragOver && (
          <p className="text-[11px] text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Nothing here
          </p>
        )}
      </div>
    </div>
  );
}

export function Tasks() {
  const { activeSite, sites } = useSites();
  const [searchParams] = useSearchParams();
  const [kanban,      setKanban]      = useState({ backlog: [], in_progress: [], review: [], done: [] });
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [draggingId,  setDraggingId]  = useState(null);
  const [allSites,    setAllSites]    = useState(false);
  const originalKanbanRef = useRef(null);

  const statusFilter = searchParams.get('status') || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!allSites && activeSite) params.set('siteId', activeSite.id);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/tasks?${params}`);
      setKanban(res.data.kanban);
    } catch {
      // toast shown by interceptor
    } finally {
      setLoading(false);
    }
  }, [activeSite, allSites, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function handleDragStart(taskId) {
    setDraggingId(taskId);
    originalKanbanRef.current = kanban;
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  async function handleDrop(targetStatus) {
    const taskId = draggingId;
    if (!taskId) return;

    let currentStatus = null;
    let task = null;
    for (const [s, tasks] of Object.entries(kanban)) {
      const found = tasks.find(t => t.id === taskId);
      if (found) { currentStatus = s; task = found; break; }
    }
    if (!task || currentStatus === targetStatus) return;

    // Optimistic update
    setKanban(prev => {
      const next = { ...prev };
      next[currentStatus] = prev[currentStatus].filter(t => t.id !== taskId);
      next[targetStatus]  = [{ ...task, status: targetStatus }, ...prev[targetStatus]];
      return next;
    });

    try {
      await api.patch(`/tasks/${taskId}`, { status: targetStatus });
    } catch {
      setKanban(originalKanbanRef.current);
      toast.error('Failed to update task status');
    }
    setDraggingId(null);
  }

  function handleTaskCreated(task) {
    setKanban(prev => ({
      ...prev,
      backlog: [task, ...prev.backlog],
    }));
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Tasks</h1>
          {activeSite && (
            <button
              type="button"
              className="text-xs mt-0.5"
              style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setAllSites(v => !v)}
            >
              {allSites ? 'Showing all sites — click for this site only' : `${activeSite.label} only — click for all sites`}
            </button>
          )}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--brand)', color: '#fff' }}
          onClick={() => setShowModal(true)}
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" rows={5} columns={4} />
      ) : (
        <div className="flex gap-4 flex-1 overflow-x-auto" onDragOver={e => e.preventDefault()}>
          {VALID_STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={kanban[status] || []}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewTaskModal
          sites={sites}
          onClose={() => setShowModal(false)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
