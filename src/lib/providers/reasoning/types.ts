import { z } from "zod";

import type { GenerationProvider } from "@/lib/generation/types";
import {
  aiBrollSchema,
  aiCaptionRevealSchema,
  aiCaptionStyleSchema,
  aiMusicSchema,
  aiSfxSchema,
  aiStickerSchema,
  aiTransitionSchema,
  type AIBroll,
  type AICaption,
  type AIMusic,
  type AISfx,
  type AISticker,
  type AITransitionPlan,
} from "@/lib/validations/ai-timeline";
import type { AIReeditResponse } from "@/lib/validations/ai-reedit";

// Phase 12 Module 4 — GPT-5.x combining Module 2's transcript + Module 3's
// persisted video-understanding output into the `captions` and `zoom`
// sections of Module 1's Timeline JSON. Scoped to exactly those two
// sections — sceneRemoval is Module 2/3's own decision, never re-derived
// here (this request doesn't even carry removal data).
//
// Phase 12 Module 5 extended the SAME call (not a second follow-up call —
// one API round trip, the model already has full transcript+video-
// analysis context loaded) to also propose `broll` WHERE/WHAT slots — see
// gpt5.provider.ts's TASK 3 for the stock-vs-generate heuristic prompt.
// This module never resolves them itself; ai-broll-resolver.ts does that
// against the raw proposal this adapter returns.
//
// Phase 12 Module 6 extended the SAME call once more for stickers (TASK
// 4), music+sfx (TASK 5), and transitions (TASK 6) — same one-round-trip
// reasoning, same "propose here, resolve elsewhere" split (ai-asset-
// resolver.ts for stickers/music/sfx; the translator's own
// mapTransitionsToSegmentBoundaries for transitions).

export interface ReasoningPlanRequest {
  words: { word: string; startMs: number; endMs: number }[];
  // Null when the source asset was AUDIO-only (Module 3 never ran) or
  // Module 3's own Gemini call failed — zoom naturally comes back empty
  // in that case (nothing to zoom INTO), captions still work fine
  // (transcript-only).
  videoAnalysis: {
    emphasisMoments: { startMs: number; endMs: number; description: string }[];
    emotionBeats: { startMs: number; endMs: number; emotion: string; description: string }[];
    visualContext: { startMs: number; endMs: number; description: string }[];
  } | null;
  // Free text from intake (aiIntakeSchema.stylePreset) — "if one was
  // chosen"; undefined is the common case today (no intake UI forces one
  // yet). The adapter picks a sensible neutral default when absent.
  stylePreset?: string;
  // Founder request (2026-07-18) — how aggressively TASK 3 (b-roll) should
  // propose cutaway windows. Undefined (no preference chosen, or a job
  // created before this field existed) keeps the adapter's pre-existing
  // calibration unchanged — see gpt5.provider.ts's densitySection.
  brollDensity?: "MINIMAL" | "BALANCED" | "HEAVY";
  // Founder policy (2026-07-18) — while true, TASK 3 must always choose
  // "stock" for every b-roll item it proposes (generation is disabled by
  // policy). This is prompt-level guidance only — the actual enforcement
  // is a hard backstop in ai-broll-resolver.ts that ignores this field's
  // own `source` choice regardless of what the model returns; the prompt
  // instruction exists so the model doesn't waste effort reasoning about
  // a "generate" case it should already know is off the table.
  brollStockOnly?: boolean;
  // Phase 12 Module 8 — pasted reference text from intake
  // (aiIntakeSchema.script), "if one was provided." Extra context ONLY
  // — never a timing source. The adapter's prompt instructs the model to
  // use it for correcting near-miss/misheard words in caption TEXT while
  // still using the real transcript's own word timestamps for every
  // caption's span, exactly like `words` above always has, script or not.
  referenceScript?: string;
  sourceDurationMs: number;
  // Phase 12 Module 6 — how many surviving segments the ALREADY-DECIDED
  // sceneRemoval list (Module 2/3, computed before this call runs) will
  // produce — the valid range for TASK 6's segment-boundary transition
  // encoding is [0, survivingSegmentCount-2]. 1 means "no internal
  // boundaries exist" (nothing removed, or the whole clip is one piece),
  // in which case the model should propose zero transitions.
  survivingSegmentCount: number;
  // How many times to re-prompt with the validation error after a
  // malformed response, before giving up (AI_EDIT_REASONING_REPAIR_MAX_
  // ATTEMPTS — read by ai-edit-jobs.ts, the orchestrator, same
  // "admin-config read at the orchestration layer, passed down as a
  // plain option" convention proposeSceneRemovals' silenceThresholdMs
  // already established). Defaults to 1 (the founder's own "retry once"
  // spec) if omitted.
  repairMaxAttempts?: number;
}

