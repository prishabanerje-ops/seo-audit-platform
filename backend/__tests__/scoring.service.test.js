// backend/__tests__/scoring.service.test.js
import { describe, it, expect } from 'vitest';
import {
  computePageScore,
  computeSectionScore,
  computeAllSectionScores,
} from '../services/scoring.service.js';

const pass = (check_id, severity, section) => ({
  check_id, passed: true, severity, section, message: 'ok', details: null,
});
const fail = (check_id, severity, section) => ({
  check_id, passed: false, severity, section, message: 'fail', details: 'x',
});

describe('computePageScore', () => {
  it('returns 100 when all checks pass', () => {
    expect(computePageScore([
      pass('http_status', 'critical', 'S1'),
      pass('title_present', 'warning', 'S11'),
    ])).toBe(100);
  });

  it('deducts 25 per critical failure', () => {
    expect(computePageScore([fail('http_status', 'critical', 'S1')])).toBe(75);
  });

  it('deducts 10 per warning failure', () => {
    expect(computePageScore([fail('title_unique', 'warning', 'S11')])).toBe(90);
  });

  it('deducts 1 per info failure', () => {
    expect(computePageScore([fail('url_length', 'info', 'S6')])).toBe(99);
  });

  it('floors at 0 with many critical failures', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      fail(`check_${i}`, 'critical', 'S1')
    );
    expect(computePageScore(results)).toBe(0);
  });

  it('stacks deductions across severities — 25+10+1=36, score=64', () => {
    expect(computePageScore([
      fail('a', 'critical', 'S1'),
      fail('b', 'warning',  'S1'),
      fail('c', 'info',     'S1'),
    ])).toBe(64);
  });

  it('ignores unknown severity (no deduction)', () => {
    const results = [{ check_id: 'x', passed: false, severity: 'unknown', section: 'S1', message: '', details: null }];
    expect(computePageScore(results)).toBe(100);
  });

  it('returns 100 for empty array', () => {
    expect(computePageScore([])).toBe(100);
  });
});

describe('computeSectionScore', () => {
  it('scores only checks belonging to the requested section', () => {
    // S1 fails critical (-25), S2 fails critical (ignored)
    expect(computeSectionScore([
      fail('a', 'critical', 'S1'),
      fail('b', 'critical', 'S2'),
      pass('c', 'warning',  'S1'),
    ], 'S1')).toBe(75);
  });

  it('returns 100 for section with no matching results', () => {
    expect(computeSectionScore([], 'S1')).toBe(100);
  });
});

describe('computeAllSectionScores', () => {
  it('returns a score per unique section', () => {
    const results = [
      fail('a', 'critical', 'Response Codes'),
      pass('b', 'warning',  'Response Codes'),
      fail('c', 'warning',  'Title Tags'),
    ];
    const scores = computeAllSectionScores(results);
    expect(scores['Response Codes']).toBe(75);
    expect(scores['Title Tags']).toBe(90);
  });

  it('returns empty object for empty input', () => {
    expect(computeAllSectionScores([])).toEqual({});
  });
});
