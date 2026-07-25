import type { GenerationRequest, GenerationResult, ProviderCredentials, ProviderExecutor } from "./types";
import type { ProviderCapabilityId } from "../provider-capabilities/types";
import type {
  GenerationQualityMeta, GenerationStatus,
} from "./types";
import { DEFAULT_TIMEOUT_MS } from "./types";
import { validateGenerationRequest } from "./validation";
import { withRetry, DEFAULT_RETRY_CONFIG } from "./retry";
import { estimateGenerationCost, resolveActualCost } from "./cost";
import { buildTelemetry } from "./telemetry";
import { defaultStorageAdapter } from "./storage";
import { openaiExecutor }   from "./providers/openai";
import { geminiExecutor }   from "./providers/gemini";
import { fluxExecutor }     from "./providers/flux";
import { ideogramExecutor } from "./providers/ideogram";
import { veoExecutor }      from "./providers/veo";
import { runwayExecutor }   from "./providers/runway";
import { klingExecutor }    from "./providers/kling";

// Phase 15 — AI Generation Orchestrator Engine.
// The ONLY module in the AI OS allowed to call AI providers.
//
// STRICT RULES:
//   ✗ Never rewrites or optimizes prompts
//   ✗ Never performs reasoning or strategy
//   ✗ Never calls Creative Brain, Blueprint, or any upstream AI OS module
//   ✓ Validates, executes, retries, tracks cost, captures telemetry

// ─────────────────────────────────────────────────────────────────────────────
// Provider executor registry
// ─────────────────────────────────────────────────────────────────────────────

const EXECUTORS: Record<ProviderCapabilityId, ProviderExecutor> = {
  openai:           openaiExecutor,
  gemini:           geminiExecutor,
  flux:             fluxExecutor,
  ideogram:         ideogramExecutor,
  stable_diffusion: fluxExecutor,   // SDXL uses same Replicate API pattern as Flux
  veo:              veoExecutor,
  runway:           runwayExecutor,
  kling:            klingExecutor,
};

// ─────────────────────────────────────────────────────────────────────────────
// Credential resolution
// ─────────────────────────────────────────────────────────────────────────────

/** Resolves provider credentials. Override this in tests or via dependency injection. */
export type CredentialResolver = (provider: ProviderCapabilityId) => Promise<ProviderCredentials | null>;

let credentialResolver: CredentialResolver = async (provider) => {
  // Default: read from environment variables (simple, works in all contexts)
  const envMap: Record<ProviderCapabilityId, string | undefined> = {
    openai:           process.env.OPENAI_API_KEY,
    gemini:           process.env.GOOGLE_AI_API_KEY,
    flux:             process.env.REPLICATE_API_TOKEN,
    ideogram:         process.env.IDEOGRAM_API_KEY,
    stable_diffusion: process.env.REPLICATE_API_TOKEN,
    veo:              process.env.GOOGLE_AI_API_KEY,
    runway:           process.env.RUNWAY_API_KEY,
    kling:            process.env.KLING_API_KEY,
  };
  const apiKey = envMap[provider];
  return apiKey ? { apiKey } : null;
};

