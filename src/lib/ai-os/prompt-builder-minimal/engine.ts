import type { OptimizedPromptSpecification } from "../prompt-optimizer/types";
import type { PromptSpecification } from "../prompt-spec/types";
import type { MinimalPromptResult } from "./types";

// Phase 10.6F — Translator Bypass Experiment.
//
// A deliberately non-editorial alternative to the Provider Translator, used
// only when ENABLE_PROVIDER_TRANSLATOR is off. It reads every StrategyField
// already present on PromptSpecification and joins the non-empty values as
// text. Unlike a Provider Translator it adds no section labels, no reordering
// by "importance", no quality-boosting sentence, no hardcoded negative-prompt
// list, and no per-provider formatting — anything beyond the spec's own field
// values does not appear here.
//
// SECTION_ORDER is PromptSpecification's own declared field order (see
// prompt-spec/types.ts) — not hero-first or any other priority ordering,
// since choosing an order "for impact" would itself be the kind of editorial
// judgment this module exists specifically not to make.
const SECTION_ORDER = [
  "mission", "hero", "supporting", "composition", "camera",
  "lighting", "environment", "marketing", "typography",
  "brandRules", "negativeConstraints", "rendering",
] as const;

interface StrategyFieldLike {
  value: unknown;
  confidence: unknown;
}

function isStrategyFieldLike(v: unknown): v is StrategyFieldLike {
  return !!v && typeof v === "object" && "value" in v && "confidence" in v;
}

function fieldText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "unknown" || trimmed === "not_applicable") return null;
  return trimmed;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function buildMinimalPrompt(optimized: OptimizedPromptSpecification): MinimalPromptResult {
  const spec: PromptSpecification = optimized.optimizedSpec;

  // "Preserve every GPT decision exactly" — when the GPT Creative Director
  // produced a validated narrative, it already IS every GPT decision, woven
  // into one string by gpt-narrative.ts. Reconstructing it field-by-field
  // instead would risk dropping or reordering something GPT decided; using
  // it verbatim is the more literal reading of "exactly".
  const narrative = spec.gptNarrative;
  if (narrative && narrative.quality.status !== "failed" && narrative.narrativePrompt.trim() !== "") {
    const finalPrompt = narrative.narrativePrompt.trim();
    return {
      finalPrompt,
      fieldsIncluded: narrative.fieldsConsumed,
      fieldsSkipped: narrative.fieldsMissing,
      usedGptNarrative: true,
      estimatedPromptLength: finalPrompt.length,
      estimatedTokenCount: estimateTokens(finalPrompt),
    };
  }

  const parts: string[] = [];
  const fieldsIncluded: string[] = [];
  const fieldsSkipped: string[] = [];

  for (const sectionKey of SECTION_ORDER) {
    const section = (spec as unknown as Record<string, unknown>)[sectionKey];
    if (!section || typeof section !== "object") continue;

    for (const [fieldKey, fieldValue] of Object.entries(section as Record<string, unknown>)) {
      if (!isStrategyFieldLike(fieldValue)) continue;
      const path = `${sectionKey}.${fieldKey}`;
      const text = fieldText(fieldValue.value);
      if (text) {
        parts.push(text);
        fieldsIncluded.push(path);
      } else {
        fieldsSkipped.push(path);
      }
    }
  }

  const finalPrompt = parts.join(". ").trim();
  return {
    finalPrompt,
    fieldsIncluded,
    fieldsSkipped,
    usedGptNarrative: false,
    estimatedPromptLength: finalPrompt.length,
    estimatedTokenCount: estimateTokens(finalPrompt),
  };
}
