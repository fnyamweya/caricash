/**
 * Standard message envelope for all domain events.
 * This is the canonical wire format for events on RabbitMQ.
 */
export interface EventEnvelope<T = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: string;         // ISO 8601
  correlationId: string;
  causationId?: string;
  schemaVersion: number;
  payload: T;
}

export function createEnvelope<T>(
  eventId: string,
  eventType: string,
  correlationId: string,
  payload: T,
  options?: { causationId?: string; schemaVersion?: number },
): EventEnvelope<T> {
  return {
    eventId,
    eventType,
    occurredAt: new Date().toISOString(),
    correlationId,
    causationId: options?.causationId,
    schemaVersion: options?.schemaVersion ?? 1,
    payload,
  };
}
