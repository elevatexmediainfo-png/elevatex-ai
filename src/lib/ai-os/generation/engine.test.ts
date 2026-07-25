import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  orchestrateGeneration, generateId, setCredentialResolver,
  validateGenerationRequest, estimateGenerationCost,
  computeRetryDelay, withRetry,
  GenerationQueue,
} from "./index";
import { GenerationError, isTransientError } from "./types";
import { getCapability } from "../provider-capabilities";
import { optimizePromptSpecification } from "../prompt-optimizer";
import { buildPromptSpecification } from "../prompt-spec";
import { buildVisualScenePlan } from "../scene-planner";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import { translateForProvider } from "../provider-translator";
import type { CreativeRequest } from "../types";
import type { GenerationRequest } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — build a GenerationRequest from a raw idea
// ─────────────────────────────────────────────────────────────────────────────

function makeGenerationRequest(rawIdea: string): GenerationRequest {
  const request: CreativeRequest = { userId: "test", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  const spec = buildPromptSpecification(blueprint, scene);
  const optimized = optimizePromptSpecification(spec);
  const providerPrompt = translateForProvider(optimized, "openai");
  const capability = getCapability("openai");

  return {
    generationId:    generateId(),
    providerPrompt,
    capability,
    aspectRatio:     "1:1",
    outputFormat:    "png",
    quality:         "high",
    userId:          "test",
    timeoutMs:       5000,
    maxRetries:      1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types and utilities
// ─────────────────────────────────────────────────────────────────────────────

describe("GenerationError", () => {
  it("isTransientError returns true for network-like errors", () => {
    const err = new GenerationError(429, "rate limit", true, "openai");
    expect(isTransientError(err)).toBe(true);
  });

  it("isTransientError returns false for validation errors", () => {
    const err = new GenerationError(400, "bad request", false, "openai");
    expect(isTransientError(err)).toBe(false);
  });
});

describe("computeRetryDelay", () => {
  it("increases with attempt number", () => {
    const d1 = computeRetryDelay(1);
    const d2 = computeRetryDelay(2);
    const d3 = computeRetryDelay(3);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });

  it("does not exceed maxDelayMs", () => {
    for (let i = 1; i <= 10; i++) {
      expect(computeRetryDelay(i, { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 5000, jitterFactor: 0 }))
        .toBeLessThanOrEqual(5000);
    }
  });
});

describe("withRetry", () => {
  it("succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const { result, retryCount } = await withRetry(fn);
    expect(result).toBe("ok");
    expect(retryCount).toBe(0);
  });

  it("retries transient errors and succeeds", async () => {
    let call = 0;
    const fn = vi.fn().mockImplementation(() => {
      call++;
      if (call < 3) throw new GenerationError(429, "rate limit", true);
      return Promise.resolve("ok");
    });
    const { result, retryCount } = await withRetry(fn,
      { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 100, jitterFactor: 0 });
    expect(result).toBe("ok");
    expect(retryCount).toBe(2);
  });

  it("does not retry non-transient errors", async () => {
    const fn = vi.fn().mockRejectedValue(new GenerationError(400, "bad request", false));
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 100, jitterFactor: 0 }))
      .rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateGenerationRequest", () => {
  it("validates a well-formed OpenAI request as valid", () => {
    const req = makeGenerationRequest("Dental Implant Creative");
    const result = validateGenerationRequest(req);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects invalid aspect ratio for OpenAI", () => {
    const req = makeGenerationRequest("Test");
    req.aspectRatio = "3:2";  // not supported by OpenAI
    const result = validateGenerationRequest(req);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("UNSUPPORTED_ASPECT_RATIO"))).toBe(true);
  });

  it("detects video output format on image provider", () => {
    const req = makeGenerationRequest("Test");
    req.outputFormat = "mp4" as "png";
    const result = validateGenerationRequest(req);
    expect(result.isValid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cost estimation
// ─────────────────────────────────────────────────────────────────────────────

describe("estimateGenerationCost", () => {
  it("returns a non-zero cost estimate for OpenAI high quality", () => {
    const req = makeGenerationRequest("Dental Campaign");
    req.quality = "high";
    const cost = estimateGenerationCost(req);
    expect(cost.estimatedCostUsd).toBeGreaterThan(0);
    expect(cost.creditCost).toBeGreaterThan(0);
    expect(cost.provider).toBe("openai");
    expect(cost.billingModel).toBe("per_image");
  });

  it("video providers use per_second billing", () => {
    const req = makeGenerationRequest("Video campaign");
    req.capability = getCapability("veo");
    const cost = estimateGenerationCost(req);
    expect(cost.billingModel).toBe("per_second");
    expect(cost.estimatedCostUsd).toBeGreaterThan(cost.estimatedCostUsd * 0); // non-zero
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Generation queue
// ─────────────────────────────────────────────────────────────────────────────

describe("GenerationQueue", () => {
  it("processes requests in order", async () => {
    const queue = new GenerationQueue({ maxConcurrency: 1, maxQueueSize: 10 });
    const results: number[] = [];
    const executor = vi.fn().mockImplementation(async (req: GenerationRequest) => {
      results.push(parseInt(req.generationId.split("_").pop() ?? "0"));
      return {
        generationId: req.generationId, status: "success" as const, provider: "openai" as const,
        model: "test", latencyMs: 1, generatedAt: "", retryCount: 0,
        cost: { estimatedCostUsd: 0.01, creditCost: 1, billingModel: "per_image" as const, provider: "openai" as const, model: "test", quality: "high" },
        quality: { estimatedOutputQuality: 80, fullPromptUsed: true, allFeaturesSupported: true, ignoredFeatures: [] },
        warnings: [], telemetry: {} as never,
      };
    });
    queue.setExecutor(executor);

    const req1 = makeGenerationRequest("1"); req1.generationId = "gen_1";
    const req2 = makeGenerationRequest("2"); req2.generationId = "gen_2";

    await Promise.all([queue.enqueue(req1), queue.enqueue(req2)]);
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("rejects when queue is full", async () => {
    const queue = new GenerationQueue({ maxConcurrency: 1, maxQueueSize: 1 });
    // Fill the queue
    queue.enqueue(makeGenerationRequest("1")).catch(() => {});
    queue.enqueue(makeGenerationRequest("2")).catch(() => {});
    // Third should be rejected
    await expect(queue.enqueue(makeGenerationRequest("3"))).rejects.toThrow("full");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// orchestrateGeneration (mocked API calls)
// ─────────────────────────────────────────────────────────────────────────────

describe("orchestrateGeneration — with mock credentials and fetch", () => {
  beforeEach(() => {
    // Inject test credentials so we don't need real API keys
    setCredentialResolver(async () => ({ apiKey: "test-key", model: "gpt-image-1.5" }));
  });

  it("returns validation_failed status when prompt is too long", async () => {
    const req = makeGenerationRequest("Dental Campaign");
    // Force an invalid aspect ratio to trigger validation failure
    req.aspectRatio = "3:2";  // unsupported by OpenAI
    const result = await orchestrateGeneration(req);
    expect(result.status).toBe("validation_failed");
    expect(result.error).toContain("UNSUPPORTED_ASPECT_RATIO");
  });

  it("returns failed status when no credentials", async () => {
    setCredentialResolver(async () => null);
    const req = makeGenerationRequest("Test");
    const result = await orchestrateGeneration(req);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("No API credentials");
  });

  it("returns all required fields in GenerationResult", async () => {
    // Mock fetch to avoid real API call
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ b64_json: "dGVzdA==" }] // base64 "test"
      }),
    } as Response);

    const req = makeGenerationRequest("Dental Campaign");
    const result = await orchestrateGeneration(req);

    expect(result).toHaveProperty("generationId");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("provider");
    expect(result).toHaveProperty("cost");
    expect(result).toHaveProperty("quality");
    expect(result).toHaveProperty("telemetry");
    expect(result).toHaveProperty("latencyMs");
    expect(typeof result.latencyMs).toBe("number");

    global.fetch = originalFetch;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Orchestrator must NOT rewrite prompts", () => {
  it("the final prompt in GenerationResult matches the input ProviderPrompt exactly", async () => {
    setCredentialResolver(async () => ({ apiKey: "test-key" }));
    const originalFetch = global.fetch;
    let capturedBody: Record<string, unknown> | null = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (typeof init?.body === "string") capturedBody = JSON.parse(init.body);
      return { ok: true, json: () => Promise.resolve({ data: [{ b64_json: "dGVzdA==" }] }) } as Response;
    });

    const req = makeGenerationRequest("Dental Implant");
    const inputPrompt = req.providerPrompt.body.finalPrompt;
    await orchestrateGeneration(req);

    // The prompt sent to the API must match exactly — no rewriting
    if (capturedBody && typeof capturedBody === "object") {
      expect((capturedBody as Record<string, unknown>).prompt).toBe(inputPrompt);
    }

    global.fetch = originalFetch;
  });
});
