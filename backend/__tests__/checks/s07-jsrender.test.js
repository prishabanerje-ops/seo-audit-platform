// backend/__tests__/checks/s07-jsrender.test.js
import { describe, it, expect } from 'vitest';
import { runJsRenderChecks } from '../../services/checks/s07-jsrender.js';

const page = (jsRender = {}) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _jsRender: {
    rawWordCount: 400, renderedWordCount: 420, rawLinkCount: 10, renderedLinkCount: 12,
    rawHasH1: true, rawHasTitle: true, rawHasMetaDesc: true, rawHasJsonLd: true,
    renderBlockingScripts: [], domContentLoadedMs: 800, lazyContentLinks: 0,
    ...jsRender,
  },
});

describe('runJsRenderChecks', () => {
  it('passes for well-rendered page', () => {
    expect(runJsRenderChecks([page()], {})).toHaveLength(0);
  });
  it('flags js_critical_content when H1 only in rendered HTML', () => {
    const r = runJsRenderChecks([page({ rawHasH1: false })], {});
    expect(r.some(x => x.check_id === 'js_critical_content')).toBe(true);
  });
  it('flags js_metadata when title missing in raw HTML', () => {
    const r = runJsRenderChecks([page({ rawHasTitle: false })], {});
    expect(r.some(x => x.check_id === 'js_metadata')).toBe(true);
  });
  it('flags js_link_discovery when rendered links > 20% more than raw', () => {
    const r = runJsRenderChecks([page({ rawLinkCount: 5, renderedLinkCount: 7 })], {});
    expect(r.some(x => x.check_id === 'js_link_discovery')).toBe(true);
  });
  it('flags js_crawl_budget_render when DCL > 2000ms', () => {
    const r = runJsRenderChecks([page({ domContentLoadedMs: 2500 })], {});
    expect(r.some(x => x.check_id === 'js_crawl_budget_render')).toBe(true);
  });
});
