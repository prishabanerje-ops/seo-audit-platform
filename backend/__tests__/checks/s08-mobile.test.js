// backend/__tests__/checks/s08-mobile.test.js
import { describe, it, expect } from 'vitest';
import { runMobileChecks } from '../../services/checks/s08-mobile.js';

const page = (mobile = {}) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Meta Robots 1': '',
  _mobile: {
    viewportMetaPresent: true, bodyScrollWidthExceedsWindow: false,
    smallTapTargets: [], bodyFontSizePx: 16, zoomDisabled: false,
    fullViewportOverlays: 0, desktopWordCount: 400, mobileWordCount: 400,
    desktopH1: 'Title', mobileH1: 'Title',
    ...mobile,
  },
});

describe('runMobileChecks', () => {
  it('passes for mobile-friendly page', () => {
    expect(runMobileChecks([page()], {})).toHaveLength(0);
  });
  it('flags viewport_meta when missing', () => {
    const r = runMobileChecks([page({ viewportMetaPresent: false })], {});
    expect(r.some(x => x.check_id === 'viewport_meta')).toBe(true);
  });
  it('flags horizontal_scroll when body wider than window', () => {
    const r = runMobileChecks([page({ bodyScrollWidthExceedsWindow: true })], {});
    expect(r.some(x => x.check_id === 'horizontal_scroll')).toBe(true);
  });
  it('flags tap_target_size for small targets', () => {
    const r = runMobileChecks([page({ smallTapTargets: [{ selector: 'a', width: 30, height: 30 }] })], {});
    expect(r.some(x => x.check_id === 'tap_target_size')).toBe(true);
  });
  it('flags mobile_content_parity when mobile word count differs > 15%', () => {
    const r = runMobileChecks([page({ desktopWordCount: 400, mobileWordCount: 300 })], {});
    expect(r.some(x => x.check_id === 'mobile_content_parity')).toBe(true);
  });
});
