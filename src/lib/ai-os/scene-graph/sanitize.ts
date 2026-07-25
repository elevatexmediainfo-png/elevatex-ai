// Phase 10.6B — Input hygiene for inherited free-text fields.
//
// Real pipeline runs surfaced a concrete failure: VisualScenePlan free-text
// fields (e.g. supportingSubjects.supportingSubjects) can occasionally carry
// raw commercial-composition/layout copy instead of a physical description —
// "ADVERTISEMENT LAYERS: A horizontal strip of 3-4 key benefits... Benefit 1:
// Quality | Benefit 2: Value" is not something a camera could ever record,
// and passing it through verbatim would put layout instructions inside a
// document whose entire purpose is "Scene Graph owns the photograph."
//
// This is deliberately NOT a re-implementation of prompt-compiler/
// banned-language.ts's business-term scrubber: importing downstream of this
// module's own position in the pipeline (Scene Graph Compiler runs BEFORE
// Prompt Visual Compiler) would invert the dependency direction and risk a
// cycle once a future phase wires the two together (see README's Migration
// guide). Every pipeline stage defends its own inputs independently — this
// is a narrow, local guard against the one failure mode observed, not a
// general-purpose banned-word list.

const LAYOUT_OR_COPY_MARKER =
  /\b[A-Z]{2,}(?:\s+[A-Z]{2,}){1,4}\s*:|Benefit\s*\d+\s*:|Testimonial element|headline|logo placement|call[- ]to[- ]action\b/;

/** True when text reads as layout/advertisement/copy instructions rather than a physical scene description. */
export function looksLikeLayoutOrCopyInstruction(text: string): boolean {
  return LAYOUT_OR_COPY_MARKER.test(text);
}

/**
 * Returns the value when it's safe to inherit verbatim, or undefined when it
 * should be treated as if no upstream signal existed (triggering the
 * caller's own vocabulary fallback instead).
 */
export function safeInheritedText(value: string): string | undefined {
  if (value === "unknown" || value.trim().length === 0) return undefined;
  if (looksLikeLayoutOrCopyInstruction(value)) return undefined;
  return value;
}
