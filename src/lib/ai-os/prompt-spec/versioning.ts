// Phase 11 — Prompt Specification versioning.
// Provider Translators check PROMPT_SPEC_VERSION before reading a specification
// to ensure the schema they're built against hasn't changed.

export const PROMPT_SPEC_VERSION = "1.0.0";

export function generateSpecId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `spec_${ts}_${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

import type { PromptSpecification } from "./types";
import type { StrategyField, FieldConfidence } from "../types";

function flattenSpecFields(obj: Record<string, unknown>, prefix = ""): Record<string, StrategyField> {
  const result: Record<string, StrategyField> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "value" in v && "confidence" in v && "reasoning" in v) {
      result[key] = v as StrategyField;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenSpecFields(v as Record<string, unknown>, key));
    }
  }
  return result;
}

export function computeSpecConfidenceScore(spec: Omit<PromptSpecification, "meta" | "unknownFields">): number {
  const weights: Record<FieldConfidence, number> = { high: 1, medium: 0.6, low: 0.3, unknown: 0 };
  const fields = Object.values(flattenSpecFields(spec as unknown as Record<string, unknown>));
  if (!fields.length) return 0;
  const total = fields.reduce((sum, f) => sum + weights[f.confidence], 0);
  return Math.round((total / fields.length) * 100);
}

export function collectSpecUnknownFields(spec: Omit<PromptSpecification, "meta" | "unknownFields">): string[] {
  return Object.entries(flattenSpecFields(spec as unknown as Record<string, unknown>))
    .filter(([, f]) => f.value === "unknown" || f.confidence === "unknown")
    .map(([k]) => k);
}

export function generateSpecWarnings(spec: Omit<PromptSpecification, "meta" | "unknownFields">): string[] {
  const warnings: string[] = [];
  if (spec.mission.whatToGenerate.value === "unknown") warnings.push("mission.whatToGenerate is unknown — generation mission not defined");
  if (spec.hero.heroSubject.value === "unknown") warnings.push("hero.heroSubject is unknown — hero is not defined, generation will be generic");
  if (spec.rendering.photorealismLevel.value === "unknown") warnings.push("rendering.photorealismLevel is unknown — image quality will default to provider standard");
  if (spec.negativeConstraints.forbiddenSceneElements.value === "unknown") warnings.push("negativeConstraints.forbiddenSceneElements is unknown — no explicit exclusions set");
  if (spec.typography.reservedLogoArea.value === "unknown") warnings.push("typography.reservedLogoArea is unknown — logo placement zone not reserved");
  return warnings;
}

export function determineSpecValidation(
  score: number,
  warnings: string[]
): PromptSpecification["meta"]["validationStatus"] {
  if (score < 40) return "incomplete";
  if (warnings.length > 0) return "ready_with_warnings";
  return "ready";
}
