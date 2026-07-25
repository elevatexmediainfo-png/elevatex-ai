import type { ProviderPrompt } from "../provider-translator/types";
import type { ProviderCapability, ProviderCapabilityId } from "../provider-capabilities/types";

// Phase 15 — AI Generation Orchestrator types.
// The only module in the AI OS allowed to call AI providers.
//
// STRICT RULES:
//   ✗ Never rewrites or optimizes prompts
//   ✗ Never performs reasoning or strategy
//   ✗ Never calls Creative Brain, Blueprint, or upstream AI OS modules
//   ✓ Only executes generation requests against provider APIs

// ─────────────────────────────────────────────────────────────────────────────
// Generation Request
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferenceImageInput {
  /** URL of the reference image. */
  url:      string;
  /** How closely the output should match the reference. */
  fidelity: "high" | "low" | "auto";
}

export interface GenerationRequest {
  /** Unique ID for this generation request (for telemetry and retry tracking). */
  generationId:    string;
  /** The provider-ready prompt from the Translation Layer. */
  providerPrompt:  ProviderPrompt;
  /** Provider capabilities — used to validate parameters before calling the API. */
  capability:      ProviderCapability;
  /** Aspect ratio requested (e.g. "1:1", "16:9"). */
  aspectRatio:     string;
  /** Output format requested. */
  outputFormat:    "png" | "jpeg" | "webp" | "mp4";
  /** Quality level (provider-specific values from capability.qualityLevels). */
  quality?:        string;
  /** Background mode for providers that support it. */
  backgroundMode?: string;
  /** Reference images for edit/img2img workflows. */
  referenceImages?:ReferenceImageInput[];
  /** Mask image URL for inpainting workflows. */
  maskImageUrl?:   string;
  /** The user making the request (for cost tracking and telemetry). */
  userId:          string;
  /** Optional link to a CreativeProject for cost association. */
  creativeProjectId?: string;
  /** Request timeout in milliseconds. 0 = use default from provider capability. */
  timeoutMs?:      number;
  /** Maximum retry attempts for transient failures. Default: 3. */
  maxRetries?:     number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Credentials (injected by orchestrator, never hardcoded in executors)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderCredentials {
  apiKey:    string;
  apiSecret?: string;
  model?:    string;
  baseUrl?:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Executor Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderRawOutput {
  /** Public URL of the generated image/video. */
  outputUrl?:   string;
  /** Base64-encoded image data (for providers that return b64_json). */
  outputData?:  string;
  /** MIME type of the output. */
  contentType?: string;
  /** Any provider-specific metadata. */
  metadata?:    Record<string, unknown>;
}

export interface ProviderExecutor {
  readonly provider: ProviderCapabilityId;
  execute(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal?: AbortSignal
  ): Promise<ProviderRawOutput>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Cost
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationCost {
  /** Pre-generation estimate in USD. */
  estimatedCostUsd:  number;
  /** Actual cost in USD (if provider returns this; otherwise matches estimate). */
  actualCostUsd?:    number;
  /** Internal credit cost for billing. */
  creditCost:        number;
  /** How the provider charges for this generation. */
  billingModel:      "per_image" | "per_second" | "per_token" | "per_call";
  provider:          ProviderCapabilityId;
  model:             string;
  quality:           string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationTelemetry {
  generationId:        string;
  provider:            ProviderCapabilityId;
  model:               string;
  promptLength:        number;
  negativePromptLength:number;
  aspectRatio:         string;
  outputFormat:        string;
  quality:             string;
  latencyMs:           number;
  success:             boolean;
  failureReason?:      string;
  retryCount:          number;
  hasReferenceImages:  boolean;
  userId:              string;
  creativeProjectId?:  string;
  generatedAt:         string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Quality Metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationQualityMeta {
  /** 0-100 estimated quality of the output based on provider capability and prompt quality. */
  estimatedOutputQuality:  number;
  /** Was the full prompt length used? */
  fullPromptUsed:          boolean;
  /** Were all requested features supported by the provider? */
  allFeaturesSupported:    boolean;
  /** Any features that were ignored or unavailable. */
  ignoredFeatures:         string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Result
// ─────────────────────────────────────────────────────────────────────────────

export type GenerationStatus = "success" | "failed" | "timeout" | "cancelled" | "validation_failed";

export interface GenerationResult {
  /** Unique ID matching the GenerationRequest. */
  generationId:    string;
  status:          GenerationStatus;
  provider:        ProviderCapabilityId;
  model:           string;

  // ── Output ────────────────────────────────────────────────────────────────
  /** Publicly accessible URL of the generated asset. */
  outputUrl?:      string;
  /** Base64 data URL when no hosted URL is available. */
  outputData?:     string;
  /** MIME type of the output (e.g. "image/png", "video/mp4"). */
  contentType?:    string;

  // ── Timing ────────────────────────────────────────────────────────────────
  /** Total time from request to result in milliseconds. */
  latencyMs:       number;
  generatedAt:     string;

  // ── Cost ──────────────────────────────────────────────────────────────────
  cost:            GenerationCost;

  // ── Quality ───────────────────────────────────────────────────────────────
  quality:         GenerationQualityMeta;

  // ── Debugging ─────────────────────────────────────────────────────────────
  warnings:        string[];
  error?:          string;
  retryCount:      number;
  telemetry:       GenerationTelemetry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class GenerationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly isTransient: boolean = false,
    public readonly provider?: ProviderCapabilityId
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

/** Transient status codes that should trigger a retry. */
export const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Returns true if this error is worth retrying. */
export function isTransientError(err: unknown): boolean {
  if (err instanceof GenerationError) return err.isTransient;
  if (err instanceof Error && err.message.includes("fetch")) return true; // network errors
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default timeout by provider speed tier
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TIMEOUT_MS: Record<string, number> = {
  fast:      30_000,
  medium:    60_000,
  slow:      120_000,
  very_slow: 180_000,
};
