import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const DEFAULT_KEY_ID = 'dev-key-v1';

function getKey(): { key: Buffer; keyId: string } {
  const keyBase64 = process.env.PII_ENCRYPTION_KEY;
  if (keyBase64) {
    return { key: Buffer.from(keyBase64, 'base64'), keyId: process.env.PII_ENCRYPTION_KEY_ID ?? 'env-key' };
  }
  const key = createHash('sha256').update('caricash-dev-key').digest();
  return { key, keyId: DEFAULT_KEY_ID };
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
  keyId: string;
}

export function encryptPayload(value: unknown): EncryptedPayload {
  const { key, keyId } = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(value ?? null);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyId,
  };
}

export function decryptPayload(payload: EncryptedPayload): unknown {
  const { key } = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

export function hashPayload(value: unknown): string {
  const canonical = JSON.stringify(value ?? null);
  return createHash('sha256').update(canonical).digest('hex');
}
