import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../services/ads.crypto.js';

process.env.JWT_SECRET = 'a'.repeat(64); // 64 hex chars = 32 bytes

describe('ads.crypto', () => {
  it('round-trips a plaintext string', () => {
    const plain = 'ya29.some-google-access-token';
    const cipher = encryptToken(plain);
    expect(cipher).not.toBe(plain);
    expect(decryptToken(cipher)).toBe(plain);
  });

  it('produces different ciphertexts for identical plaintexts (random IV)', () => {
    const plain = 'same-token';
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plain);
    expect(decryptToken(b)).toBe(plain);
  });

  it('throws on tampered ciphertext', () => {
    const cipher = encryptToken('secret');
    const tampered = cipher.slice(0, -4) + 'xxxx';
    expect(() => decryptToken(tampered)).toThrow();
  });
});
