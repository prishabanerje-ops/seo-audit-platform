import { Loader2 } from 'lucide-react';
import './Button.css';

const VARIANTS = {
  primary:     { bg: 'var(--brand)',              text: '#ffffff', hoverBg: 'var(--brand-hover)' },
  secondary:   { bg: 'var(--bg-raised)',           text: 'var(--text-primary)', hoverBg: 'var(--border-default)' },
  destructive: { bg: 'var(--severity-critical)',   text: '#ffffff', hoverBg: '#dc2626' },
  ghost:       { bg: 'transparent',               text: 'var(--text-secondary)', hoverBg: 'var(--bg-raised)' },
  outline:     { bg: 'transparent',               text: 'var(--text-primary)', border: '1px solid var(--border-default)', hoverBg: 'var(--bg-raised)' },
};

const SIZES = {
  sm: { height: '28px', px: '10px', fontSize: '12px' },
  md: { height: '34px', px: '14px', fontSize: '13px' },
  lg: { height: '40px', px: '18px', fontSize: '14px' },
};

export function Button({
  variant = 'primary',
  size    = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  children,
  className = '',
  style = {},
  ...props
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      data-btn-variant={variant}
      data-btn-disabled={isDisabled ? 'true' : undefined}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-colors ${className}`}
      style={{
        height: s.height,
        padding: `0 ${s.px}`,
        fontSize: s.fontSize,
        backgroundColor: v.bg,
        color: v.text,
        border: v.border || 'none',
        opacity: isDisabled ? 0.4 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {iconLeft && <span className="shrink-0">{iconLeft}</span>}
          {children}
          {iconRight && <span className="shrink-0">{iconRight}</span>}
        </>
      )}
    </button>
  );
}
