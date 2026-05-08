import { describe, it, expect } from 'vitest';
import { classifyRow } from '../src/classifier.js';

const sig = (overrides) => ({
  signal_id: 'X',
  name: '',
  signal_type: 'issue-emitter',
  priority: 1,
  file: 'f.js',
  line: 1,
  metadata: {},
  ...overrides,
});

describe('classifyRow', () => {
  it('G-IMPL-1: P1 score >= 0.6 → implemented', () => {
    const row = { check_id: 'C1', name: 'Title Too Long over 60 chars', automation_type: 'automated' };
    const signals = [sig({ name: 'Title Too Long (over 60 chars)', priority: 1 })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('implemented');
    expect(result.gap_notes).toContain('G-IMPL-1');
    expect(result.impl_evidence).toContain('Title Too Long');
  });

  it('G-IMPL-2: P2 score >= 0.5 (no qualifying P1) → implemented', () => {
    const row = { check_id: 'C2', name: 'Largest Contentful Paint Score', automation_type: 'automated' };
    const signals = [sig({ name: 'getLcpScore', priority: 2, signal_type: 'service-function', file: 'backend/routes/psi.js' })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('implemented');
    expect(result.gap_notes).toContain('G-IMPL-2');
  });

  it('G-PARTIAL-1: P3 score >= 0.4 (no qualifying P1/P2) → partial', () => {
    const row = { check_id: 'C3', name: 'Heading h1 count', automation_type: 'automated' };
    const signals = [sig({ name: 'h1Count', priority: 3, signal_type: 'extractor-field' })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('partial');
    expect(result.gap_notes).toContain('G-PARTIAL-1');
  });

  it('G-MAN: manual + no signal score >= 0.3 → n-a', () => {
    const row = { check_id: 'C4', name: 'Brand Voice Consistency', automation_type: 'manual' };
    const signals = [sig({ name: 'unrelatedThing', priority: 1 })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('n-a');
    expect(result.gap_notes).toContain('G-MAN');
  });

  it('G-MISS: no signal score >= 0.3 → missing', () => {
    const row = { check_id: 'C5', name: 'Some Truly Unique Check', automation_type: 'automated' };
    const signals = [sig({ name: 'totallyUnrelated', priority: 1 })];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('missing');
    expect(result.gap_notes).toContain('G-MISS');
  });

  it('G-FLAG: top two priority scores within 0.1 AND both >= 0.4 → flag', () => {
    const row = { check_id: 'C6', name: 'Meta Tags Validation', automation_type: 'automated' };
    const signals = [
      sig({ name: 'Meta Tags Check', priority: 1 }),       // P1 score = 0.5
      sig({ name: 'Meta Tags Analyzer', priority: 3 }),    // P3 score = 0.5
    ];
    const result = classifyRow(row, signals);
    expect(result.impl_status).toBe('flag');
    expect(result.gap_notes).toContain('G-FLAG');
  });
});
