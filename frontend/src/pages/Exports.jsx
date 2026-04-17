/**
 * Exports — export audit results as CSV or push to Google Sheets.
 *
 * Entry points:
 *   /exports              — standalone; user picks site first
 *   /exports?siteId=xxx   — site pre-selected (linked from audit view)
 *
 * Flow: site picker → job picker → optional filters → Download CSV / Push to Sheets
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams }                  from 'react-router';
import { Download, FileSpreadsheet }        from 'lucide-react';
import { toast }                            from 'sonner';
import api                 from '../api/index.js';
import { useSites }        from '../context/SitesContext.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { Button }          from '../components/ui/Button.jsx';

const SEVERITIES = ['critical', 'warning', 'info'];

export function Exports() {
  const [searchParams]          = useSearchParams();
  const { sites, loading: sitesLoading } = useSites();

  const [siteId,             setSiteId]             = useState(searchParams.get('siteId') || '');
  const [jobs,               setJobs]               = useState([]);
  const [jobId,              setJobId]              = useState('');
  const [sections,           setSections]           = useState([]);
  const [selectedSeverities, setSelectedSeverities] = useState(new Set(SEVERITIES));
  const [allSections,        setAllSections]        = useState(true);
  const [selectedSections,   setSelectedSections]   = useState(new Set());
  const [loadingJobs,        setLoadingJobs]        = useState(false);
  const [loadingSections,    setLoadingSections]    = useState(false);
  const [downloading,        setDownloading]        = useState(false);
  const [pushing,            setPushing]            = useState(false);

  // Load completed crawl jobs when site changes
  const loadJobs = useCallback(async (sid, signal) => {
    setLoadingJobs(true);
    setJobs([]);
    setJobId('');
    setSections([]);
    try {
      const res = await api.get('/exports/jobs', { params: { siteId: sid }, signal });
      setJobs(res.data.jobs || []);
    } catch (err) {
      if (err.name !== 'CanceledError') { /* interceptor handles toast */ }
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Load distinct sections present in the selected job
  const loadSections = useCallback(async (jid, signal) => {
    setLoadingSections(true);
    setSections([]);
    setSelectedSections(new Set());
    try {
      const res = await api.get('/exports/sections', { params: { jobId: jid }, signal });
      const list = res.data.sections || [];
      setSections(list);
      setSelectedSections(new Set(list));
    } catch (err) {
      if (err.name !== 'CanceledError') { /* interceptor handles toast */ }
    } finally {
      setLoadingSections(false);
    }
  }, []);

  useEffect(() => {
    if (!siteId) return;
    const controller = new AbortController();
    loadJobs(siteId, controller.signal);
    return () => controller.abort();
  }, [siteId, loadJobs]);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    loadSections(jobId, controller.signal);
    return () => controller.abort();
  }, [jobId, loadSections]);

  // Build query params shared between CSV and Sheets
  function buildParams() {
    const sevs = [...selectedSeverities];
    const secs = allSections ? [] : [...selectedSections];
    return {
      jobId,
      ...(sevs.length < SEVERITIES.length ? { severity: sevs.join(',') } : {}),
      ...(secs.length > 0 && secs.length < sections.length ? { sections: secs.join(',') } : {}),
    };
  }

  async function downloadCsv() {
    setDownloading(true);
    try {
      const params = buildParams();
      const qs = new URLSearchParams(params).toString();
      const res = await api.get(`/exports/csv?${qs}`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] || 'audit-export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // toast shown by axios interceptor
    } finally {
      setDownloading(false);
    }
  }

  async function pushSheets() {
    setPushing(true);
    try {
      const { jobId: jid, severity, sections: secs } = buildParams();
      const body = { jobId: jid };
      if (severity) body.severity = severity.split(',');
      if (secs)     body.sections  = secs.split(',');
      const res = await api.post('/exports/sheets', body);
      toast.success(`Pushed ${res.data.rowsWritten.toLocaleString()} rows to Sheets`);
    } catch {
      // toast shown by axios interceptor
    } finally {
      setPushing(false);
    }
  }

  // Check if Sheets is configured for the selected site
  const activeSite  = (sites || []).find(s => s.id === siteId);
  const sheetsReady = !!(activeSite?.sheets_tab_name && activeSite?.sheets_spreadsheet_id);
  const canExport   = !!jobId && selectedSeverities.size > 0;

  if (sitesLoading) {
    return <div className="p-6"><LoadingSkeleton type="table" rows={4} columns={1} /></div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Exports</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Download audit results as CSV or push to Google Sheets.
      </p>

      <div
        className="rounded-xl p-6 space-y-5"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        {/* ── Step 1: Site picker ── */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Site
          </label>
          <select
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-raised)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            value={siteId}
            onChange={e => { setSiteId(e.target.value); setJobId(''); setSections([]); }}
          >
            <option value="">Select a site…</option>
            {(sites || []).map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* ── Step 2: Crawl job picker ── */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Crawl Job
          </label>
          {loadingJobs ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading jobs…</p>
          ) : (
            <select
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                opacity: (!siteId || jobs.length === 0) ? 0.6 : 1,
              }}
              value={jobId}
              onChange={e => setJobId(e.target.value)}
              disabled={!siteId || jobs.length === 0}
            >
              <option value="">
                {!siteId
                  ? 'Select a site first'
                  : jobs.length === 0
                    ? 'No completed crawls yet'
                    : 'Select a crawl job…'}
              </option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  {new Date(j.started_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {' · '}{(j.total_urls || 0).toLocaleString()} URLs
                  {j.health_score != null ? ` · Score ${j.health_score}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Step 3: Filters (only shown after a job is selected) ── */}
        {jobId && (
          <>
            {/* Severity checkboxes */}
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Severity
              </p>
              <div className="flex gap-4">
                {SEVERITIES.map(sev => (
                  <label
                    key={sev}
                    className="flex items-center gap-1.5 cursor-pointer text-sm select-none"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSeverities.has(sev)}
                      onChange={e => {
                        const next = new Set(selectedSeverities);
                        if (e.target.checked) next.add(sev); else next.delete(sev);
                        setSelectedSeverities(next);
                      }}
                    />
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Section filter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Sections
                </p>
                <label
                  className="flex items-center gap-1.5 cursor-pointer text-xs select-none"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <input
                    type="checkbox"
                    checked={allSections}
                    onChange={e => setAllSections(e.target.checked)}
                  />
                  All sections
                </label>
              </div>

              {!allSections && (
                loadingSections ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading sections…</p>
                ) : (
                  <div
                    className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto rounded-lg p-2"
                    style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}
                  >
                    {sections.map(sec => (
                      <label
                        key={sec}
                        className="flex items-center gap-1.5 cursor-pointer text-xs select-none"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSections.has(sec)}
                          onChange={e => {
                            const next = new Set(selectedSections);
                            if (e.target.checked) next.add(sec); else next.delete(sec);
                            setSelectedSections(next);
                          }}
                        />
                        {sec}
                      </label>
                    ))}
                  </div>
                )
              )}
            </div>
          </>
        )}

        {/* ── Step 4: Export actions ── */}
        <div
          className="flex items-center gap-3 pt-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {/* CSV download */}
          <Button
            variant="primary"
            iconLeft={<Download className="w-4 h-4" />}
            onClick={downloadCsv}
            disabled={!canExport}
            loading={downloading}
          >
            {downloading ? 'Downloading…' : 'Download CSV'}
          </Button>

          {/* Sheets push with tooltip when not configured */}
          <div className="relative group">
            <Button
              variant="secondary"
              iconLeft={<FileSpreadsheet className="w-4 h-4" />}
              onClick={pushSheets}
              disabled={!canExport || !sheetsReady}
              loading={pushing}
            >
              {pushing ? 'Pushing…' : 'Push to Sheets'}
            </Button>

            {/* Tooltip — only shown when job is selected but Sheets is not configured */}
            {jobId && !sheetsReady && (
              <div
                className="absolute bottom-full left-0 mb-2 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  backgroundColor: 'var(--bg-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                Configure Sheets tab name + spreadsheet ID in Site Settings first
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
