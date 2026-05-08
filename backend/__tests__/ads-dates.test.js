import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDateRange } from '../services/ads.service.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

describe('getDateRange (IST)', () => {
  beforeEach(() => {
    // Pin to 2026-04-14 10:00:00 UTC = 2026-04-14 15:30:00 IST
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('last7d: startDate is 6 days before today in IST', () => {
    const { startDate, endDate } = getDateRange('last7d');
    // IST today = 2026-04-14; start = today-6 = 2026-04-08
    expect(startDate).toBe('2026-04-08');
    expect(endDate).toBe('2026-04-14');
  });

  it('last30d: startDate is 29 days before today', () => {
    const { startDate, endDate } = getDateRange('last30d');
    expect(startDate).toBe('2026-03-16');
    expect(endDate).toBe('2026-04-14');
  });

  it('thisMonth: startDate is 1st of the current month', () => {
    const { startDate, endDate } = getDateRange('thisMonth');
    expect(startDate).toBe('2026-04-01');
    expect(endDate).toBe('2026-04-14');
  });

  it('throws on unknown range', () => {
    expect(() => getDateRange('yesterday')).toThrow('Unknown date range');
  });
});
