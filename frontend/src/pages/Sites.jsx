import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Globe, Pencil, Trash2, Activity, Clock, ExternalLink } from 'lucide-react';
import { useSites } from '../context/SitesContext.jsx';
import { useToast }  from '../context/ToastContext.jsx';
import { HealthRing }      from '../components/HealthRing.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { EmptyState }      from '../components/EmptyState.jsx';
import { Modal }           from '../components/ui/Modal.jsx';
import { Button }          from '../components/ui/Button.jsx';
import { Input }           from '../components/ui/Input.jsx';

const COLOR_PRESETS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {COLOR_PRESETS.map(c => (
        <button
          key={c} type="button"
          onClick={() => onChange(c)}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
          style={{ backgroundColor: c, boxShadow: value === c ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${c}` : 'none' }}
          title={c}
        >
          {value === c && <span className="text-white text-xs">✓</span>}
        </button>
      ))}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatusBadge({ status }) {
  const map = {
    completed:  { label: 'Completed',  color: 'var(--severity-pass)',    bg: 'var(--severity-pass-bg)' },
    running:    { label: 'Running',    color: 'var(--severity-info)',    bg: 'var(--severity-info-bg)' },
    queued:     { label: 'Queued',     color: 'var(--severity-info)',    bg: 'var(--severity-info-bg)' },
    failed:     { label: 'Failed',     color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    cancelled:  { label: 'Cancelled',  color: 'var(--text-muted)',       bg: 'var(--bg-raised)' },
    import:     { label: 'Imported',   color: 'var(--severity-pass)',    bg: 'var(--severity-pass-bg)' },
  };
  const s = map[status] || map.cancelled;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

export function Sites() {
  const navigate                          = useNavigate();
  const { sites, loading, deleteSite, updateSite, setActiveSite } = useSites();
  const { toast }                         = useToast();
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleting,     setDeleting]       = useState(false);
  const [editTarget,   setEditTarget]     = useState(null);
  const [editLabel,    setEditLabel]      = useState('');
  const [editUrl,      setEditUrl]        = useState('');
  const [editColor,    setEditColor]      = useState('');
  const [editGsc,      setEditGsc]        = useState('');
  const [editGa4,      setEditGa4]        = useState('');
  const [editErrors,   setEditErrors]     = useState({});
  const [saving,       setSaving]         = useState(false);

  const openEdit = (site) => {
    setEditTarget(site);
    setEditLabel(site.label);
    setEditUrl(site.url);
    setEditColor(site.color || '#6366f1');
    setEditGsc(site.gsc_property || '');
    setEditGa4(site.ga4_property_id || '');
    setEditErrors({});
  };

  const handleSaveEdit = async () => {
    const e = {};
    if (!editLabel.trim()) e.label = 'Site name is required';
    if (!editUrl.trim())   e.url   = 'URL is required';
    else { try { new URL(editUrl); } catch { e.url = 'Must be a valid URL'; } }
    if (Object.keys(e).length) { setEditErrors(e); return; }

    setSaving(true);
    try {
      await updateSite(editTarget.id, {
        label:           editLabel.trim(),
        url:             editUrl.trim().replace(/\/$/, ''),
        color:           editColor,
        gsc_property:    editGsc.trim(),
        ga4_property_id: editGa4.trim(),
      });
      toast.success(`"${editLabel}" updated`);
      setEditTarget(null);
    } catch {
      toast.error('Failed to update site');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSite(deleteTarget.id);
      toast.success(`"${deleteTarget.label}" removed`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete site');
    } finally {
      setDeleting(false);
    }
  };

  const handleCrawl = (site) => {
    setActiveSite(site);
    navigate('/crawl');
  };

  if (loading) return (
    <div className="p-6"><LoadingSkeleton type="table" rows={4} cols={5} /></div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Sites</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {sites.length} site{sites.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <Button
          iconLeft={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/sites/new')}
        >
          Add Site
        </Button>
      </div>

      {sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          message="No sites yet"
          description="Add your first site to start running SEO audits."
          action={{ label: 'Add Site', to: '/sites/new' }}
        />
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border-default)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-raised)', borderBottom: '1px solid var(--border-default)' }}>
                {['Site', 'Last Crawl', 'URLs', 'Health', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ backgroundColor: 'var(--bg-surface)' }}>
              {sites.map((site, i) => (
                <tr
                  key={site.id}
                  style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                  className="group"
                >
                  {/* Site name + URL */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: site.color || 'var(--brand)' }}
                      />
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {site.label}
                        </p>
                        <a
                          href={site.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 mt-0.5"
                          style={{ color: 'var(--text-muted)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </td>

                  {/* Last crawl */}
                  <td className="px-4 py-3">
                    {site.last_crawled_at ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {timeAgo(site.last_crawled_at)}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Never</span>
                    )}
                    {site.latest_job_status && site.latest_job_status !== 'completed' && (
                      <div className="mt-1">
                        <StatusBadge status={site.latest_job_status} />
                      </div>
                    )}
                  </td>

                  {/* URLs */}
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {site.crawl_count > 0
                      ? `${site.crawl_count} crawl${site.crawl_count !== 1 ? 's' : ''}`
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>

                  {/* Health score */}
                  <td className="px-4 py-3">
                    <HealthRing score={site.latest_health_score} size={36} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm"
                        iconLeft={<Activity className="w-3.5 h-3.5" />}
                        onClick={() => handleCrawl(site)}
                        title="Start crawl"
                      >
                        Crawl
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        iconLeft={<Pencil className="w-3.5 h-3.5" />}
                        onClick={() => openEdit(site)}
                        title="Edit site"
                      />
                      <Button
                        variant="ghost" size="sm"
                        iconLeft={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => setDeleteTarget(site)}
                        title="Delete site"
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

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete site"
        size="sm"
      >
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Delete <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.label}</strong>?
          This will permanently remove all crawl jobs and audit results for this site.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      {/* Edit site modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit site"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Site name"
            value={editLabel}
            onChange={e => { setEditLabel(e.target.value); setEditErrors(v => ({ ...v, label: '' })); }}
            error={editErrors.label}
            required
          />
          <Input
            label="Root URL"
            value={editUrl}
            onChange={e => { setEditUrl(e.target.value); setEditErrors(v => ({ ...v, url: '' })); }}
            error={editErrors.url}
            type="url"
            required
          />
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Colour
            </label>
            <ColorPicker value={editColor} onChange={setEditColor} />
          </div>
          <Input
            label="GSC property"
            placeholder="sc-domain:example.com"
            value={editGsc}
            onChange={e => setEditGsc(e.target.value)}
          />
          <Input
            label="GA4 property ID"
            placeholder="G-XXXXXXXXXX"
            value={editGa4}
            onChange={e => setEditGa4(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button loading={saving} onClick={handleSaveEdit}>Save changes</Button>
        </div>
      </Modal>
    </div>
  );
}
