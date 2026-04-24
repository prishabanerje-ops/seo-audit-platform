/**
 * AdsDashboard — Paid Ads Performance Overview
 *
 * Shows aggregated performance across Google Ads, Meta, and LinkedIn.
 * - Control bar: date range selector, platform filter pills, export
 * - KPI cards: Total Spent, Impressions, Clicks, Conversions, Avg CTR
 * - Campaign breakdown table: Platform → Campaign → Ad Set + Ad (collapsible)
 *
 * Data is fetched live from GET /api/ads/metrics?range=<dateRange>
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import api from '../api/index.js';
import { io as socketIo } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';

// ── Platform brand colors ─────────────────────────────────────────────────────

const PLATFORM_COLORS = {
  google:   '#4285F4',
  meta:     '#1877F2',
  linkedin: '#0A66C2',
};

// ── Metrics utilities ─────────────────────────────────────────────────────────

const ZERO = { clicks: 0, impressions: 0, conversions: 0, spent: 0 };

function aggregateMetrics(items) {
  return items.reduce(
    (acc, m) => ({
      clicks:      acc.clicks      + m.clicks,
      impressions: acc.impressions + m.impressions,
      conversions: acc.conversions + m.conversions,
      spent:       acc.spent       + m.spent,
    }),
    { ...ZERO },
  );
}

function getCampaignMetrics(campaign) {
  return aggregateMetrics(campaign.adSets.flatMap(as => as.ads));
}

function getPlatformMetrics(platform) {
  return aggregateMetrics(platform.campaigns.flatMap(c => c.adSets.flatMap(as => as.ads)));
}

function derivedMetrics(raw) {
  return {
    ctr: raw.impressions > 0 ? raw.clicks / raw.impressions : 0,
    cpc: raw.clicks      > 0 ? raw.spent  / raw.clicks      : 0,
    cpm: raw.impressions > 0 ? (raw.spent / raw.impressions) * 1000 : 0,
  };
}

function getSortValue(raw, col) {
  const rawCols = ['clicks', 'impressions', 'conversions', 'spent'];
  if (rawCols.includes(col)) return raw[col];
  return derivedMetrics(raw)[col];
}

function fmtCurrency(v)        { return '₹' + Math.round(v).toLocaleString('en-IN'); }
function fmtCurrencyDec(v)     { return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtNumber(v)          { return Math.round(v).toLocaleString('en-IN'); }
function fmtPercent(v)         { return (v * 100).toFixed(2) + '%'; }

function fmtMetric(col, raw) {
  const d = derivedMetrics(raw);
  switch (col) {
    case 'clicks':      return fmtNumber(raw.clicks);
    case 'impressions': return fmtNumber(raw.impressions);
    case 'conversions': return fmtNumber(raw.conversions);
    case 'spent':       return fmtCurrency(raw.spent);
    case 'ctr':         return fmtPercent(d.ctr);
    case 'cpc':         return fmtCurrencyDec(d.cpc);
    case 'cpm':         return fmtCurrencyDec(d.cpm);
    default:            return '—';
  }
}

// ── Column config ─────────────────────────────────────────────────────────────

const METRIC_COLS = [
  { key: 'clicks',      label: 'Clicks'      },
  { key: 'impressions', label: 'Impressions'  },
  { key: 'conversions', label: 'Conversions'  },
  { key: 'spent',       label: 'Spent'        },
  { key: 'ctr',         label: 'CTR'          },
  { key: 'cpc',         label: 'CPC'          },
  { key: 'cpm',         label: 'CPM'          },
];

// ── KPI card config ───────────────────────────────────────────────────────────

const KPI_CARDS = [
  {
    label: 'Total Spent',
    getValue: (platforms, visible) => {
      const totals = aggregateMetrics(platforms.filter(p => visible.has(p.platform)).map(getPlatformMetrics));
      return fmtCurrency(totals.spent);
    },
    delta: '↑ 14%', positive: true,
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z',
  },
  {
    label: 'Impressions',
    getValue: (platforms, visible) => {
      const totals = aggregateMetrics(platforms.filter(p => visible.has(p.platform)).map(getPlatformMetrics));
      return fmtNumber(totals.impressions);
    },
    delta: '↑ 8%', positive: true,
    icon: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  },
  {
    label: 'Clicks',
    getValue: (platforms, visible) => {
      const totals = aggregateMetrics(platforms.filter(p => visible.has(p.platform)).map(getPlatformMetrics));
      return fmtNumber(totals.clicks);
    },
    delta: '↑ 11%', positive: true,
    icon: 'M9 3L5 6.99h3V14h2V6.99h3L9 3zm7 14.01V10h-2v7.01h-3L15 21l4-3.99h-3z',
  },
  {
    label: 'Conversions',
    getValue: (platforms, visible) => {
      const totals = aggregateMetrics(platforms.filter(p => visible.has(p.platform)).map(getPlatformMetrics));
      return fmtNumber(totals.conversions);
    },
    delta: '↑ 9%', positive: true,
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    label: 'Avg CTR',
    getValue: (platforms, visible) => {
      const totals = aggregateMetrics(platforms.filter(p => visible.has(p.platform)).map(getPlatformMetrics));
      return fmtPercent(derivedMetrics(totals).ctr);
    },
    delta: '↑ 0.18%', positive: true,
    icon: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  },
];

// ── StatusBadge sub-component ─────────────────────────────────────────────────

const STATUS_STYLES = {
  active: {
    bg:     'var(--severity-pass-bg)',
    text:   'var(--severity-pass-text)',
    border: 'var(--severity-pass-border)',
    dot:    'var(--severity-pass)',
  },
  paused: {
    bg:     'var(--severity-warning-bg)',
    text:   'var(--severity-warning-text)',
    border: 'var(--severity-warning-border)',
    dot:    'var(--severity-warning)',
  },
  draft: {
    bg:     'var(--severity-none-bg)',
    text:   'var(--severity-none-text)',
    border: 'transparent',
    dot:    'var(--severity-none)',
  },
  ended: {
    bg:     'var(--severity-critical-bg)',
    text:   'var(--severity-critical-text)',
    border: 'var(--severity-critical-border)',
    dot:    'var(--severity-critical)',
  },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 rounded text-xs font-medium uppercase tracking-wide"
      style={{
        height: 22,
        backgroundColor: s.bg,
        color:           s.text,
        border:          `1px solid ${s.border}`,
      }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: 5, height: 5, backgroundColor: s.dot }}
      />
      {status}
    </span>
  );
}

// ── KPI Cards sub-component ───────────────────────────────────────────────────

function KPICards({ platforms, visiblePlatforms }) {
  const values = useMemo(
    () => KPI_CARDS.map(c => c.getValue(platforms, visiblePlatforms)),
    [platforms, visiblePlatforms],
  );

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
      {KPI_CARDS.map((card, i) => (
        <div
          key={card.label}
          className="rounded-lg p-4 flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border:          '1px solid var(--border-default)',
          }}
        >
          {/* Label + icon */}
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              {card.label}
            </span>
            <svg
              width="16" height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ color: 'var(--text-muted)', flexShrink: 0 }}
            >
              <path d={card.icon} />
            </svg>
          </div>

          {/* Value */}
          <span
            className="text-2xl font-bold font-mono tabular-nums leading-none"
            style={{ color: 'var(--text-primary)' }}
          >
            {values[i]}
          </span>

          {/* Delta */}
          <span
            className="text-xs font-medium"
            style={{ color: card.positive ? 'var(--severity-pass)' : 'var(--severity-critical)' }}
          >
            {card.delta} vs last period
          </span>
        </div>
      ))}
    </div>
  );
}

