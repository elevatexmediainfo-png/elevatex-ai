import { prisma } from "@/lib/prisma";
import type { GenerationCategory } from "./types";

export type HealthStatus = "HEALTHY" | "DEGRADED" | "DOWN";

export interface HealthState {
  status: HealthStatus;
  consecutiveFailures: number;
  downUntil: Date | null;
}

const INITIAL_HEALTH_STATE: HealthState = { status: "HEALTHY", consecutiveFailures: 0, downUntil: null };

// Pure state-transition function — no DB access — so the circuit-breaker
// logic is unit-testable without Postgres. `recordOutcome`/`isProviderAvailable`
// below are the thin DB-backed wrappers around it that production code uses.
export function computeNextHealthState(
  current: HealthState,
  outcome: "success" | "failure",
  threshold: number,
  cooldownMs: number,
  nowMs: number
): HealthState {
  if (outcome === "success") {
    return { status: "HEALTHY", consecutiveFailures: 0, downUntil: null };
  }
  const consecutiveFailures = current.consecutiveFailures + 1;
  if (consecutiveFailures >= threshold) {
    return { status: "DOWN", consecutiveFailures, downUntil: new Date(nowMs + cooldownMs) };
  }
  return { status: "DEGRADED", consecutiveFailures, downUntil: null };
}

// A DOWN provider is unavailable only until its cooldown passes — after
// that it gets one more chance (the next failure immediately re-trips it,
// since consecutiveFailures was never reset).
export function isAvailableNow(state: Pick<HealthState, "status" | "downUntil">, nowMs: number): boolean {
  if (state.status !== "DOWN") return true;
  if (!state.downUntil) return true;
  return state.downUntil.getTime() <= nowMs;
}

async function getHealthState(category: GenerationCategory, providerId: string): Promise<HealthState> {
  const row = await prisma.providerHealth.findUnique({
    where: { category_providerId: { category, providerId } },
  });
  if (!row) return INITIAL_HEALTH_STATE;
  return { status: row.status, consecutiveFailures: row.consecutiveFailures, downUntil: row.downUntil };
}

export async function isProviderAvailable(category: GenerationCategory, providerId: string): Promise<boolean> {
  const state = await getHealthState(category, providerId);
  return isAvailableNow(state, Date.now());
}

export interface RecordOutcomeOptions {
  threshold: number;
  cooldownMs: number;
  error?: string;
}

export async function recordOutcome(
  category: GenerationCategory,
  providerId: string,
  outcome: "success" | "failure",
  opts: RecordOutcomeOptions
): Promise<void> {
  const current = await getHealthState(category, providerId);
  const next = computeNextHealthState(current, outcome, opts.threshold, opts.cooldownMs, Date.now());

  await prisma.providerHealth.upsert({
    where: { category_providerId: { category, providerId } },
    create: {
      category,
      providerId,
      status: next.status,
      consecutiveFailures: next.consecutiveFailures,
      downUntil: next.downUntil,
      lastSuccessAt: outcome === "success" ? new Date() : null,
      lastFailureAt: outcome === "failure" ? new Date() : null,
      lastError: outcome === "failure" ? opts.error ?? null : null,
    },
    update: {
      status: next.status,
      consecutiveFailures: next.consecutiveFailures,
      downUntil: next.downUntil,
      ...(outcome === "success"
        ? { lastSuccessAt: new Date() }
        : { lastFailureAt: new Date(), lastError: opts.error ?? null }),
    },
  });
}

// Admin panel feed — every known provider's current circuit-breaker state.
export async function getHealthSnapshot() {
  return prisma.providerHealth.findMany({ orderBy: [{ category: "asc" }, { providerId: "asc" }] });
}
