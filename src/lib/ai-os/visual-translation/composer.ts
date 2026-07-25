import type { VisualPrimitive } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Composer — assembles a set of primitives into a single natural-language
// visual directive, ordered by primitive type for readability.
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ORDER: Record<string, number> = {
  person: 0,
  action: 1,
  object: 2,
  composition: 3,
  lighting: 4,
  material: 5,
  spatial: 6,
  color: 7,
};

function primitiveOrder(p: VisualPrimitive): number {
  return TYPE_ORDER[p.type] ?? 99;
}

/**
 * Joins a set of visual primitives into a single prose directive.
 * Primitives are ordered by type so image models encounter people and
 * actions before environment details.
 */
export function composePrimitives(primitives: readonly VisualPrimitive[]): string {
  if (primitives.length === 0) return "";

  const sorted = [...primitives].sort((a, b) => {
    const orderDiff = primitiveOrder(a) - primitiveOrder(b);
    if (orderDiff !== 0) return orderDiff;
    return b.weight - a.weight; // higher weight first within same type
  });

  return sorted.map((p) => p.value).join(" ");
}

/**
 * Deduplicates a list of primitives by tag overlap.
 * Two primitives are considered duplicates when they share ≥2 tags.
 * The one with the higher weight is kept.
 */
export function deduplicatePrimitives(
  primitives: readonly VisualPrimitive[],
): VisualPrimitive[] {
  const kept: VisualPrimitive[] = [];

  for (const candidate of primitives) {
    const isDuplicate = kept.some((existing) => {
      const sharedTags = candidate.tags.filter((t) => existing.tags.includes(t));
      return sharedTags.length >= 2;
    });

    if (!isDuplicate) {
      kept.push(candidate);
    }
  }

  return kept;
}

/**
 * Filters out primitives whose value contains any of the existing phrases
 * passed in the context. Handles the case where a concept's visual instruction
 * would duplicate something already written elsewhere in the prompt.
 */
export function filterAgainstContext(
  primitives: readonly VisualPrimitive[],
  existingPhrases: readonly string[],
): VisualPrimitive[] {
  if (existingPhrases.length === 0) return [...primitives];

  const normalised = existingPhrases.map((p) => p.toLowerCase());

  return primitives.filter((primitive) => {
    const val = primitive.value.toLowerCase();
    return !normalised.some((phrase) => val.includes(phrase) || phrase.includes(val));
  });
}
