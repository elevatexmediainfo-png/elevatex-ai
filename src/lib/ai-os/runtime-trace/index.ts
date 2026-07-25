// Phase 10.6D — Runtime Verification System public API.
// Import from this index; never import sub-module paths directly.

export { ExecutionTreeBuilder, timed } from "./stage-tracer";
export { buildProviderReport, NAMED_PROVIDERS } from "./provider-report";
export { buildInfluenceGraph } from "./influence-graph";
export { buildRuntimeReport } from "./report";
export { assembleFinalReport } from "./final-report";
export { detectSceneGraphConsumption, sceneGraphSourcesFor, SCENE_GRAPH_WIRED_SPEC_FIELDS } from "./provenance";
export { diffFieldTrees, countUnknownFields, flattenToText, flattenPaths } from "./field-diff";
export { textMetricsFor, enumLeakageFor, duplicateRatio, textOverlaps, splitIntoSentences, estimateTokens } from "./text-analysis";

export type {
  StageName, StageTrace, ExecutionTree, TextMetrics, FieldDiff,
  SceneGraphUsage, PromptCompilerUsage, RuntimeReport, ProviderTrace,
  InfluenceEdge, InfluenceGraph, RuntimeGraph, DependencyEdge, DependencyGraph,
  FieldDependency, ExecutionGraph, ProviderGraph, PerformanceGraph,
  RuntimeVerificationReport,
} from "./types";
export { STAGE_ORDER } from "./types";
