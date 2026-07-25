import { prisma } from "@/lib/prisma";
import { incrementRedisCounter } from "@/lib/cache/cache";
import { getConfig } from "@/lib/admin/config";

// Milestone 12 — generalizes the OTP route's existing per-phone/per-IP
// rate-limit pattern (src/app/api/auth/otp/send, count rows in a window) to
// every other costly/abusable action, keyed by an admin-named "action"
// (RATE_LIMITS config) rather than being hardcoded per route.
//
// Redis (when REDIS_URL is configured) gets an atomic INCR+EXPIRE — correct
// under concurrent multi-instance requests with one round trip. Without
// Redis, falls back to the exact "insert a hit row, then count the window"
// approach OtpRequest already used — always correct under multi-instance
// (it's a real DB count, not an in-process counter), just one extra query.
// Never silently skips the check either way.

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(action: string, identifier: string): Promise<RateLimitResult> {
  const rateLimits = await getConfig("RATE_LIMITS");
  const policy = rateLimits[action];
  // No policy configured for this action — fail open (the action is simply
  // not rate-limited), matching admin-configurability: a key only limits
  // once an admin (or the default registry) defines it.
  if (!policy) {
    return { allowed: true, limit: Infinity, remaining: Infinity, retryAfterSeconds: 0 };
  }

  const { limit, windowSeconds } = policy;
  const key = `ratelimit:${action}:${identifier}`;

  const redisCount = await incrementRedisCounter(key, windowSeconds);
  if (redisCount !== null) {
    return {
      allowed: redisCount <= limit,
      limit,
      remaining: Math.max(0, limit - redisCount),
      retryAfterSeconds: redisCount <= limit ? 0 : windowSeconds,
    };
  }

  const windowStart = new Date(Date.now() - windowSeconds * 1000);
  await prisma.rateLimitHit.create({ data: { key } });
  // Opportunistic cleanup, same bounded-by-key approach OtpRequest's
  // deleteMany already used — keeps the table from growing unbounded
  // without a separate maintenance job.
  await prisma.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: windowStart } } });

  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } });
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: count <= limit ? 0 : windowSeconds,
  };
}
