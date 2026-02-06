import { Injectable } from '@nestjs/common';
import { queryMany } from '@caricash/db';

@Injectable()
export class AuditRepository {
  async listEvents(cursor: string | undefined, limit: number, action?: string, resourceType?: string): Promise<{ data: Record<string, unknown>[]; nextCursor: string | undefined; hasMore: boolean }> {
    const conditions = ['1=1'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (cursor) {
      conditions.push(`sequence_number < $${paramIndex++}`);
      values.push(cursor);
    }
    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(action);
    }
    if (resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      values.push(resourceType);
    }

    values.push(limit + 1);

    const rows = await queryMany(
      `SELECT * FROM audit_events WHERE ${conditions.join(' AND ')} ORDER BY sequence_number DESC LIMIT $${paramIndex}`,
      values,
    );

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const nextCursor = hasMore && data.length > 0 ? String(data[data.length - 1].sequence_number) : undefined;

    return { data, nextCursor, hasMore };
  }

  async getAllEventsForVerification() {
    return queryMany<{
      sequence_number: number;
      actor_type: string;
      actor_id: string;
      action: string;
      resource_type: string;
      resource_id: string;
      payload: unknown;
      correlation_id: string;
      request_id: string;
      created_at: string;
      prev_hash: string | null;
      hash: string;
    }>(
      'SELECT * FROM audit_events ORDER BY sequence_number ASC',
    );
  }
}
