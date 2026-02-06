import { createHash } from 'crypto';

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}

class InMemoryCache implements CacheClient {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async incr(key: string): Promise<number> {
    const current = Number((await this.get(key)) ?? '0');
    const next = current + 1;
    await this.set(key, String(next));
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }
}

let cachedClient: CacheClient | null = null;

export async function getCacheClient(): Promise<CacheClient> {
  if (cachedClient) return cachedClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    cachedClient = new InMemoryCache();
    return cachedClient;
  }
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(redisUrl);
  cachedClient = {
    get: (key) => redis.get(key),
    set: async (key, value, ttlSeconds) => {
      if (ttlSeconds) {
        await redis.set(key, value, 'EX', ttlSeconds);
      } else {
        await redis.set(key, value);
      }
    },
    incr: (key) => redis.incr(key),
    expire: (key, ttlSeconds) => redis.expire(key, ttlSeconds).then(() => undefined),
  };
  return cachedClient;
}

export function hashCacheKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
