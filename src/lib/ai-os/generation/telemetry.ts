import type { GenerationRequest, GenerationTelemetry, GenerationResult } from "./types";

// Phase 15 — Generation telemetry capture.
// Structured telemetry for every generation attempt.
// No external calls — pure data capture.

/** Builds telemetry for a successful generation. */
export function buildTelemetry(
  request: GenerationRequest,
  result: Pick<GenerationResult, "latencyMs" | "status" | "error" | "retryCount">
): GenerationTelemetry {
  return {
    generationId:         request.generationId,
    provider:             request.capability.id,
    model:                request.capability.providerVersion.value,
    promptLength:         request.providerPrompt.body.estimatedPromptLength,
    negativePromptLength: request.providerPrompt.body.negativePrompt?.length ?? 0,
    aspectRatio:          request.aspectRatio,
    outputFormat:         request.outputFormat,
    quality:              request.quality ?? "default",
    latencyMs:            result.latencyMs,
    success:              result.status === "success",
    failureReason:        result.error,
    retryCount:           result.retryCount,
    hasReferenceImages:   (request.referenceImages?.length ?? 0) > 0,
    userId:               request.userId,
    creativeProjectId:    request.creativeProjectId,
    generatedAt:          new Date().toISOString(),
  };
}
