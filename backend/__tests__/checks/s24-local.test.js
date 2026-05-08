// backend/__tests__/checks/s24-local.test.js
import { describe, it, expect } from 'vitest';
import { runLocalChecks } from '../../services/checks/s24-local.js';

const page = (overrides) => ({
  url: 'https://example.com/location/dubai',
  'Indexability': 'Indexable',
  'Word Count': '400',
  'Status Code': '200',
  _schemaTypes: ['LocalBusiness'],
  _schemaItems: [{
    Type: 'LocalBusiness',
    properties: [
      { name: 'name', value: 'Example Insurance Dubai' },
      { name: 'address', value: '123 Main St, Dubai' },
      { name: 'telephone', value: '+971 4 123 4567' },
      { name: 'openingHours', value: 'Mo-Fr 09:00-18:00' },
      { name: 'geo', value: { latitude: 25.2, longitude: 55.3 } },
    ],
  }],
  ...overrides,
});

describe('runLocalChecks', () => {
  it('passes for complete LocalBusiness schema', () => {
    expect(runLocalChecks([page()], {})).toHaveLength(0);
  });
  it('flags local_business_schema when LocalBusiness schema missing', () => {
    const r = runLocalChecks([page({ _schemaTypes: [], _schemaItems: [] })], {});
    expect(r.some(x => x.check_id === 'local_business_schema')).toBe(true);
  });
  it('flags local_location_crawlable for non-200 location page', () => {
    const r = runLocalChecks([page({ 'Status Code': '404', 'Indexability': 'Non-Indexable' })], {});
    expect(r.some(x => x.check_id === 'local_location_crawlable')).toBe(true);
  });
  it('flags local_schema_geo when geo coordinates missing', () => {
    const itemWithoutGeo = {
      Type: 'LocalBusiness',
      properties: [
        { name: 'name', value: 'Example' }, { name: 'address', value: 'Dubai' },
        { name: 'telephone', value: '+971 1234567' }, { name: 'openingHours', value: 'Mo-Fr' },
      ],
    };
    const r = runLocalChecks([page({ _schemaItems: [itemWithoutGeo] })], {});
    expect(r.some(x => x.check_id === 'local_schema_geo')).toBe(true);
  });
});
