import type { ImageCriticInput } from "./types";

// Phase 16 — Image Critic input validation.
// Validates the ImageCriticInput before evaluation begins.

export interface ImageCriticValidationResult {
  isValid:   boolean;
  errors:    string[];
  warnings:  string[];
}

export function validateImageCriticInput(input: ImageCriticInput): ImageCriticValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  // 1. Image URL must be present
  if (!input.imageUrl || input.imageUrl.trim().length === 0) {
    errors.push("IMAGE_MISSING: imageUrl is required to evaluate the generated image");
  }

  // 2. Blueprint must be present and have a blueprintId
  if (!input.blueprint) {
    errors.push("BLUEPRINT_MISSING: UniversalCampaignBlueprint is required for spec-based evaluation");
  } else if (!input.blueprint.meta?.blueprintId) {
    warnings.push("BLUEPRINT_NO_ID: Blueprint has no blueprintId — evaluation confidence may be lower");
  }

  // 3. Scene plan must be present
  if (!input.scenePlan) {
    errors.push("SCENE_PLAN_MISSING: VisualScenePlan is required for hero and composition evaluation");
  }

  // 4. Prompt spec must be present
  if (!input.promptSpec) {
    errors.push("PROMPT_SPEC_MISSING: PromptSpecification is required for composition and typography evaluation");
  }

  // 5. Generation result must be present
  if (!input.generationResult) {
    errors.push("GENERATION_RESULT_MISSING: GenerationResult is required for metadata-based evaluation");
  } else {
    if (input.generationResult.status !== "success") {
      warnings.push(`GENERATION_NOT_SUCCESSFUL: GenerationResult status is "${input.generationResult.status}" — evaluation may be unreliable`);
    }
    if (!input.generationResult.quality) {
      warnings.push("GENERATION_NO_QUALITY_META: GenerationResult has no quality metadata — some scores will be estimated");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