// ── AdsTable sub-components ───────────────────────────────────────────────────

function MetricCells({ raw }) {
  return METRIC_COLS.map(col => (
    <td
      key={col.key}
      className="px-4 py-2.5 text-right font-mono tabular-nums text-sm whitespace-nowrap"
      style={{ color: 'var(--text-primary)' }}
    >
      {fmtMetric(col.key, raw)}
    </td>
  ));
}

function SortArrow({ active, direction }) {
  if (!active) return <span style={{ color: 'var(--text-disabled)', fontSize: 10 }}>⇅</span>;
  return <span style={{ color: 'var(--brand)', fontSize: 10 }}>{direction === 'asc' ? '↑' : '↓'}</span>;
}

function CampaignRows({ campaign, campaignRaw, isExpanded, onToggle }) {
  return (
    <>
      {/* Campaign row */}
      <tr
        className="transition-colors cursor-pointer"
        onClick={onToggle}
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-raised)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
      >
        <td className="px-4 py-2.5" style={{ paddingLeft: 32 }}>
          <div className="flex items-center gap-2">
            <span
              className="flex-shrink-0 transition-transform duration-150"
              style={{
                color:     'var(--text-muted)',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                display:   'inline-block',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
            <span
              className="text-sm truncate"
              style={{ color: 'var(--text-primary)', maxWidth: 200 }}
              title={campaign.name}
            >
              {campaign.name}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-disabled)' }}>—</td>
        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-disabled)' }}>—</td>
        <td className="px-4 py-2.5">
          <StatusBadge status={campaign.status} />
        </td>
        <MetricCells raw={campaignRaw} />
      </tr>

      {/* Ad rows — shown only when expanded */}
      {isExpanded && campaign.adSets.flatMap(adSet =>
        adSet.ads.map(ad => (
          <tr
            key={ad.id}
            className="transition-colors"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-raised)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
          >
            <td className="px-4 py-2" style={{ paddingLeft: 56 }}>
              <div className="flex items-center gap-1.5">
                <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>└</span>
              </div>
            </td>
            <td
              className="px-4 py-2 text-sm truncate"
              style={{ color: 'var(--text-muted)', maxWidth: 160 }}
              title={adSet.name}
            >
              {adSet.name}
            </td>
            <td
              className="px-4 py-2 text-sm truncate"
              style={{ color: 'var(--text-primary)', maxWidth: 190 }}
              title={ad.name}
            >
              {ad.name}
            </td>
            <td className="px-4 py-2">
              <StatusBadge status={ad.status} />
            </td>
            <MetricCells raw={ad} />
          </tr>
        ))
      )}
    </>
  );
}

