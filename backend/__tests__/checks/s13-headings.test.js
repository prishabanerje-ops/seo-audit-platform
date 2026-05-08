// backend/__tests__/checks/s13-headings.test.js
import { describe, it, expect } from 'vitest';
import { runHeadingChecks } from '../../services/checks/s13-headings.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'H1-1': 'Main Page Heading',
  'H1-2': '',
  'H1 Occurrences': '1',
  'H2-1': 'First Section',
  'H2 Occurrences': '3',
  'Word Count': '500',
  _headingHierarchy: [{ level: 1, text: 'Main' }, { level: 2, text: 'Section 1' }, { level: 3, text: 'Sub' }],
  ...overrides,
});

describe('runHeadingChecks', () => {
  it('passes for well-structured page', () => {
    expect(runHeadingChecks([page()], {})).toHaveLength(0);
  });
  it('flags h1_present when H1 missing', () => {
    const r = runHeadingChecks([page({ 'H1-1': '', 'H1 Occurrences': '0' })], {});
    expect(r.some(x => x.check_id === 'h1_present')).toBe(true);
  });
  it('flags h1_present when multiple H1s', () => {
    const r = runHeadingChecks([page({ 'H1-2': 'Second H1', 'H1 Occurrences': '2' })], {});
    expect(r.some(x => x.check_id === 'h1_present')).toBe(true);
  });
  it('flags h1_unique for duplicate H1 across site', () => {
    const pages = [page({ url: 'https://example.com/a' }), page({ url: 'https://example.com/b' })];
    const r = runHeadingChecks(pages, {});
    expect(r.some(x => x.check_id === 'h1_unique')).toBe(true);
  });
  it('flags heading_hierarchy for skipped level (H1→H3)', () => {
    const r = runHeadingChecks([page({ _headingHierarchy: [{ level: 1 }, { level: 3 }] })], {});
    expect(r.some(x => x.check_id === 'heading_hierarchy')).toBe(true);
  });
  it('flags h2_structure for content page > 300 words with no H2', () => {
    const r = runHeadingChecks([page({ 'H2-1': '', 'H2 Occurrences': '0' })], {});
    expect(r.some(x => x.check_id === 'h2_structure')).toBe(true);
  });
});
