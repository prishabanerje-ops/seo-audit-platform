/**
 * SeverityPill — coloured badge for critical/warning/info/pass/none.
 * Supports 'ok' as alias for 'pass' (PRD uses 'ok', Figma uses 'pass').
 */
const CONFIG = {
  critical: { dot: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)', text: 'var(--severity-critical-text)', label: 'Critical' },
  warning:  { dot: 'var(--severity-warning)',  bg: 'var(--severity-warning-bg)',  text: 'var(--severity-warning-text)',  label: 'Warning'  },
  info:     { dot: 'var(--severity-info)',     bg: 'var(--severity-info-bg)',     text: 'var(--severity-info-text)',     label: 'Info'     },
  pass:     { dot: 'var(--severity-pass)',     bg: 'var(--severity-pass-bg)',     text: 'var(--severity-pass-text)',     label: 'Pass'     },
  ok:       { dot: 'var(--severity-pass)',     bg: 'var(--severity-pass-bg)',     text: 'var(--severity-pass-text)',     label: 'OK'       },
  none:     { dot: 'var(--severity-none)',     bg: 'transparent',                 text: 'var(--severity-none-text)',     label: '—'        },
};

export function SeverityPill({ severity = 'none', label, className = '' }) {
  const cfg = CONFIG[severity] || CONFIG.none;
  const displayLabel = label ?? cfg.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded text-xs font-medium uppercase tracking-wide ${className}`}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {displayLabel}
    </span>
  );
}