function PlatformGroup({ platform, platformRaw, platformColor, sortedCampaigns, expandedCampaigns, onToggleCampaign }) {
  return (
    <>
      {/* Platform header row */}
      <tr
        style={{
          backgroundColor: 'var(--bg-raised)',
          borderTop:       '2px solid var(--border-default)',
          borderBottom:    '1px solid var(--border-default)',
        }}
      >
        <td className="px-4 py-2.5" colSpan={4}>
          <div className="flex items-center gap-2">
            <span
              className="rounded-sm flex-shrink-0"
              style={{ width: 3, height: 16, backgroundColor: platformColor }}
            />
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: platformColor }}
            >
              {platform.accountName}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{
                backgroundColor: platformColor + '18',
                color:           platformColor,
              }}
            >
              {platform.campaigns.length} campaigns
            </span>
          </div>
        </td>
        <MetricCells raw={platformRaw} />
      </tr>

      {/* Campaign rows */}
      {sortedCampaigns.map(campaign => {
        const campaignRaw = getCampaignMetrics(campaign);
        return (
          <CampaignRows
            key={campaign.id}
            campaign={campaign}
            campaignRaw={campaignRaw}
            isExpanded={expandedCampaigns.has(campaign.id)}
            onToggle={() => onToggleCampaign(campaign.id)}
          />
        );
      })}
    </>
  );
}

