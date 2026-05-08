// backend/__tests__/checks/s09-security.test.js
import { describe, it, expect } from 'vitest';
import { runSecurityChecks } from '../../services/checks/s09-security.js';

const page = (overrides = {}) => ({
  url: 'https://example.com/page',
  'Indexability': 'Indexable',
  _isHttps: true,
  _hsts: 'max-age=31536000; includeSubDomains',
  _csp: "default-src 'self'",
  _xFrameOptions: 'DENY',
  _xContentTypeOptions: 'nosniff',
  _referrerPolicy: 'strict-origin-when-cross-origin',
  _permissionsPolicy: 'camera=(), microphone=()',
  _monitoring: { sslValid: true, sslExpiryDays: 90, sslChainComplete: true, mixedContentUrls: [] },
  ...overrides,
});

describe('runSecurityChecks', () => {
  it('passes on fully secure page', () => {
    expect(runSecurityChecks([page()], {})).toHaveLength(0);
  });
  it('flags https_enabled for HTTP page', () => {
    const r = runSecurityChecks([page({ url: 'http://example.com/page', _isHttps: false })], {});
    expect(r.some(x => x.check_id === 'https_enabled')).toBe(true);
  });
  it('flags hsts_header when missing', () => {
    const r = runSecurityChecks([page({ _hsts: '' })], {});
    expect(r.some(x => x.check_id === 'hsts_header')).toBe(true);
  });
  it('flags hsts_header when max-age < 31536000', () => {
    const r = runSecurityChecks([page({ _hsts: 'max-age=3600' })], {});
    expect(r.some(x => x.check_id === 'hsts_header')).toBe(true);
  });
  it('flags csp_header when missing', () => {
    const r = runSecurityChecks([page({ _csp: '' })], {});
    expect(r.some(x => x.check_id === 'csp_header')).toBe(true);
  });
  it('flags x_frame_options when set to ALLOWALL', () => {
    const r = runSecurityChecks([page({ _xFrameOptions: 'ALLOWALL' })], {});
    expect(r.some(x => x.check_id === 'x_frame_options')).toBe(true);
  });
  it('flags ssl_valid when cert invalid', () => {
    const r = runSecurityChecks([page({ _monitoring: { sslValid: false, sslExpiryDays: -1, sslChainComplete: true, mixedContentUrls: [] } })], {});
    expect(r.some(x => x.check_id === 'ssl_valid')).toBe(true);
  });
  it('flags mixed_content when http resources on https page', () => {
    const r = runSecurityChecks([page({ _monitoring: { sslValid: true, sslExpiryDays: 90, sslChainComplete: true, mixedContentUrls: ['http://cdn.example.com/image.png'] } })], {});
    expect(r.some(x => x.check_id === 'mixed_content')).toBe(true);
  });
});
