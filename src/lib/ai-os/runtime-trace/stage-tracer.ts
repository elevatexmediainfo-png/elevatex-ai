import type { CreativeStrategy } from "../creative-brain/types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualScenePlan } from "../scene-planner/types";
import type { SceneGraph } from "../scene-graph/types";
import type { PromptSpecification } from "../prompt-spec/types";
import type { CompiledPrompt } from "../prompt-compiler/types";
import type { OptimizedPromptSpecification } from "../prompt-optimizer/types";
import type { ProviderPrompt, SupportedProvider } from "../provider-translator/types";
import type { ExecutionTree, StageTrace, FieldDiff } from "./types";
import { STAGE_ORDER } from "./types";
import { diffFieldTrees, countUnknownFields, flattenToText } from "./field-diff";
import { textMetricsFor } from "./text-analysis";
import { detectSceneGraphConsumption, SCENE_GRAPH_WIRED_SPEC_FIELDS } from "./provenance";

// Phase 10.6D — Execution tree builder.
//
// Observes the ALREADY-WIRED Phase 10.6C pipeline; changes nothing about what
// any stage computes. Each `record*` method takes the real objects the live
// route already has in hand at that point (before/after where the stage's
// input and output share a shape; input+output directly otherwise) plus a
// pre-measured elapsed time, and derives every metric from them — nothing is
// assumed or synthesised. Where a metric is structurally inapplicable to a
// stage, `fieldDiff.note` says so explicitly instead of a fabricated value.

const STRUCTURAL_NOTE = "input and output are structurally different types — no direct field-by-field comparison applies";
const EMPTY_DIFF = (note: string): FieldDiff => ({ added: [], removed: [], modified: [], note });

export class ExecutionTreeBuilder {
  private readonly requestId: string;
  private readonly createdAt: string;
  private readonly stages: StageTrace[] = [];

  constructor(requestId: string) {
    this.requestId = requestId;
    this.createdAt = new Date().toISOString();
  }

  private push(partial: Omit<StageTrace, "order">): void {
    const order = STAGE_ORDER.indexOf(partial.stage);
    this.stages.push({ ...partial, order: order === -1 ? this.stages.length : order });
  }

  recordCreativeBrain(strategy: CreativeStrategy, elapsedMs: number): void {
    const text = flattenToText(strategy as unknown as Record<string, unknown>);
    this.push({
      stage: "creative-brain",
      executionTimeMs: elapsedMs,
      inputSummary: "CreativeContext (user idea + asset intelligence + brand context)",
      outputSummary: `CreativeStrategy — ${strategy.confidenceScore}/100 confidence, ${strategy.unknownFields.length} unknown fields`,
      textMetrics: textMetricsFor(text),
      fieldDiff: EMPTY_DIFF(STRUCTURAL_NOTE),
      duplicateRemoval: 0,
      visualTranslationCount: 0,
      unknownFieldsBefore: 0,
      unknownFieldsAfter: strategy.unknownFields.length,
      sceneGraphUsage: { used: false, fieldsConsumed: [] },
      promptCompilerUsage: { used: false, fieldsConsumed: [] },
    });
  }

  recordScenePlanner(blueprint: UniversalCampaignBlueprint, scene: VisualScenePlan, elapsedMs: number): void {
    const text = flattenToText(scene as unknown as Record<string, unknown>);
    this.push({
      stage: "scene-planner",
      executionTimeMs: elapsedMs,
      inputSummary: `UniversalCampaignBlueprint (${blueprint.meta.blueprintId})`,
      outputSummary: `VisualScenePlan — ${scene.confidenceScore}/100 confidence, ${scene.unknownFields.length} unknown fields`,
      textMetrics: textMetricsFor(text),
      fieldDiff: EMPTY_DIFF(STRUCTURAL_NOTE),
      duplicateRemoval: 0,
      visualTranslationCount: 0,
      unknownFieldsBefore: 0,
      unknownFieldsAfter: scene.unknownFields.length,
      sceneGraphUsage: { used: false, fieldsConsumed: [] },
      promptCompilerUsage: { used: false, fieldsConsumed: [] },
    });
  }

