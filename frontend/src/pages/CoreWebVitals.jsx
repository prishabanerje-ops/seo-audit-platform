/**
 * CoreWebVitals — PageSpeed Insights analysis page.
 *
 * Lets users run a manual PSI analysis for any URL (defaults to activeSite.url
 * if a site is selected). Displays a performance score gauge and a metrics grid
 * with status indicators (Good / Needs Improvement / Poor) based on Core Web
 * Vitals thresholds.
 *
 * No auto-fetch on mount — all analysis is user-triggered.
 */
import { useState, useCallback } from 'react';
import { Zap, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../api/index.js';
import { useSites } from '../context/SitesContext.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns { label, color } for a metric given its raw value and thresholds.
 * @param {number|null} value
 * @param {number} goodMax   — below this → Good
 * @param {number} needsMax  — below this → Needs Improvement; at/above → Poor
 */
function getStatus(value, goodMax, needsMax) {
  if (value === null || value === undefined) {
    return { label: 'N/A', color: 'var(--text-muted)' };
  }
  if (value < goodMax) {
    return { label: 'Good', color: 'var(--severity-pass)' };
  }
  if (value < needsMax) {
    return { label: 'Needs Improvement', color: 'var(--severity-warning)' };
  }
  return { label: 'Poor', color: 'var(--severity-critical)' };
}

/** Returns the CSS color for a performance score (0–100). */
function scoreColor(score) {
  if (score >= 90) return 'var(--severity-pass)';
  if (score >= 50) return 'var(--severity-warning)';
  return 'var(--severity-critical)';
}

/** Format an ISO timestamp into a human-readable local string. */
function formatTimestamp(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ── Metric definitions ─────────────────────────────────────────────────────────

const METRICS = [
  {
    key:     'lcp',
    label:   'Largest Contentful Paint',
    abbr:    'LCP',
    format:  v => v === null || v === undefined ? 'N/A' : `${(v / 1000).toFixed(2)}s`,
    goodMax: 2500,
    needsMax: 4000,
  },
  {
    key:     'cls',
    label:   'Cumulative Layout Shift',
    abbr:    'CLS',
    format:  v => v === null || v === undefined ? 'N/A' : v.toFixed(3),
    goodMax: 0.1,
    needsMax: 0.25,
  },
  {
    key:     'fcp',
    label:   'First Contentful Paint',
    abbr:    'FCP',
    format:  v => v === null || v === undefined ? 'N/A' : `${(v / 1000).toFixed(2)}s`,
    goodMax: 1800,
    needsMax: 3000,
  },
  {
    key:     'ttfb',
    label:   'Time to First Byte',
    abbr:    'TTFB',
    format:  v => v === null || v === undefined ? 'N/A' : `${v}ms`,
    goodMax: 800,
    needsMax: 1800,
  },
  {
    key:     'fid',
    label:   'First Input Delay',
    abbr:    'FID',
    format:  v => v === null || v === undefined ? 'N/A' : `${v}ms`,
    goodMax: 100,
    needsMax: 300,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Large circular-style score display. */
function ScoreGauge({ score }) {
  const color = scoreColor(score);
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '4px',
        padding:        '24px 32px',
        borderRadius:   '12px',
        border:         `3px solid ${color}`,
        backgroundColor: 'var(--bg-raised)',
        minWidth:       '140px',
      }}
      aria-label={`Performance score: ${score} out of 100`}
    >
      <span
        style={{
          fontSize:           '4rem',
          fontWeight:         700,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight:         1,
        }}
      >
        {score}
      </span>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
        Performance Score
      </span>
    </div>
  );
}

/** Single metric card in the grid. */
function MetricCard({ metric, value }) {
  const status = getStatus(value, metric.goodMax, metric.needsMax);
  const displayValue = metric.format(value);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border:          '1px solid var(--border)',
        borderRadius:    '10px',
        padding:         '16px',
      }}
    >
      <dl style={{ margin: 0 }}>
        <dt style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '6px' }}>
          {metric.abbr} — {metric.label}
        </dt>
        <dd
          style={{
            margin:             0,
            fontSize:           '22px',
            fontWeight:         700,
            fontVariantNumeric: 'tabular-nums',
            color:              'var(--text-primary)',
            marginBottom:       '6px',
          }}
        >
          {displayValue}
        </dd>
        <dd
          style={{
            margin:     0,
            fontSize:   '11px',
            fontWeight: 600,
            color:      status.color,
          }}
        >
          {status.label}
        </dd>
      </dl>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CoreWebVitals() {
  const { activeSite } = useSites();

  const [inputUrl,  setInputUrl]  = useState(activeSite?.url ?? '');
  const [strategy,  setStrategy]  = useState('mobile');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [result,    setResult]    = useState(null);

  const handleAnalyze = useCallback(async () => {
    // Form validation
    const trimmedUrl = inputUrl.trim();
    if (!trimmedUrl) {
      setValidationError('Please enter a URL.');
      return;
    }
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setValidationError('URL must start with http:// or https://');
      return;
    }
    setValidationError(null);

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data } = await api.get('/psi/analyze', {
        params: { url: trimmedUrl, strategy },
      });
      setResult(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to run analysis. Check PSI API key in Settings.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [inputUrl, strategy]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAnalyze();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
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
          <Zap style={{ width: 20, height: 20, color: 'var(--brand)' }} />
          Core Web Vitals
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
          Run a PageSpeed Insights analysis for any URL
        </p>
      </div>

      {/* Analysis form card */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border:          '1px solid var(--border)',
          borderRadius:    '12px',
          padding:         '24px',
          marginBottom:    '24px',
        }}
      >
        <form onSubmit={handleSubmit} aria-busy={loading} noValidate>

          {/* URL input */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="cwv-url"
              style={{
                display:      'block',
                fontSize:     '13px',
                fontWeight:   500,
                color:        'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              URL
            </label>
            <input
              id="cwv-url"
              type="url"
              value={inputUrl}
              onChange={e => { setInputUrl(e.target.value); setValidationError(null); }}
              placeholder="https://example.com/page"
              disabled={loading}
              style={{
                border:      '1px solid var(--border)',
                borderRadius: 6,
                padding:     '0.5rem 0.75rem',
                background:  'var(--bg-surface)',
                color:       'var(--text-primary)',
                width:       '100%',
                fontSize:    '14px',
                boxSizing:   'border-box',
                outline:     'none',
              }}
            />
            {validationError && (
              <p style={{ marginTop: '6px', marginBottom: 0, fontSize: '12px', color: 'var(--severity-critical)' }}>
                {validationError}
              </p>
            )}
          </div>

          {/* Strategy toggle */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display:      'block',
                fontSize:     '13px',
                fontWeight:   500,
                color:        'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Strategy
            </label>
            <div role="group" aria-label="Analysis strategy" style={{ display: 'flex', gap: 0 }}>
              {['mobile', 'desktop'].map(s => {
                const isActive = strategy === s;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={isActive}
                    disabled={loading}
                    onClick={() => setStrategy(s)}
                    style={{
                      padding:         '7px 20px',
                      fontSize:        '13px',
                      fontWeight:      500,
                      border:          '1px solid var(--border)',
                      borderRadius:    s === 'mobile' ? '6px 0 0 6px' : '0 6px 6px 0',
                      backgroundColor: isActive ? 'var(--brand)' : 'var(--bg-raised)',
                      color:           isActive ? 'var(--text-inverse)' : 'var(--text-muted)',
                      cursor:          loading ? 'not-allowed' : 'pointer',
                      transition:      'background-color 0.15s, color 0.15s',
                      marginLeft:      s === 'desktop' ? '-1px' : 0,
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Analyze button */}
          <button
            type="submit"
            disabled={loading}
            aria-label={loading ? 'Analyzing...' : 'Analyze'}
            style={{
              display:         'inline-flex',
              alignItems:      'center',
              gap:             '6px',
              padding:         '8px 20px',
              fontSize:        '14px',
              fontWeight:      600,
              backgroundColor: loading ? 'var(--bg-raised)' : 'var(--brand)',
              color:           loading ? 'var(--text-muted)' : 'var(--text-inverse)',
              border:          'none',
              borderRadius:    '8px',
              cursor:          loading ? 'not-allowed' : 'pointer',
              transition:      'background-color 0.15s',
            }}
          >
            {loading
              ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
              : <Zap style={{ width: 16, height: 16 }} />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>

          {/* API / network error banner */}
          {error && (
            <div
              role="alert"
              style={{
                display:         'flex',
                alignItems:      'flex-start',
                gap:             '8px',
                marginTop:       '16px',
                padding:         '12px 16px',
                backgroundColor: 'var(--bg-raised)',
                border:          '1px solid var(--severity-critical)',
                borderRadius:    '8px',
                color:           'var(--severity-critical)',
                fontSize:        '13px',
              }}
            >
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Results card — only shown after a successful analysis */}
      {result && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border:          '1px solid var(--border)',
            borderRadius:    '12px',
            padding:         '24px',
          }}
        >
          {/* Results header */}
          <div
            style={{
              display:       'flex',
              flexWrap:      'wrap',
              alignItems:    'center',
              gap:           '10px',
              marginBottom:  '24px',
            }}
          >
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <p
                style={{
                  margin:       0,
                  fontSize:     '14px',
                  fontWeight:   600,
                  color:        'var(--text-primary)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
                title={result.url}
              >
                Results for {result.url}
              </p>
              {result.analyzed_at && (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Analyzed {formatTimestamp(result.analyzed_at)}
                </p>
              )}
            </div>
            {/* Strategy badge */}
            <span
              style={{
                display:         'inline-block',
                padding:         '3px 10px',
                fontSize:        '11px',
                fontWeight:      600,
                borderRadius:    '99px',
                backgroundColor: 'var(--bg-raised)',
                color:           'var(--text-muted)',
                border:          '1px solid var(--border)',
                textTransform:   'capitalize',
                flexShrink:      0,
              }}
            >
              {result.strategy}
            </span>
          </div>

          {/* Score + metrics layout */}
          <div
            style={{
              display:    'flex',
              flexWrap:   'wrap',
              gap:        '24px',
              alignItems: 'flex-start',
            }}
          >
            {/* Score gauge */}
            <div style={{ flexShrink: 0 }}>
              <ScoreGauge score={result.score} />
            </div>

            {/* Metrics grid */}
            <div
              style={{
                flex:                '1 1 0',
                minWidth:            '280px',
                display:             'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap:                 '12px',
              }}
            >
              {METRICS.map(metric => (
                <MetricCard
                  key={metric.key}
                  metric={metric}
                  value={result[metric.key]}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
