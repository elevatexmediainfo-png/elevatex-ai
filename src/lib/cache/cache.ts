import Redis from "ioredis";

// Milestone 12 — a shared cache primitive used by both lib/admin/config.ts's
// settings cache and lib/security/rate-limit.ts's counters. Backed by Redis
// when REDIS_URL is configured (correct under multiple app instances, since
// they share the same store — invalidation is just a DEL, no pub/sub needed,
// unlike the in-process-only cache this replaces used to speculate it would);
// falls back to an in-process Map otherwise, which is the exact behavior
// every single-instance deployment of this app already had before this file
// existed. Never throws on a Redis hiccup — a cache/counter is an
// optimization, not a source of truth, so a failure here degrades to
// "recompute" rather than breaking the request.

let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return redisClient;
  }

  const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false });
  client.on("error", (err) => {
    console.error("[cache] Redis connection error — falling back to in-process cache for this call", err.message);
  });
  redisClient = client;
  return redisClient;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const inProcessCache = new Map<string, CacheEntry>();

export async function getOrSetCache<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // fall through to compute below
    }
    const value = await compute();
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // best-effort — the caller still gets a correct value this call
    }
    return value;
  }

  const cached = inProcessCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }
  const value = await compute();
  inProcessCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return value;
}

export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // best-effort
    }
  }
  inProcessCache.delete(key);
}

// Atomic counter for rate limiting — Redis INCR+EXPIRE is correct under
// concurrent multi-instance requests; returns null when Redis isn't
// configured so the caller (lib/security/rate-limit.ts) knows to fall back
// to its DB-backed counting path instead of silently under-counting.
export async function incrementRedisCounter(key: string, windowSeconds: number): Promise<number | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count;
  } catch {
    return null;
  }
}

export function isRedisConfigured(): boolean {
  return getRedisClient() !== null;
}

export async function pingRedis(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
