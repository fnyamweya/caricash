import { Injectable } from '@nestjs/common';
import { IdempotencyRepository } from './idempotency.repository';
import { hashPayload } from '@caricash/crypto';
import { IdempotencyConflictError } from '@caricash/common';

@Injectable()
export class IdempotencyService {
  constructor(private readonly repo: IdempotencyRepository) {}

  async execute<T>(params: {
    key: string;
    resourceType: string;
    request: unknown;
    handler: () => Promise<{ response: T; resourceId?: string }>;
  }): Promise<T> {
    const requestHash = hashPayload(params.request);
    const existing = await this.repo.findByKey(params.key);
    if (existing) {
      if (existing.request_hash && existing.request_hash !== requestHash) {
        throw new IdempotencyConflictError(params.key);
      }
      return existing.response_body as T;
    }

    const result = await params.handler();
    const inserted = await this.repo.insert({
      key: params.key,
      resourceType: params.resourceType,
      resourceId: result.resourceId,
      statusCode: 200,
      responseBody: result.response,
      requestHash,
    });

    if (!inserted) {
      const retry = await this.repo.findByKey(params.key);
      if (retry) return retry.response_body as T;
    }

    return result.response;
  }
}
