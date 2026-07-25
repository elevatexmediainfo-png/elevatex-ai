import { generateScript } from "@/lib/generation";
import type { GenerationContext } from "@/lib/generation";
import { recordPrompt } from "./service";

// Milestone 10 Part 7 — Prompt Optimization. Same shape as
// lib/ai/script-studio.ts (Milestone 8): pure prompt-building/parsing here,
// unit-testable without the Generation Engine; runPromptOptimization is the
// thin wrapper that actually calls it. Routes through generateScript() —
// the SAME LLM call every script/transform/variant operation already uses —
// rather than a parallel "optimization model" call path.

export type PromptKind = "SCRIPT" | "IMAGE" | "VIDEO" | "NEGATIVE";

const KIND_DESCRIPTION: Record<PromptKind, string> = {
  SCRIPT: "a video script prompt for an AI script-writing model",
  IMAGE: "an image-generation prompt for an AI image model",
  VIDEO: "a video-generation prompt for an AI video model",
  NEGATIVE: "a negative prompt (things an image/video model should avoid)",
};

// Negative-prompt suggestions only make sense for IMAGE/VIDEO prompts — a
// SCRIPT prompt has no visual negative-prompt counterpart, and optimizing a
// NEGATIVE prompt IS the negative prompt, not a nested suggestion of one.
function wantsNegativeSuggestion(kind: PromptKind): boolean {
  return kind === "IMAGE" || kind === "VIDEO";
}

export function buildOptimizationPrompt(kind: PromptKind, text: string, businessContext?: string): string {
  const lines = [
    `Improve the following ${KIND_DESCRIPTION[kind]}. Make it more specific, vivid, and stylistically consistent, while preserving the original intent. Keep it concise — a tighter prompt, not a longer one.`,
  ];
  if (businessContext) lines.push(`Business context: ${businessContext}`);
  lines.push(
    wantsNegativeSuggestion(kind)
      ? "Respond in exactly this format:\nOPTIMIZED:\n<the improved prompt>\nNEGATIVE:\n<a short negative prompt — things the generation should avoid>"
      : "Respond in exactly this format:\nOPTIMIZED:\n<the improved prompt>"
  );
  lines.push(`\nOriginal:\n${text}`);
  return lines.join("\n");
}

export interface ParsedOptimization {
  optimizedText: string;
  negativePromptSuggestion?: string;
}

// Tolerant of a model that doesn't follow the requested format exactly
// (falls back to the raw response as the optimized text) — same defensive
// stance as parseNumberedVariants() in script-studio.ts.
export function parseOptimizationResponse(raw: string): ParsedOptimization {
  const optimizedMatch = raw.match(/OPTIMIZED:\s*([\s\S]*?)(?:\n+NEGATIVE:|$)/i);
  const negativeMatch = raw.match(/NEGATIVE:\s*([\s\S]*)$/i);
  const optimizedText = (optimizedMatch?.[1] ?? raw).trim();
  const negativePromptSuggestion = negativeMatch?.[1]?.trim() || undefined;
  return { optimizedText, negativePromptSuggestion };
}

export interface OptimizePromptInput {
  userId: string;
  kind: PromptKind;
  text: string;
  businessContext?: string;
  videoProjectId?: string;
  sceneId?: string;
}

export interface OptimizePromptResult extends ParsedOptimization {
  originalText: string;
}

// Records BOTH the original and the optimized text via recordPrompt() — the
// existing prompt-history mechanism (lib/prompts/service.ts) already gives
// every (userId, kind) pair a chronological list, which IS prompt
// versioning; this doesn't need a second, parallel "version" table.
export async function runPromptOptimization(input: OptimizePromptInput): Promise<OptimizePromptResult> {
  if (!input.text.trim()) {
    throw new Error("Cannot optimize an empty prompt.");
  }

  await recordPrompt({
    userId: input.userId,
    kind: input.kind,
    text: input.text,
    videoProjectId: input.videoProjectId,
    sceneId: input.sceneId,
  });

  const prompt = buildOptimizationPrompt(input.kind, input.text, input.businessContext);
  const context: GenerationContext = { userId: input.userId, videoProjectId: input.videoProjectId, sceneId: input.sceneId };
  const result = await generateScript({ prompt, contentLanguage: "EN" }, context, "prompt_optimization");
  const parsed = parseOptimizationResponse(result.text);

  await recordPrompt({
    userId: input.userId,
    kind: input.kind,
    text: parsed.optimizedText,
    videoProjectId: input.videoProjectId,
    sceneId: input.sceneId,
  });

  return { originalText: input.text, ...parsed };
}
