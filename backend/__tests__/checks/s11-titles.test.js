// backend/__tests__/checks/s11-titles.test.js
import { describe, it, expect } from 'vitest';
import { runTitleChecks } from '../../services/checks/s11-titles.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  'Title 1': 'Car Insurance Plans | Compare & Save | Example',
  'Title 1 Length': '50',
  'Title 1 Pixel Width': '490',
  'H1-1': 'Best Car Insurance Plans',
  ...overrides,
});

describe('runTitleChecks', () => {
  it('passes for valid title', () => {
    expect(runTitleChecks([page()], {})).toHaveLength(0);
  });
  it('flags title_present when missing', () => {
    const r = runTitleChecks([page({ 'Title 1': '' })], {});
    expect(r.some(x => x.check_id === 'title_present')).toBe(true);
  });
  it('flags title_unique for duplicate titles', () => {
    const pages = [page({ url: 'https://example.com/a' }), page({ url: 'https://example.com/b' })];
    const r = runTitleChecks(pages, {});
    expect(r.some(x => x.check_id === 'title_unique')).toBe(true);
  });
  it('flags title_length_chars when title < 30 chars', () => {
    const r = runTitleChecks([page({ 'Title 1': 'Short', 'Title 1 Length': '5' })], {});
    expect(r.some(x => x.check_id === 'title_length_chars')).toBe(true);
  });
  it('flags title_length_chars when title > 75 chars', () => {
    const longTitle = 'A'.repeat(80);
    const r = runTitleChecks([page({ 'Title 1': longTitle, 'Title 1 Length': '80' })], {});
    expect(r.some(x => x.check_id === 'title_length_chars')).toBe(true);
  });
  it('flags title_keyword_stuffing when word repeated 3+ times', () => {
    const r = runTitleChecks([page({ 'Title 1': 'insurance insurance insurance plans' })], {});
    expect(r.some(x => x.check_id === 'title_keyword_stuffing')).toBe(true);
  });
  it('flags title_h1_diff when title equals H1', () => {
    const r = runTitleChecks([page({ 'Title 1': 'Best Car Insurance Plans', 'H1-1': 'Best Car Insurance Plans' })], {});
    expect(r.some(x => x.check_id === 'title_h1_diff')).toBe(true);
  });
});
