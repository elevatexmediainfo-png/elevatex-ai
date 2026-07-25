import type { StrategyField, FieldConfidence } from "../../types";

export function tf<T extends string = string>(
  value: T | "unknown",
  confidence: FieldConfidence,
  reasoning: string
): StrategyField<T> {
  return { value, confidence, reasoning } as StrategyField<T>;
}

export function unknownTf(fieldName: string): StrategyField {
  return { value: "unknown", confidence: "unknown", reasoning: `No signal found for "${fieldName}"` };
}
