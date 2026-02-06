export interface CacheClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    incr(key: string): Promise<number>;
    expire(key: string, ttlSeconds: number): Promise<void>;
}
export declare function getCacheClient(): Promise<CacheClient>;
export declare function hashCacheKey(value: string): string;
//# sourceMappingURL=cache.d.ts.map