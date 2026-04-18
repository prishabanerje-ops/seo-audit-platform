import { describe, it, expect } from '@jest/globals';
import { load } from 'cheerio';
import { extractMonitoring } from '../../src/extractors/monitoring.js';

const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options':    'nosniff',
  'x-frame-options':           'DENY',
  'content-security-policy':   "default-src 'self'",
};

describe('extractMonitoring()', () => {
  it('detects HTTPS and security headers', () => {
    const $ = load('<html><head></head></html>');
    const { _monitoring: r } = extractMonitoring(SECURITY_HEADERS, 120, $, 'https://example.com/');
    expect(r.isHttps).toBe(true);
    expect(r.hasHsts).toBe(true);
    expect(r.hasXContentTypeOptions).toBe(true);
    expect(r.hasXFrameOptions).toBe(true);
    expect(r.hasContentSecurityPolicy).toBe(true);
  });

  it('flags HTTP page', () => {
    const $ = load('<html><head></head></html>');
    const { _monitoring: r } = extractMonitoring({}, 200, $, 'http://example.com/');
    expect(r.isHttps).toBe(false);
    expect(r.hasHsts).toBe(false);
  });

  it('detects GA4 analytics script', () => {
    const $ = load(`<html><head>
      <script>gtag('config', 'G-ABCD1234XY');</script>
    </head></html>`);
    const { _monitoring: r } = extractMonitoring({}, 100, $, 'https://example.com/');
    expect(r.analyticsDetected).toBe(true);
    expect(r.analyticsType).toBe('ga4');
    expect(r.ga4DoubleFiring).toBe(false);
  });

  it('detects GA4 double-firing when two G- IDs present', () => {
    const $ = load(`<html><head>
      <script>gtag('config', 'G-AAAA111111'); gtag('config', 'G-BBBB222222');</script>
    </head></html>`);
    const { _monitoring: r } = extractMonitoring({}, 100, $, 'https://example.com/');
    expect(r.ga4DoubleFiring).toBe(true);
  });

  it('detects GTM when no GA4 present', () => {
    const $ = load(`<html><head>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX1234"></script>
    </head></html>`);
    const { _monitoring: r } = extractMonitoring({}, 50, $, 'https://example.com/');
    expect(r.analyticsDetected).toBe(true);
    expect(r.analyticsType).toBe('gtm');
  });

  it('returns analyticsDetected=false when no analytics found', () => {
    const $ = load('<html><head></head></html>');
    const { _monitoring: r } = extractMonitoring({}, 80, $, 'https://example.com/');
    expect(r.analyticsDetected).toBe(false);
    expect(r.analyticsType).toBe('none');
  });

  it('stores serverResponseTime', () => {
    const $ = load('<html></html>');
    const { _monitoring: r } = extractMonitoring({}, 450, $, 'https://example.com/');
    expect(r.serverResponseTime).toBe(450);
  });
});
