export function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div
      className={`flex gap-0 ${className}`}
      style={{ borderBottom: '1px solid var(--border-default)' }}
    >
      {tabs.map(tab => {
        const isActive = tab.value === activeTab;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative shrink-0"
            style={{ color: isActive ? 'var(--brand-text)' : 'var(--text-muted)' }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={{ backgroundColor: 'var(--brand)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
