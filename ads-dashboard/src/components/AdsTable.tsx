import { useMemo } from 'react';
import type { Platform, RawMetrics } from '../data/mockData';
import type { SortableColumn } from '../utils/metrics';
import {
  aggregateMetrics, getCampaignMetrics, getPlatformMetrics,
  getSortValue, fmtMetric,
} from '../utils/metrics';
import StatusBadge from './StatusBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SortConfig {
  column:    SortableColumn | null;
  direction: 'asc' | 'desc';
}

interface Props {
  platforms:          Platform[];
  visiblePlatforms:   Set<string>;
  expandedCampaigns:  Set<string>;
  onToggleCampaign:   (id: string) => void;
  sortConfig:         SortConfig;
  onSort:             (col: SortableColumn) => void;
}

// ── Column definitions ────────────────────────────────────────────────────────

const METRIC_COLS: Array<{ key: SortableColumn; label: string }> = [
  { key: 'clicks',      label: 'Clicks'      },
  { key: 'impressions', label: 'Impressions'  },
  { key: 'leads',       label: 'Leads'        },
  { key: 'conversions', label: 'Conversions'  },
  { key: 'spent',       label: 'Spent'        },
  { key: 'ctr',         label: 'CTR'          },
  { key: 'cpc',         label: 'CPC'          },
  { key: 'cpl',         label: 'CPL'          },
  { key: 'cpm',         label: 'CPM'          },
];

// ── Platform color accent map ─────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  google:   '#4285F4',
  meta:     '#1877F2',
  linkedin: '#0A66C2',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCells({ raw }: { raw: RawMetrics }) {
  return (
    <>
      {METRIC_COLS.map(col => (
        <td
          key={col.key}
          className="px-4 py-2.5 text-right font-mono tabular-nums text-sm whitespace-nowrap"
          style={{ color: 'var(--text-primary)' }}
        >
          {fmtMetric(col.key, raw)}
        </td>
      ))}
    </>
  );
}

function SortArrow({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) {
    return (
      <span style={{ color: 'var(--text-disabled)', fontSize: 10 }}>⇅</span>
    );
  }
  return (
    <span style={{ color: 'var(--brand-default)', fontSize: 10 }}>
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdsTable({
  platforms,
  visiblePlatforms,
  expandedCampaigns,
  onToggleCampaign,
  sortConfig,
  onSort,
}: Props) {
  // Compute total row across all visible platforms
  const totalRaw = useMemo(() => {
    const visible = platforms.filter(p => visiblePlatforms.has(p.id));
    return aggregateMetrics(visible.map(p => getPlatformMetrics(p)));
  }, [platforms, visiblePlatforms]);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border-default)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 1100 }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <thead
            className="sticky top-0 z-10"
            style={{
              backgroundColor: 'var(--bg-raised)',
              borderBottom:    '1px solid var(--border-default)',
            }}
          >
            <tr>
              {/* Text columns */}
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                style={{ color: 'var(--text-muted)', minWidth: 260 }}
              >
                Account / Campaign
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                style={{ color: 'var(--text-muted)', minWidth: 180 }}
              >
                Ad Set
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                style={{ color: 'var(--text-muted)', minWidth: 200 }}
              >
                Ad
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                style={{ color: 'var(--text-muted)', minWidth: 90 }}
              >
                Status
              </th>

              {/* Sortable metric columns */}
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
                    <SortArrow
                      active={sortConfig.column === col.key}
                      direction={sortConfig.direction}
                    />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <tbody>
            {platforms.map(platform => {
              if (!visiblePlatforms.has(platform.id)) return null;

              const platformColor = PLATFORM_COLORS[platform.id] ?? 'var(--brand-default)';
              const platformRaw   = getPlatformMetrics(platform);

              // Sort campaigns within this platform
              const sortedCampaigns = [...platform.campaigns].sort((a, b) => {
                if (!sortConfig.column) return 0;
                const aVal = getSortValue(getCampaignMetrics(a), sortConfig.column);
                const bVal = getSortValue(getCampaignMetrics(b), sortConfig.column);
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
              });

              return (
                <PlatformGroup
                  key={platform.id}
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

          {/* ── Total row ───────────────────────────────────────────────── */}
          <tfoot>
            <tr
              style={{
                borderTop:       '2px solid var(--border-default)',
                backgroundColor: 'var(--bg-raised)',
              }}
            >
              <td
                className="px-4 py-3 text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
                colSpan={4}
              >
                Total (all visible platforms)
              </td>
              <MetricCells raw={totalRaw} />
            </tr>
          </tfoot>

        </table>
      </div>
    </div>
  );
}

// ── Platform group (extracted to avoid re-render loops) ───────────────────────

interface PlatformGroupProps {
  platform:          Platform;
  platformRaw:       RawMetrics;
  platformColor:     string;
  sortedCampaigns:   Platform['campaigns'];
  expandedCampaigns: Set<string>;
  onToggleCampaign:  (id: string) => void;
}

function PlatformGroup({
  platform,
  platformRaw,
  platformColor,
  sortedCampaigns,
  expandedCampaigns,
  onToggleCampaign,
}: PlatformGroupProps) {
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
              {platform.name}
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
        const isExpanded   = expandedCampaigns.has(campaign.id);
        const campaignRaw  = getCampaignMetrics(campaign);

        return (
          <CampaignRows
            key={campaign.id}
            campaign={campaign}
            campaignRaw={campaignRaw}
            isExpanded={isExpanded}
            onToggle={() => onToggleCampaign(campaign.id)}
          />
        );
      })}
    </>
  );
}

