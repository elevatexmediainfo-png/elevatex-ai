import { getConfig } from "@/lib/admin/config";
import {
  getProviderPolicyOverrides as getProviderPolicyOverridesDefault,
  type ProviderPolicyOverrides,
} from "@/lib/providers/credentials";
import { checkProviderBudget as checkProviderBudgetDefault, type BudgetCheckResult } from "./budget";
import { isProviderAvailable, recordOutcome as recordOutcomeDefault } from "./health";
import { logGenerationEvent, type LogEntryInput } from "./usage-log";
import { estimateCost as estimateCostDefault } from "./cost";
import {
  AllProvidersFailedError,
  NonRetryableProviderError,
  type GenerationCategory,
  type GenerationContext,
  type GenerationPolicy,
  type GenerationProgressEvent,
  type GenerationProvider,
  type GenerationUsage,
  type ProviderAttemptSummary,
} from "./types";

const TIMEOUT_CONFIG_KEY = {
  LLM: "GENERATION_TIMEOUT_MS_LLM",
  IMAGE: "GENERATION_TIMEOUT_MS_IMAGE",
  VOICE: "GENERATION_TIMEOUT_MS_VOICE",
  VIDEO: "GENERATION_TIMEOUT_MS_VIDEO",
  TRANSCRIPTION: "GENERATION_TIMEOUT_MS_TRANSCRIPTION",
  VIDEO_UNDERSTANDING: "GENERATION_TIMEOUT_MS_VIDEO_UNDERSTANDING",
  REASONING: "GENERATION_TIMEOUT_MS_REASONING",
} as const satisfies Record<GenerationCategory, string>;