// zoom comes back WITHOUT clipId — see AI_ZOOM_SOURCE_CLIP_PLACEHOLDER's
// own doc comment (lib/validations/ai-timeline.ts) for why the model
// can't produce a real one.
export const reasoningZoomItemSchema = z
  .object({
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    scaleFrom: z.number().min(1).max(1000),
    scaleTo: z.number().min(1).max(1000),
  })
  .refine((v) => v.endMs > v.startMs, { message: "endMs must be after startMs" });
export type ReasoningZoomItem = z.infer<typeof reasoningZoomItemSchema>;

// Real incident (2026-07-22) — captions used to reuse Module 1's own
// aiCaptionSchema verbatim (ms-based startMs/endMs), the same "the model's
// raw output and the app's contract are the same schema" principle broll
// still follows below. Live verification found this genuinely broken: even
// with ZERO Hinglish/style-preset involvement, a plain baseline run's
// caption boundaries didn't land on the real transcript's own word
// timestamps (one caption's endMs was 1500ms when the words it actually
// contains end at 980ms — off by over half a second). GPT is reliable at
// deciding WHAT words to group into a caption (it can see the exact word
// list in the prompt) but not at re-estimating WHEN in free-floating
// milliseconds — an unforced, redundant task given AssemblyAI's own
// per-word timestamps (formatWords() in gpt5.provider.ts numbers every
// word) already exist and are accurate. So captions alone use a distinct
// raw shape: the model cites which numbered transcript words a caption
// spans, and gpt5.provider.ts's plan() computes the real startMs/endMs
// deterministically from req.words at those indices, never trusting a
// model-estimated timestamp. Every OTHER section (broll, stickers, etc.)
// keeps proposing genuine startMs/endMs directly, since those windows
// don't need to snap to a specific transcript word span the way captions
// (a word-for-word readout of what's being said) fundamentally do.
export const reasoningCaptionRawSchema = z
  .object({
    text: z.string().min(1),
    sourceWordStartIndex: z.number().int().min(0),
    sourceWordEndIndex: z.number().int().min(0),
    style: aiCaptionStyleSchema.optional(),
    reveal: aiCaptionRevealSchema.optional(),
  })
  .refine((v) => v.sourceWordEndIndex >= v.sourceWordStartIndex, {
    message: "sourceWordEndIndex must be >= sourceWordStartIndex",
  });
export type ReasoningCaptionRaw = z.infer<typeof reasoningCaptionRawSchema>;

// The raw shape the model must return, validated BEFORE anything here is
// trusted — broll reuses Module 1's own aiBrollSchema verbatim (no
// parallel/looser schema invented for the "AI's own output" vs. "the
// app's contract," they're the same schema), so validation failure here
// means the SAME failure the client would hit re-validating later.
// captions is the one deliberate exception — see reasoningCaptionRawSchema
// above. The model never fills resolvedAssetId/resolvedAssetUrl/
// resolutionNote on broll items (all optional on aiBrollSchema) —
// ai-broll-resolver.ts fills those in afterward.
export const reasoningPlanOutputSchema = z.object({
  captions: z.array(reasoningCaptionRawSchema),
  zoom: z.array(reasoningZoomItemSchema),
  broll: z.array(aiBrollSchema),
  stickers: z.array(aiStickerSchema).default([]),
  music: aiMusicSchema.optional(),
  sfx: z.array(aiSfxSchema).default([]),
  transitions: z.array(aiTransitionSchema).default([]),
});
export type ReasoningPlanOutput = z.infer<typeof reasoningPlanOutputSchema>;

// Fix (2026-08-06, founder-reported production incident — "AI Timeline
// Planning is failing") — reasoningPlanOutputSchema above validates the
// model's ENTIRE response as ONE object; gpt5.provider.ts USED TO run the
// whole thing through a single `.safeParse()`, which meant one invalid
// item ANYWHERE (a bad broll item, an empty caption string, an out-of-
// range sfx timestamp) failed the WHOLE response, and once repair
// attempts were exhausted, the caller (ai-edit-jobs.ts) reset ALL SEVEN
// sections — including perfectly valid captions/zoom/etc. that had
// nothing wrong with them — to empty arrays. `parsePlanOutputLeniently`
// replaces that all-or-nothing gate: each section's array is validated
// ITEM BY ITEM (`safeArraySection`), a bad item is dropped and its exact
// Zod issue recorded in `warnings` (still useful for a repair retry —
// gpt5.provider.ts's `runPlanJsonRepairLoop` still re-prompts with these
// specific errors while attempts remain, same "give the model a real
// chance to self-correct first" convention as before), while every OTHER
// item and section that DID validate survives untouched. Only a
// genuinely un-parseable response (not an object at all) loses everything
// — there's nothing to salvage from that shape. "music" is a lone object,
// not an array, so it gets its own single safeParse rather than
// safeArraySection.
function safeArraySection<T>(raw: unknown, itemSchema: z.ZodType<T>, sectionName: string, warnings: string[]): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(`"${sectionName}" was expected to be an array in the model's response but was not — treated as empty for this attempt.`);
    return [];
  }
  const kept: T[] = [];
  raw.forEach((item, i) => {
    const parsed = itemSchema.safeParse(item);
    if (parsed.success) {
      kept.push(parsed.data);
    } else {
      const detail = parsed.error.issues.map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("; ");
      warnings.push(`"${sectionName}[${i}]" failed validation and was dropped (${detail}).`);
    }
  });
  return kept;
}

