/**
 * Notifications — view and manage platform notifications.
 * Fetches from GET /api/notifications, supports filter toggle (All | Unread).
 */
import { useState, useEffect, useCallback } from 'react';
import { Link }                              from 'react-router';
import { Bell, Trash2, Check }               from 'lucide-react';
import { toast }                             from 'sonner';
import api                                   from '../api/index.js';
import { LoadingSkeleton }                   from '../components/LoadingSkeleton.jsx';
import { EmptyState }                        from '../components/EmptyState.jsx';

/** Notify the Header bell badge of the new unread count. */
function emitUnreadCount(count) {
  window.dispatchEvent(new CustomEvent('notifications:count', { detail: { count } }));
}

export function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [filter,        setFilter]        = useState('all'); // 'all' | 'unread'
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [markingAll,    setMarkingAll]    = useState(false);

  const fetchNotifications = useCallback(async (activeFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params = activeFilter === 'unread' ? { unread: true } : {};
      const { data } = await api.get('/notifications', { params });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count ?? 0);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(filter);
  }, [filter, fetchNotifications]);

  const handleMarkRead = async (id) => {
    // Snapshot before optimistic update
    const prevNotifications = notifications;
    const prevCount = unreadCount;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
      emitUnreadCount(Math.max(0, prevCount - 1));
    } catch (err) {
      // Rollback
      setNotifications(prevNotifications);
      setUnreadCount(prevCount);
      toast.error(err?.response?.data?.error || 'Failed to mark notification as read');
    }
  };

  const handleDelete = async (id) => {
    // Snapshot before optimistic update — avoids stale closure issues
    const snapshot = notifications.slice();
    const item = snapshot.find(n => n.id === id);
    const wasUnread = item?.is_read === 0;
    const prevCount = unreadCount;
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await api.delete(`/notifications/${id}`);
      if (wasUnread) emitUnreadCount(Math.max(0, prevCount - 1));
    } catch (err) {
      // Rollback
      setNotifications(snapshot);
      setUnreadCount(prevCount);
      toast.error(err?.response?.data?.error || 'Failed to delete notification');
    }
  };

  const handleMarkAllRead = async () => {
    const snapshot = notifications.slice();
    const prevCount = unreadCount;
    setMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
    try {
      await api.patch('/notifications/read-all');
      emitUnreadCount(0);
    } catch (err) {
      // Rollback
      setNotifications(snapshot);
      setUnreadCount(prevCount);
      toast.error(err?.response?.data?.error || 'Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const hasUnread = notifications.some(n => n.is_read === 0);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Notifications
          </h1>
          <button
            onClick={handleMarkAllRead}
            disabled={!hasUnread || markingAll}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            <Check className="w-3.5 h-3.5" />
            {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        </div>

        {/* Filter toggle */}
        <div
          className="flex items-center gap-1 p-1 rounded-lg mb-5 w-fit"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}
        >
          {['all', 'unread'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="h-7 px-3 rounded-md text-sm font-medium capitalize transition-colors"
              style={{
                backgroundColor: filter === f ? 'var(--bg-surface)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: filter === f ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {f === 'unread' && unreadCount > 0 ? `Unread (${unreadCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && <LoadingSkeleton rows={5} columns={3} />}

        {!loading && error && (
          <p className="text-sm py-4" style={{ color: 'var(--severity-critical)' }}>{error}</p>
        )}

        {!loading && !error && notifications.length === 0 && (
          <EmptyState
            icon={Bell}
            message="No notifications"
            description="You're all caught up."
          />
        )}

        {!loading && !error && notifications.length > 0 && (
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border-default)' }}
          >
            {notifications.map((n, idx) => (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3.5 relative"
                style={{
                  backgroundColor: n.is_read === 0 ? 'var(--bg-raised)' : 'transparent',
                  borderBottom: idx < notifications.length - 1 ? '1px solid var(--border-default)' : 'none',
                  borderLeft: n.is_read === 0 ? '3px solid var(--brand)' : '3px solid transparent',
                }}
              >
                {/* Bell icon */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
                >
                  <Bell className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  {n.link ? (
                    <Link
                      to={n.link}
                      className="text-sm font-medium leading-snug hover:underline"
                      style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                    >
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {n.title}
                    </p>
                  )}
                  {n.body && (
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {n.body}
                    </p>
                  )}
                </div>

                {/* Right side: time + actions */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    {n.is_read === 0 && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="flex items-center gap-1 h-6 px-2 rounded text-xs transition-colors"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-muted)',
                        }}
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3" />
                        Read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="w-6 h-6 flex items-center justify-center rounded transition-colors"
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-muted)',
                      }}
                      title="Delete notification"
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--severity-critical)'; e.currentTarget.style.borderColor = 'var(--severity-critical)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
