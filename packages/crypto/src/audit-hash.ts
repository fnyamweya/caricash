import { createHash } from 'crypto';

/**
 * Compute a tamper-evident hash for an audit event.
 * Uses SHA-256 over canonical JSON of the event fields + previous hash.
 *
 * Chain: hash(n) = SHA256(prev_hash + canonical_json(event_fields))
 */
export function computeAuditHash(
  prevHash: string | null,
  fields: {
    actorType: string;
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    payload: unknown;
    correlationId?: string;
    requestId?: string;
    createdAt: string;
  },
): string {
  const canonical = JSON.stringify({
    prev_hash: prevHash ?? '',
    actor_type: fields.actorType,
    actor_id: fields.actorId ?? '',
    action: fields.action,
    resource_type: fields.resourceType,
    resource_id: fields.resourceId ?? '',
    payload: fields.payload,
    correlation_id: fields.correlationId ?? '',
    request_id: fields.requestId ?? '',
    created_at: fields.createdAt,
  });

  return createHash('sha256').update(canonical).digest('hex');
}
