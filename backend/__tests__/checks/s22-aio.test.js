// backend/__tests__/checks/s22-aio.test.js
import { describe, it, expect } from 'vitest';
import { runAioChecks } from '../../services/checks/s22-aio.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Word Count': '900',
  _headingHierarchy: [
    { level: 2, text: 'What is car insurance?' },
    { level: 2, text: 'How does car insurance work?' },
    { level: 2, text: 'Why do I need coverage?' },
  ],
  _schemaTypes: ['Article', 'FAQPage'],
  _hasTocAnchors: true,
  ...overrides,
});

describe('runAioChecks', () => {
  it('passes for AIO-optimized page', () => {
    expect(runAioChecks([page()], {})).toHaveLength(0);
  });
  it('flags aio_qa_format when < 2 question headings on informational page', () => {
    const r = runAioChecks([page({ _headingHierarchy: [{ level: 2, text: 'Overview' }, { level: 2, text: 'Details' }] })], {});
    expect(r.some(x => x.check_id === 'aio_qa_format')).toBe(true);
  });
  it('flags aio_schema_ai_readability when no Article/FAQ/HowTo schema', () => {
    const r = runAioChecks([page({ _schemaTypes: ['WebPage'] })], {});
    expect(r.some(x => x.check_id === 'aio_schema_ai_readability')).toBe(true);
  });
  it('flags aio_content_length for informational page < 800 words', () => {
    const r = runAioChecks([page({ 'Word Count': '500' })], {});
    expect(r.some(x => x.check_id === 'aio_content_length')).toBe(true);
  });
  it('flags aio_toc_anchors for long-form page without TOC', () => {
    const r = runAioChecks([page({ 'Word Count': '2000', _hasTocAnchors: false })], {});
    expect(r.some(x => x.check_id === 'aio_toc_anchors')).toBe(true);
  });
});
