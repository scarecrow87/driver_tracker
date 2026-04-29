// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const b64 = Buffer.from(trimmed, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    // Ignore and fall through to utf8 handling.
  }

  const utf8 = Buffer.from(trimmed, 'utf8');
  if (utf8.length === 32) return utf8;

  return null;
}

export function encryptSetting(value: string): string {
  const key = getKey();
  if (!key) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be set to a 32-byte value (base64 or raw).');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSetting(payload: string): string {
  const key = getKey();
  if (!key) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be set to a 32-byte value (base64 or raw).');
  }

  const [ivRaw, tagRaw, encryptedRaw] = payload.split(':');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted setting payload.');
  }

  const iv = Buffer.from(ivRaw, 'base64');
  const tag = Buffer.from(tagRaw, 'base64');
  const encrypted = Buffer.from(encryptedRaw, 'base64');

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}
