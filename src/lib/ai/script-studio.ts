import { generateScript } from "@/lib/generation";
import type { GenerationContext } from "@/lib/generation";

// Script Studio (Milestone 8) — Rewrite/Expand/Shorten/Translate/Hook/CTA are
// all just different prompts over the SAME generic LLMProvider.generate()
// contract (prompt: string) — no provider interface changes, no new
// generation call sites beyond generateScript() itself (requirement 11).
// Pure prompt-building/parsing here is unit-tested without touching the
// Generation Engine; runScriptTransform/runScriptVariants are the thin
// wrappers that actually call it.

export type ScriptTransformOperation = "rewrite" | "expand" | "shorten" | "translate";
export type ScriptVariantKind = "hook" | "cta";

const LANGUAGE_NAME: Record<string, string> = {
  EN: "English",
  HI: "Hindi",
  HINGLISH: "Hinglish (Hindi-English code-mixed, Latin script)",
};

export interface TransformOptions {
  tone?: string;
  targetLanguage?: string;
}

export function buildTransformPrompt(
  operation: ScriptTransformOperation,
  text: string,
  opts: TransformOptions = {}
): string {
  switch (operation) {
    case "rewrite":
      return `Rewrite the following video script${
        opts.tone ? ` in a ${opts.tone.toLowerCase()} tone` : ""
      }, keeping the same structure ([HOOK]/[BODY]/[CTA] if present) and the same core meaning. Return only the rewritten script, nothing else.\n\nOriginal:\n${text}`;
    case "expand":
      return `Expand the following video script with more descriptive, persuasive detail, keeping the same structure. Return only the expanded script, nothing else.\n\nOriginal:\n${text}`;
    case "shorten":
      return `Shorten the following video script to be more concise while keeping its core message and structure. Return only the shortened script, nothing else.\n\nOriginal:\n${text}`;
    case "translate":
      return `Translate the following video script into ${
        LANGUAGE_NAME[opts.targetLanguage ?? "EN"] ?? "English"
      }, keeping the same structure. Return only the translated script, nothing else.\n\nOriginal:\n${text}`;
  }
}

export function buildVariantsPrompt(kind: ScriptVariantKind, script: string, count: number): string {
  const what = kind === "hook" ? "alternative opening hook lines" : "alternative closing call-to-action lines";
  return `Based on the following video script, write ${count} ${what}, each on its own line, numbered "1.", "2.", etc. Return only the numbered list, nothing else.\n\nScript:\n${script}`;
}

// Parses "1. foo\n2. bar" style responses — tolerant of missing numbering
// (falls back to one variant per non-empty line) since real LLM output isn't
// always perfectly formatted.
export function parseNumberedVariants(text: string, count: number): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return lines.slice(0, count);
}

export interface TransformResult {
  text: string;
  prompt: string;
}

export async function runScriptTransform(
  text: string,
  operation: ScriptTransformOperation,
  contentLanguage: "EN" | "HI" | "HINGLISH",
  opts: TransformOptions,
  context?: GenerationContext
): Promise<TransformResult> {
  const prompt = buildTransformPrompt(operation, text, opts);
  const effectiveLanguage = (opts.targetLanguage as typeof contentLanguage) ?? contentLanguage;
  const result = await generateScript({ prompt, contentLanguage: effectiveLanguage }, context, `script_${operation}`);
  return { text: result.text.trim(), prompt };
}

export interface VariantsResult {
  variants: string[];
  prompt: string;
}

export async function runScriptVariants(
  script: string,
  kind: ScriptVariantKind,
  count: number,
  contentLanguage: "EN" | "HI" | "HINGLISH",
  context?: GenerationContext
): Promise<VariantsResult> {
  const prompt = buildVariantsPrompt(kind, script, count);
  const result = await generateScript({ prompt, contentLanguage }, context, `script_${kind}`);
  const variants = parseNumberedVariants(result.text, count);
  return { variants, prompt };
}
