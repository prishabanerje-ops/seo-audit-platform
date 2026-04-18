import { describe, it, expect } from '@jest/globals';
import { load } from 'cheerio';
import { extractMobile } from '../../src/extractors/mobile.js';

describe('extractMobile()', () => {
  it('detects viewport meta tag', () => {
    const $ = load('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head></html>');
    const { _mobile: r } = extractMobile($, 'https://example.com/');
    expect(r.hasViewport).toBe(true);
    expect(r.viewportContent).toBe('width=device-width,initial-scale=1');
  });

  it('returns hasViewport=false when missing', () => {
    const $ = load('<html><head></head></html>');
    const { _mobile: r } = extractMobile($, 'https://example.com/');
    expect(r.hasViewport).toBe(false);
  });

  it('detects AMP link', () => {
    const $ = load('<html><head><link rel="amphtml" href="https://example.com/amp/page"></head></html>');
    const { _mobile: r } = extractMobile($, 'https://example.com/page');
    expect(r.hasAmpLink).toBe(true);
    expect(r.ampHref).toBe('https://example.com/amp/page');
  });

  it('counts render-blocking resources in head', () => {
    const $ = load(`<html><head>
      <link rel="stylesheet" href="/style.css">
      <script src="/app.js"></script>
      <script src="/vendor.js" defer></script>
    </head></html>`);
    const { _mobile: r } = extractMobile($, 'https://example.com/');
    expect(r.renderBlockingCount).toBe(2); // 1 stylesheet + 1 sync script (defer excluded)
  });

  it('counts third-party scripts', () => {
    const $ = load(`<html><head></head><body>
      <script src="https://www.googletagmanager.com/gtm.js"></script>
      <script src="https://cdn.example.com/lib.js"></script>
      <script src="/local.js"></script>
    </body></html>`);
    const { _mobile: r } = extractMobile($, 'https://example.com/page');
    expect(r.thirdPartyScriptCount).toBe(2);
    expect(r.thirdPartyDomains).toContain('https://www.googletagmanager.com');
  });

  it('handles null $ gracefully', () => {
    const { _mobile: r } = extractMobile(null, 'https://example.com/');
    expect(r.hasViewport).toBe(false);
    expect(r.renderBlockingCount).toBe(0);
  });
});
