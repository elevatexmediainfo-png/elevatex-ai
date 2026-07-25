import type { SupportedProvider } from "../provider-translator/types";
import type { FieldClassification } from "../prompt-compiler/types";

// Phase 10.6D — Runtime Verification System types.
//
// This module observes the ALREADY-WIRED Phase 10.6C pipeline; it does not
// change what any stage computes or returns. Every number here is measured
// from a real execution, not assumed or synthesised — where a metric is
// structurally inapplicable to a stage (e.g. "field diff" between two
// differently-shaped types), the trace says so explicitly via `note` rather
// than fabricating a value.

export type StageName =
  | "creative-brain"
  | "scene-planner"
  | "scene-graph-compiler"
  | "prompt-specification"
  | "prompt-visual-compiler"
  | "prompt-optimizer"
  | "provider-translator";

export const STAGE_ORDER: readonly StageName[] = [
  "creative-brain", "scene-planner", "scene-graph-compiler",
  "prompt-specification", "prompt-visual-compiler", "prompt-optimizer", "provider-translator",
];

// ─────────────────────────────────────────────────────────────────────────────
// Per-stage trace
// ─────────────────────────────────────────────────────────────────────────────

export interface TextMetrics {
  tokenCount: number;
  visualTokenRatio: number;
  abstractTokenRatio: number;
}

export interface FieldDiff {
  added: string[];
  removed: string[];
  modified: string[];
  /** Set when this stage's input/output types are structurally different
   *  (e.g. CreativeContext -> CreativeStrategy) and a literal field-by-field
   *  comparison does not apply — explains what was measured instead. */
  note?: string;
}

export interface SceneGraphUsage {
  used: boolean;
  /** SceneGraph field paths (e.g. "pose.secondaryAction") confirmed consumed
   *  at this stage, detected from this phase's own "Scene Graph ..." markers
   *  written into every enriched field's `reasoning` string by Phase 10.6C. */
  fieldsConsumed: string[];
}

export interface PromptCompilerUsage {
  used: boolean;
  /** PromptSpecification field paths (e.g. "hero.heroSubject") the compiler
   *  classified A/B and actually rewrote (compiledValue differs from raw). */
  fieldsConsumed: string[];
}

export interface StageTrace {
  stage: StageName;
  order: number;
  executionTimeMs: number;
  inputSummary: string;
  outputSummary: string;
  textMetrics: TextMetrics;
  fieldDiff: FieldDiff;
  duplicateRemoval: number;
  visualTranslationCount: number;
  unknownFieldsBefore: number;
  unknownFieldsAfter: number;
  sceneGraphUsage: SceneGraphUsage;
  promptCompilerUsage: PromptCompilerUsage;
}

export interface ExecutionTree {
  requestId: string;
  createdAt: string;
  stages: StageTrace[];
  finalProvider: SupportedProvider;
  finalPrompt: string;
  totalExecutionTimeMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime report — aggregated across all stages
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeReport {
  sceneGraphFieldsConsumed: string[];
  promptCompilerFieldsConsumed: string[];
  promptSpecificationFieldsSkipped: string[];
  duplicateRemovals: number;
  businessLanguageRemoved: number;
  visualLanguageAdded: number;
  providerSpecificTransformations: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-provider report
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderTrace {
  provider: SupportedProvider;
  finalPromptLength: number;
  visualTokenRatio: number;
  abstractTokenRatio: number;
  enumLeakage: number;
  duplicateRatio: number;
  /** 0-1: share of this provider's finalPrompt content attributable to a
   *  field this phase confirmed Scene-Graph-sourced. */
  sceneGraphCoverage: number;
  /** 0-1: share of this provider's finalPrompt content attributable to a
   *  field the Prompt Visual Compiler classified A/B and rewrote. */
  promptCompilerCoverage: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Influence graph — sentence-level provenance
// ─────────────────────────────────────────────────────────────────────────────

export interface InfluenceEdge {
  sentence: string;
  sourceField?: string;
  sourceSceneGraphPath?: string;
  compilerClassification?: FieldClassification;
  provider: SupportedProvider;
}

export interface InfluenceGraph {
  provider: SupportedProvider;
  edges: InfluenceEdge[];
  /** Sentences that could not be confidently traced to a spec field — almost
   *  always a translator's own hardcoded vocabulary (quality boosters,
   *  "AVOID:" lists, section headers) rather than spec-derived content. */
  unattributedSentences: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Final report — 6 named graphs, all projections over the same ExecutionTree
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeGraph {
  stages: StageTrace[];
  totalExecutionTimeMs: number;
}

export interface DependencyEdge {
  from: StageName | "final-provider-prompt";
  to: StageName | "final-provider-prompt";
}

export interface FieldDependency {
  targetField: string;
  dependsOnSceneGraphPaths: string[];
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  fieldDependencies: FieldDependency[];
}

export interface ExecutionGraph {
  order: StageName[];
  timingsMs: Record<StageName, number>;
}

export interface ProviderGraph {
  providers: ProviderTrace[];
}

export interface PerformanceGraph {
  totalMs: number;
  byStage: Record<StageName, number>;
  slowestStage: StageName;
  fastestStage: StageName;
}

export interface RuntimeVerificationReport {
  requestId: string;
  createdAt: string;
  runtimeGraph: RuntimeGraph;
  dependencyGraph: DependencyGraph;
  influenceGraph: InfluenceGraph;
  executionGraph: ExecutionGraph;
  providerGraph: ProviderGraph;
  performanceGraph: PerformanceGraph;
  report: RuntimeReport;
}
