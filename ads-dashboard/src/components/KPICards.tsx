import { useMemo } from 'react';
import type { Platform } from '../data/mockData';
import { getPlatformMetrics, aggregateMetrics, derivedMetrics, fmtCurrency, fmtNumber, fmtPercent, fmtCurrencyDecimal } from '../utils/metrics';

interface Props {
  platforms: Platform[];
  visiblePlatforms: Set<string>;
}

interface CardDef {
  label:    string;
  value:    (platforms: Platform[], visible: Set<string>) => string;
  delta:    string;
  positive: boolean;
}

const CARDS: CardDef[] = [
  {
    label: 'Total Spent',
    value: (ps, vis) => {
      const totals = aggregateMetrics(ps.filter(p => vis.has(p.id)).map(p => getPlatformMetrics(p)));
      return fmtCurrency(totals.spent);
    },
    delta: '↑ 14%',
    positive: true,
  },
  {
    label: 'Impressions',
    value: (ps, vis) => {
      const totals = aggregateMetrics(ps.filter(p => vis.has(p.id)).map(p => getPlatformMetrics(p)));
      return fmtNumber(totals.impressions);
    },
    delta: '↑ 8%',
    positive: true,
  },
  {
    label: 'Clicks',
    value: (ps, vis) => {
      const totals = aggregateMetrics(ps.filter(p => vis.has(p.id)).map(p => getPlatformMetrics(p)));
      return fmtNumber(totals.clicks);
    },
    delta: '↑ 11%',
    positive: true,
  },
  {
    label: 'Leads',
    value: (ps, vis) => {
      const totals = aggregateMetrics(ps.filter(p => vis.has(p.id)).map(p => getPlatformMetrics(p)));
      return fmtNumber(totals.leads);
    },
    delta: '↑ 6%',
    positive: true,
  },
  {
    label: 'Avg CPL',
    value: (ps, vis) => {
      const totals = aggregateMetrics(ps.filter(p => vis.has(p.id)).map(p => getPlatformMetrics(p)));
      return fmtCurrencyDecimal(derivedMetrics(totals).cpl);
    },
    delta: '↓ 4%',
    positive: true, // lower CPL is good
  },
  {
    label: 'Avg CTR',
    value: (ps, vis) => {
      const totals = aggregateMetrics(ps.filter(p => vis.has(p.id)).map(p => getPlatformMetrics(p)));
      return fmtPercent(derivedMetrics(totals).ctr);
    },
    delta: '↑ 0.18%',
    positive: true,
  },
];

// Icon SVG paths for each card
const ICONS: Record<string, string> = {
  'Total Spent':  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z',
  'Impressions':  'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  'Clicks':       'M9 3L5 6.99h3V14h2V6.99h3L9 3zm7 14.01V10h-2v7.01h-3L15 21l4-3.99h-3z',
  'Leads':        'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  'Avg CPL':      'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  'Avg CTR':      'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
};

export default function KPICards({ platforms, visiblePlatforms }: Props) {
  const values = useMemo(
    () => CARDS.map(c => c.value(platforms, visiblePlatforms)),
    [platforms, visiblePlatforms],
  );

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
      {CARDS.map((card, i) => (
        <div
          key={card.label}
          className="rounded-lg p-4 flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border:          '1px solid var(--border-default)',
          }}
        >
          {/* Label + icon row */}
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
              <path d={ICONS[card.label]} />
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
            style={{ color: card.positive ? '#10b981' : '#ef4444' }}
          >
            {card.delta} vs last period
          </span>
        </div>
      ))}
    </div>
  );
}
