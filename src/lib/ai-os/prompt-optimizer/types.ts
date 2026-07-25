import type { PromptSpecification } from "../prompt-spec/types";

// Phase 12 — AI Prompt Optimization Engine types.
// OptimizedPromptSpecification is the output of the Prompt Optimization Engine.
// It contains the original PromptSpecification with optimization intelligence
// layered on top: priorities, conflicts, budgets, visual scores, quality scores.
//
// STRICT RULES:
//   ✗ No provider-specific language
//   ✗ No OpenAI/Gemini/Flux/Ideogram parameters
//   ✗ No generated prompts of any kind
//   ✗ No LLM calls
//   ✓ Only structured optimization decisions on the PromptSpecification

// ─────────────────────────────────────────────────────────────────────────────
// Optimization Metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface OptimizationMeta {
  optimizationId: string;
  createdAt: string;
  schemaVersion: string;
  sourceSpecId: string;
  optimizationVersion: string;
  /** How many fields were compressed. */
  fieldsCompressed: number;
  /** How many duplicates were detected and merged. */
  duplicatesRemoved: number;
  /** How many conflicts were detected. */
  conflictsFound: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Priority Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface SectionPriority {
  /** 0-100 priority weight per section. Higher = rendered first / given more budget. */
  hero:                number;
  negativeConstraints: number;
  rendering:           number;
  composition:         number;
  storytelling:        number;
  marketing:           number;
  lighting:            number;
  environment:         number;
  typography:          number;
  camera:              number;
  supporting:          number;
  brandRules:          number;
  mission:             number;
  /** Reasoning for the top-3 highest priorities. */
  priorityReasoning:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Duplicate Detection
// ─────────────────────────────────────────────────────────────────────────────

export interface DuplicateReport {
  /** Total number of duplicate/redundant field values found. */
  totalFound: number;
  /** Descriptions of what was merged and why. */
  mergedItems: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Conflict Detection
// ─────────────────────────────────────────────────────────────────────────────

export type ConflictSeverity = "critical" | "warning" | "suggestion";

export interface ConflictItem {
  severity:   ConflictSeverity;
  field1:     string;
  value1:     string;
  field2:     string;
  value2:     string;
  description:string;
  resolution: string;
}

export interface ConflictReport {
  /** Total conflicts found. */
  totalFound: number;
  criticalCount: number;
  warningCount: number;
  suggestionCount: number;
  conflicts: ConflictItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Budget Allocation
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetAllocation {
  /** Total character budget available for all sections. */
  totalBudget: number;
  /** Allocated character budget per section. */
  hero:                number;
  negativeConstraints: number;
  composition:         number;
  camera:              number;
  lighting:            number;
  environment:         number;
  marketing:           number;
  supporting:          number;
  typography:          number;
  rendering:           number;
  brandRules:          number;
  mission:             number;
  /** Unused buffer reserved for Provider Translator overhead. */
  buffer:              number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Information Ordering
// ─────────────────────────────────────────────────────────────────────────────

export interface SectionOrder {
  /** Canonical AI OS ordering from highest to lowest visual reasoning priority. */
  orderedKeys: string[];
  /** Reasoning for this specific ordering given this campaign's characteristics. */
  orderingReasoning: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Visual Importance Scoring
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualElement {
  name:       string;
  importance: number;       // 0-100
  confidence: number;       // 0-100
  category:   "hero" | "supporting" | "environment" | "decorative" | "trust" | "educational";
  reasoning:  string;
}

export interface VisualImportanceMap {
  elements: VisualElement[];
  /** The single most visually important element — must never be wrong in generation. */
  primaryElement: string;
  /** Score of overall visual clarity (do elements form a coherent hierarchy?). */
  hierarchyClarity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Merged Negative Constraints
// ─────────────────────────────────────────────────────────────────────────────

export interface MergedNegatives {
  /** Single consolidated, deduplicated negative constraint string in optimal order. */
  consolidated: string;
  /** Count of individual negative items before merging. */
  itemsBeforeMerge: number;
  /** Count of unique negative items after merging. */
  itemsAfterMerge: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Optimized Rendering
// ─────────────────────────────────────────────────────────────────────────────

export interface OptimizedRendering {
  /** Photorealism priority weight (0-100). */
  photorealismPriority:  number;
  /** Commercial quality priority weight. */
  commercialQualityPriority: number;
  /** Editorial quality priority weight. */
  editorialQualityPriority: number;
  /** Realism target priority weight. */
  realismPriority:       number;
  /** Luxury level priority weight. */
  luxuryPriority:        number;
  /** Combined rendering quality directive (provider-agnostic). */
  combinedDirective:     string;
  reasoning:             string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Quality Scores
// ─────────────────────────────────────────────────────────────────────────────

export interface QualityScores {
  /** How well the specification was optimized (compression, dedup, ordering). */
  optimizationScore:   number;   // 0-100
  /** 100 = no conflicts; deducted per conflict found. */
  conflictScore:       number;   // 0-100
  /** 100 = no redundancy; deducted per duplicate found. */
  redundancyScore:     number;   // 0-100
  /** How clear and unambiguous the specification is for a Provider Translator. */
  readabilityScore:    number;   // 0-100
  /** Overall readiness — Provider Translator can safely consume at this score. */
  promptReadinessScore:number;   // 0-100
  /** Narrative explanation of the scores. */
  scoreReasoning:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// OptimizedPromptSpecification — complete output
// ─────────────────────────────────────────────────────────────────────────────

export interface OptimizedPromptSpecification {
  /** Optimization metadata: IDs, timestamps, version, counters. */
  meta:               OptimizationMeta;

  /** The optimized PromptSpecification — compressed, deduplicated, sections unchanged in type. */
  optimizedSpec:      PromptSpecification;

  /** Priority weights assigned to every section (0-100). */
  priority:           SectionPriority;

  /** Canonical AI OS ordering for Provider Translator consumption. */
  sectionOrder:       SectionOrder;

  /** Duplicate/redundancy detection report. */
  duplicates:         DuplicateReport;

  /** Conflict detection report. */
  conflicts:          ConflictReport;

  /** Character budget per section. */
  budget:             BudgetAllocation;

  /** Per-element visual importance scores. */
  visualScores:       VisualImportanceMap;

  /** Merged, deduplicated, optimally ordered negative constraints. */
  mergedNegatives:    MergedNegatives;

  /** Optimized rendering priority weights and combined directive. */
  optimizedRendering: OptimizedRendering;

  /** Quality scores across 5 dimensions. */
  quality:            QualityScores;

  /** All fields that remained "unknown" after optimization. */
  unknownFields: string[];
}
