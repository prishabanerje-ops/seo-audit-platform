/**
 * IssueDetail — drill-down page for a single audit result.
 *
 * Route pattern: /audit/issue/:resultId
 * Query params:
 *   from      — category slug (e.g. "title-tags")
 *   issueType — issue type string (URL-encoded)
 *   pos       — 0-indexed position within sibling list
 *   total     — total count for that issue_type
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  ExternalLink, ThumbsUp, ThumbsDown,
  Loader2, AlertTriangle, Sparkles,
} from 'lucide-react';
import api                from '../api/index.js';
import { useSites }       from '../context/SitesContext.jsx';
import { EmptyState }     from '../components/EmptyState.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { Button }         from '../components/ui/Button.jsx';

// ── Slug → display label ───────────────────────────────────────────────────────
const SLUG_LABELS = {
  'response-codes':  'Response Codes',
  'canonicals':      'Canonicals',
  'robots':          'Robots / Indexability',
  'sitemap':         'Sitemap',
  'crawl-depth':     'Crawl Depth',
  'title-tags':      'Title Tags',
  'meta-desc':       'Meta Descriptions',
  'headings':        'Headings',
  'links':           'Internal Linking',
  'images':          'Images',
  'structured-data': 'Structured Data',
  'content':         'Content',
  'page-speed':      'Page Speed',
  'mobile':          'Mobile SEO',
  'custom':          'JavaScript Rendering',
  'indexability':    'Indexability',
  'hreflang':        'Hreflang',
  'redirects':       'Redirects',
  'security':        'Security',
  'international':   'International SEO',
};

// ── Severity badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const map = {
    critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
    warning:  { color: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)'  },
    info:     { color: 'var(--severity-info)',     bg: 'var(--severity-info-bg)'     },
  };
  const s = map[severity] || map.info;
  return (
    <span
      style={{
        color: s.color,
        backgroundColor: s.bg,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '0.25rem',
        fontSize: '0.625rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        flexShrink: 0,
      }}
    >
      {severity || 'info'}
    </span>
  );
}

// ── Parse result.data safely ───────────────────────────────────────────────────
function parseData(raw) {
  if (!raw) return { parsed: null, raw: null };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return { parsed, raw: null };
    }
    return { parsed: null, raw: String(raw) };
  } catch {
    return { parsed: null, raw: String(raw) };
  }
}

// ── Panel wrapper ──────────────────────────────────────────────────────────────
function Panel({ title, children }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          padding: '0.625rem 1rem',
          backgroundColor: 'var(--bg-raised)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ backgroundColor: 'var(--bg-surface)', padding: '1rem' }}>
        {children}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function IssueDetail() {
  const { resultId }    = useParams();
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { activeSite }  = useSites();

  const from      = searchParams.get('from') || '';
  const issueType = searchParams.get('issueType') || '';
  const pos       = parseInt(searchParams.get('pos') || '0', 10);
  const total     = parseInt(searchParams.get('total') || '0', 10);

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(true);
  const [result,       setResult]       = useState(null);
  const [check,        setCheck]        = useState(null);
  const [notFound,     setNotFound]     = useState(false);
  const [siblingIds,   setSiblingIds]   = useState([]);

  const [suggestion,   setSuggestion]   = useState(null);
  const [suggestionId, setSuggestionId] = useState(null);
  const [feedback,     setFeedback]     = useState(null);

  const [streaming,    setStreaming]    = useState(false);
  const [streamError,  setStreamError]  = useState(null);
  const [aiChecked,    setAiChecked]    = useState(false);

  // AbortController ref — cancels in-flight SSE stream on navigation/unmount
  const abortRef = useRef(null);

  // ── Reset + fetch on resultId change ──────────────────────────────────────
  useEffect(() => {
    // Reset all state
    setLoading(true);
    setResult(null);
    setCheck(null);
    setNotFound(false);
    setSiblingIds([]);
    setSuggestion(null);
    setSuggestionId(null);
    setFeedback(null);
    setStreaming(false);
    setStreamError(null);
    setAiChecked(false);

    if (!resultId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      // Fetch result and cached AI suggestion in parallel
      const [resultRes, aiRes] = await Promise.allSettled([
        api.get(`/reports/results/${resultId}`),
        api.get('/ai/suggest', { params: { result_id: resultId } }),
      ]);

      if (cancelled) return;

      // Handle result
      if (resultRes.status === 'fulfilled') {
        const data = resultRes.value.data;
        setResult(data.result ?? data);
        setCheck(data.check ?? null);

        // Fetch siblings using result.section
        const section = (data.result ?? data).section;
        if (section && activeSite?.id && issueType) {
          try {
            const sibRes = await api.get(`/reports/${activeSite.id}/issues`, {
              params: { section, issue_type: issueType, limit: 200 },
            });
            if (!cancelled) {
              setSiblingIds((sibRes.data.results || []).map(r => r.id));
            }
          } catch {
            // Non-fatal — prev/next just won't work
          }
        }
      } else {
        // Any error fetching the result → treat as not found
        setNotFound(true);
      }

      // Handle cached AI
      if (aiRes.status === 'fulfilled') {
        const d = aiRes.value.data;
        if (d?.suggestion) {
          setSuggestion(d.suggestion);
          setSuggestionId(d.id ?? d.suggestion_id ?? null);
          setFeedback(d.feedback ?? null);
        }
      }

      if (!cancelled) {
        setAiChecked(true);
        setLoading(false);
      }
    }

    fetchAll().catch(() => {
      if (!cancelled) {
        setLoading(false);
        setAiChecked(true);
      }
    });

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultId]);

  // ── Prev / Next navigation ─────────────────────────────────────────────────
  const hasPrev = pos > 0 && siblingIds[pos - 1] !== undefined;
  const hasNext = pos + 1 < total && siblingIds[pos + 1] !== undefined;

  const handleNav = useCallback((newPos) => {
    const targetId = siblingIds[newPos];
    if (targetId === undefined) return;
    navigate(
      `/audit/issue/${targetId}?from=${from}&issueType=${encodeURIComponent(issueType)}&pos=${newPos}&total=${total}`
    );
  }, [siblingIds, from, issueType, total, navigate]);

  // ── AI recommendation streaming ────────────────────────────────────────────
  const handleGetAI = useCallback(async () => {
    setStreaming(true);
    setStreamError(null);
    setSuggestion('');
    setSuggestionId(null);

    // Abort any previous stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ result_id: parseInt(resultId, 10) }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        // 503 = no API key configured
        if (resp.status === 503) {
          setStreamError('AI recommendations require an Anthropic API key.');
        } else {
          setStreamError(errData?.error || `Request failed (${resp.status})`);
        }
        setStreaming(false);
        return;
      }

      const contentType = resp.headers.get('content-type') || '';

      // Cached fast-path — plain JSON response
      if (!contentType.includes('text/event-stream')) {
        const data = await resp.json();
        setSuggestion(data.suggestion || '');
        setSuggestionId(data.id ?? data.suggestion_id ?? null);
        setStreaming(false);
        return;
      }

      // SSE streaming path
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let newSuggestionId = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') {
            setSuggestionId(newSuggestionId);
            setStreaming(false);
            return;
          }
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'delta') {
              // Support both evt.text (spec) and evt.delta (legacy)
              const chunk = evt.text ?? evt.delta ?? '';
              if (chunk) setSuggestion(prev => (prev || '') + chunk);
            } else if (evt.type === 'done') {
              newSuggestionId = evt.id ?? evt.suggestion_id ?? null;
              setSuggestionId(newSuggestionId);
            } else if (evt.type === 'error') {
              setStreamError(evt.message || 'Unknown error');
              setStreaming(false);
              return;
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      setSuggestionId(newSuggestionId);
      setStreaming(false);
    } catch (err) {
      if (err?.name === 'AbortError') return;  // navigation away — ignore
      setStreamError(err?.message || 'Failed to get AI recommendation.');
      setStreaming(false);
    }
  }, [resultId]);

  // ── Feedback ───────────────────────────────────────────────────────────────
  const handleFeedback = useCallback(async (value) => {
    if (!suggestionId || feedback !== null) return;
    try {
      await api.post(`/ai/suggest/${suggestionId}/feedback`, { value });
      setFeedback(value);
    } catch {
      // Silently ignore feedback errors
    }
  }, [suggestionId, feedback]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!activeSite) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          message="No site selected"
          description="Select a site from the header to view issue details."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '52rem', margin: '0 auto' }}>
        <LoadingSkeleton type="table" rows={6} columns={2} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          message="Issue not found"
          description="This issue could not be found or you may not have access."
          action={{ label: '← Back to category', to: from ? `/audit/${from}` : '/audit' }}
        />
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          message="Issue not found"
          description="No data was returned for this issue."
          action={{ label: '← Back', to: from ? `/audit/${from}` : '/audit' }}
        />
      </div>
    );
  }

  // ── Parse detected data ────────────────────────────────────────────────────
  const { parsed: detectedData, raw: rawData } = parseData(result.data);
  const dataEntries = detectedData ? Object.entries(detectedData) : [];

  const categoryLabel = SLUG_LABELS[from] || from || 'Audit';
  const pageUrl       = result.url || result.page_url || '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1.5rem', maxWidth: '52rem', margin: '0 auto' }}>

      {/* ── Breadcrumb + Prev/Next ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Back link */}
        <Link
          to={from ? `/audit/${from}` : '/audit'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            textDecoration: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <ArrowLeft style={{ width: '0.875rem', height: '0.875rem' }} />
          {categoryLabel}
        </Link>

        {/* Prev / Next */}
        {total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => handleNav(pos - 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-default)',
                backgroundColor: 'transparent',
                cursor: hasPrev ? 'pointer' : 'not-allowed',
                opacity: hasPrev ? 1 : 0.4,
                color: 'var(--text-muted)',
              }}
            >
              <ChevronLeft style={{ width: '1rem', height: '1rem' }} />
            </button>

            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                minWidth: '4rem',
                textAlign: 'center',
              }}
            >
              {pos + 1} / {total}
            </span>

            <button
              type="button"
              disabled={!hasNext}
              onClick={() => handleNav(pos + 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-default)',
                backgroundColor: 'transparent',
                cursor: hasNext ? 'pointer' : 'not-allowed',
                opacity: hasNext ? 1 : 0.4,
                color: 'var(--text-muted)',
              }}
            >
              <ChevronRight style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
        )}
      </div>

      {/* ── Issue header ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            marginBottom: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <h1
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: '1.4',
              flex: 1,
              minWidth: 0,
            }}
          >
            {result.issue_type}
          </h1>
          <SeverityBadge severity={result.severity} />
        </div>

        {pageUrl && (
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--brand)',
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {pageUrl}
            <ExternalLink style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0 }} />
          </a>
        )}
      </div>

      {/* ── Check definition panel ── */}
      {check && (
        <Panel title="Check Definition">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {check.description && (
              <div>
                <p
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                    marginBottom: '0.25rem',
                  }}
                >
                  Description
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                  {check.description}
                </p>
              </div>
            )}

            {check.seo_impact && (
              <div>
                <p
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                    marginBottom: '0.25rem',
                  }}
                >
                  SEO Impact
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                  {check.seo_impact}
                </p>
              </div>
            )}

            {check.how_to_fix && (
              <div>
                <p
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                    marginBottom: '0.25rem',
                  }}
                >
                  How to Fix
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                  {check.how_to_fix}
                </p>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* ── Detected data panel ── */}
      <Panel title="Detected Data">
        {dataEntries.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <tbody>
              {dataEntries.map(([key, val]) => (
                <tr
                  key={key}
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td
                    style={{
                      padding: '0.5rem 0.75rem 0.5rem 0',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'top',
                      width: '40%',
                    }}
                  >
                    {key}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem 0',
                      color: 'var(--text-primary)',
                      wordBreak: 'break-word',
                      verticalAlign: 'top',
                    }}
                  >
                    {String(val)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : rawData ? (
          <pre
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {rawData}
          </pre>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No data available.</p>
        )}
      </Panel>

      {/* ── AI recommendation panel ── */}
      <Panel title="AI Recommendation">
        {/* API key error */}
        {streamError && streamError.toLowerCase().includes('api key') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--severity-warning-bg)',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
            }}
          >
            <AlertTriangle
              style={{
                width: '1rem',
                height: '1rem',
                flexShrink: 0,
                color: 'var(--severity-warning)',
                marginTop: '0.125rem',
              }}
            />
            <span>
              AI recommendations require an Anthropic API key.{' '}
              <Link
                to="/settings"
                style={{ color: 'var(--brand)', textDecoration: 'underline' }}
              >
                Configure in Settings
              </Link>
            </span>
          </div>
        )}

        {/* Other stream error */}
        {streamError && !streamError.toLowerCase().includes('api key') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--severity-critical-bg)',
              fontSize: '0.875rem',
            }}
          >
            <AlertTriangle
              style={{
                width: '1rem',
                height: '1rem',
                flexShrink: 0,
                color: 'var(--severity-critical)',
                marginTop: '0.125rem',
              }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>{streamError}</p>
              <button
                type="button"
                onClick={handleGetAI}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--brand)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Streaming / cached suggestion text */}
        {(suggestion !== null && suggestion !== '') && !streamError && (
          <div>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                margin: '0 0 0.75rem',
              }}
            >
              {suggestion}
              {streaming && (
                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>▌</span>
              )}
            </p>

            {/* Feedback buttons — only shown when not streaming and suggestionId is set */}
            {!streaming && suggestionId && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.75rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Was this helpful?
                </span>
                <button
                  type="button"
                  disabled={feedback !== null}
                  onClick={() => handleFeedback(1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-default)',
                    backgroundColor: feedback === 1 ? 'var(--severity-info-bg)' : 'transparent',
                    color: feedback === 1 ? 'var(--severity-info)' : 'var(--text-muted)',
                    cursor: feedback !== null ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    opacity: feedback !== null && feedback !== 1 ? 0.4 : 1,
                  }}
                >
                  <ThumbsUp style={{ width: '0.875rem', height: '0.875rem' }} />
                  Yes
                </button>
                <button
                  type="button"
                  disabled={feedback !== null}
                  onClick={() => handleFeedback(-1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-default)',
                    backgroundColor: feedback === -1 ? 'var(--severity-critical-bg)' : 'transparent',
                    color: feedback === -1 ? 'var(--severity-critical)' : 'var(--text-muted)',
                    cursor: feedback !== null ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    opacity: feedback !== null && feedback !== -1 ? 0.4 : 1,
                  }}
                >
                  <ThumbsDown style={{ width: '0.875rem', height: '0.875rem' }} />
                  No
                </button>
              </div>
            )}
          </div>
        )}

        {/* Streaming spinner with empty suggestion */}
        {streaming && suggestion === '' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0',
            }}
          >
            <Loader2
              style={{
                width: '1rem',
                height: '1rem',
                color: 'var(--text-muted)',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Generating recommendation…
            </span>
          </div>
        )}

        {/* Generate button — shown only when no suggestion and not streaming and no error */}
        {!streaming && suggestion === null && !streamError && aiChecked && (
          <div>
            <button
              type="button"
              onClick={handleGetAI}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-raised)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, var(--bg-raised))'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-raised)'}
            >
              <Sparkles style={{ width: '1rem', height: '1rem', color: 'var(--brand)' }} />
              Get AI Recommendation
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
