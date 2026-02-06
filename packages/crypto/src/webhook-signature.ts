/**
 * Webhook HMAC SHA-256 signing and verification.
 *
 * Payload format: timestamp.raw_body
 * Headers: event id, type, timestamp, key id, signature
 */
import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookSignatureHeaders {
  'x-caricash-event-id': string;
  'x-caricash-event-type': string;
  'x-caricash-timestamp': string;
  'x-caricash-key-id': string;
  'x-caricash-signature': string;
}

/**
 * Compute HMAC SHA-256 signature for a webhook payload.
 * Format: HMAC-SHA256(key, "timestamp.rawBody")
 */
export function computeWebhookSignature(
  signingKey: string,
  timestamp: string,
  rawBody: string,
): string {
  const payload = `${timestamp}.${rawBody}`;
  return createHmac('sha256', signingKey).update(payload).digest('hex');
}

/**
 * Verify a webhook signature using timing-safe comparison.
 */
export function verifyWebhookSignature(
  signingKey: string,
  timestamp: string,
  rawBody: string,
  receivedSignature: string,
): boolean {
  const expected = computeWebhookSignature(signingKey, timestamp, rawBody);

  // Timing-safe comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(receivedSignature, 'hex');

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Build the standard webhook delivery headers.
 */
export function buildWebhookHeaders(
  eventId: string,
  eventType: string,
  timestamp: string,
  keyId: string,
  signature: string,
): WebhookSignatureHeaders {
  return {
    'x-caricash-event-id': eventId,
    'x-caricash-event-type': eventType,
    'x-caricash-timestamp': timestamp,
    'x-caricash-key-id': keyId,
    'x-caricash-signature': signature,
  };
}
