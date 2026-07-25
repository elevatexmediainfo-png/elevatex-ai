import type { GenerationRequest } from "./types";
import type { CapabilityValidationResult, CapabilityValidationIssue } from "../provider-capabilities/types";
import { validateProviderPrompt } from "../provider-capabilities/validation";
import { checkAspectRatio, checkOutputFormat } from "../provider-capabilities/engine";

// Phase 15 — Pre-generation validation.
// Validates all aspects of a GenerationRequest before any API call is made.
// This is the LAST validation gate — upstream modules have already optimized and translated.

export interface PreGenerationValidation {
  isValid:       boolean;
  errors:        string[];
  warnings:      string[];
  capabilityResult: CapabilityValidationResult;
}

export function validateGenerationRequest(request: GenerationRequest): PreGenerationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Provider prompt validation against capability
  const capResult = validateProviderPrompt(request.providerPrompt, request.capability);
  capResult.issues.forEach((issue: CapabilityValidationIssue) => {
    if (issue.severity === "error")   errors.push(`${issue.code}: ${issue.message}`);
    if (issue.severity === "warning") warnings.push(`${issue.code}: ${issue.message}`);
  });

  // 2. Aspect ratio validation
  const ratioResult = checkAspectRatio(request.aspectRatio, request.capability.id);
  if (!ratioResult.isCompatible) {
    ratioResult.issues.forEach((issue: CapabilityValidationIssue) => errors.push(`${issue.code}: ${issue.message}`));
  }

  // 3. Output format validation
  const formatResult = checkOutputFormat(request.outputFormat, request.capability.id);
  if (!formatResult.isCompatible) {
    formatResult.issues.forEach(issue => errors.push(`${issue.code}: ${issue.message}`));
  }

  // 4. Quality level validation
  if (request.quality) {
    const supported = request.capability.qualityLevels.value;
    if (supported.length > 0 && !supported.some(q => q.includes(request.quality!))) {
      warnings.push(`Quality "${request.quality}" may not be supported. Supported: ${supported.join(", ")}`);
    }
  }

  // 5. Reference image validation
  if (request.referenceImages && request.referenceImages.length > 0) {
    if (!request.capability.referenceImageSupport.value) {
      errors.push(`REFERENCE_IMAGE_NOT_SUPPORTED: ${request.capability.id} does not support reference images`);
    } else {
      const maxRefs = request.capability.maximumReferenceImages.value;
      if (request.referenceImages.length > maxRefs) {
        errors.push(`TOO_MANY_REFERENCE_IMAGES: ${request.capability.id} supports maximum ${maxRefs} reference images (${request.referenceImages.length} provided)`);
      }
    }
  }

  // 6. Video provider with image output format
  if (request.capability.category === "video" && request.outputFormat !== "mp4") {
    errors.push(`INVALID_OUTPUT_FORMAT_FOR_VIDEO: Video providers require mp4 output format`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    capabilityResult: capResult,
  };
}