  recordSceneGraphCompiler(scene: VisualScenePlan, sceneGraph: SceneGraph, elapsedMs: number): void {
    const domains = { who: sceneGraph.who, where: sceneGraph.where, pose: sceneGraph.pose, body: sceneGraph.body,
      objectContact: sceneGraph.objectContact, microMotion: sceneGraph.microMotion, camera: sceneGraph.camera, materials: sceneGraph.materials };
    this.push({
      stage: "scene-graph-compiler",
      executionTimeMs: elapsedMs,
      inputSummary: `VisualScenePlan — ${scene.unknownFields.length} unknown fields (the Phase 10.5C audit baseline this stage exists to close)`,
      outputSummary: `SceneGraph — ${sceneGraph.meta.completenessScore}/100 completeness, ${sceneGraph.meta.unknownFields.length} unknown fields, narrative ${sceneGraph.narrative.length} chars`,
      textMetrics: textMetricsFor(flattenToText(domains as unknown as Record<string, unknown>)),
      fieldDiff: EMPTY_DIFF("Scene Graph's 8 sub-graphs (who/where/pose/body/objectContact/microMotion/camera/materials) are new dimensions with no VisualScenePlan counterpart to diff against field-by-field — see outputSummary's completeness score, measured against the same checklist the Phase 10.5C audit used"),
      duplicateRemoval: 0,
      visualTranslationCount: 0,
      unknownFieldsBefore: countUnknownFields(scene as unknown as Record<string, unknown>),
      unknownFieldsAfter: sceneGraph.meta.unknownFields.length,
      sceneGraphUsage: { used: true, fieldsConsumed: [] },
      promptCompilerUsage: { used: false, fieldsConsumed: [] },
    });
  }

  recordPromptSpecification(spec: PromptSpecification, sceneGraph: SceneGraph | undefined, elapsedMs: number): void {
    const consumption = sceneGraph ? detectSceneGraphConsumption(spec, sceneGraph) : { specFieldsConsumed: [], sceneGraphFieldsConsumed: [] };
    const text = flattenToText(spec as unknown as Record<string, unknown>);
    this.push({
      stage: "prompt-specification",
      executionTimeMs: elapsedMs,
      inputSummary: sceneGraph
        ? `UniversalCampaignBlueprint + VisualScenePlan + SceneGraph (${sceneGraph.meta.completenessScore}/100 completeness)`
        : "UniversalCampaignBlueprint + VisualScenePlan (no Scene Graph provided)",
      outputSummary: `PromptSpecification — ${spec.meta.confidenceScore}/100 confidence, ${spec.unknownFields.length} unknown fields, ${consumption.specFieldsConsumed.length}/${SCENE_GRAPH_WIRED_SPEC_FIELDS.length} Scene-Graph-wired fields confirmed populated from Scene Graph content`,
      textMetrics: textMetricsFor(text),
      fieldDiff: EMPTY_DIFF(`${STRUCTURAL_NOTE} — see sceneGraphUsage for Scene Graph's confirmed, value-verified contribution to this stage's 5 wired builders (hero, supporting, composition, camera, environment)`),
      duplicateRemoval: 0,
      visualTranslationCount: 0,
      unknownFieldsBefore: sceneGraph ? sceneGraph.meta.unknownFields.length : 0,
      unknownFieldsAfter: spec.unknownFields.length,
      sceneGraphUsage: { used: consumption.specFieldsConsumed.length > 0, fieldsConsumed: consumption.sceneGraphFieldsConsumed },
      promptCompilerUsage: { used: false, fieldsConsumed: [] },
    });
  }

