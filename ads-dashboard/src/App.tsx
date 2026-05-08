import { useState, useCallback } from 'react';
import { mockData } from './data/mockData';
import type { SortableColumn } from './utils/metrics';
import { aggregateMetrics, getPlatformMetrics } from './utils/metrics';
import TopBar   from './components/TopBar';
import KPICards from './components/KPICards';
import AdsTable from './components/AdsTable';
import type { SortConfig } from './components/AdsTable';

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [dateRange, setDateRange]       = useState('last30d');
  const [visiblePlatforms, setVisible]  = useState<Set<string>>(
    () => new Set(mockData.map(p => p.id)),
  );
  const [expandedCampaigns, setExpanded] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig]      = useState<SortConfig>({
    column:    'spent',
    direction: 'desc',
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleTogglePlatform = useCallback((id: string) => {
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Don't allow hiding the last visible platform
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleCampaign = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else               next.add(id);
      return next;
    });
  }, []);

  const handleSort = useCallback((col: SortableColumn) => {
    setSortConfig(prev => ({
      column:    col,
      direction: prev.column === col && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const handleExport = useCallback(() => {
    const visible = mockData.filter(p => visiblePlatforms.has(p.id));
    const totals  = aggregateMetrics(visible.map(p => getPlatformMetrics(p)));
    console.log('[Ads Dashboard] Export triggered', {
      dateRange,
      visiblePlatforms: [...visiblePlatforms],
      totals,
      data: visible,
    });
  }, [dateRange, visiblePlatforms]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Top bar */}
      <TopBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        platforms={mockData}
        visiblePlatforms={visiblePlatforms}
        onTogglePlatform={handleTogglePlatform}
        onExport={handleExport}
      />

      {/* Page body */}
      <main className="flex-1 flex flex-col gap-6 p-6">

        {/* Page heading */}
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Performance Overview
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Aggregated across{' '}
            <span style={{ color: 'var(--text-primary)' }}>
              {visiblePlatforms.size} platform{visiblePlatforms.size !== 1 ? 's' : ''}
            </span>
            {' '}·{' '}
            {{ last7d: 'Last 7 days', last30d: 'Last 30 days', thisMonth: 'This month' }[dateRange]}
          </p>
        </div>

        {/* KPI cards */}
        <KPICards
          platforms={mockData}
          visiblePlatforms={visiblePlatforms}
        />

        {/* Table */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Campaign Breakdown
            </h3>
            <span
              className="text-xs"
              style={{ color: 'var(--text-disabled)' }}
            >
              Click a campaign row to expand ad sets & ads · Click a column header to sort
            </span>
          </div>

          <AdsTable
            platforms={mockData}
            visiblePlatforms={visiblePlatforms}
            expandedCampaigns={expandedCampaigns}
            onToggleCampaign={handleToggleCampaign}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
        </div>

      </main>
    </div>
  );
}
