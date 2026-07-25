import type { PromptSpecification } from "../prompt-spec/types";
import type { CompiledPrompt, FieldClassification } from "../prompt-compiler/types";
import type { SupportedProvider } from "../provider-translator/types";
import type { InfluenceGraph, InfluenceEdge } from "./types";
import { flattenPaths } from "./field-diff";
import { splitIntoSentences, textOverlaps } from "./text-analysis";
import { sceneGraphSourcesFor, SCENE_GRAPH_WIRED_SPEC_FIELDS } from "./provenance";

// Phase 10.6D — Runtime Influence Graph.
//
// For a provider's final prompt, attributes each sentence back to: the
// PromptSpecification field it most overlaps (by significant-word overlap —
// the same technique already established in hero-fusion.ts and
// prompt-compiler/engine.ts's own duplicate detection), that field's Prompt
// Visual Compiler classification (A/B/C/D/E) when the compiler touched it,
// and — when the field is one of Phase 10.6C's 7 Scene-Graph-wired fields —
// which Scene Graph source path(s) feed it. A sentence with no confident
// match (typically a translator's own hardcoded vocabulary — quality
// boosters, "AVOID:" lists, section headers) is reported as unattributed
// rather than force-matched.

function classificationFor(compiled: CompiledPrompt, path: string): FieldClassification | undefined {
  return compiled.fields.find((f) => f.path === path)?.classification;
}

export function buildInfluenceGraph(
  spec: PromptSpecification,
  compiled: CompiledPrompt,
  finalPrompt: string,
  provider: SupportedProvider,
): InfluenceGraph {
  const fieldValues = flattenPaths(spec as unknown as Record<string, unknown>);
  const fieldPaths = Object.keys(fieldValues);
  const sentences = splitIntoSentences(finalPrompt);

  const edges: InfluenceEdge[] = [];
  const unattributedSentences: string[] = [];

  for (const sentence of sentences) {
    let bestPath: string | undefined;
    let bestScore = 0;
    for (const path of fieldPaths) {
      const value = fieldValues[path]!;
      if (!textOverlaps(value, sentence)) continue;
      // Prefer the shortest source field that still overlaps — the more
      // specific match, not the first/longest one that happens to contain it.
      const score = 1 / Math.max(value.length, 1);
      if (score > bestScore) { bestScore = score; bestPath = path; }
    }

    if (!bestPath) {
      unattributedSentences.push(sentence);
      continue;
    }

    const classification = classificationFor(compiled, bestPath);
    const sceneGraphSources = SCENE_GRAPH_WIRED_SPEC_FIELDS.includes(bestPath) ? sceneGraphSourcesFor(bestPath) : [];

    edges.push({
      sentence,
      sourceField: bestPath,
      ...(sceneGraphSources.length > 0 ? { sourceSceneGraphPath: sceneGraphSources.join(" + ") } : {}),
      ...(classification ? { compilerClassification: classification } : {}),
      provider,
    });
  }

  return { provider, edges, unattributedSentences };
}
