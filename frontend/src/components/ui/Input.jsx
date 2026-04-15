export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </label>
      )}
      <input
        className="h-9 px-3 rounded-md text-sm placeholder:text-[var(--text-muted)] focus:outline-none transition-shadow"
        style={{
          backgroundColor: 'var(--bg-raised)',
          border: `1px solid ${error ? 'var(--severity-critical)' : 'var(--border-default)'}`,
          color: 'var(--text-primary)',
        }}
        onFocus={e  => e.currentTarget.style.boxShadow = `0 0 0 2px var(--brand)`}
        onBlur={e   => e.currentTarget.style.boxShadow = ''}
        {...props}
      />
      {error && (
        <p className="text-xs" style={{ color: 'var(--severity-critical)' }}>{error}</p>
      )}
    </div>
  );
}