export function setCredentialResolver(resolver: CredentialResolver) {
  credentialResolver = resolver;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestrate function
// ─────────────────────────────────────────────────────────────────────────────

/** Executes a generation request against the specified provider. */
export async function orchestrateGeneration(request: GenerationRequest): Promise<GenerationResult> {
  const startTime = Date.now();
  const provider  = request.capability.id;
  let retryCount  = 0;
  const warnings: string[] = [];

  // Step 1: Pre-generation validation
  const validation = validateGenerationRequest(request);
  if (!validation.isValid) {
    return buildFailedResult(request, "validation_failed",
      `Validation failed: ${validation.errors.join("; ")}`, 0, Date.now() - startTime, []);
  }
  warnings.push(...validation.warnings);

  // Step 2: Credential resolution
  const credentials = await credentialResolver(provider);
  if (!credentials) {
    return buildFailedResult(request, "failed",
      `No API credentials configured for provider "${provider}"`, 0, Date.now() - startTime, []);
  }

  // Step 3: Cost estimation (pre-flight)
  const costEstimate = estimateGenerationCost(request);

  // Step 4: Get executor
  const executor = EXECUTORS[provider];
  if (!executor) {
    return buildFailedResult(request, "failed",
      `No executor registered for provider "${provider}"`, 0, Date.now() - startTime, []);
  }

  // Step 5: Timeout setup
  const timeoutMs = request.timeoutMs
    ?? DEFAULT_TIMEOUT_MS[request.capability.estimatedSpeed.value] ?? 60_000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Step 6: Execute with retry
    const maxRetries = request.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries;
    const { result: rawOutput, retryCount: attempts } = await withRetry(
      () => executor.execute(request, credentials, controller.signal),
      { ...DEFAULT_RETRY_CONFIG, maxRetries },
      (attempt, err, delayMs) => {
        warnings.push(`Retry ${attempt} after ${delayMs}ms: ${err instanceof Error ? err.message : String(err)}`);
      }
    );
    retryCount = attempts;

    const latencyMs = Date.now() - startTime;

    // Step 7: Storage
    const stored = rawOutput.outputData ?? rawOutput.outputUrl ?? "";
    const storageResult = await defaultStorageAdapter.upload(
      stored,
      `generations/${request.generationId}.${request.outputFormat}`,
      rawOutput.contentType ?? `image/${request.outputFormat}`
    );

    // Step 8: Cost resolution
    const cost = resolveActualCost(costEstimate);

    // Step 9: Quality metadata
    const quality: GenerationQualityMeta = {
      estimatedOutputQuality: request.capability.luxuryAdvertisementQuality?.value ?? 80,
      fullPromptUsed: request.providerPrompt.body.estimatedPromptLength <= request.capability.maximumPromptLength.value,
      allFeaturesSupported: validation.capabilityResult.errorCount === 0,
      ignoredFeatures: validation.capabilityResult.issues
        .filter(i => i.severity === "warning" || i.severity === "info")
        .map(i => i.code),
    };

    // Step 10: Telemetry
    const partialResult = { latencyMs, status: "success" as GenerationStatus, error: undefined, retryCount };
    const telemetry = buildTelemetry(request, partialResult);

    return {
      generationId: request.generationId,
      status:       "success",
      provider,
      model:        credentials.model ?? request.capability.providerVersion.value,
      outputUrl:    storageResult.url,
      contentType:  rawOutput.contentType,
      latencyMs,
      generatedAt:  new Date().toISOString(),
      cost,
      quality,
      warnings,
      retryCount,
      telemetry,
    };
  } catch (err) {
    clearTimeout(timeoutHandle);
    const latencyMs = Date.now() - startTime;
    const isTimeout = controller.signal.aborted;
    const status: GenerationStatus = isTimeout ? "timeout" : "failed";
    const errorMessage = err instanceof Error ? err.message : String(err);
    return buildFailedResult(request, status, errorMessage, retryCount, latencyMs, warnings);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildFailedResult(
  request: GenerationRequest,
  status: GenerationStatus,
  error: string,
  retryCount: number,
  latencyMs: number,
  warnings: string[]
): GenerationResult {
  const provider = request.capability.id;
  const partialResult = { latencyMs, status, error, retryCount };
  const telemetry = buildTelemetry(request, partialResult);
  return {
    generationId: request.generationId,
    status,
    provider,
    model: request.capability.providerVersion.value,
    latencyMs,
    generatedAt:  new Date().toISOString(),
    cost:         estimateGenerationCost(request),
    quality: {
      estimatedOutputQuality: 0,
      fullPromptUsed: false,
      allFeaturesSupported: false,
      ignoredFeatures: [],
    },
    warnings,
    error,
    retryCount,
    telemetry,
  };
}

/** Generates a unique generation ID. */
export function generateId(): string {
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
