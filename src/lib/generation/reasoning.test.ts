import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReasoningPlanRequest } from "@/lib/providers/reasoning";

// Diagnostic instrumentation (2026-08-15) — focused coverage for
// planTimeline()'s own onProgress wiring ONLY. Mocks runGeneration()
// itself (not its internal DB-backed defaults) because planTimeline()
// doesn't expose runGeneration's own dependency-injection seams to ITS
// caller — the real engine's retry/timeout/onProgress-firing mechanics
// (including the safeProgress() "a throwing onProgress callback can never
// break generation" contract) are already thoroughly tested in
// engine.test.ts's own "runGeneration onProgress" describe block
// (specifically "never throws or breaks generation when onProgress itself
// rejects") — this file relies on that existing coverage rather than
// re-proving it, and only verifies that planTimeline()'s OWN callback
// turns a real GenerationProgressEvent (the exact shape engine.test.ts's
// own fixtures confirm the real engine produces) into the right
// structured log fields.
const listEnabledProviderConfigsMock = vi.fn();
vi.mock("@/lib/providers/credentials", () => ({ listEnabledProviderConfigs: (...args: unknown[]) => listEnabledProviderConfigsMock(...args) }));

const instantiateReasoningProviderMock = vi.fn();
vi.mock("@/lib/providers/reasoning", () => ({ instantiateReasoningProvider: (...args: unknown[]) => instantiateReasoningProviderMock(...args) }));

const getConfigMock = vi.fn();
vi.mock("@/lib/admin/config", () => ({ getConfig: (...args: unknown[]) => getConfigMock(...args) }));

const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: (...args: unknown[]) => loggerInfoMock(...args), warn: (...args: unknown[]) => loggerWarnMock(...args) },
}));

const runGenerationMock = vi.fn();
vi.mock("./engine", () => ({ runGeneration: (...args: unknown[]) => runGenerationMock(...args) }));

const { planTimeline } = await import("./reasoning");

const BASE_REQ: ReasoningPlanRequest = { words: [], videoAnalysis: null, sourceDurationMs: 1000, survivingSegmentCount: 1 };

afterEach(() => {
  vi.clearAllMocks();
});

describe("planTimeline — engine-attempt diagnostic logging", () => {
  it("logs attempt_start with provider, model, engineAttempt, maxEngineAttempts, configuredTimeoutMs", async () => {
    listEnabledProviderConfigsMock.mockResolvedValue(["gpt5"]);
    instantiateReasoningProviderMock.mockResolvedValue({ id: "gpt5", category: "REASONING", model: "gpt-5" });
    getConfigMock.mockResolvedValue(60_000);
    // Real event shape, matching engine.test.ts's own confirmed fixture
    // for a first-attempt start (see that file's "fires no attempt_failed
    // ... on a first-try success" test).
    runGenerationMock.mockImplementation(async (opts: { onProgress?: (e: unknown) => unknown }) => {
      await opts.onProgress?.({ providerId: "gpt5", attempt: 1, maxAttempts: 2, phase: "attempt_start" });
      return { captions: [] };
    });

    await planTimeline(BASE_REQ);

    const startLog = loggerInfoMock.mock.calls.find(([, msg]) => msg === "[reasoning] plan_timeline engine attempt starting");
    expect(startLog?.[0]).toMatchObject({
      operation: "plan_timeline",
      provider: "gpt5",
      model: "gpt-5",
      engineAttempt: 1,
      maxEngineAttempts: 2,
      configuredTimeoutMs: 60_000,
    });
  });

  it("logs attempt_failed with provider, engineAttempt, elapsedMs, and the error message", async () => {
    listEnabledProviderConfigsMock.mockResolvedValue(["gpt5"]);
    instantiateReasoningProviderMock.mockResolvedValue({ id: "gpt5", category: "REASONING", model: "gpt-5" });
    getConfigMock.mockResolvedValue(60_000);
    // Real event shape for a timed-out first attempt, matching
    // engine.test.ts's own confirmed fixture (error carries the raw
    // Error.message string, e.g. "Timed out after 60000ms").
    runGenerationMock.mockImplementation(async (opts: { onProgress?: (e: unknown) => unknown }) => {
      await opts.onProgress?.({ providerId: "gpt5", attempt: 1, maxAttempts: 2, phase: "attempt_start" });
      await opts.onProgress?.({ providerId: "gpt5", attempt: 1, maxAttempts: 2, phase: "attempt_failed", error: "Timed out after 60000ms" });
      throw new Error("All REASONING providers failed");
    });

    await expect(planTimeline(BASE_REQ)).rejects.toThrow("All REASONING providers failed");

    const failLog = loggerWarnMock.mock.calls.find(([, msg]) => msg === "[reasoning] plan_timeline engine attempt failed");
    expect(failLog?.[0]).toMatchObject({ provider: "gpt5", engineAttempt: 1, errorMessage: "Timed out after 60000ms" });
    expect(typeof (failLog?.[0] as { elapsedMs?: number })?.elapsedMs).toBe("number");
  });

  it("logs provider_exhausted when the operation finally fails after every engine attempt", async () => {
    listEnabledProviderConfigsMock.mockResolvedValue(["gpt5"]);
    instantiateReasoningProviderMock.mockResolvedValue({ id: "gpt5", category: "REASONING", model: "gpt-5" });
    getConfigMock.mockResolvedValue(60_000);
    // Real event sequence for total exhaustion, matching engine.test.ts's
    // own confirmed fixture ("fires attempt_start before each attempt and
    // attempt_failed after each failure...").
    runGenerationMock.mockImplementation(async (opts: { onProgress?: (e: unknown) => unknown }) => {
      await opts.onProgress?.({ providerId: "gpt5", attempt: 1, maxAttempts: 2, phase: "attempt_start" });
      await opts.onProgress?.({ providerId: "gpt5", attempt: 1, maxAttempts: 2, phase: "attempt_failed", error: "Timed out after 60000ms" });
      await opts.onProgress?.({ providerId: "gpt5", attempt: 2, maxAttempts: 2, phase: "attempt_start" });
      await opts.onProgress?.({ providerId: "gpt5", attempt: 2, maxAttempts: 2, phase: "attempt_failed", error: "Timed out after 60000ms" });
      await opts.onProgress?.({ providerId: "gpt5", attempt: 2, maxAttempts: 2, phase: "provider_exhausted", error: "Timed out after 60000ms" });
      throw new Error("All REASONING providers failed for \"plan_timeline\": gpt5 (2 attempt(s): Timed out after 60000ms)");
    });

    await expect(planTimeline(BASE_REQ)).rejects.toThrow(/All REASONING providers failed/);

    const exhaustedLog = loggerWarnMock.mock.calls.find(([, msg]) => msg === "[reasoning] plan_timeline provider exhausted all engine attempts");
    expect(exhaustedLog?.[0]).toMatchObject({ operation: "plan_timeline", provider: "gpt5", model: "gpt-5", maxEngineAttempts: 2, outcome: "provider_exhausted" });
  });
});
