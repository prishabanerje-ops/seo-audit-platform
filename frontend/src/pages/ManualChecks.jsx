import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link }          from 'react-router';
import { ChevronDown, ChevronRight, ClipboardList }  from 'lucide-react';
import api                       from '../api/index.js';
import { LoadingSkeleton }        from '../components/LoadingSkeleton.jsx';
import { EmptyState }             from '../components/EmptyState.jsx';
import { AUDIT_CATEGORY_GROUPS }  from '../lib/auditCategories.js';

const STATUS_STYLES = {
  pass:         { color: 'var(--severity-pass)',     bg: 'var(--severity-pass-bg)'     },
  fail:         { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
  needs_review: { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
};

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

function SeverityBadge({ severity }) {
  const color = severity === 'critical' ? 'var(--severity-critical)'
              : severity === 'warning'  ? 'var(--severity-warning)'
              : 'var(--severity-info)';
  const bg    = severity === 'critical' ? 'var(--severity-critical-bg)'
              : severity === 'warning'  ? 'var(--severity-warning-bg)'
              : 'var(--severity-info-bg)';
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ color, backgroundColor: bg }}>
      {severity}
    </span>
  );
}

function CheckRow({ check, onUpdate }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const textareaRef               = useRef(null);

  function handleStatusClick(s) {
    const next = check.status === s ? null : s;
    onUpdate(check.check_number, { status: next, notes: check.notes });
  }

  function handleNoteBlur() {
    const val = (textareaRef.current?.value ?? '').trim() || null;
    if (val !== (check.notes || null)) {
      onUpdate(check.check_number, { status: check.status, notes: val });
    }
  }

  const days = daysSince(check.updated_at);

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <SeverityBadge severity={check.severity_default} />
        <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>
          {check.name}
        </span>

        {/* Status toggles */}
        <div className="flex items-center gap-1 shrink-0">
          {['pass', 'needs_review', 'fail'].map(s => {
            const isActive = check.status === s;
            const st       = STATUS_STYLES[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusClick(s)}
                className="text-[11px] px-2 py-0.5 rounded font-medium transition-colors"
                style={isActive
                  ? { color: st.color, backgroundColor: st.bg, border: `1px solid ${st.color}` }
                  : { color: 'var(--text-muted)', backgroundColor: 'transparent', border: '1px solid var(--border-subtle)' }
                }
              >
                {s === 'needs_review' ? 'Review' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Staleness */}
        <span className="text-[11px] w-24 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
          {days === null ? 'Not reviewed' : days === 0 ? 'Today' : `${days}d ago`}
        </span>

        {/* Notes chevron */}
        <button
          type="button"
          onClick={() => setNotesOpen(v => !v)}
          className="p-1 rounded"
          style={{ color: 'var(--text-muted)' }}
          title="Toggle notes"
        >
          {notesOpen
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {notesOpen && (
        <div className="px-4 pb-3" style={{ backgroundColor: 'var(--bg-raised)' }}>
          {check.implementation_rule && (
            <p className="text-[11px] mb-2 italic" style={{ color: 'var(--text-muted)' }}>
              {check.implementation_rule}
            </p>
          )}
          <textarea
            ref={textareaRef}
            key={check.check_number}
            defaultValue={check.notes || ''}
            onBlur={handleNoteBlur}
            placeholder="Add notes…"
            rows={3}
            className="w-full text-xs rounded p-2 resize-none"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}

function CategoryGroup({ group, checksByCategory, filter, onUpdate, scrollRef }) {
  const [open, setOpen] = useState(true);

  const allChecks = group.categories.flatMap(cat => checksByCategory[cat] || []);
  if (allChecks.length === 0) return null;

  const reviewed = allChecks.filter(c => c.status !== null).length;

  return (
    <div
      ref={scrollRef}
      className="rounded-xl overflow-hidden mb-4"
      style={{ border: '1px solid var(--border-default)' }}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ backgroundColor: 'var(--bg-raised)' }}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {group.groupLabel}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {reviewed}/{allChecks.length} reviewed
        </span>
      </button>

      {open && (
        <div style={{ backgroundColor: 'var(--bg-surface)' }}>
          {group.categories.map(cat => {
            const checks = (checksByCategory[cat] || []).filter(c => {
              if (filter === 'unreviewed') return c.status === null;
              if (filter === 'flagged')   return c.status === 'fail' || c.status === 'needs_review';
              return true;
            });
            if (checks.length === 0) return null;
            return (
              <div key={cat}>
                <div
                  className="px-4 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--bg-raised)',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  {cat}
                </div>
                {checks.map(chk => (
                  <CheckRow key={chk.check_number} check={chk} onUpdate={onUpdate} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ManualChecks() {
  const { siteId }             = useParams();
  const [searchParams]         = useSearchParams();
  const [checks,  setChecks]   = useState([]);
  const [loading, setLoading]  = useState(true);
  const [filter,  setFilter]   = useState('all');
  const groupRefs              = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sites/${siteId}/manual-checks`);
      setChecks(res.data.checks);
    } catch (err) {
      console.error('[ManualChecks] load error', err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  // Scroll to group containing the ?category= param
  useEffect(() => {
    const target = searchParams.get('category');
    if (!target || loading) return;
    const group = AUDIT_CATEGORY_GROUPS.find(g => g.categories.includes(target));
    if (!group) return;
    const el = groupRefs.current[group.groupLabel];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [searchParams, loading]);

  async function updateCheck(checkNumber, patch) {
    setChecks(prev => prev.map(c =>
      c.check_number === checkNumber
        ? { ...c, ...patch, updated_at: new Date().toISOString() }
        : c
    ));
    try {
      await api.put(`/sites/${siteId}/manual-checks/${checkNumber}`, patch);
    } catch {
      load();
    }
  }

  const reviewed = checks.filter(c => c.status !== null).length;
  const flagged  = checks.filter(c => c.status === 'fail' || c.status === 'needs_review').length;
  const total    = checks.length;

  const checksByCategory = {};
  for (const c of checks) {
    if (!checksByCategory[c.category]) checksByCategory[c.category] = [];
    checksByCategory[c.category].push(c);
  }

  const filterCounts = {
    all:        total,
    unreviewed: checks.filter(c => c.status === null).length,
    flagged,
  };

  if (loading) return <div className="p-6"><LoadingSkeleton /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/audit" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          ← Audit Health
        </Link>
        <h1 className="text-xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
          Manual Checks
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {reviewed} of {total} reviewed · {flagged} flagged
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {['all', 'unreviewed', 'flagged'].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={filter === f
              ? { backgroundColor: 'var(--brand)', color: '#fff' }
              : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }
            }
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({filterCounts[f]})
          </button>
        ))}
      </div>

      {/* Groups */}
      {AUDIT_CATEGORY_GROUPS.map(group => (
        <CategoryGroup
          key={group.groupLabel}
          group={group}
          checksByCategory={checksByCategory}
          filter={filter}
          onUpdate={updateCheck}
          scrollRef={el => { groupRefs.current[group.groupLabel] = el; }}
        />
      ))}

      {total === 0 && (
        <EmptyState
          icon={ClipboardList}
          message="No manual checks found"
          description="No manual checks are registered in the audit check registry."
        />
      )}
    </div>
  );
}
