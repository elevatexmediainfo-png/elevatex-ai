import type { PromptSpecification } from "../prompt-spec/types";
import type { OptimizedPromptSpecification } from "./types";
import { buildSectionPriority }        from "./builders/priority";
import { buildCompressedSpec }         from "./builders/compression";
import { buildDuplicateReport }        from "./builders/duplicates";
import { buildConflictReport }         from "./builders/conflicts";
import { buildBudgetAllocation }       from "./builders/budget";
import { buildSectionOrder }           from "./builders/ordering";
import { buildVisualImportanceMap }    from "./builders/visual-scoring";
import { buildMergedNegatives }        from "./builders/negative-opt";
import { buildOptimizedRendering }     from "./builders/rendering-opt";
import { buildQualityScores }          from "./builders/quality-score";
import {
  OPTIMIZATION_VERSION,
  OPTIMIZER_SCHEMA_VERSION,
  generateOptimizationId,
} from "./versioning";

// Phase 12 — AI Prompt Optimization Engine.
// Single responsibility: take a PromptSpecification and produce an
// OptimizedPromptSpecification with priorities, conflicts, budgets,
// visual scores, merged negatives, and quality scores.
//
// STRICT RULES:
//   ✗ Never generates provider prompts
//   ✗ Never calls any LLM or provider API
//   ✗ Never modifies the user's marketing intent
//   ✗ Never produces provider-specific parameters
//   ✓ Only analyzes and optimizes the structured specification

export function optimizePromptSpecification(spec: PromptSpecification): OptimizedPromptSpecification {
  // 1. Priority Engine
  const priority = buildSectionPriority(spec);

  // 2. Semantic Compression → produces the optimized spec
  const { compressed: optimizedSpec, fieldsCompressed } = buildCompressedSpec(spec);

  // 3. Duplicate Detection (on compressed spec)
  const duplicates = buildDuplicateReport(optimizedSpec);

  // 4. Conflict Detection
  const conflicts = buildConflictReport(optimizedSpec);

  // 5. Budget Allocation
  const budget = buildBudgetAllocation(priority);

  // 6. Section Ordering
  const sectionOrder = buildSectionOrder(optimizedSpec, priority);

  // 7. Visual Importance Scoring
  const visualScores = buildVisualImportanceMap(optimizedSpec);

  // 8. Marketing Optimization (report only — no spec mutation beyond compression)
  // Marketing report is internal; quality scoring incorporates it

  // 9. Merged Negatives
  const mergedNegatives = buildMergedNegatives(optimizedSpec);

  // 10. Rendering Optimization
  const optimizedRendering = buildOptimizedRendering(optimizedSpec);

  // 11. Quality Scores
  const totalFields = Object.values(optimizedSpec).reduce((sum, section) => {
    if (section && typeof section === "object" && !Array.isArray(section)) {
      return sum + Object.values(section).filter(v => v && typeof v === "object" && "value" in v).length;
    }
    return sum;
  }, 0);

  const quality = buildQualityScores(
    fieldsCompressed,
    totalFields,
    duplicates,
    conflicts,
    visualScores,
    optimizedSpec.unknownFields.length
  );

  const meta = {
    optimizationId:    generateOptimizationId(),
    createdAt:         new Date().toISOString(),
    schemaVersion:     OPTIMIZER_SCHEMA_VERSION,
    sourceSpecId:      spec.meta.specId,
    optimizationVersion: OPTIMIZATION_VERSION,
    fieldsCompressed,
    duplicatesRemoved: duplicates.totalFound,
    conflictsFound:    conflicts.totalFound,
  };

  return {
    meta,
    optimizedSpec,
    priority,
    sectionOrder,
    duplicates,
    conflicts,
    budget,
    visualScores,
    mergedNegatives,
    optimizedRendering,
    quality,
    unknownFields: optimizedSpec.unknownFields,
  };
}
