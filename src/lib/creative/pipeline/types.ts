import type { CreativeBrief } from "../brief/types";
import type { Storyboard } from "../storyboard/types";
import type { SceneBible } from "../scene-bible/types";
import type { CompiledCreativePlan } from "../compiler/types";
import type { ValidationResult } from "../validation/types";

// Integration layer, Phase A (2026-07-28) — runs Creative Brief ->
// Storyboard -> Scene Bible -> Creative Compiler -> Validator in order and
// returns everything each layer produced. Ends at the compiled render
// prompt; never touches a rendering provider (that's Phase B, kept
// completely isolated from this layer).

export interface CreativePipelineResult {
  creativeBrief: CreativeBrief;
  storyboard: Storyboard;
  sceneBible: SceneBible;
  /** Null when the Validator found any error-severity issue — the pipeline stops before treating a compiled prompt as final, even if compilation itself happened to succeed. */
  compiledPrompt: CompiledCreativePlan | null;
  validationResult: ValidationResult;
}