function AdsTable({ platforms, visiblePlatforms, expandedCampaigns, onToggleCampaign, sortConfig, onSort }) {
  const visiblePlatformsList = platforms.filter(p => visiblePlatforms.has(p.platform));
  const uniqueCurrencies = [...new Set(visiblePlatformsList.map(p => p.currency).filter(Boolean))];
  const showTotalRow = uniqueCurrencies.length <= 1;

  const totalRaw = useMemo(() => {
    const visible = platforms.filter(p => visiblePlatforms.has(p.platform));
    return aggregateMetrics(visible.map(getPlatformMetrics));
  }, [platforms, visiblePlatforms]);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border-default)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 1100 }}>

          {/* Header */}
          <thead
            className="sticky top-0 z-10"
            style={{
              backgroundColor: 'var(--bg-raised)',
              borderBottom:    '1px solid var(--border-default)',
            }}
          >
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-muted)', minWidth: 260 }}>
                Account / Campaign
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-muted)', minWidth: 180 }}>
                Ad Set
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-muted)', minWidth: 200 }}>
                Ad
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-muted)', minWidth: 90 }}>
                Status
              </th>

              {METRIC_COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap cursor-pointer select-none transition-colors"
                  style={{
                    color:           sortConfig.column === col.key ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor: sortConfig.column === col.key ? 'var(--bg-overlay)'   : undefined,
                    minWidth:        90,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = sortConfig.column === col.key ? 'var(--text-primary)' : 'var(--text-muted)')}
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    {col.label}
                    <SortArrow active={sortConfig.column === col.key} direction={sortConfig.direction} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {platforms.map(platform => {
              if (!visiblePlatforms.has(platform.platform)) return null;
              const platformColor = PLATFORM_COLORS[platform.platform] ?? 'var(--brand)';
              const platformRaw   = getPlatformMetrics(platform);
              const sortedCampaigns = [...platform.campaigns].sort((a, b) => {
                if (!sortConfig.column) return 0;
                const aVal = getSortValue(getCampaignMetrics(a), sortConfig.column);
                const bVal = getSortValue(getCampaignMetrics(b), sortConfig.column);
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
              });
              return (
                <PlatformGroup
                  key={platform.platform}
                  platform={platform}
                  platformRaw={platformRaw}
                  platformColor={platformColor}
                  sortedCampaigns={sortedCampaigns}
                  expandedCampaigns={expandedCampaigns}
                  onToggleCampaign={onToggleCampaign}
                />
              );
            })}
          </tbody>

          {/* Total row */}
          <tfoot>
            {showTotalRow && (
              <tr style={{ borderTop: '2px solid var(--border-default)', backgroundColor: 'var(--bg-raised)' }}>
                <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }} colSpan={4}>
                  Total (all visible platforms)
                </td>
                <MetricCells raw={totalRaw} />
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Data hook ─────────────────────────────────────────────────────────────────

function useAdsData(dateRange) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/ads/metrics?range=${dateRange}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load ad metrics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, setData, loading, error, refetch: fetchData };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdsDashboard() {
  const [dateRange, setDateRange]        = useState('last30d');
  const { data, setData, loading, error } = useAdsData(dateRange);
  const platforms = data?.platforms ?? [];
  const [visiblePlatforms, setVisible] = useState(() => new Set());
  const [expandedCampaigns, setExpanded] = useState(new Set());

  const { user, viewingCompanyId } = useAuth();
  const [syncing, setSyncing] = useState(false);

  // Sync visible platforms when data loads (initialize all to visible)
  useEffect(() => {
    if (platforms.length > 0) {
      setVisible(prev => {
        if (prev.size === 0) return new Set(platforms.map(p => p.platform));
        return prev;
      });
    }
  }, [platforms.length]);

  // Socket.io — listen for real-time sync progress
  useEffect(() => {
    const companyId = viewingCompanyId ?? user?.company_id;
    if (!companyId) return;
    const socketUrl = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;
    const socket = socketIo(socketUrl, { withCredentials: true });
    socket.emit('join:company', companyId);

    socket.on('ads:sync:progress', ({ platform, status, data: platformData }) => {
      if (status === 'done' && platformData) {
        setData(prev => {
          if (!prev) return prev;
          const updated = (prev.platforms || []).filter(p => p.platform !== platform);
          return { ...prev, platforms: [...updated, platformData] };
        });
      }
    });

    socket.on('ads:sync:complete', () => {
      setSyncing(false);
    });

    return () => {
      socket.emit('leave:company', companyId);
      socket.disconnect();
    };
  }, [user?.company_id, viewingCompanyId]);

  const [sortConfig, setSortConfig]      = useState({ column: 'spent', direction: 'desc' });

  const handleTogglePlatform = useCallback((id) => {
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // never hide last platform
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleCampaign = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSort = useCallback((col) => {
    setSortConfig(prev => ({
      column:    col,
      direction: prev.column === col && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const handleExport = useCallback(() => {
    const visible = platforms.filter(p => visiblePlatforms.has(p.platform));
    const totals  = aggregateMetrics(visible.map(getPlatformMetrics));
    // Export implementation is handled via the Sheets integration (backend/routes/sheets.js). Hook up here when ready.
  }, [dateRange, visiblePlatforms, platforms]);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      await api.post(`/ads/metrics/refresh?range=${dateRange}`);
      // Data updates come via Socket.io events
    } catch {
      setSyncing(false);
    }
  }, [dateRange]);

  const DATE_LABELS = { last7d: 'Last 7 days', last30d: 'Last 30 days', thisMonth: 'This month' };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>
        Loading ad metrics…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'var(--severity-critical)', textAlign: 'center', fontSize: '0.875rem' }}>
        {error}
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          No ad platforms connected yet.
        </p>
        <a href="/integrations" style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: '0.875rem' }}>
          Connect a platform on the Integrations page →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6" style={{ backgroundColor: 'var(--bg-base)', minHeight: '100%' }}>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Paid Ads Dashboard
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Aggregated across{' '}
            <span style={{ color: 'var(--text-primary)' }}>
              {visiblePlatforms.size} platform{visiblePlatforms.size !== 1 ? 's' : ''}
            </span>
            {' '}·{' '}
            {DATE_LABELS[dateRange]}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Platform pills */}
          <div className="flex items-center gap-2">
            {platforms.map(p => {
              const active = visiblePlatforms.has(p.platform);
              const color  = PLATFORM_COLORS[p.platform] ?? 'var(--brand)';
              return (
                <button
                  key={p.platform}
                  onClick={() => handleTogglePlatform(p.platform)}
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
                  {p.accountName}
                </button>
              );
            })}
          </div>

          {/* Date range */}
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
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

          {/* Sync Now */}
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap"
            style={{
              height:          36,
              backgroundColor: 'var(--bg-raised)',
              border:          '1px solid var(--border-default)',
              color:           syncing ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor:          syncing ? 'not-allowed' : 'pointer',
              opacity:         syncing ? 0.7 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap"
            style={{
              height:          36,
              backgroundColor: 'var(--brand)',
              color:           '#ffffff',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--brand-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--brand)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <KPICards platforms={platforms} visiblePlatforms={visiblePlatforms} />

      {/* Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            Campaign Breakdown
          </h3>
          <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>
            Click a campaign row to expand ad sets &amp; ads · Click a column header to sort
          </span>
        </div>

        <AdsTable
          platforms={platforms}
          visiblePlatforms={visiblePlatforms}
          expandedCampaigns={expandedCampaigns}
          onToggleCampaign={handleToggleCampaign}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
