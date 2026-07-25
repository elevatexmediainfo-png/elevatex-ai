import type { ProviderCapability, ProviderCapabilityId, CapabilityValidationResult, CapabilityValidationIssue } from "./types";
import type { ProviderPrompt } from "../provider-translator/types";

// Phase 14 — Capability Validation.
// Validates a ProviderPrompt against a provider's capability definition.
// Detects: prompt too long, unsupported features, invalid combinations, etc.

function issue(
  severity: CapabilityValidationIssue["severity"],
  code: string,
  field: string,
  requested: string,
  supported: string,
  message: string,
  resolution: string
): CapabilityValidationIssue {
  return { severity, code, field, requested, supported, message, resolution };
}

/** Validates a ProviderPrompt against the provider's capability definition. */
export function validateProviderPrompt(
  prompt: ProviderPrompt,
  capability: ProviderCapability
): CapabilityValidationResult {
  const issues: CapabilityValidationIssue[] = [];
  const provider = capability.id;

  // 1. Prompt length check
  const promptLength = prompt.body.estimatedPromptLength;
  const maxLength = capability.maximumPromptLength.value;
  if (promptLength > maxLength) {
    issues.push(issue(
      "error", "PROMPT_TOO_LONG", "maximumPromptLength",
      `${promptLength} chars`,
      `max ${maxLength} chars`,
      `Prompt is ${promptLength} characters but ${provider} supports maximum ${maxLength} characters`,
      `Reduce prompt length or switch to a provider with a higher limit (e.g., OpenAI supports 32000 chars)`
    ));
  }

  // 2. Negative prompt support
  if (prompt.body.negativePrompt && prompt.body.negativePrompt.length > 0) {
    if (!capability.negativePromptSupport.value) {
      issues.push(issue(
        "warning", "NEGATIVE_PROMPT_NOT_SUPPORTED", "negativePromptSupport",
        "negative prompt provided",
        "not supported by this provider",
        `${provider} does not support a separate negative prompt — the negative content will be ignored`,
        `Use a provider that supports negative prompts (Flux, SDXL, Kling) or fold negatives into the positive prompt`
      ));
    } else {
      const maxNeg = capability.maximumNegativePromptLength.value;
      if (maxNeg > 0 && prompt.body.negativePrompt.length > maxNeg) {
        issues.push(issue(
          "error", "NEGATIVE_PROMPT_TOO_LONG", "maximumNegativePromptLength",
          `${prompt.body.negativePrompt.length} chars`,
          `max ${maxNeg} chars`,
          `Negative prompt is too long for ${provider}`,
          `Shorten the negative prompt to ${maxNeg} characters or fewer`
        ));
      }
    }
  }

  // 3. Typography quality warning
  const typoQuality = capability.typographyQuality.value;
  if (typoQuality < 5) {
    const promptContainsTextHint = prompt.body.finalPrompt.toLowerCase().includes("headline") ||
      prompt.body.finalPrompt.toLowerCase().includes("text zone") ||
      prompt.body.finalPrompt.toLowerCase().includes("cta");
    if (promptContainsTextHint) {
      issues.push(issue(
        "warning", "POOR_TYPOGRAPHY_QUALITY", "typographyQuality",
        `typography in image requested`,
        `quality score ${typoQuality}/10`,
        `${provider} has low typography quality (${typoQuality}/10) — text rendered in image may be illegible or distorted`,
        `Use Ideogram (score: 10/10) or OpenAI (score: 9/10) for images requiring readable text`
      ));
    }
  }

  // 4. Video provider receiving image spec
  if (capability.category === "video" && prompt.body.formatStyle !== "temporal") {
    issues.push(issue(
      "warning", "WRONG_FORMAT_FOR_VIDEO_PROVIDER", "category",
      `format: ${prompt.body.formatStyle}`,
      `format: temporal`,
      `${provider} is a video provider but the prompt is in "${prompt.body.formatStyle}" format — video providers expect temporal narrative prompts`,
      `Use the temporal format translator for video providers`
    ));
  }

  // 5. Image provider receiving temporal spec
  if (capability.category === "image" && prompt.body.formatStyle === "temporal") {
    issues.push(issue(
      "info", "TEMPORAL_FORMAT_FOR_IMAGE_PROVIDER", "category",
      `format: temporal`,
      `format: prose or tags`,
      `${provider} is an image provider but the prompt is in temporal format`,
      `Use prose or tags format for image providers`
    ));
  }

  const errorCount      = issues.filter(i => i.severity === "error").length;
  const warningCount    = issues.filter(i => i.severity === "warning").length;
  const infoCount       = issues.filter(i => i.severity === "info").length;
  const isCompatible    = errorCount === 0;

  return { provider, isCompatible, issues, errorCount, warningCount, infoCount };
}

/** Validates a specific aspect ratio against a provider's supported list. */
export function validateAspectRatio(
  ratio: string,
  capability: ProviderCapability
): CapabilityValidationResult {
  const supported = capability.supportedAspectRatios.value;
  const isSupported = supported.some(r => r.includes(ratio) || r === "custom_via_width_height");
  const issues: CapabilityValidationIssue[] = [];

  if (!isSupported) {
    issues.push(issue(
      "error", "UNSUPPORTED_ASPECT_RATIO", "supportedAspectRatios",
      ratio, supported.join(", "),
      `Aspect ratio "${ratio}" is not supported by ${capability.id}`,
      `Use one of: ${supported.join(", ")}`
    ));
  }

  return {
    provider:     capability.id,
    isCompatible: issues.length === 0,
    issues,
    errorCount:   issues.filter(i => i.severity === "error").length,
    warningCount: 0,
    infoCount:    0,
  };
}

/** Validates an output format against a provider's supported list. */
export function validateOutputFormat(
  format: string,
  capability: ProviderCapability
): CapabilityValidationResult {
  const supported = capability.outputFormats.value;
  const isSupported = supported.includes(format.toLowerCase());
  const issues: CapabilityValidationIssue[] = [];

  if (!isSupported) {
    issues.push(issue(
      "error", "UNSUPPORTED_OUTPUT_FORMAT", "outputFormats",
      format, supported.join(", "),
      `Output format "${format}" is not supported by ${capability.id}`,
      `Use one of: ${supported.join(", ")}`
    ));
  }

  return {
    provider: capability.id,
    isCompatible: issues.length === 0,
    issues,
    errorCount:   issues.filter(i => i.severity === "error").length,
    warningCount: 0,
    infoCount:    0,
  };
}

/** Returns the best provider for a specific rendering quality requirement. */
export function getBestProviderForUseCase(
  useCase: "typography" | "human" | "product" | "medical" | "architecture" | "food" | "luxury",
  capabilities: Record<ProviderCapabilityId, ProviderCapability>
): ProviderCapabilityId {
  const fieldMap: Record<string, keyof ProviderCapability> = {
    typography:   "typographyQuality",
    human:        "humanRenderingQuality",
    product:      "productRenderingQuality",
    medical:      "medicalRenderingQuality",
    architecture: "architectureRenderingQuality",
    food:         "foodRenderingQuality",
    luxury:       "luxuryAdvertisementQuality",
  };
  const field = fieldMap[useCase];
  if (!field) return "openai";

  let best: ProviderCapabilityId = "openai";
  let bestScore = 0;
  for (const [id, cap] of Object.entries(capabilities)) {
    const capField = cap[field] as { value: number };
    const score = typeof capField?.value === "number" ? capField.value : 0;
    if (score > bestScore) {
      bestScore = score;
      best = id as ProviderCapabilityId;
    }
  }
  return best;
}
