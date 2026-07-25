import { generateScript } from "@/lib/generation";
import type { GenerationContext } from "@/lib/generation";

// Milestone 11 Part 3 — AI Context Understanding. Same shape as
// lib/ai/script-studio.ts and lib/prompts/optimizer.ts: pure prompt-
// building/parsing here (unit-tested without the Generation Engine),
// routed through generateScript() — the SAME LLM call every other text
// operation already uses, not a parallel "analysis model" call path.
// Numbered-section plain-text format, matching this codebase's only
// structured-output convention (no JSON-mode precedent anywhere here).

export interface ContextAnalysisInput {
  order: number;
  text: string;
}

export const CONTEXT_ANALYSIS_BATCH_SIZE = 8;

// Pure batching helper — kept separate from runContextAnalysisBatch() so the
// "how many sentences per LLM call" policy is unit-testable without a
// generation call.
export function chunkSegments<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length ? [items] : [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface SegmentAnalysis {
  companies: string[];
  products: string[];
  numbers: string[];
  dates: string[];
  locations: string[];
  concepts: string[];
  statistics: string[];
  isHook: boolean;
  isCTA: boolean;
  emotion: string | null;
  tags: string[];
}

export function emptySegmentAnalysis(): SegmentAnalysis {
  return {
    companies: [],
    products: [],
    numbers: [],
    dates: [],
    locations: [],
    concepts: [],
    statistics: [],
    isHook: false,
    isCTA: false,
    emotion: null,
    tags: [],
  };
}

// Batches several sentences per LLM call (cost/context-window reasons) —
// the outcome "every sentence gets analyzed" holds, the call-count just
// isn't 1:1 with sentence count.
export function buildContextAnalysisPrompt(segments: ContextAnalysisInput[]): string {
  const lines = [
    "You are analyzing sentences from a talking-head marketing video's transcript.",
    "For EACH numbered sentence below, extract the following. Respond in exactly this format, repeated once per sentence, in order:",
    "",
    "SENTENCE <n>:",
    "COMPANIES: comma-separated company/brand names, or NONE",
    "PRODUCTS: comma-separated product/service names, or NONE",
    "NUMBERS: comma-separated standalone numbers mentioned, or NONE",
    "DATES: comma-separated dates/time references, or NONE",
    "LOCATIONS: comma-separated places, or NONE",
    "CONCEPTS: comma-separated marketing concepts (e.g. urgency, social proof, value), or NONE",
    "STATISTICS: comma-separated statistics/data points, or NONE",
    "HOOK: YES if this sentence is an attention-grabbing opening hook, else NO",
    "CTA: YES if this sentence is a call-to-action, else NO",
    "EMOTION: one word describing the dominant emotion (e.g. excited, urgent, reassuring, neutral)",
    "TAGS: comma-separated short semantic tags summarizing the sentence",
    "",
    "Sentences:",
  ];
  for (const seg of segments) {
    lines.push(`${seg.order + 1}. ${seg.text}`);
  }
  return lines.join("\n");
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed || /^none$/i.test(trimmed)) return [];
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseYesNo(raw: string | undefined): boolean {
  return /^\s*yes/i.test(raw ?? "");
}

// Tolerant of a model that drifts slightly from the requested format —
// missing fields default to empty/NONE rather than throwing, same defensive
// stance as parseOptimizationResponse() in lib/prompts/optimizer.ts. Always
// returns exactly `count` entries (index-aligned with the input segments),
// backfilling with emptySegmentAnalysis() for anything the model skipped.
export function parseContextAnalysisResponse(raw: string, count: number): SegmentAnalysis[] {
  const blocks = raw.split(/(?=SENTENCE\s+\d+\s*:)/i);
  const byIndex = new Map<number, SegmentAnalysis>();

  for (const block of blocks) {
    const headerMatch = block.match(/SENTENCE\s+(\d+)\s*:/i);
    if (!headerMatch) continue;
    const index = Number(headerMatch[1]) - 1;
    if (index < 0 || index >= count) continue;

    const field = (name: string) => block.match(new RegExp(`${name}:\\s*(.*)`, "i"))?.[1]?.trim();

    byIndex.set(index, {
      companies: parseList(field("COMPANIES")),
      products: parseList(field("PRODUCTS")),
      numbers: parseList(field("NUMBERS")),
      dates: parseList(field("DATES")),
      locations: parseList(field("LOCATIONS")),
      concepts: parseList(field("CONCEPTS")),
      statistics: parseList(field("STATISTICS")),
      isHook: parseYesNo(field("HOOK")),
      isCTA: parseYesNo(field("CTA")),
      emotion: field("EMOTION")?.replace(/^none$/i, "").trim() || null,
      tags: parseList(field("TAGS")),
    });
  }

  return Array.from({ length: count }, (_, i) => byIndex.get(i) ?? emptySegmentAnalysis());
}

export interface ContextAnalysisResult {
  analyses: SegmentAnalysis[];
  prompt: string;
}

// Thin wrapper — one LLM call per batch. Callers (lib/render/pipeline.ts's
// processAnalyzeJob) chunk the full segment list into batches themselves so
// this stays a pure-ish single-call function, easy to unit test the
// surrounding chunking separately from the LLM call.
export async function runContextAnalysisBatch(
  segments: ContextAnalysisInput[],
  context?: GenerationContext
): Promise<ContextAnalysisResult> {
  const prompt = buildContextAnalysisPrompt(segments);
  const result = await generateScript({ prompt, contentLanguage: "EN" }, context, "talking_head_context_analysis");
  return { analyses: parseContextAnalysisResponse(result.text, segments.length), prompt };
}
