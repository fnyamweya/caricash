import { Injectable } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { computeAuditHash } from '@caricash/crypto';
import { withTransaction, TransactionClient } from '@caricash/db';
import { redactPII } from '@caricash/observability';

export interface RecordAuditParams {
  actorType: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  payload: unknown;
  correlationId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  /**
   * Record an immutable audit event with hash chain linkage.
   * Uses a serializable transaction with advisory lock to ensure chain integrity.
   */
  async record(params: RecordAuditParams) {
    return withTransaction((client) => this.recordWithClient(params, client), { isolationLevel: 'SERIALIZABLE' });
  }

  async recordWithClient(params: RecordAuditParams, client: TransactionClient) {
    // Advisory lock to serialize audit chain writes
    await client.query('SELECT pg_advisory_xact_lock(1)');

    // Get previous event for hash chain
    const lastEvent = await this.repo.getLastEvent(client);
    const prevHash = lastEvent?.hash ?? null;

    const createdAt = new Date().toISOString();
    const redactedPayload = redactPII(params.payload);

    // Compute tamper-evident hash
    const hash = computeAuditHash(prevHash, {
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      payload: redactedPayload,
      correlationId: params.correlationId,
      requestId: params.requestId,
      createdAt,
    });

    // Insert audit event
    const event = await this.repo.insertEvent(
      { ...params, payload: redactedPayload, prevHash, hash },
      client,
    );

    return event;
  }
}
