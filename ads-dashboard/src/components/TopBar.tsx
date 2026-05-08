import type { Platform } from '../data/mockData';

interface Props {
  dateRange: string;
  onDateRangeChange: (v: string) => void;
  platforms: Platform[];
  visiblePlatforms: Set<string>;
  onTogglePlatform: (id: string) => void;
  onExport: () => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  google:   '#4285F4',
  meta:     '#1877F2',
  linkedin: '#0A66C2',
};

export default function TopBar({
  dateRange,
  onDateRangeChange,
  platforms,
  visiblePlatforms,
  onTogglePlatform,
  onExport,
}: Props) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-4 border-b flex-wrap"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor:     'var(--border-default)',
      }}
    >
      {/* Left — title + platform pills */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1
          className="text-xl font-semibold whitespace-nowrap"
          style={{ color: 'var(--text-primary)' }}
        >
          Paid Ads Dashboard
        </h1>

        {/* Platform filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {platforms.map(p => {
            const active = visiblePlatforms.has(p.id);
            const color  = PLATFORM_COLORS[p.id] ?? 'var(--brand-default)';
            return (
              <button
                key={p.id}
                onClick={() => onTogglePlatform(p.id)}
                className="inline-flex items-center gap-1.5 px-3 rounded-md text-sm font-medium transition-colors"
                style={{
                  height:          32,
                  backgroundColor: active ? color + '22' : 'var(--bg-raised)',
                  color:           active ? color        : 'var(--text-muted)',
                  border:          `1px solid ${active ? color + '55' : 'var(--border-default)'}`,
                }}
              >
                <span
                  className="rounded-full flex-shrink-0"
                  style={{ width: 7, height: 7, backgroundColor: active ? color : 'var(--text-disabled)' }}
                />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — date range + export */}
      <div className="flex items-center gap-3">
        <select
          value={dateRange}
          onChange={e => onDateRangeChange(e.target.value)}
          className="text-sm rounded-md px-3 outline-none transition-colors cursor-pointer"
          style={{
            height:          36,
            backgroundColor: 'var(--bg-raised)',
            border:          '1px solid var(--border-default)',
            color:           'var(--text-primary)',
          }}
        >
          <option value="last7d">Last 7 days</option>
          <option value="last30d">Last 30 days</option>
          <option value="thisMonth">This month</option>
        </select>

        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap"
          style={{
            height:          36,
            backgroundColor: 'var(--brand-default)',
            color:           '#ffffff',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--brand-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--brand-default)')}
        >
          {/* Download icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>
    </div>
  );
}
