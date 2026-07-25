import type {
  ExecutionTree, RuntimeReport, ProviderTrace, InfluenceGraph, RuntimeVerificationReport,
  DependencyEdge, StageName, RuntimeGraph, DependencyGraph, ExecutionGraph, ProviderGraph, PerformanceGraph,
} from "./types";
import { STAGE_ORDER } from "./types";
import { sceneGraphSourcesFor, SCENE_GRAPH_WIRED_SPEC_FIELDS } from "./provenance";

// Phase 10.6D — Final report: 6 named graphs, all projections over the same
// ExecutionTree + provider/influence data already measured elsewhere in this
// module — no new measurement happens here, only assembly.

function buildDependencyEdges(): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
    edges.push({ from: STAGE_ORDER[i]!, to: STAGE_ORDER[i + 1]! });
  }
  edges.push({ from: "provider-translator", to: "final-provider-prompt" });
  return edges;
}

export function assembleFinalReport(
  tree: ExecutionTree,
  runtimeReport: RuntimeReport,
  providerTraces: readonly ProviderTrace[],
  influenceGraph: InfluenceGraph,
): RuntimeVerificationReport {
  const runtimeGraph: RuntimeGraph = { stages: tree.stages, totalExecutionTimeMs: tree.totalExecutionTimeMs };

  const dependencyGraph: DependencyGraph = {
    edges: buildDependencyEdges(),
    fieldDependencies: SCENE_GRAPH_WIRED_SPEC_FIELDS.map((path) => ({
      targetField: path,
      dependsOnSceneGraphPaths: sceneGraphSourcesFor(path),
    })),
  };

  const executionGraph: ExecutionGraph = {
    order: tree.stages.map((s) => s.stage),
    timingsMs: Object.fromEntries(tree.stages.map((s) => [s.stage, s.executionTimeMs])) as Record<StageName, number>,
  };

  const providerGraph: ProviderGraph = { providers: [...providerTraces] };

  const byStage = Object.fromEntries(tree.stages.map((s) => [s.stage, s.executionTimeMs])) as Record<StageName, number>;
  const sortedByTime = [...tree.stages].sort((a, b) => a.executionTimeMs - b.executionTimeMs);
  const performanceGraph: PerformanceGraph = {
    totalMs: tree.totalExecutionTimeMs,
    byStage,
    slowestStage: sortedByTime[sortedByTime.length - 1]?.stage ?? "creative-brain",
    fastestStage: sortedByTime[0]?.stage ?? "creative-brain",
  };

  return {
    requestId: tree.requestId,
    createdAt: tree.createdAt,
    runtimeGraph,
    dependencyGraph,
    influenceGraph,
    executionGraph,
    providerGraph,
    performanceGraph,
    report: runtimeReport,
  };
}
