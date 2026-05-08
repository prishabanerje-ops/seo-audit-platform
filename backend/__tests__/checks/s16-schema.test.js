// backend/__tests__/checks/s16-schema.test.js
import { describe, it, expect } from 'vitest';
import { runSchemaChecks } from '../../services/checks/s16-schema.js';

const page = (overrides) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _schemaItems: [{ Type: 'WebPage', Property: '@type', Content: 'WebPage' }],
  _schemaTypes: ['WebPage'],
  _schemaValid: true,
  _hasJsonLd: true,
  ...overrides,
});

describe('runSchemaChecks', () => {
  it('passes for page with valid schema', () => {
    expect(runSchemaChecks([page()], { schemaRules: [] })).toHaveLength(0);
  });
  it('flags schema_present when no schema on key page', () => {
    const r = runSchemaChecks([page({ _schemaItems: [], _schemaTypes: [], _hasJsonLd: false })], { schemaRules: [] });
    expect(r.some(x => x.check_id === 'schema_present')).toBe(true);
  });
  it('flags schema_rules when required type missing', () => {
    const ctx = { schemaRules: [{ pattern: '/page', required: ['Product'] }] };
    const r = runSchemaChecks([page({ _schemaTypes: ['WebPage'] })], ctx);
    expect(r.some(x => x.check_id === 'schema_rules')).toBe(true);
  });
  it('flags schema_organization when homepage lacks Organization schema', () => {
    const r = runSchemaChecks([page({ url: 'https://example.com/', _schemaTypes: ['WebPage'] })], { schemaRules: [] });
    expect(r.some(x => x.check_id === 'schema_organization')).toBe(true);
  });
});
