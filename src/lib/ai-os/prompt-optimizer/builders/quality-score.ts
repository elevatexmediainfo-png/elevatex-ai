import type { DuplicateReport, ConflictReport, VisualImportanceMap, QualityScores } from "../types";
import { clamp100 } from "./shared";

// Builder 11 — Quality Score
// Computes the 5 quality dimensions from all previous builder outputs.

export function buildQualityScores(
  fieldsCompressed: number,
  totalFields: number,
  duplicates: DuplicateReport,
  conflicts: ConflictReport,
  visualScores: VisualImportanceMap,
  unknownFieldCount: number
): QualityScores {
  // Optimization Score — how much was improved
  // High compression + deduplication = good optimization
  const compressionRatio = totalFields > 0 ? fieldsCompressed / totalFields : 0;
  const dupRatio = duplicates.totalFound / Math.max(1, totalFields * 0.2);
  const optimizationScore = clamp100(100 - unknownFieldCount * 3 - dupRatio * 10 + compressionRatio * 20);

  // Conflict Score — 100 = clean, deduct per conflict
  const conflictScore = clamp100(
    100 - conflicts.criticalCount * 20 - conflicts.warningCount * 8 - conflicts.suggestionCount * 3
  );

  // Redundancy Score — 100 = no duplicates
  const redundancyScore = clamp100(100 - duplicates.totalFound * 8);

  // Readability Score — how clear is the specification
  const hierarchyClarity = visualScores.hierarchyClarity;
  const readabilityScore = clamp100(
    (hierarchyClarity * 0.5) +
    (unknownFieldCount < 5 ? 30 : unknownFieldCount < 10 ? 20 : 10) +
    (conflicts.criticalCount === 0 ? 20 : conflicts.criticalCount < 2 ? 10 : 0)
  );

  // Prompt Readiness Score — weighted average, conflict-adjusted
  const baseReadiness = (optimizationScore * 0.25 + redundancyScore * 0.2 + readabilityScore * 0.3 + conflictScore * 0.25);
  const promptReadinessScore = clamp100(
    baseReadiness - (conflicts.criticalCount > 0 ? 15 : 0)
  );

  const scoreReasoning = [
    `Optimization: ${optimizationScore}/100 (${fieldsCompressed} fields compressed, ${unknownFieldCount} unknowns remaining)`,
    `Conflicts: ${conflictScore}/100 (${conflicts.criticalCount} critical, ${conflicts.warningCount} warnings)`,
    `Redundancy: ${redundancyScore}/100 (${duplicates.totalFound} duplicates detected)`,
    `Readability: ${readabilityScore}/100 (visual hierarchy clarity: ${hierarchyClarity}/100)`,
    `Prompt Readiness: ${promptReadinessScore}/100 — ${promptReadinessScore >= 80 ? "READY for Provider Translator" : promptReadinessScore >= 60 ? "USABLE but review warnings" : "NEEDS IMPROVEMENT before generation"}`,
  ].join(". ");

  return { optimizationScore, conflictScore, redundancyScore, readabilityScore, promptReadinessScore, scoreReasoning };
}