  recordPromptVisualCompiler(before: PromptSpecification, after: PromptSpecification, compiled: CompiledPrompt, elapsedMs: number): void {
    const diff = diffFieldTrees(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
    const compilerFields = compiled.fields.filter((f) => (f.classification === "A" || f.classification === "B") && f.compiledValue !== undefined && f.compiledValue !== f.originalValue).map((f) => f.path);
    this.push({
      stage: "prompt-visual-compiler",
      executionTimeMs: elapsedMs,
      inputSummary: `PromptSpecification (${before.unknownFields.length} unknown fields, pre-compilation)`,
      outputSummary: `PromptSpecification with ${compiled.fields.filter((f) => f.classification === "A").length} pass-through, ${compiled.fields.filter((f) => f.classification === "B").length} converted, ${compiled.fields.filter((f) => f.classification === "C").length} removed, ${compiled.fields.filter((f) => f.classification === "D").length} deduplicated fields`,
      textMetrics: textMetricsFor(compiled.compiledText),
      fieldDiff: diff,
      duplicateRemoval: compiled.report.duplicatesMerged,
      visualTranslationCount: compiled.report.conceptsTranslated.length,
      unknownFieldsBefore: countUnknownFields(before as unknown as Record<string, unknown>),
      unknownFieldsAfter: countUnknownFields(after as unknown as Record<string, unknown>),
      sceneGraphUsage: { used: false, fieldsConsumed: [] },
      promptCompilerUsage: { used: compilerFields.length > 0, fieldsConsumed: compilerFields },
    });
  }

  recordPromptOptimizer(before: PromptSpecification, optimized: OptimizedPromptSpecification, elapsedMs: number): void {
    const diff = diffFieldTrees(before as unknown as Record<string, unknown>, optimized.optimizedSpec as unknown as Record<string, unknown>);
    this.push({
      stage: "prompt-optimizer",
      executionTimeMs: elapsedMs,
      inputSummary: `PromptSpecification (post-compilation, ${before.unknownFields.length} unknown fields)`,
      outputSummary: `OptimizedPromptSpecification — ${optimized.meta.fieldsCompressed} fields compressed, ${optimized.duplicates.totalFound} duplicates found, ${optimized.conflicts.totalFound} conflicts, quality ${optimized.quality.promptReadinessScore}/100`,
      textMetrics: textMetricsFor(flattenToText(optimized.optimizedSpec as unknown as Record<string, unknown>)),
      fieldDiff: diff,
      duplicateRemoval: optimized.duplicates.totalFound,
      visualTranslationCount: 0,
      unknownFieldsBefore: countUnknownFields(before as unknown as Record<string, unknown>),
      unknownFieldsAfter: optimized.unknownFields.length,
      sceneGraphUsage: { used: false, fieldsConsumed: [] },
      promptCompilerUsage: { used: false, fieldsConsumed: [] },
    });
  }

  recordProviderTranslator(
    optimized: OptimizedPromptSpecification,
    result: ProviderPrompt,
    elapsedMs: number,
    sceneGraphConsumedUpstream: string[],
    compilerConsumedUpstream: string[],
  ): void {
    const finalPrompt = result.body.finalPrompt;
    const sceneGraphSurviving = sceneGraphConsumedUpstream.filter((path) => {
      const value = getSpecValue(optimized.optimizedSpec, path);
      return !!value && value !== "unknown" && finalPrompt.includes(value.slice(0, Math.min(40, value.length)));
    });
    const compilerSurviving = compilerConsumedUpstream.filter((path) => {
      const value = getSpecValue(optimized.optimizedSpec, path);
      return !!value && value !== "unknown" && finalPrompt.includes(value.slice(0, Math.min(40, value.length)));
    });
    this.push({
      stage: "provider-translator",
      executionTimeMs: elapsedMs,
      inputSummary: `OptimizedPromptSpecification (quality ${optimized.quality.promptReadinessScore}/100)`,
      outputSummary: `ProviderPrompt for ${result.meta.provider} — ${result.body.finalPrompt.length} chars, ${result.body.formatStyle} format, quality ${result.quality.estimatedQuality}/100`,
      textMetrics: textMetricsFor(finalPrompt),
      fieldDiff: EMPTY_DIFF("structured spec -> flat text — no direct field comparison; see the Influence Graph for sentence-level field attribution"),
      duplicateRemoval: 0,
      visualTranslationCount: 0,
      unknownFieldsBefore: optimized.unknownFields.length,
      unknownFieldsAfter: 0,
      sceneGraphUsage: { used: sceneGraphSurviving.length > 0, fieldsConsumed: sceneGraphSurviving },
      promptCompilerUsage: { used: compilerSurviving.length > 0, fieldsConsumed: compilerSurviving },
    });
  }

  build(finalProvider: SupportedProvider, finalPrompt: string): ExecutionTree {
    return {
      requestId: this.requestId,
      createdAt: this.createdAt,
      stages: [...this.stages].sort((a, b) => a.order - b.order),
      finalProvider,
      finalPrompt,
      totalExecutionTimeMs: this.stages.reduce((sum, s) => sum + s.executionTimeMs, 0),
    };
  }
}

function getSpecValue(spec: PromptSpecification, path: string): string | undefined {
  const [section, field] = path.split(".");
  const sectionObj = (spec as unknown as Record<string, unknown>)[section!];
  if (!sectionObj || typeof sectionObj !== "object") return undefined;
  const fieldObj = (sectionObj as Record<string, unknown>)[field!];
  if (!fieldObj || typeof fieldObj !== "object" || !("value" in fieldObj)) return undefined;
  return (fieldObj as { value: string }).value;
}

/** Times a synchronous stage function and returns both its result and the
 *  elapsed milliseconds — the one universal primitive every `record*` call
 *  site in the live route uses around its already-existing function call. */
export function timed<T>(fn: () => T): { result: T; elapsedMs: number } {
  const start = performance.now();
  const result = fn();
  const elapsedMs = performance.now() - start;
  return { result, elapsedMs };
}
