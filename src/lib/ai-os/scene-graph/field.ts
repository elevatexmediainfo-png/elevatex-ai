import type { StrategyField, FieldConfidence } from "../types";

// Phase 10.6B — StrategyField constructor, matching the exact convention
// already established per-module across the pipeline (scene-planner's sp(),
// prompt-spec's psf()): same shared {value, confidence, reasoning} shape,
// each module keeps its own colocated constructor rather than importing a
// sibling module's.

export function sg<T extends string = string>(
  value: T | "unknown",
  confidence: FieldConfidence,
  reasoning: string
): StrategyField<T> {
  return { value, confidence, reasoning } as StrategyField<T>;
}

export function unknownSg(fieldName: string): StrategyField {
  return { value: "unknown", confidence: "unknown", reasoning: `No signal found for "${fieldName}"` };
}
