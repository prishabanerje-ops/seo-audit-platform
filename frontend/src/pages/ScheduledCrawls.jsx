/**
 * ScheduledCrawls — Manage recurring automated site audit schedules.
 *
 * Shows:
 * - Table of existing schedules with site names, cron expression, last/next run, notify flags, enabled toggle, delete
 * - Create Schedule modal with site multi-select, cron presets, notify options
 *
 * Access: admin and superadmin only. seo/readonly see an access-denied EmptyState.
 */
import { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import api from '../api/index.js';
import { useSites } from '../context/SitesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

// ── Cron presets ──────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Daily 2am',      value: '0 2 * * *'  },
  { label: 'Weekly Mon 2am', value: '0 2 * * 1'  },
  { label: 'Every 6 hours',  value: '0 */6 * * *' },
  { label: 'Hourly',         value: '0 * * * *'  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(val) {
  if (!val) return 'Never';
  try {
    return new Date(val).toLocaleString();
  } catch {
    return String(val);
  }
}

// ── Create Schedule Modal ─────────────────────────────────────────────────────

function CreateScheduleModal({ sites, onClose, onCreated }) {
  const [selectedSiteIds, setSelectedSiteIds] = useState([]);
  const [cron,            setCron]            = useState('');
  const [notifySlack,     setNotifySlack]     = useState(false);
  const [notifyEmail,     setNotifyEmail]     = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleSite(id) {
    setSelectedSiteIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setValidationError(null);
    if (selectedSiteIds.length === 0) {
      setValidationError('Select at least one site.');
      return;
    }
    if (!cron.trim()) {
      setValidationError('Cron expression is required.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/schedules', {
        site_ids:      selectedSiteIds,
        cron_expression: cron.trim(),
        notify_slack:  notifySlack,
        notify_email:  notifyEmail,
      });
      onCreated(data.schedule);
      onClose();
    } catch (err) {
      setValidationError(err.response?.data?.error || 'Failed to create schedule');
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Overlay backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create Schedule"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: 'var(--bg-overlay)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        zIndex:          1000,
        padding:         '16px',
      }}
    >
      {/* Modal card */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border:          '1px solid var(--border)',
          borderRadius:    '14px',
          width:           '100%',
          maxWidth:        '520px',
          maxHeight:       '90vh',
          overflowY:       'auto',
          padding:         '24px',
          display:         'flex',
          flexDirection:   'column',
          gap:             '20px',
        }}
      >
        {/* Header */}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Add Schedule
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Configure a recurring audit schedule for one or more sites.
          </p>
        </div>

        {/* Site multi-select */}
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', marginTop: 0 }}>
            SITES
          </p>
          {sites.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No sites available.</p>
          ) : (
            <div
              style={{
                border:       '1px solid var(--border)',
                borderRadius: '8px',
                maxHeight:    '160px',
                overflowY:    'auto',
              }}
            >
              {sites.map((site, idx) => (
                <label
                  key={site.id}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             '10px',
                    padding:         '9px 12px',
                    cursor:          'pointer',
                    borderTop:       idx > 0 ? '1px solid var(--border)' : 'none',
                    backgroundColor: selectedSiteIds.includes(site.id) ? 'var(--bg-raised)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSiteIds.includes(site.id)}
                    onChange={() => toggleSite(site.id)}
                    style={{ accentColor: 'var(--brand)', width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {site.name || site.domain || site.id}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Cron expression */}
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', marginTop: 0 }}>
            CRON EXPRESSION
          </p>
          <input
            type="text"
            value={cron}
            onChange={e => setCron(e.target.value)}
            placeholder="e.g. 0 2 * * *"
            style={{
              width:           '100%',
              boxSizing:       'border-box',
              padding:         '9px 12px',
              fontSize:        '13px',
              fontFamily:      'monospace',
              border:          '1px solid var(--border)',
              borderRadius:    '8px',
              backgroundColor: 'var(--bg-raised)',
              color:           'var(--text-primary)',
              outline:         'none',
            }}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0 }}>
            e.g. <code style={{ fontFamily: 'monospace' }}>0 2 * * *</code> for daily at 2am
          </p>

          {/* Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {PRESETS.map(preset => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setCron(preset.value)}
                style={{
                  padding:         '5px 12px',
                  fontSize:        '12px',
                  fontWeight:      500,
                  border:          '1px solid var(--border)',
                  borderRadius:    '6px',
                  backgroundColor: cron === preset.value ? 'var(--brand)' : 'var(--bg-surface)',
                  color:           cron === preset.value ? 'var(--text-inverse)' : 'var(--text-primary)',
                  cursor:          'pointer',
                  transition:      'background-color 0.15s, color 0.15s',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notify options */}
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', marginTop: 0 }}>
            NOTIFICATIONS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={notifySlack}
                onChange={e => setNotifySlack(e.target.checked)}
                style={{ accentColor: 'var(--brand)', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Notify via Slack</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={e => setNotifyEmail(e.target.checked)}
                style={{ accentColor: 'var(--brand)', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Notify via Email</span>
            </label>
          </div>
        </div>

        {/* Validation error */}
        {validationError && (
          <div
            style={{
              display:         'flex',
              alignItems:      'center',
              gap:             '8px',
              padding:         '10px 12px',
              backgroundColor: 'var(--bg-raised)',
              border:          '1px solid var(--severity-critical)',
              borderRadius:    '8px',
              fontSize:        '13px',
              color:           'var(--severity-critical)',
            }}
          >
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
            {validationError}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding:         '8px 20px',
              fontSize:        '13px',
              fontWeight:      500,
              border:          '1px solid var(--border)',
              borderRadius:    '8px',
              backgroundColor: 'var(--bg-surface)',
              color:           'var(--text-primary)',
              cursor:          saving ? 'not-allowed' : 'pointer',
              opacity:         saving ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding:         '8px 20px',
              fontSize:        '13px',
              fontWeight:      600,
              border:          'none',
              borderRadius:    '8px',
              backgroundColor: 'var(--brand)',
              color:           'var(--text-inverse)',
              cursor:          saving ? 'not-allowed' : 'pointer',
              opacity:         saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schedules table ───────────────────────────────────────────────────────────

const TABLE_HEADERS = ['Sites', 'Cron Expression', 'Last Run', 'Next Run', 'Notify', 'Enabled', 'Actions'];

function SchedulesTable({ schedules, sites, onToggle, onDelete }) {
  // Build a site lookup map: id → label
  const siteMap = {};
  for (const s of sites) {
    siteMap[s.id] = s.name || s.domain || s.id;
  }

  function getSiteLabel(id) {
    return siteMap[id] ?? String(id).slice(0, 8) + '…';
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border:          '1px solid var(--border)',
        borderRadius:    '12px',
        overflow:        'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-raised)' }}>
              {TABLE_HEADERS.map(h => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    padding:    '10px 14px',
                    textAlign:  'left',
                    fontSize:   '11px',
                    fontWeight: 500,
                    color:      'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedules.map(schedule => {
              const siteLabels = Array.isArray(schedule.site_ids)
                ? schedule.site_ids.map(getSiteLabel).join(', ')
                : '—';

              return (
                <tr
                  key={schedule.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-raised)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Sites */}
                  <td
                    style={{
                      padding:      '11px 14px',
                      color:        'var(--text-primary)',
                      maxWidth:     '220px',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                    title={siteLabels}
                  >
                    {siteLabels}
                  </td>

                  {/* Cron expression */}
                  <td
                    style={{
                      padding:    '11px 14px',
                      color:      'var(--text-primary)',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {schedule.cron_expression}
                  </td>

                  {/* Last Run */}
                  <td style={{ padding: '11px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(schedule.last_run)}
                  </td>

                  {/* Next Run */}
                  <td style={{ padding: '11px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(schedule.next_run)}
                  </td>

                  {/* Notify badges */}
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    {!schedule.notify_slack && !schedule.notify_email ? (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: '6px' }}>
                        {schedule.notify_slack && (
                          <span
                            style={{
                              fontSize:        '11px',
                              fontWeight:      500,
                              padding:         '2px 8px',
                              borderRadius:    '20px',
                              backgroundColor: 'var(--bg-raised)',
                              border:          '1px solid var(--border)',
                              color:           'var(--text-primary)',
                            }}
                          >
                            Slack
                          </span>
                        )}
                        {schedule.notify_email && (
                          <span
                            style={{
                              fontSize:        '11px',
                              fontWeight:      500,
                              padding:         '2px 8px',
                              borderRadius:    '20px',
                              backgroundColor: 'var(--bg-raised)',
                              border:          '1px solid var(--border)',
                              color:           'var(--text-primary)',
                            }}
                          >
                            Email
                          </span>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Enabled toggle */}
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      type="button"
                      onClick={() => onToggle(schedule)}
                      title={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
                      style={{
                        background: 'none',
                        border:     'none',
                        padding:    0,
                        cursor:     'pointer',
                        lineHeight: 0,
                        display:    'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      {schedule.enabled ? (
                        <ToggleRight
                          style={{ width: 24, height: 24, color: 'var(--severity-pass)' }}
                        />
                      ) : (
                        <ToggleLeft
                          style={{ width: 24, height: 24, color: 'var(--text-muted)' }}
                        />
                      )}
                    </button>
                  </td>

                  {/* Delete */}
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      type="button"
                      onClick={() => onDelete(schedule)}
                      title="Delete schedule"
                      style={{
                        background: 'none',
                        border:     'none',
                        padding:    '4px',
                        cursor:     'pointer',
                        borderRadius: '6px',
                        lineHeight: 0,
                        display:    'inline-flex',
                        alignItems: 'center',
                        color:      'var(--text-muted)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--severity-critical)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <Trash2 style={{ width: 15, height: 15 }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ScheduledCrawls() {
  const { sites }  = useSites();
  const { user }   = useAuth();

  const [schedules,   setSchedules]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [showModal,   setShowModal]   = useState(false);

  const isAdminLike = user?.role === 'admin' || user?.role === 'superadmin';

  // ── Data fetching ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (user?.role === 'superadmin') {
        params.company_id = user.company_id;
      }
      const { data } = await api.get('/schedules', { params });
      setSchedules(data.schedules || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Access guard (after all hooks) ─────────────────────────────────────────

  if (!isAdminLike) {
    return (
      <div style={{ padding: '24px' }}>
        <EmptyState
          icon={AlertTriangle}
          message="Access denied"
          description="Scheduled crawl management is available to admin and superadmin users only."
        />
      </div>
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleToggle(schedule) {
    const next = !schedule.enabled;
    // Optimistic update
    setSchedules(prev =>
      prev.map(s => s.id === schedule.id ? { ...s, enabled: next } : s)
    );
    try {
      const { data } = await api.patch(`/schedules/${schedule.id}`, { enabled: next });
      setSchedules(prev =>
        prev.map(s => s.id === schedule.id ? data.schedule : s)
      );
    } catch {
      // Roll back
      setSchedules(prev =>
        prev.map(s => s.id === schedule.id ? { ...s, enabled: schedule.enabled } : s)
      );
    }
  }

  async function handleDelete(schedule) {
    const confirmed = window.confirm(
      'Delete this schedule? Crawls will no longer run automatically for the configured sites.'
    );
    if (!confirmed) return;
    try {
      await api.delete(`/schedules/${schedule.id}`);
      setSchedules(prev => prev.filter(s => s.id !== schedule.id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete schedule');
    }
  }

  function handleCreated(schedule) {
    setSchedules(prev => [schedule, ...prev]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', maxWidth: '1080px', margin: '0 auto' }}>

      {/* Page header */}
      <div
        style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          flexWrap:       'wrap',
          gap:            '12px',
          marginBottom:   '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize:   '20px',
              fontWeight: 700,
              color:      'var(--text-primary)',
              margin:     0,
              display:    'flex',
              alignItems: 'center',
              gap:        '8px',
            }}
          >
            <Clock style={{ width: 20, height: 20, color: 'var(--text-muted)' }} />
            Scheduled Crawls
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Automate recurring site audits
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            gap:             '6px',
            padding:         '9px 18px',
            fontSize:        '13px',
            fontWeight:      600,
            border:          'none',
            borderRadius:    '8px',
            backgroundColor: 'var(--brand)',
            color:           'var(--text-inverse)',
            cursor:          'pointer',
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
          Add Schedule
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <LoadingSkeleton rows={4} columns={6} />
      )}

      {/* Error state */}
      {!loading && error && (
        <EmptyState
          icon={AlertTriangle}
          message="Failed to load schedules"
          description={error}
        />
      )}

      {/* Empty state */}
      {!loading && !error && schedules.length === 0 && (
        <EmptyState
          icon={Clock}
          message="No scheduled crawls yet"
          description="Set up automated crawls to keep your audit data fresh."
          action={{ label: 'Add Schedule', onClick: () => setShowModal(true) }}
        />
      )}

      {/* Schedules table */}
      {!loading && !error && schedules.length > 0 && (
        <SchedulesTable
          schedules={schedules}
          sites={sites || []}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      )}

      {/* Create modal */}
      {showModal && (
        <CreateScheduleModal
          sites={sites || []}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
