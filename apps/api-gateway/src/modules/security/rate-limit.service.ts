import { Injectable } from '@nestjs/common';
import { getCacheClient, hashCacheKey } from '@caricash/common';

@Injectable()
export class RateLimitService {
  async checkLimit(params: { key: string; limit: number; windowSeconds: number }): Promise<{ allowed: boolean; remaining: number }> {
    const client = await getCacheClient();
    const hashedKey = hashCacheKey(params.key);
    const counter = await client.incr(hashedKey);
    if (counter === 1) {
      await client.expire(hashedKey, params.windowSeconds);
    }
    const remaining = Math.max(params.limit - counter, 0);
    return { allowed: counter <= params.limit, remaining };
  }
}
