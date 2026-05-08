// backend/__tests__/checks/infra.test.js
import { describe, it, expect } from 'vitest';
import { classifyYmyl } from '../../services/audit-parser.service.js';

describe('classifyYmyl', () => {
  it('returns null for non-YMYL pages', () => {
    expect(classifyYmyl('/blog/seo-tips', 'search engine optimization tips')).toBeNull();
  });
  it('returns "finance" for insurance URL pattern', () => {
    expect(classifyYmyl('/insurance/car', 'any content')).toBe('finance');
  });
  it('returns "health" for /health URL', () => {
    expect(classifyYmyl('/health/mediclaim', 'any content')).toBe('health');
  });
  it('returns "legal" for /legal URL', () => {
    expect(classifyYmyl('/legal/terms', 'any content')).toBe('legal');
  });
  it('returns "finance" when body has 3+ YMYL words', () => {
    expect(classifyYmyl('/blog/page', 'This policy covers premium and claim benefits.')).toBe('finance');
  });
  it('respects custom URL patterns', () => {
    expect(classifyYmyl('/plans/motor', 'any content', ['/plans/'])).toBe('finance');
  });
});
