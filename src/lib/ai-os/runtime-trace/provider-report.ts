import type { OptimizedPromptSpecification } from "../prompt-optimizer/types";
import type { PromptSpecification } from "../prompt-spec/types";
import type { SupportedProvider } from "../provider-translator/types";
import { translateForProvider } from "../provider-translator";
import type { ProviderTrace } from "./types";
import { textMetricsFor, enumLeakageFor, duplicateRatio } from "./text-analysis";

// Phase 10.6D — Per-provider report.
//
// Runs all 4 named providers against the SAME already-optimized spec purely
// for comparison/reporting — this does not change what the live route
// actually returns as its primary result (still exactly the one resolved
// `translationTarget` provider). Cheap by construction: translateForProvider
// is pure formatting over data that is already fully computed (proven in
// Phase 10.6C's own performance suite — well under 150ms for all 4 combined).

export const NAMED_PROVIDERS: readonly SupportedProvider[] = ["openai", "gemini", "flux", "stable_diffusion"];

function getSpecValue(spec: PromptSpecification, path: string): string | undefined {
  const [section, field] = path.split(".");
  const sectionObj = (spec as unknown as Record<string, unknown>)[section!];
  if (!sectionObj || typeof sectionObj !== "object") return undefined;
  const fieldObj = (sectionObj as Record<string, unknown>)[field!];
  if (!fieldObj || typeof fieldObj !== "object" || !("value" in fieldObj)) return undefined;
  return (fieldObj as { value: string }).value;
}

function coverage(spec: PromptSpecification, paths: readonly string[], finalPrompt: string): number {
  if (paths.length === 0) return 0;
  let present = 0;
  for (const path of paths) {
    const value = getSpecValue(spec, path);
    if (value && value !== "unknown" && finalPrompt.includes(value.slice(0, Math.min(40, value.length)))) present++;
  }
  return Math.round((present / paths.length) * 1000) / 1000;
}

/**
 * @param sceneGraphSourcedSpecFields PromptSpecification field paths (e.g.
 *   "hero.heroDetails") already confirmed Scene-Graph-sourced — NOT Scene
 *   Graph's own field paths (e.g. "pose.secondaryAction"). Those two live in
 *   different namespaces (SceneGraph vs PromptSpecification); this function
 *   looks values up on the spec, so it needs the spec-side paths — the same
 *   ones `detectSceneGraphConsumption().specFieldsConsumed` returns, not its
 *   `.sceneGraphFieldsConsumed`, and not `RuntimeReport.sceneGraphFieldsConsumed`
 *   (which is the latter, aggregated across stages).
 * @param compilerSourcedSpecFields PromptSpecification field paths the Prompt
 *   Visual Compiler classified A/B and actually rewrote.
 */
export function buildProviderReport(
  optimized: OptimizedPromptSpecification,
  sceneGraphSourcedSpecFields: readonly string[],
  compilerSourcedSpecFields: readonly string[],
): ProviderTrace[] {
  return NAMED_PROVIDERS.map((provider) => {
    const result = translateForProvider(optimized, provider);
    const finalPrompt = result.body.finalPrompt;
    const metrics = textMetricsFor(finalPrompt);
    return {
      provider,
      finalPromptLength: finalPrompt.length,
      visualTokenRatio: metrics.visualTokenRatio,
      abstractTokenRatio: metrics.abstractTokenRatio,
      enumLeakage: enumLeakageFor(finalPrompt),
      duplicateRatio: duplicateRatio(finalPrompt),
      sceneGraphCoverage: coverage(optimized.optimizedSpec, sceneGraphSourcedSpecFields, finalPrompt),
      promptCompilerCoverage: coverage(optimized.optimizedSpec, compilerSourcedSpecFields, finalPrompt),
    };
  });
}
