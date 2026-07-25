import type { StrategyField, FieldConfidence } from "../../types";

export function psf<T extends string = string>(
  value: T | "unknown",
  confidence: FieldConfidence,
  reasoning: string
): StrategyField<T> {
  return { value, confidence, reasoning } as StrategyField<T>;
}

export function unknownPsf(fieldName: string): StrategyField {
  return { value: "unknown", confidence: "unknown", reasoning: `No signal found for "${fieldName}"` };
}

/** Promotes a StrategyField from a source module, converting its reasoning to the Spec context. */
export function promoteField<T extends string = string>(
  source: { value: T | "unknown"; confidence: FieldConfidence; reasoning?: string },
  contextLabel: string
): StrategyField<T> {
  if (source.value === "unknown") return unknownPsf(contextLabel) as StrategyField<T>;
  return psf<T>(source.value, source.confidence, `[${contextLabel}] ${source.reasoning ?? "from source module"}`);
}

// Phase 10.6C — Scene Graph Compiler integration.
// A Scene Graph field counts as a real, usable signal only when it isn't
// "unknown" (no signal found) or "not_applicable" (a confident, deliberate
// absence — e.g. no vehicle in a dental clinic scene). Both are legitimate
// SceneGraph states but neither should ever be spliced into prose text.
export function sceneGraphUsable(field: { value: string } | undefined): field is { value: string } {
  return !!field && field.value !== "unknown" && field.value !== "not_applicable";
}

/** Joins usable Scene Graph field values, capitalising nothing — callers own final casing/punctuation. */
export function sceneGraphJoin(fields: ReadonlyArray<{ value: string } | undefined>): string[] {
  return fields.filter(sceneGraphUsable).map((f) => f.value);
}