async function loadPolicy(category: GenerationCategory): Promise<GenerationPolicy> {
  const [retryMaxAttempts, retryBackoffMs, timeoutMs, healthFailureThreshold, healthCooldownMs] = await Promise.all([
    getConfig("GENERATION_RETRY_MAX_ATTEMPTS"),
    getConfig("GENERATION_RETRY_BACKOFF_MS"),
    getConfig(TIMEOUT_CONFIG_KEY[category]),
    getConfig("GENERATION_HEALTH_FAILURE_THRESHOLD"),
    getConfig("GENERATION_HEALTH_COOLDOWN_MS"),
  ]);
  return { retryMaxAttempts, retryBackoffMs, timeoutMs, healthFailureThreshold, healthCooldownMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Closes a real race checkProviderBudget() alone can't prevent: found live,
// not theorized — RENDER_QUEUE_CONCURRENCY (default 3) lets several scenes'
// runGeneration() calls run in true parallel, and Veo's real call is a
// long-running operation (create -> poll for up to ~5 minutes), so the
// GenerationLog row checkProviderBudget()'s rateLimitPerMinute count reads
// doesn't exist until well AFTER the call completes. Multiple concurrent
// callers can each see 0 recent rows for the same provider, all pass the
// budget check, and all fire their real vendor request within the same
// second — exactly how a real per-minute Veo limit got tripped despite
// rateLimitPerMinute being set correctly. Reuses rateLimitPerMinute itself
// (not a new config field) to derive a minimum spacing between consecutive
// calls to the SAME provider. The reservation (read current slot, write the
// next one) happens synchronously, before any `await` — JS's single-
// threaded execution means no other concurrent caller can interleave
// between that read and write, so two callers can never reserve the same
// slot, unlike a check-then-log pattern.
const lastReservedCallAtByProviderKey = new Map<string, number>();

function reserveProviderCallSlot(key: string, minSpacingMs: number): Promise<void> {
  if (minSpacingMs <= 0) return Promise.resolve();
  const now = Date.now();
  const previousReservation = lastReservedCallAtByProviderKey.get(key) ?? 0;
  const reservedAt = Math.max(now, previousReservation + minSpacingMs);
  lastReservedCallAtByProviderKey.set(key, reservedAt);
  const waitMs = reservedAt - now;
  return waitMs > 0 ? sleep(waitMs) : Promise.resolve();
}

// Milestone 14 — a per-tool "default AI model" (Admin Creative Tools panel)
// biases which provider is tried FIRST without removing the category's
// existing safety net: if the preferred provider is missing, unhealthy, or
// over budget, runGeneration()'s own filtering/failover still applies to
// the rest of the chain exactly as before. This never replaces the
// priority-ordered list, only reorders it.
export function reorderProvidersByPreference<P extends GenerationProvider>(
  providers: P[],
  preferredProviderId?: string
): P[] {
  if (!preferredProviderId) return providers;
  const index = providers.findIndex((p) => p.id === preferredProviderId);
  if (index <= 0) return providers;
  const reordered = [...providers];
  const [preferred] = reordered.splice(index, 1);
  reordered.unshift(preferred);
  return reordered;
}

// A broken progress sink (e.g. a caller's DB write failing) must never take
// down the generation it's just reporting on — same "best-effort, never on
// the critical path" contract every other progress-feedback write in this
// codebase already follows (merge-via-editor.ts's own progress writes).
async function safeProgress(
  onProgress: RunGenerationOptions<GenerationProvider, unknown>["onProgress"],
  event: GenerationProgressEvent
): Promise<void> {
  if (!onProgress) return;
  try {
    await onProgress(event);
  } catch (err) {
    console.error("[generation] onProgress callback threw — ignored", err);
  }
}

// Races `fn` against a timeout. `fn` receives an AbortSignal it MAY honor
// (e.g. pass through to `fetch(url, { signal })`) for true cancellation;
// adapters that ignore it simply have their result discarded on timeout —
// the engine moves on to a retry/failover regardless.
async function withTimeout<R>(fn: (signal: AbortSignal) => Promise<R>, timeoutMs: number): Promise<R> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface RunGenerationOptions<P extends GenerationProvider, R> {
  category: GenerationCategory;
  /** Logical operation name for usage analytics, e.g. "script" | "thumbnail" | "voiceover" | "preview_render" | "master_render". */
  operation: string;
  /** Already in admin-configured priority order — index 0 is tried first. */
  providers: P[];
  invoke: (provider: P, signal: AbortSignal) => Promise<R>;
  /** Extracts usage (tokens/characters/seconds/images) from a successful result, for cost tracking. */
  getUsage?: (result: R) => GenerationUsage | undefined;
  context?: GenerationContext;

  // Dependency-injection seams. Production call sites never pass these —
  // they default to the real DB-backed implementations below. Unit tests
  // substitute fakes so the retry/timeout/failover ORCHESTRATION logic is
  // verifiable without touching Postgres.
  isAvailable?: (category: GenerationCategory, providerId: string) => Promise<boolean>;
  recordOutcome?: (
    category: GenerationCategory,
    providerId: string,
    outcome: "success" | "failure",
    opts: { threshold: number; cooldownMs: number; error?: string }
  ) => Promise<void>;
  logEvent?: (entry: LogEntryInput) => Promise<void>;
  estimateCost?: (providerId: string, usage: GenerationUsage | undefined) => Promise<number>;
  getPolicy?: (category: GenerationCategory) => Promise<GenerationPolicy>;
  /** Per-provider timeoutMs/retryCount overrides (Admin AI Providers panel) — unset fields fall back to the category-wide policy above. */
  getProviderOverrides?: (category: GenerationCategory, providerId: string) => Promise<ProviderPolicyOverrides>;
  /** Admin-set daily/monthly budget + per-minute rate limit (Admin AI Providers panel) — unlike health, exhausting every provider here is a genuine "no," not a transient blip to retry through. */
  checkBudget?: (category: GenerationCategory, providerId: string) => Promise<BudgetCheckResult>;
  /** Real progress feedback (2026-07-25) — see GenerationProgressEvent's own comment. Fire-and-forget from the engine's perspective; a caller that awaits inside this callback slows down the attempt loop by that much, so keep it cheap. */
  onProgress?: (event: GenerationProgressEvent) => void | Promise<void>;
}

// The unified Generation Engine. Every category (LLM/Image/Voice/Video) goes
// through this single function — it is the one place failover, retry,
// timeout, cost tracking, health monitoring, and usage logging are
// implemented, so none of those concerns are duplicated per category.
//
// Flow per request: filter the priority-ordered provider list to ones not
// currently in a health cooldown (falling back to the full list if that
// would leave nothing) → for each provider, retry up to the policy's max
// attempts with linear backoff and a per-attempt timeout → on success,
// record health + log + return → on exhausted retries, record the failure
// and move to the next provider → if every provider is exhausted, throw
// AllProvidersFailedError.
export async function runGeneration<P extends GenerationProvider, R>(
  opts: RunGenerationOptions<P, R>
): Promise<R & { providerId: string; costUsd?: number }> {
  const {
    category,
    operation,
    providers,
    invoke,
    getUsage,
    context = {},
    isAvailable = isProviderAvailable,
    recordOutcome = recordOutcomeDefault,
    logEvent = logGenerationEvent,
    estimateCost = estimateCostDefault,
    getPolicy = loadPolicy,
    getProviderOverrides = getProviderPolicyOverridesDefault,
    checkBudget = checkProviderBudgetDefault,
    onProgress,
  } = opts;

  if (providers.length === 0) {
    throw new AllProvidersFailedError(category, operation, []);
  }

  const policy = await getPolicy(category);

  const availability = await Promise.all(providers.map((p) => isAvailable(category, p.id)));
  const healthy = providers.filter((_, i) => availability[i]);
  // Never let the chain go fully empty — a transient health blip across
  // every configured provider shouldn't cause a hard outage; give the
  // full list one more shot instead of refusing the request outright.
  const afterHealth = healthy.length > 0 ? healthy : providers;

  // Budget/rate limits are admin-set hard caps (Admin AI Providers panel),
  // not a transient blip — unlike the health filter above, exhausting
  // every provider here is a genuine "no," surfaced as a real failure
  // rather than silently falling back to the unfiltered list.
  const budgetChecks = await Promise.all(afterHealth.map((p) => checkBudget(category, p.id)));
  const chain = afterHealth.filter((_, i) => budgetChecks[i].ok);
  if (chain.length === 0) {
    const summaries: ProviderAttemptSummary[] = afterHealth.map((p, i) => ({
      providerId: p.id,
      attempts: 0,
      error: budgetChecks[i].reason ?? "budget/rate limit exceeded",
    }));
    throw new AllProvidersFailedError(category, operation, summaries);
  }

  const summaries: ProviderAttemptSummary[] = [];

  for (const provider of chain) {
    // Admin-configured per-provider overrides (Admin AI Providers panel)
    // take priority over the category-wide policy; an unset field just
    // leaves that category default in place.
    const overrides = await getProviderOverrides(category, provider.id);
    const retryMaxAttempts = overrides.retryCount ?? policy.retryMaxAttempts;
    const timeoutMs = overrides.timeoutMs ?? policy.timeoutMs;

    let lastError = "";
    let attemptsTaken = 0;

    // Only meaningfully paces when an admin has actually set
    // rateLimitPerMinute on this provider (unset -> 0 -> no-op, same as
    // checkProviderBudget()'s own opt-in convention) — this doesn't invent
    // a new default limit, it just makes an existing one race-proof under
    // concurrency.
    const minSpacingMs = overrides.rateLimitPerMinute ? Math.ceil(60_000 / overrides.rateLimitPerMinute) : 0;

    for (let attempt = 1; attempt <= retryMaxAttempts; attempt++) {
      attemptsTaken = attempt;
      await reserveProviderCallSlot(`${category}:${provider.id}`, minSpacingMs);
      await safeProgress(onProgress, { providerId: provider.id, attempt, maxAttempts: retryMaxAttempts, phase: "attempt_start" });
      const startedAt = Date.now();
      try {
        const result = await withTimeout((signal) => invoke(provider, signal), timeoutMs);
        const latencyMs = Date.now() - startedAt;
        const usage = getUsage?.(result);
        const costUsd = await estimateCost(provider.id, usage);

        await Promise.all([
          recordOutcome(category, provider.id, "success", {
            threshold: policy.healthFailureThreshold,
            cooldownMs: policy.healthCooldownMs,
          }),
          logEvent({
            category,
            providerId: provider.id,
            operation,
            status: "SUCCESS",
            attempt,
            latencyMs,
            costUsd,
            videoProjectId: context.videoProjectId,
            userId: context.userId,
            sceneId: context.sceneId,
            creativeProjectId: context.creativeProjectId,
            model: provider.model,
            usageTokens: usage?.tokens,
            usageImages: usage?.images,
            usageSeconds: usage?.seconds,
          }),
        ]);

        // Attach which provider actually served this, so a caller charging
        // credits after "success" can tell a real vendor result apart from
        // a MOCK_PROVIDER_ID fallback, instead of charging identically for
        // both as every video charge site did until this fix. Only spreads
        // when result is a genuine object — found live by actually running
        // this file's own test suite (not assumed safe): spreading a
        // primitive R (this suite uses plain strings to test retry/failover
        // logic in isolation) silently explodes it into character-indexed
        // properties instead of the expected value. Every REAL production
        // category result (video/image/voice/script/transcription) is
        // already an object, so this only changes behavior for the
        // non-representative primitive case.
        //
        // Phase 12 Module 10 — also attach the SAME costUsd just computed
        // for logging (line above), so callers building a cost preview
        // (e.g. the AI Auto-Editor pipeline) read the real number the
        // engine already calculated instead of a second, parallel
        // recomputation — this was previously logged and then discarded.
        return result && typeof result === "object"
          ? { ...result, providerId: provider.id, costUsd }
          : (result as R & { providerId: string; costUsd?: number });
      } catch (err) {
        const latencyMs = Date.now() - startedAt;
        const isNonRetryable = err instanceof NonRetryableProviderError;
        lastError = err instanceof Error ? err.message : String(err);

        // A deterministic failure (e.g. a content-policy block) is not
        // evidence THIS provider is unhealthy — an unmodified retry can
        // never turn a 400 into a 200 — so it's excluded from the
        // circuit-breaker signal entirely. Still logged to GenerationLog
        // below for observability; only the health/consecutiveFailures
        // side is skipped.
        const tasks: Promise<unknown>[] = [
          logEvent({
            category,
            providerId: provider.id,
            operation,
            status: "FAILURE",
            attempt,
            latencyMs,
            errorMessage: lastError,
            videoProjectId: context.videoProjectId,
            userId: context.userId,
            sceneId: context.sceneId,
            creativeProjectId: context.creativeProjectId,
            model: provider.model,
          }),
        ];
        if (!isNonRetryable) {
          tasks.push(
            recordOutcome(category, provider.id, "failure", {
              threshold: policy.healthFailureThreshold,
              cooldownMs: policy.healthCooldownMs,
              error: lastError,
            })
          );
        }
        await Promise.all(tasks);

        await safeProgress(onProgress, {
          providerId: provider.id,
          attempt,
          maxAttempts: retryMaxAttempts,
          phase: "attempt_failed",
          error: lastError,
        });

        // Deterministic failure — stop retrying THIS provider immediately,
        // no backoff sleep. The outer provider loop naturally moves to the
        // next provider in the chain (or falls through to
        // AllProvidersFailedError below if this was the last one).
        if (isNonRetryable) {
          break;
        }

        if (attempt < retryMaxAttempts) {
          await sleep(policy.retryBackoffMs * attempt);
        }
      }
    }

    await safeProgress(onProgress, {
      providerId: provider.id,
      attempt: attemptsTaken,
      maxAttempts: retryMaxAttempts,
      phase: "provider_exhausted",
      error: lastError,
    });
    summaries.push({ providerId: provider.id, attempts: attemptsTaken, error: lastError });
  }

  throw new AllProvidersFailedError(category, operation, summaries);
}

export * from "./types";
