import type { PromptSpecification } from "../prompt-spec/types";
import type { CompiledPrompt } from "./types";

// Phase 10.6C — Runtime Integration.
//
// Applies compileToVisualLanguage()'s field-level verdicts back onto a
// PromptSpecification's own StrategyField values, so every downstream
// consumer (Prompt Optimizer, every Provider Translator) reads compiled text
// through the EXACT SAME field it already reads today — no call site
// anywhere downstream needs to know the compiler ran, and nothing in
// prompt-optimizer/ or provider-translator/ is modified.
//
// Category A/B fields (compiledValue present, per ClassifiedField's own
// contract: "Present only for A/B fields that survive into the compiled
// output") are overwritten with the compiler's cleaner text.
//
// Category C (business-only, "removed entirely from the compiled output")
// and D (near-duplicate of an earlier field) are overwritten with the literal
// string "unknown" — not left raw. This is deliberately NOT a no-op: every
// field-reading helper across every Provider Translator (shared/section-
// builders.ts's `val()`, Flux/SDXL's `tag()`) already treats "unknown" as
// "no signal — omit this field", the same universal sentinel every builder in
// this pipeline produces when it has nothing to say. Blanking C/D fields to
// that exact sentinel is therefore safe by construction — it can only ever
// trigger a code path each translator already exercises for a field with no
// signal, never a new one — while finally acting on the compiler's own
// classification instead of only pretending to for A/B fields.
//
// Category E (internal metadata — confidence scores, validation criteria)
// and any field the compiler didn't classify at all are left untouched: E is
// about what the compiler's OWN narrative excludes, not a verdict on the
// field's usefulness to other consumers.

const SECTION_KEYS = [
  "mission", "hero", "supporting", "composition", "camera", "lighting",
  "environment", "marketing", "typography", "brandRules", "negativeConstraints", "rendering",
] as const;

export function applyCompiledPrompt(spec: PromptSpecification, compiled: CompiledPrompt): PromptSpecification {
  const overrides = new Map<string, string>();
  for (const f of compiled.fields) {
    if (f.compiledValue !== undefined) {
      overrides.set(f.path, f.compiledValue);
    } else if (f.classification === "C" || f.classification === "D") {
      overrides.set(f.path, "unknown");
    }
  }
  if (overrides.size === 0) return spec;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applySection(section: any, sectionKey: string): any {
    const result = { ...section };
    for (const [key, field] of Object.entries(result)) {
      if (!field || typeof field !== "object" || !("value" in field)) continue;
      const override = overrides.get(`${sectionKey}.${key}`);
      if (override !== undefined) result[key] = { ...(field as object), value: override };
    }
    return result;
  }

  const result = { ...spec } as unknown as Record<string, unknown>;
  for (const key of SECTION_KEYS) {
    result[key] = applySection((spec as unknown as Record<string, unknown>)[key], key);
  }
  return result as unknown as PromptSpecification;
}
