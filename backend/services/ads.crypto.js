import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Derive a 32-byte key from ADS_TOKEN_ENCRYPTION_KEY (preferred)
 * or fall back to the first 32 bytes of JWT_SECRET.
 */
function getKey() {
  const raw = process.env.ADS_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  const hex = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 64);
  if (hex.length < 64) throw new Error('ADS_TOKEN_ENCRYPTION_KEY or JWT_SECRET must be at least 64 hex chars');
  return Buffer.from(hex, 'hex'); // 32 bytes
}

/**
 * Encrypt a plaintext string. Returns base64: iv:authTag:ciphertext
 */
export function encryptToken(plaintext) {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map(b => b.toString('base64')).join(':');
}

/**
 * Decrypt a token encrypted by encryptToken.
 */
export function decryptToken(combined) {
  const [ivB64, tagB64, dataB64] = combined.split(':');
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