// ── Campaign + its expanded ad rows ──────────────────────────────────────────

interface CampaignRowsProps {
  campaign:    Platform['campaigns'][number];
  campaignRaw: RawMetrics;
  isExpanded:  boolean;
  onToggle:    () => void;
}

function CampaignRows({ campaign, campaignRaw, isExpanded, onToggle }: CampaignRowsProps) {
  return (
    <>
      {/* Campaign row */}
      <tr
        className="group transition-colors cursor-pointer"
        onClick={onToggle}
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-raised)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
      >
        {/* Account/Campaign column — indent 16px */}
        <td className="px-4 py-2.5" style={{ paddingLeft: 32 }}>
          <div className="flex items-center gap-2">
            {/* Chevron */}
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
        {/* Ad Set + Ad columns — empty at campaign level */}
        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-disabled)' }}>—</td>
        <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-disabled)' }}>—</td>
        <td className="px-4 py-2.5">
          <StatusBadge status={campaign.status} />
        </td>
        <MetricCells raw={campaignRaw} />
      </tr>

      {/* Ad rows — shown only when campaign is expanded */}
      {isExpanded && campaign.adSets.flatMap(adSet =>
        adSet.ads.map(ad => (
          <tr
            key={ad.id}
            className="transition-colors"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-raised)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
          >
            {/* Account/Campaign — indent 32px, tree connector */}
            <td className="px-4 py-2" style={{ paddingLeft: 56 }}>
              <div className="flex items-center gap-1.5">
                <span style={{ color: 'var(--border-default)', fontSize: 12 }}>└</span>
              </div>
            </td>
            {/* Ad Set column */}
            <td
              className="px-4 py-2 text-sm truncate"
              style={{ color: 'var(--text-muted)', maxWidth: 160 }}
              title={adSet.name}
            >
              {adSet.name}
            </td>
            {/* Ad column */}
            <td
              className="px-4 py-2 text-sm truncate"
              style={{ color: 'var(--text-primary)', maxWidth: 190 }}
              title={ad.name}
            >
              {ad.name}
            </td>
            {/* Status */}
            <td className="px-4 py-2">
              <StatusBadge status={ad.status} />
            </td>
            {/* Metrics */}
            <MetricCells raw={ad} />
          </tr>
        ))
      )}
    </>
  );
}
