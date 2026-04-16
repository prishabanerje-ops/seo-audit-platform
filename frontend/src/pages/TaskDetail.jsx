/**
 * TaskDetail — single task: metadata panel + comments thread.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link }                  from 'react-router';
import { ArrowLeft, ExternalLink }          from 'lucide-react';
import { toast }                            from 'sonner';
import api               from '../api/index.js';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';

const VALID_STATUSES   = ['backlog', 'in_progress', 'review', 'done'];
const STATUS_LABELS    = { backlog: 'Backlog', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

function MetaField({ label, children }) {
  return (
    <div className="py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {children}
    </div>
  );
}

function Comment({ comment }) {
  const initials = (comment.user_name || comment.user_email || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="flex gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--brand)' }}
      >
        {initials}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {comment.user_name || comment.user_email}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{comment.body}</p>
      </div>
    </div>
  );
}

export function TaskDetail() {
  const { id }                    = useParams();
  const [task,       setTask]     = useState(null);
  const [comments,   setComments] = useState([]);
  const [loading,    setLoading]  = useState(true);
  const [notFound,   setNotFound] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saving,     setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks/${id}`);
      setTask(res.data.task);
      setComments(res.data.comments || []);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function patchTask(fields) {
    setSaving(true);
    try {
      const res = await api.patch(`/tasks/${id}`, fields);
      setTask(res.data.task);
    } catch {
      // toast shown by interceptor
    } finally {
      setSaving(false);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/tasks/${id}/comments`, { body: newComment.trim() });
      setComments(prev => [...prev, res.data.comment]);
      setNewComment('');
    } catch {
      // toast shown by interceptor
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6"><LoadingSkeleton type="table" rows={6} columns={2} /></div>;

  if (notFound) {
    return (
      <div className="p-6">
        <EmptyState message="Task not found" description="This task may have been deleted." action={{ label: '← Back to Tasks', to: '/tasks' }} />
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        to="/tasks"
        className="inline-flex items-center gap-1.5 text-xs mb-4"
        style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Tasks
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Title + Comments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Inline-editable title */}
          <input
            className="w-full text-lg font-bold bg-transparent border-0 outline-none"
            style={{ color: 'var(--text-primary)' }}
            defaultValue={task.title}
            onBlur={e => {
              if (e.target.value.trim() && e.target.value !== task.title) {
                patchTask({ title: e.target.value.trim() });
              }
            }}
          />

          {/* Comments thread */}
          <div
            className="rounded-xl p-4 space-y-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Comments ({comments.length})
            </p>
            {comments.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No comments yet.</p>
            )}
            {comments.map(c => <Comment key={c.id} comment={c} />)}
          </div>

          {/* New comment form */}
          <form onSubmit={submitComment} className="space-y-2">
            <textarea
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              placeholder="Add a comment…"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--brand)', color: '#fff', opacity: submitting || !newComment.trim() ? 0.6 : 1 }}
              >
                {submitting ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Metadata */}
        <div
          className="rounded-xl p-4 h-fit"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Details</p>

          <MetaField label="Status">
            <select
              className="w-full rounded-lg px-2 py-1.5 text-xs"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              value={task.status}
              onChange={e => patchTask({ status: e.target.value })}
              disabled={saving}
            >
              {VALID_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </MetaField>

          <MetaField label="Priority">
            <select
              className="w-full rounded-lg px-2 py-1.5 text-xs"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              value={task.priority || 'medium'}
              onChange={e => patchTask({ priority: e.target.value })}
              disabled={saving}
            >
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </MetaField>

          <MetaField label="Site">
            <p className="text-xs flex items-center gap-1.5">
              {task.site_color && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.site_color }} />
              )}
              <span style={{ color: 'var(--text-secondary)' }}>{task.site_label || task.site_id}</span>
            </p>
          </MetaField>

          {task.assignee_name && (
            <MetaField label="Assignee">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{task.assignee_name}</p>
            </MetaField>
          )}

          {task.due_date && (
            <MetaField label="Due Date">
              <p
                className="text-xs"
                style={{ color: new Date(task.due_date) < new Date() ? 'var(--severity-critical)' : 'var(--text-secondary)' }}
              >
                {new Date(task.due_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </MetaField>
          )}

          {task.linear_url && (
            <MetaField label="Linear">
              <a
                href={task.linear_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs"
                style={{ color: 'var(--brand)' }}
              >
                View in Linear <ExternalLink className="w-3 h-3" />
              </a>
            </MetaField>
          )}

          <MetaField label="Created">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </MetaField>
        </div>
      </div>
    </div>
  );
}
