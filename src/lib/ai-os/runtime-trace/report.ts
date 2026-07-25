import type { CompiledPrompt } from "../prompt-compiler/types";
import type { ExecutionTree, ProviderTrace, RuntimeReport } from "./types";

// Phase 10.6D — Runtime report: aggregates the ExecutionTree's per-stage
// data (already measured, nothing recomputed here) into the summary shape
// the brief asks for.

export function buildRuntimeReport(tree: ExecutionTree, compiled: CompiledPrompt, providerTraces: readonly ProviderTrace[]): RuntimeReport {
  const sceneGraphFieldsConsumed = [...new Set(tree.stages.flatMap((s) => s.sceneGraphUsage.fieldsConsumed))].sort();
  const promptCompilerFieldsConsumed = [...new Set(tree.stages.flatMap((s) => s.promptCompilerUsage.fieldsConsumed))].sort();
  const promptSpecificationFieldsSkipped = compiled.fields
    .filter((f) => f.classification === "C" || f.classification === "E")
    .map((f) => f.path)
    .sort();

  const duplicateRemovals = tree.stages.reduce((sum, s) => sum + s.duplicateRemoval, 0);
  const businessLanguageRemoved = compiled.report.bannedTermsRemoved;
  const visualLanguageAdded = compiled.fields.filter((f) => f.classification === "A" || f.classification === "B").length;

  const providerSpecificTransformations = providerTraces.map((p) => {
    const delta = p.finalPromptLength - compiled.compiledText.length;
    const direction = delta >= 0 ? "expanded" : "compressed";
    return `${p.provider}: ${direction} the compiled text by ${Math.abs(delta)} chars into a ${p.finalPromptLength}-char, ` +
      `${p.duplicateRatio === 0 ? "duplicate-free" : `${Math.round(p.duplicateRatio * 100)}% duplicate-clause`} final prompt ` +
      `(${p.enumLeakage === 0 ? "no enum leaks" : `${p.enumLeakage} enum leaks`}).`;
  });

  return {
    sceneGraphFieldsConsumed,
    promptCompilerFieldsConsumed,
    promptSpecificationFieldsSkipped,
    duplicateRemovals,
    businessLanguageRemoved,
    visualLanguageAdded,
    providerSpecificTransformations,
  };
}
