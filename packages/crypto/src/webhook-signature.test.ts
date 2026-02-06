/**
 * Tests for webhook HMAC SHA-256 signing and verification.
 */
import {
  computeWebhookSignature,
  verifyWebhookSignature,
  buildWebhookHeaders,
} from './webhook-signature';

describe('Webhook Signature', () => {
  const signingKey = 'test-secret-key-12345';
  const timestamp = '2026-02-06T12:00:00Z';
  const rawBody = '{"event":"Payment.Completed.v1","paymentId":"pay-1"}';

  describe('computeWebhookSignature', () => {
    it('produces a hex-encoded SHA-256 HMAC', () => {
      const sig = computeWebhookSignature(signingKey, timestamp, rawBody);
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic: same inputs produce same output', () => {
      const sig1 = computeWebhookSignature(signingKey, timestamp, rawBody);
      const sig2 = computeWebhookSignature(signingKey, timestamp, rawBody);
      expect(sig1).toBe(sig2);
    });

    it('different keys produce different signatures', () => {
      const sig1 = computeWebhookSignature('key-a', timestamp, rawBody);
      const sig2 = computeWebhookSignature('key-b', timestamp, rawBody);
      expect(sig1).not.toBe(sig2);
    });

    it('different timestamps produce different signatures', () => {
      const sig1 = computeWebhookSignature(signingKey, '2026-01-01T00:00:00Z', rawBody);
      const sig2 = computeWebhookSignature(signingKey, '2026-01-02T00:00:00Z', rawBody);
      expect(sig1).not.toBe(sig2);
    });

    it('different bodies produce different signatures', () => {
      const sig1 = computeWebhookSignature(signingKey, timestamp, '{"a":1}');
      const sig2 = computeWebhookSignature(signingKey, timestamp, '{"a":2}');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('verifies a correct signature', () => {
      const sig = computeWebhookSignature(signingKey, timestamp, rawBody);
      expect(verifyWebhookSignature(signingKey, timestamp, rawBody, sig)).toBe(true);
    });

    it('rejects an incorrect signature', () => {
      const wrongSig = '0'.repeat(64);
      expect(verifyWebhookSignature(signingKey, timestamp, rawBody, wrongSig)).toBe(false);
    });

    it('rejects a signature with wrong key', () => {
      const sig = computeWebhookSignature('wrong-key', timestamp, rawBody);
      expect(verifyWebhookSignature(signingKey, timestamp, rawBody, sig)).toBe(false);
    });

    it('rejects a tampered body', () => {
      const sig = computeWebhookSignature(signingKey, timestamp, rawBody);
      const tampered = rawBody + ' ';
      expect(verifyWebhookSignature(signingKey, timestamp, tampered, sig)).toBe(false);
    });
  });

  describe('buildWebhookHeaders', () => {
    it('returns all required headers', () => {
      const sig = computeWebhookSignature(signingKey, timestamp, rawBody);
      const headers = buildWebhookHeaders('evt-1', 'Payment.Completed.v1', timestamp, 'key-v1', sig);

      expect(headers['x-caricash-event-id']).toBe('evt-1');
      expect(headers['x-caricash-event-type']).toBe('Payment.Completed.v1');
      expect(headers['x-caricash-timestamp']).toBe(timestamp);
      expect(headers['x-caricash-key-id']).toBe('key-v1');
      expect(headers['x-caricash-signature']).toBe(sig);
    });
  });
});
