// backend/__tests__/checks/s10-cwv.test.js
import { describe, it, expect } from 'vitest';
import { runCwvChecks } from '../../services/checks/s10-cwv.js';

const page = (monitoring = {}) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _monitoring: {
    ttfbMs: 400, totalRequests: 50, jsCssTransferBytes: 200000,
    lcpIsDecorative: false, clsSources: [],
    ...monitoring,
  },
});

describe('runCwvChecks', () => {
  it('passes for fast page', () => {
    expect(runCwvChecks([page()], {})).toHaveLength(0);
  });
  it('flags lab_ttfb when > 800ms', () => {
    const r = runCwvChecks([page({ ttfbMs: 1200 })], {});
    expect(r.some(x => x.check_id === 'lab_ttfb')).toBe(true);
  });
  it('flags lab_request_count when > 100 requests', () => {
    const r = runCwvChecks([page({ totalRequests: 120 })], {});
    expect(r.some(x => x.check_id === 'lab_request_count')).toBe(true);
  });
  it('flags lab_asset_weight when JS+CSS > 500KB', () => {
    const r = runCwvChecks([page({ jsCssTransferBytes: 600000 })], {});
    expect(r.some(x => x.check_id === 'lab_asset_weight')).toBe(true);
  });
  it('flags lcp_element_id for decorative LCP element', () => {
    const r = runCwvChecks([page({ lcpIsDecorative: true, lcpTagName: 'DIV' })], {});
    expect(r.some(x => x.check_id === 'lcp_element_id')).toBe(true);
  });
});
