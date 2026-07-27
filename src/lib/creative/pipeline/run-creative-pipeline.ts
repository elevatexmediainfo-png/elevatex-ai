import { getCreativeBrief } from "../brief/get-creative-brief";
import { planStoryboard } from "../storyboard/plan-storyboard";
import { planSceneBible } from "../scene-bible/plan-scene-bible";
import { compileCreativePlan } from "../compiler/compile-creative-plan";
import { validateCreativePipeline } from "../validation/validate-creative-pipeline";
import type { CreativePipelineResult } from "./types";

// Phase A Integration (2026-07-28) — executes every layer of the Creative
// pipeline in order and returns their outputs together. Ends at the
// compiled render prompt; never calls a rendering provider (Seedance/Veo/
// Runway/Kling) — that's Phase B, deliberately kept out of this function
// entirely so the rendering layer stays fully isolated from the creative
// pipeline.
//
// Order matches the founder's diagram exactly: Creative Brief -> Storyboard
// -> Scene Bible -> Creative Compiler -> Validator -> Final Prompt. The
// compiled prompt is computed before validation runs (as diagrammed), but
// it is only ever RETURNED when the Validator confirms the whole pipeline
// is sound — "if validation fails, stop the pipeline, do not continue"
// means the compiled prompt is never treated as final/usable once the
// Validator disagrees, even if compilation itself happened to succeed (the
// Validator checks real invariants — e.g. duplicate storyboard scene
// numbers — that compilation alone would not necessarily catch).
//
// A thrown CreativeCompilerError from compileCreativePlan is caught here,
// not re-thrown: the Validator's own "compiler contract" check
// independently re-runs the same compilation and reports exactly why it
// failed as a structured issue, so this function still returns a normal
// result rather than an exception — a validation failure is a first-class,
// reportable outcome of running the pipeline, not a crash. Earlier-stage
// failures (Creative Brief not found, a malformed LLM response from the
// Storyboard/Scene Bible planners) are genuine execution failures, not
// content-validation failures, and are allowed to propagate as real thrown
// errors — there is nothing structured to return yet at that point.
export async function runCreativePipeline(videoProjectId: string): Promise<CreativePipelineResult> {
  const creativeBrief = await getCreativeBrief(videoProjectId);
  const storyboard = await planStoryboard(creativeBrief);
  const sceneBible = await planSceneBible(creativeBrief, storyboard);

  let compiledPrompt: CreativePipelineResult["compiledPrompt"];
  try {
    compiledPrompt = compileCreativePlan({ brief: creativeBrief, storyboard, sceneBible });
  } catch {
    compiledPrompt = null;
  }

  const validationResult = validateCreativePipeline(creativeBrief, storyboard, sceneBible);

  return {
    creativeBrief,
    storyboard,
    sceneBible,
    compiledPrompt: validationResult.valid ? compiledPrompt : null,
    validationResult,
  };
}
