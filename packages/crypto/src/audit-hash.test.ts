import { computeAuditHash } from './audit-hash';

describe('computeAuditHash', () => {
  const baseFields = {
    actorType: 'SYSTEM',
    actorId: undefined,
    action: 'ledger.post',
    resourceType: 'journal_entry',
    resourceId: 'entry-1',
    payload: { amount: 100 },
    correlationId: 'corr-1',
    requestId: 'req-1',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('should produce a 64-char hex hash', () => {
    const hash = computeAuditHash(null, baseFields);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should be deterministic', () => {
    const hash1 = computeAuditHash(null, baseFields);
    const hash2 = computeAuditHash(null, baseFields);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = computeAuditHash(null, baseFields);
    const hash2 = computeAuditHash(null, { ...baseFields, action: 'ledger.reverse' });
    expect(hash1).not.toBe(hash2);
  });

  it('should chain correctly: hash depends on prevHash', () => {
    const hash1 = computeAuditHash(null, baseFields);
    const hash2 = computeAuditHash(hash1, baseFields);
    const hash3 = computeAuditHash('different-prev-hash', baseFields);
    expect(hash2).not.toBe(hash1);
    expect(hash2).not.toBe(hash3);
  });

  it('should form a verifiable chain', () => {
    // Simulate 3 audit events in a chain
    const events = [
      { ...baseFields, action: 'event-1' },
      { ...baseFields, action: 'event-2' },
      { ...baseFields, action: 'event-3' },
    ];

    let prevHash: string | null = null;
    const hashes: string[] = [];

    for (const event of events) {
      const hash = computeAuditHash(prevHash, event);
      hashes.push(hash);
      prevHash = hash;
    }

    // Verify the chain by recomputing
    let verifyPrevHash: string | null = null;
    for (let i = 0; i < events.length; i++) {
      const expectedHash = computeAuditHash(verifyPrevHash, events[i]);
      expect(expectedHash).toBe(hashes[i]);
      verifyPrevHash = expectedHash;
    }
  });

  it('should detect tampering', () => {
    const hash1 = computeAuditHash(null, baseFields);
    const hash2 = computeAuditHash(hash1, { ...baseFields, action: 'event-2' });

    // Tamper with event 1 payload
    const tamperedHash1 = computeAuditHash(null, { ...baseFields, payload: { amount: 999 } });
    expect(tamperedHash1).not.toBe(hash1);

    // Chain after tampering would be different
    const tamperedHash2 = computeAuditHash(tamperedHash1, { ...baseFields, action: 'event-2' });
    expect(tamperedHash2).not.toBe(hash2);
  });
});
