// backend/__tests__/checks/s23-geo.test.js
import { describe, it, expect } from 'vitest';
import { runGeoChecks } from '../../services/checks/s23-geo.js';

const pagesWithSiteData = (siteDataOverrides = {}) => [{
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _isHttps: true,
  _jsRender: { rawHasH1: true, rawWordCount: 200, rawLinkCount: 5 },
  _siteData: {
    robots: {
      exists: true,
      llmsTxt: '# Example\n\nSite description here.\n\n- [Blog](/blog): Our blog',
      llmsFullTxt: null,
      urlMdSample: { hasAny: false, tested: [], found: [] },
      agentRules: { GPTBot: { disallowed: [], allowed: ['/'] } },
    },
    ...siteDataOverrides,
  },
  'Canonical Link Element 1': 'https://example.com/page',
}];

describe('runGeoChecks', () => {
  it('passes for GEO-optimized site', () => {
    expect(runGeoChecks(pagesWithSiteData(), {})).toHaveLength(0);
  });
  it('flags geo_llms_txt when llms.txt not found', () => {
    const r = runGeoChecks(pagesWithSiteData({ robots: { exists: true, llmsTxt: null, llmsFullTxt: null, urlMdSample: { hasAny: false }, agentRules: {} } }), {});
    expect(r.some(x => x.check_id === 'geo_llms_txt')).toBe(true);
  });
  it('flags geo_https_trust for HTTP content page', () => {
    const pages = pagesWithSiteData();
    pages[0]._isHttps = false;
    pages[0].url = 'http://example.com/page';
    const r = runGeoChecks(pages, {});
    expect(r.some(x => x.check_id === 'geo_https_trust')).toBe(true);
  });
  it('flags geo_content_without_js when H1 only in rendered DOM', () => {
    const pages = pagesWithSiteData();
    pages[0]._jsRender = { rawHasH1: false, rawWordCount: 0, rawLinkCount: 0 };
    const r = runGeoChecks(pages, {});
    expect(r.some(x => x.check_id === 'geo_content_without_js')).toBe(true);
  });
});
