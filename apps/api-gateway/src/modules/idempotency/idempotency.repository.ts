import { Injectable } from '@nestjs/common';
import { queryOne } from '@caricash/db';

export interface IdempotencyRecord {
  key: string;
  resource_type: string;
  resource_id: string | null;
  status_code: number;
  response_body: unknown;
  request_hash: string | null;
}

@Injectable()
export class IdempotencyRepository {
  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    return queryOne<IdempotencyRecord>(
      'SELECT key, resource_type, resource_id, status_code, response_body, request_hash FROM idempotency_keys WHERE key = $1',
      [key],
    );
  }

  async insert(record: {
    key: string;
    resourceType: string;
    resourceId?: string | null;
    statusCode: number;
    responseBody: unknown;
    requestHash: string;
  }): Promise<IdempotencyRecord | null> {
    return queryOne<IdempotencyRecord>(
      `INSERT INTO idempotency_keys (key, resource_type, resource_id, status_code, response_body, request_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO NOTHING
       RETURNING key, resource_type, resource_id, status_code, response_body, request_hash`,
      [
        record.key,
        record.resourceType,
        record.resourceId ?? null,
        record.statusCode,
        JSON.stringify(record.responseBody),
        record.requestHash,
      ],
    );
  }
}
