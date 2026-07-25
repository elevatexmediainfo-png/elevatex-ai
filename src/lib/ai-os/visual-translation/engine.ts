import type {
  VisualPrimitive,
  VisualTranslationRequest,
  VisualTranslation,
  MultiConceptTranslation,
  TranslationSource,
  IndustryKey,
} from "./types";
import {
  UNIVERSAL_CONCEPTS,
  INDUSTRY_REGISTRY,
} from "./knowledge/index";
import { resolveConcept, resolveIndustry } from "./resolver";
import {
  composePrimitives,
  deduplicatePrimitives,
  filterAgainstContext,
} from "./composer";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a deterministic subset of primitives based on variationIndex.
 * variationIndex=0 → highest-weight items (default).
 * variationIndex=N → rotate by N positions within the sorted list.
 */
function selectVariation(
  primitives: readonly VisualPrimitive[],
  maxCount: number,
  variationIndex: number,
): VisualPrimitive[] {
  const sorted = [...primitives].sort((a, b) => b.weight - a.weight);
  if (variationIndex === 0 || sorted.length <= maxCount) {
    return sorted.slice(0, maxCount);
  }
  // Rotate: shift the starting position by variationIndex, wrap around
  const start = (variationIndex * Math.ceil(maxCount / 2)) % sorted.length;
  const rotated = [...sorted.slice(start), ...sorted.slice(0, start)];
  return rotated.slice(0, maxCount);
}

/**
 * Merges industry-specific and universal primitives.
 * Industry primitives fill their slots first; universal primitives fill the
 * remainder up to maxPrimitives. Deduplication runs after merge.
 */
function mergePrimitives(
  industryPrimitives: readonly VisualPrimitive[],
  universalPrimitives: readonly VisualPrimitive[],
  maxPrimitives: number,
  variationIndex: number,
): VisualPrimitive[] {
  const industrySlots = Math.min(industryPrimitives.length, Math.ceil(maxPrimitives * 0.6));
  const universalSlots = maxPrimitives - industrySlots;

  const selectedIndustry = selectVariation(industryPrimitives, industrySlots, variationIndex);
  const selectedUniversal = selectVariation(universalPrimitives, universalSlots, variationIndex);

  const combined = [...selectedIndustry, ...selectedUniversal];
  const deduped = deduplicatePrimitives(combined);
  return deduped.slice(0, maxPrimitives);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core translation function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translates a single abstract concept into concrete visual primitives.
 *
 * Flow:
 *   1. Normalise concept (alias resolution)
 *   2. Normalise industry (alias + token resolution)
 *   3. Retrieve industry-specific primitives (if available)
 *   4. Retrieve universal primitives (fallback or supplement)
 *   5. Merge with industry-first priority
 *   6. Apply variationIndex rotation
 *   7. Filter against existing context
 *   8. Compose into a single directive
 */
export function translateConcept(request: VisualTranslationRequest): VisualTranslation {
  const maxPrimitives = request.maxPrimitives ?? 5;
  const variationIndex = request.variationIndex ?? 0;
  const existingPhrases = request.context?.existingPrimitives ?? [];

  // Step 1 — resolve concept
  const conceptResolution = resolveConcept(request.concept);
  const conceptKey = conceptResolution.normalized;

  // Step 2 — resolve industry
  const industryResolution = resolveIndustry(request.industry);
  const industryKey = industryResolution.key;

  // Step 3 — retrieve industry-specific primitives
  const industryPrimitives: readonly VisualPrimitive[] =
    industryKey !== "unknown"
      ? (INDUSTRY_REGISTRY[industryKey as IndustryKey]?.concepts[conceptKey] ?? [])
      : [];

  // Step 4 — retrieve universal primitives
  const universalPrimitives: readonly VisualPrimitive[] =
    UNIVERSAL_CONCEPTS[conceptKey] ?? [];

  // Step 5 — determine source and fallback
  const hasIndustrySpecific = industryPrimitives.length > 0;
  const hasUniversal = universalPrimitives.length > 0;
  const fallbackUsed = !hasIndustrySpecific;

  let source: TranslationSource;
  if (!conceptResolution.known) {
    source = "generic_fallback";
  } else if (conceptResolution.aliasUsed) {
    source = "alias_resolved";
  } else if (hasIndustrySpecific) {
    source = "industry_specific";
  } else {
    source = "universal_only";
  }

  // Step 6 — merge and rotate
  let primitives: VisualPrimitive[];
  if (hasIndustrySpecific) {
    primitives = mergePrimitives(industryPrimitives, universalPrimitives, maxPrimitives, variationIndex);
  } else if (hasUniversal) {
    primitives = selectVariation(universalPrimitives, maxPrimitives, variationIndex);
  } else {
    // Unknown concept with no knowledge — return empty with zero confidence
    primitives = [];
  }

  // Step 7 — filter against existing context
  if (existingPhrases.length > 0) {
    primitives = filterAgainstContext(primitives, existingPhrases);
  }

  // Step 8 — compose
  const composedDirective = composePrimitives(primitives);

  // Confidence: 1.0 for exact industry hit, 0.8 for alias, 0.6 for universal-only, 0.3 for generic fallback
  const confidence =
    source === "industry_specific" ? 1.0
    : source === "alias_resolved" ? 0.8
    : source === "universal_only" ? 0.6
    : 0.3;

  return {
    concept: request.concept,
    normalizedConcept: conceptKey,
    industry: industryKey,
    primitives,
    composedDirective,
    confidence,
    fallbackUsed,
    source,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phrase translation — splits a phrase into concept words and translates each
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts to translate every word in a phrase as a concept.
 * Words that don't resolve to a known concept are skipped.
 * Returns the first successful translation, or a generic fallback.
 */
export function translatePhrase(
  phrase: string,
  industry?: string,
  variationIndex = 0,
  maxPrimitives = 5,
): VisualTranslation {
  const words = phrase.trim().toLowerCase().split(/\s+/);

  for (const word of words) {
    const resolution = resolveConcept(word);
    if (resolution.known) {
      return translateConcept({ concept: word, industry, variationIndex, maxPrimitives });
    }
  }

  // Multi-word attempt — try the full phrase as a concept key
  return translateConcept({ concept: phrase, industry, variationIndex, maxPrimitives });
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-concept translation — translates several concepts and merges them
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translates multiple concepts for the same industry and merges the results.
 * Deduplication runs across all merged primitives before final composition.
 */
export function translateAndMerge(
  concepts: readonly string[],
  industry?: string,
  variationIndex = 0,
  maxPrimitivesPerConcept = 3,
): MultiConceptTranslation {
  const industryResolution = resolveIndustry(industry);
  const resolvedIndustry = industryResolution.key;

  const translations = concepts.map((concept) =>
    translateConcept({ concept, industry, variationIndex, maxPrimitives: maxPrimitivesPerConcept }),
  );

  // Collect and deduplicate all primitives from all translations
  const allPrimitives = translations.flatMap((t) => [...t.primitives]);
  const deduped = deduplicatePrimitives(allPrimitives);
  const sorted = [...deduped].sort((a, b) => b.weight - a.weight);

  const composedDirective = composePrimitives(sorted);

  return {
    concepts: [...concepts],
    industry: resolvedIndustry,
    translations,
    mergedPrimitives: sorted,
    composedDirective,
  };
}
