import type { PromptSpecification } from "../../prompt-spec/types";
import type { MergedNegatives } from "../types";

// Builder 9 — Negative Constraint Optimization
// Merges all four negative constraint categories into a single optimized,
// deduplicated, priority-ordered list.
//
// Order: AI artifacts first (hardest technical issue), then quality anti-patterns,
// then scene forbidden elements, then brand anti-patterns.

export function buildMergedNegatives(spec: PromptSpecification): MergedNegatives {
  const nc = spec.negativeConstraints;

  const rawItems: string[] = [];

  function addItems(value: string) {
    if (!value || value === "unknown") return;
    // Split on comma, semicolon, or period-space
    const items = value.split(/[,;]|(?<=\w)\.\s+/).map(s => s.trim()).filter(s => s.length > 5);
    rawItems.push(...items);
  }

  // Order: AI artifacts (highest technical priority), quality, scene, brand
  addItems(nc.forbiddenAiArtifacts.value);
  addItems(nc.qualityAntiPatterns.value);
  addItems(nc.forbiddenSceneElements.value);
  addItems(nc.brandAntiPatterns.value);

  const beforeCount = rawItems.length;

  // Deduplicate: exact match + partial overlap check
  const deduped: string[] = [];
  for (const item of rawItems) {
    const normalized = item.toLowerCase().trim();
    const isDuplicate = deduped.some(existing => {
      const e = existing.toLowerCase();
      // Exact match or one is a sub-phrase of the other
      return e === normalized || e.includes(normalized.slice(0, 20)) || normalized.includes(e.slice(0, 20));
    });
    if (!isDuplicate && normalized.length > 5) {
      deduped.push(item);
    }
  }

  // Consolidate into a single string with comma separation
  const consolidated = deduped.join(", ");

  return {
    consolidated,
    itemsBeforeMerge: beforeCount,
    itemsAfterMerge: deduped.length,
  };
}
