import { Injectable } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { computeAuditHash } from '@caricash/crypto';

@Injectable()
export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  async listEvents(params: {
    cursor?: string;
    limit?: number;
    action?: string;
    resourceType?: string;
  }) {
    const limit = Math.min(params.limit ?? 50, 100);
    return this.repo.listEvents(params.cursor, limit, params.action, params.resourceType);
  }

  /**
   * Verify the audit hash chain integrity.
   * Reads all events in sequence order and validates each hash.
   */
  async verifyChain(): Promise<{ valid: boolean; totalEvents: number; brokenAt?: number }> {
    const events = await this.repo.getAllEventsForVerification();
    let prevHash: string | null = null;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const expectedHash = computeAuditHash(prevHash, {
        actorType: event.actor_type,
        actorId: event.actor_id,
        action: event.action,
        resourceType: event.resource_type,
        resourceId: event.resource_id,
        payload: event.payload,
        correlationId: event.correlation_id,
        requestId: event.request_id,
        createdAt: event.created_at,
      });

      if (event.hash !== expectedHash) {
        return { valid: false, totalEvents: events.length, brokenAt: event.sequence_number };
      }

      if (event.prev_hash !== prevHash && !(event.prev_hash === null && prevHash === null)) {
        return { valid: false, totalEvents: events.length, brokenAt: event.sequence_number };
      }

      prevHash = event.hash;
    }

    return { valid: true, totalEvents: events.length };
  }
}
