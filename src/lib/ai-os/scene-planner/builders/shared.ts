import type { StrategyField, FieldConfidence } from "../../types";

export function sp<T extends string = string>(
  value: T | "unknown",
  confidence: FieldConfidence,
  reasoning: string
): StrategyField<T> {
  return { value, confidence, reasoning } as StrategyField<T>;
}

export function unknownSp(fieldName: string): StrategyField {
  return { value: "unknown", confidence: "unknown", reasoning: `No signal found for "${fieldName}"` };
}