export interface LenientPlanParseResult {
  data: ReasoningPlanOutput;
  // One entry per dropped item/section, human-readable — surfaced to
  // ai-edit-jobs.ts's `planningError` (advisory, never blocks the job)
  // and fed back into the repair prompt while attempts remain. Empty
  // array means every section validated cleanly.
  warnings: string[];
}

export function parsePlanOutputLeniently(raw: unknown): LenientPlanParseResult {
  const warnings: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      data: { captions: [], zoom: [], broll: [], stickers: [], sfx: [], transitions: [] },
      warnings: ["The model's response was not a JSON object with the expected sections — every section is empty for this attempt."],
    };
  }
  const obj = raw as Record<string, unknown>;
  const captions = safeArraySection(obj.captions, reasoningCaptionRawSchema, "captions", warnings);
  const zoom = safeArraySection(obj.zoom, reasoningZoomItemSchema, "zoom", warnings);
  const broll = safeArraySection(obj.broll, aiBrollSchema, "broll", warnings);
  const stickers = safeArraySection(obj.stickers, aiStickerSchema, "stickers", warnings);
  const sfx = safeArraySection(obj.sfx, aiSfxSchema, "sfx", warnings);
  const transitions = safeArraySection(obj.transitions, aiTransitionSchema, "transitions", warnings);

  let music: ReasoningPlanOutput["music"];
  if (obj.music !== undefined && obj.music !== null) {
    const parsedMusic = aiMusicSchema.safeParse(obj.music);
    if (parsedMusic.success) {
      music = parsedMusic.data;
    } else {
      const detail = parsedMusic.error.issues.map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("; ");
      warnings.push(`"music" failed validation and was dropped (${detail}).`);
    }
  }

  return { data: { captions, zoom, broll, stickers, music, sfx, transitions }, warnings };
}

export interface ReasoningPlanResult {
  captions: AICaption[];
  zoom: ReasoningZoomItem[];
  broll: AIBroll[];
  stickers: AISticker[];
  music?: AIMusic;
  sfx: AISfx[];
  transitions: AITransitionPlan[];
  providerRef?: string;
  usage?: { tokens?: number };
  // Fix (2026-08-06) — set (non-empty) when parsePlanOutputLeniently
  // dropped one or more invalid items/sections even after every repair
  // attempt was exhausted. Undefined/omitted means every section
  // validated cleanly — the common case. ai-edit-jobs.ts surfaces this via
  // its existing `planningError` field so degradation is never silent,
  // without discarding the sections that DID come back valid.
  warnings?: string[];
}

// Phase 12 Module 9 — Prompt-based re-edit. A second, genuinely different
// capability on the SAME reasoning category/provider (not a second
// adapter) — `plan()` produces a whole multi-section Timeline JSON from a
// transcript; `reEdit()` interprets ONE free-text instruction about ONE
// already-placed clip into ONE of a small, fixed operation set (see
// lib/validations/ai-reedit.ts). Deliberately scoped to a single clip —
// no multi-clip/whole-timeline instructions, per the module's own
// DO-NOT-build list.
export interface ReasoningReeditRequest {
  instruction: string;
  clip: {
    durationMs: number;
    transform: { scale: number; position: { x: number; y: number }; rotation: number; opacity: number } | null;
    // True when the clip's OWN scale property carries real keyframes
    // (a zoom animation) — distinct from `transform.scale`, which is
    // always the current/base value regardless of whether it's animated.
    hasZoomKeyframes: boolean;
    caption: { text: string; reveal: { mode: string; unitDurationMs: number; style: string; highlightColor: string } | null } | null;
    adjacentTransitions: { side: "before" | "after"; type: string; durationMs: number }[];
  };
  repairMaxAttempts?: number;
}

export interface ReasoningReeditResult {
  response: AIReeditResponse;
  providerRef?: string;
  usage?: { tokens?: number };
}

export interface ReasoningProvider extends GenerationProvider {
  plan(req: ReasoningPlanRequest, signal?: AbortSignal): Promise<ReasoningPlanResult>;
  reEdit(req: ReasoningReeditRequest, signal?: AbortSignal): Promise<ReasoningReeditResult>;
}

// Phase 12 Module 10 — costUsd is attached by the Generation Engine itself
// (runGeneration, generation/engine.ts), not by any ReasoningProvider
// adapter — real per-call vendor cost, for the AI Auto-Editor cost preview.
export type ReasoningPlanResultWithProvider = ReasoningPlanResult & { providerId: string; costUsd?: number };
export type ReasoningReeditResultWithProvider = ReasoningReeditResult & { providerId: string; costUsd?: number };
