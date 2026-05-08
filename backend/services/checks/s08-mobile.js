// backend/services/checks/s08-mobile.js
const SECTION = 'Mobile & Usability';

export function runMobileChecks(records, _ctx) {
  const failures = [];

  for (const r of records) {
    const url = r.url || '';
    if (!url || r['Indexability'] !== 'Indexable') continue;
    const m = r._mobile;
    if (!m) continue;

    // viewport_meta
    if (!m.viewportMetaPresent) {
      failures.push({ check_id: 'viewport_meta', passed: false, severity: 'critical', section: SECTION,
        message: 'Missing <meta name="viewport"> tag', details: url });
    }

    // mobile_responsive
    if (m.bodyScrollWidthExceedsWindow) {
      failures.push({ check_id: 'mobile_responsive', passed: false, severity: 'critical', section: SECTION,
        message: 'Page content wider than viewport — not mobile responsive', details: url });
    }

    // tap_target_size
    if ((m.smallTapTargets || []).length > 0) {
      failures.push({ check_id: 'tap_target_size', passed: false, severity: 'warning', section: SECTION,
        message: `${m.smallTapTargets.length} tap target(s) smaller than 48×48px`, details: url });
    }

    // text_legibility
    if ((m.bodyFontSizePx || 16) < 16) {
      failures.push({ check_id: 'text_legibility', passed: false, severity: 'warning', section: SECTION,
        message: `Body font size is ${m.bodyFontSizePx}px — below 16px minimum`, details: url });
    }

    // horizontal_scroll
    if (m.bodyScrollWidthExceedsWindow) {
      failures.push({ check_id: 'horizontal_scroll', passed: false, severity: 'critical', section: SECTION,
        message: 'Horizontal scrolling detected on mobile viewport', details: url });
    }

    // zoom_disabled
    if (m.zoomDisabled) {
      failures.push({ check_id: 'zoom_disabled', passed: false, severity: 'warning', section: SECTION,
        message: 'Zoom disabled via viewport meta (user-scalable=no or maximum-scale=1)', details: url });
    }

    // mobile_interstitials
    if ((m.fullViewportOverlays || 0) > 0) {
      failures.push({ check_id: 'mobile_interstitials', passed: false, severity: 'warning', section: SECTION,
        message: `${m.fullViewportOverlays} full-viewport overlay(s) detected on mobile load`, details: url });
    }

    // mobile_content_parity — > 15% word count difference
    if (m.desktopWordCount > 0 && m.mobileWordCount > 0) {
      const diff = Math.abs(m.desktopWordCount - m.mobileWordCount) / m.desktopWordCount;
      if (diff > 0.15) {
        failures.push({ check_id: 'mobile_content_parity', passed: false, severity: 'critical', section: SECTION,
          message: `Mobile word count (${m.mobileWordCount}) differs ${Math.round(diff*100)}% from desktop (${m.desktopWordCount})`,
          details: url });
      }
    }

    // H1 parity
    if (m.desktopH1 && m.mobileH1 && m.desktopH1 !== m.mobileH1) {
      failures.push({ check_id: 'mobile_content_parity', passed: false, severity: 'critical', section: SECTION,
        message: `Mobile H1 differs from desktop H1`, details: url });
    }

    // touch_spacing
    if ((m.touchSpacingIssues || 0) > 0) {
      failures.push({ check_id: 'touch_spacing', passed: false, severity: 'warning', section: SECTION,
        message: `${m.touchSpacingIssues} tap target pair(s) with < 8px gap`, details: url });
    }

    // app_install_banners
    if (m.appInstallBannerDetected) {
      failures.push({ check_id: 'app_install_banners', passed: false, severity: 'info', section: SECTION,
        message: 'App install banner covering viewport on mobile load', details: url });
    }
  }

  return failures;
}
