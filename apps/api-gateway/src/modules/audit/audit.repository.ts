import { Injectable } from '@nestjs/common';
import { query, queryOne } from '@caricash/db';
import { PoolClient } from 'pg';

export interface AuditEventRow {
  id: string;
  sequence_number: number;
  actor_type: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  payload: unknown;
  correlation_id: string | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  prev_hash: string | null;
  hash: string;
  created_at: string;
}

@Injectable()
export class AuditRepository {
  async getLastEvent(client?: PoolClient): Promise<AuditEventRow | null> {
    return queryOne<AuditEventRow>(
      'SELECT * FROM audit_events ORDER BY sequence_number DESC LIMIT 1',
      [],
      client,
    );
  }

  async insertEvent(
    event: {
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
      prevHash: string | null;
      hash: string;
    },
    client?: PoolClient,
  ): Promise<AuditEventRow> {
    return queryOne<AuditEventRow>(
      `INSERT INTO audit_events (actor_type, actor_id, action, resource_type, resource_id, payload, correlation_id, request_id, ip_address, user_agent, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet, $10, $11, $12)
       RETURNING *`,
      [
        event.actorType,
        event.actorId ?? null,
        event.action,
        event.resourceType,
        event.resourceId ?? null,
        JSON.stringify(event.payload),
        event.correlationId ?? null,
        event.requestId ?? null,
        event.ipAddress ?? null,
        event.userAgent ?? null,
        event.prevHash,
        event.hash,
      ],
      client,
    ) as Promise<AuditEventRow>;
  }
}
