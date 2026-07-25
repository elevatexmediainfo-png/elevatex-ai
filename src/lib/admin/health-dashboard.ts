import { prisma } from "@/lib/prisma";
import { getHealthSnapshot } from "@/lib/generation/health";
import { getQueueSnapshot } from "@/lib/render/analytics";
import { getConfig } from "@/lib/admin/config";
import { resolveProviderCredentials } from "@/lib/providers/credentials";
import { testProviderConnection } from "@/lib/providers/test-connection";
import { pingRedis, isRedisConfigured } from "@/lib/cache/cache";

// Milestone 12 — "Health Dashboard" as a pure aggregation of signals that
// already exist (provider circuit breakers, queue depth, the per-vendor
// Test Connection check) plus two cheap new pings (DB, Redis) — no new
// monitoring mechanism, one page that answers "is the system healthy."

export interface HealthCheckResult {
  name: string;
  ok: boolean;
  message: string;
}

export interface HealthDashboard {
  database: HealthCheckResult;
  redis: HealthCheckResult;
  storage: HealthCheckResult;
  queue: { pending: number; processing: number; paused: number; failedLast24h: number };
  providers: Awaited<ReturnType<typeof getHealthSnapshot>>;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: "Database", ok: true, message: "Connected." };
  } catch (err) {
    return { name: "Database", ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  if (!isRedisConfigured()) {
    return { name: "Redis", ok: true, message: "Not configured — using in-process cache/rate-limit fallback." };
  }
  const ok = await pingRedis();
  return { name: "Redis", ok, message: ok ? "Connected." : "Configured but unreachable." };
}

async function checkStorage(): Promise<HealthCheckResult> {
  const providerId = await getConfig("PROVIDER_STORAGE");
  if (providerId === "mock") {
    return { name: "Storage", ok: true, message: "Mock storage provider — always reachable." };
  }
  const result = await testProviderConnection("STORAGE", providerId, await resolveProviderCredentials("STORAGE", providerId));
  return { name: "Storage", ok: result.ok, message: result.message };
}

export async function getHealthDashboard(): Promise<HealthDashboard> {
  const [database, redis, storage, queue, providers] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
    getQueueSnapshot(),
    getHealthSnapshot(),
  ]);

  return { database, redis, storage, queue, providers };
}
