import { createEnvelope } from './envelope';

describe('EventEnvelope', () => {
  it('should create a valid envelope', () => {
    const envelope = createEnvelope('evt-1', 'Ledger.Posted.v1', 'corr-1', { amount: 100 });
    expect(envelope.eventId).toBe('evt-1');
    expect(envelope.eventType).toBe('Ledger.Posted.v1');
    expect(envelope.correlationId).toBe('corr-1');
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.payload).toEqual({ amount: 100 });
    expect(envelope.occurredAt).toBeTruthy();
  });

  it('should accept optional causationId and schemaVersion', () => {
    const envelope = createEnvelope('evt-1', 'Test.v2', 'corr-1', {}, {
      causationId: 'cause-1',
      schemaVersion: 2,
    });
    expect(envelope.causationId).toBe('cause-1');
    expect(envelope.schemaVersion).toBe(2);
  });
});
