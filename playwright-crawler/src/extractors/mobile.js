// playwright-crawler/src/extractors/mobile.js
/**
 * Mobile extractor — per-page, Playwright mode only.
 * Serves: Section 8 (Mobile & Usability).
 *
 * Temporarily resizes the page to iPhone 14 viewport (375×812),
 * measures mobile-specific signals, then restores original viewport.
 */

const MOBILE_VIEWPORT  = { width: 375, height: 812 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MIN_TAP_SIZE_PX  = 44; // Google's minimum recommended tap target size

/**
 * @param {import('playwright').Page} page
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function extractMobile(page, url) {
  const originalViewport = page.viewportSize();

  const viewportMetaPresent = await page.evaluate(
    () => !!document.querySelector('meta[name="viewport"]')
  ).catch(() => false);

  let desktopWordCount = 0, desktopH1 = '';
  try {
    desktopWordCount = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return (clone.innerText || '').trim().split(/\s+/).filter(Boolean).length;
    });
    desktopH1 = await page.evaluate(() => document.querySelector('h1')?.innerText?.trim() ?? '');
  } catch {}

  await page.setViewportSize(MOBILE_VIEWPORT).catch(() => {});

  let bodyScrollWidthExceedsWindow = false;
  let tapTargets = [], smallTapTargets = [];
  let bodyFontSizePx = 16;
  let zoomDisabled   = false;
  let fullViewportOverlays = 0;
  let mobileWordCount = 0, mobileH1 = '';

  try {
    bodyScrollWidthExceedsWindow = await page.evaluate(
      () => document.body.scrollWidth > window.innerWidth
    );

    tapTargets = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button, input, select, [role="button"]');
      return [...els].map(el => {
        const r = el.getBoundingClientRect();
        return { selector: el.tagName.toLowerCase(), width: Math.round(r.width), height: Math.round(r.height) };
      }).filter(t => t.width > 0 && t.height > 0);
    });

    smallTapTargets = tapTargets.filter(t => t.width < MIN_TAP_SIZE_PX || t.height < MIN_TAP_SIZE_PX);

    bodyFontSizePx = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return parseFloat(style.fontSize) || 16;
    });

    const vmContent = await page.evaluate(
      () => document.querySelector('meta[name="viewport"]')?.content ?? ''
    );
    zoomDisabled = /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?!\d)/i.test(vmContent);

    fullViewportOverlays = await page.evaluate(() =>
      [...document.querySelectorAll('*')].filter(el => {
        const s = window.getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'sticky') return false;
        const r = el.getBoundingClientRect();
        return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.5;
      }).length
    );

    mobileWordCount = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return (clone.innerText || '').trim().split(/\s+/).filter(Boolean).length;
    });

    mobileH1 = await page.evaluate(
      () => document.querySelector('h1')?.innerText?.trim() ?? ''
    );
  } catch {}

  // Restore original viewport
  const restore = originalViewport ?? DESKTOP_VIEWPORT;
  await page.setViewportSize(restore).catch(() => {});

  return {
    viewportMetaPresent,
    bodyScrollWidthExceedsWindow,
    tapTargets,
    smallTapTargets,
    bodyFontSizePx,
    zoomDisabled,
    fullViewportOverlays,
    desktopWordCount,
    mobileWordCount,
    desktopH1,
    mobileH1,
  };
}
