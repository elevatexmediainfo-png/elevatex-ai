import type { StrategyField, FieldConfidence } from "../../types";

// Shared helpers for all Creative Director builders.
// This file contains ONLY utility constructors — no reasoning logic.

export function cf<T extends string = string>(
  value: T | "unknown",
  confidence: FieldConfidence,
  reasoning: string
): StrategyField<T> {
  return { value, confidence, reasoning } as StrategyField<T>;
}

export function unknownCf(fieldName: string): StrategyField {
  return { value: "unknown", confidence: "unknown", reasoning: `No signal found for "${fieldName}"` };
}

export function fromStrategy<T extends string = string>(
  strategyField: { value: string | "unknown"; confidence: FieldConfidence; reasoning?: string },
  fallback: T,
  reasoning: string
): StrategyField<T> {
  if (strategyField.value !== "unknown") {
    return cf<T>(strategyField.value as T, strategyField.confidence, `${reasoning} — directly from CreativeStrategy`);
  }
  return cf<T>(fallback, "low", `${reasoning} — using fallback "${fallback}"`);
}
