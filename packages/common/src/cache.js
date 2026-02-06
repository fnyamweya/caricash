"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheClient = getCacheClient;
exports.hashCacheKey = hashCacheKey;
const crypto_1 = require("crypto");
class InMemoryCache {
    store = new Map();
    async get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }
    async set(key, value, ttlSeconds) {
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
        this.store.set(key, { value, expiresAt });
    }
    async incr(key) {
        const current = Number((await this.get(key)) ?? '0');
        const next = current + 1;
        await this.set(key, String(next));
        return next;
    }
    async expire(key, ttlSeconds) {
        const entry = this.store.get(key);
        if (entry) {
            entry.expiresAt = Date.now() + ttlSeconds * 1000;
        }
    }
}
let cachedClient = null;
async function getCacheClient() {
    if (cachedClient)
        return cachedClient;
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        cachedClient = new InMemoryCache();
        return cachedClient;
    }
    const { default: Redis } = await Promise.resolve().then(() => __importStar(require('ioredis')));
    const redis = new Redis(redisUrl);
    cachedClient = {
        get: (key) => redis.get(key),
        set: async (key, value, ttlSeconds) => {
            if (ttlSeconds) {
                await redis.set(key, value, 'EX', ttlSeconds);
            }
            else {
                await redis.set(key, value);
            }
        },
        incr: (key) => redis.incr(key),
        expire: (key, ttlSeconds) => redis.expire(key, ttlSeconds).then(() => undefined),
    };
    return cachedClient;
}
function hashCacheKey(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
}
//# sourceMappingURL=cache.js.map