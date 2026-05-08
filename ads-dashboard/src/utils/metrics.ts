import type { RawMetrics, Campaign, Platform } from '../data/mockData';

// ── Aggregation ───────────────────────────────────────────────────────────────

export function aggregateMetrics(items: RawMetrics[]): RawMetrics {
  return items.reduce(
    (acc, m) => ({
      clicks:      acc.clicks      + m.clicks,
      impressions: acc.impressions + m.impressions,
      leads:       acc.leads       + m.leads,
      conversions: acc.conversions + m.conversions,
      spent:       acc.spent       + m.spent,
    }),
    { clicks: 0, impressions: 0, leads: 0, conversions: 0, spent: 0 },
  );
}

export function getCampaignMetrics(campaign: Campaign): RawMetrics {
  return aggregateMetrics(
    campaign.adSets.flatMap(as => as.ads),
  );
}

export function getPlatformMetrics(platform: Platform): RawMetrics {
  return aggregateMetrics(
    platform.campaigns.flatMap(c => c.adSets.flatMap(as => as.ads)),
  );
}

// ── Derived metrics (never stored — always computed on the fly) ───────────────

export interface DerivedMetrics {
  ctr: number;  // clicks / impressions
  cpc: number;  // spent / clicks
  cpl: number;  // spent / leads
  cpm: number;  // (spent / impressions) * 1000
}

export function derivedMetrics(raw: RawMetrics): DerivedMetrics {
  return {
    ctr: raw.impressions > 0 ? raw.clicks / raw.impressions : 0,
    cpc: raw.clicks      > 0 ? raw.spent  / raw.clicks      : 0,
    cpl: raw.leads       > 0 ? raw.spent  / raw.leads       : 0,
    cpm: raw.impressions > 0 ? (raw.spent / raw.impressions) * 1000 : 0,
  };
}

export type SortableColumn =
  | 'clicks' | 'impressions' | 'leads' | 'conversions' | 'spent'
  | 'ctr' | 'cpc' | 'cpl' | 'cpm';

export function getSortValue(raw: RawMetrics, col: SortableColumn): number {
  if (col in raw) return raw[col as keyof RawMetrics];
  return derivedMetrics(raw)[col as keyof DerivedMetrics];
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** ₹1,23,456 — Indian number system, zero decimal places */
export function fmtCurrency(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN');
}

/** ₹1,234.56 — two decimal places for small per-unit costs */
export function fmtCurrencyDecimal(value: number): string {
  return '₹' + value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 1,23,456 — Indian number system */
export function fmtNumber(value: number): string {
  return Math.round(value).toLocaleString('en-IN');
}

/** 2.45% */
export function fmtPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

/** Format any metric column value for display */
export function fmtMetric(col: SortableColumn, raw: RawMetrics): string {
  const d = derivedMetrics(raw);
  switch (col) {
    case 'clicks':      return fmtNumber(raw.clicks);
    case 'impressions': return fmtNumber(raw.impressions);
    case 'leads':       return fmtNumber(raw.leads);
    case 'conversions': return fmtNumber(raw.conversions);
    case 'spent':       return fmtCurrency(raw.spent);
    case 'ctr':         return fmtPercent(d.ctr);
    case 'cpc':         return fmtCurrencyDecimal(d.cpc);
    case 'cpl':         return fmtCurrencyDecimal(d.cpl);
    case 'cpm':         return fmtCurrencyDecimal(d.cpm);
  }
}
