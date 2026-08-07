import { z } from "zod";

import type { GenerationProvider } from "@/lib/generation/types";
import {
  AI_QUALITY_CATEGORIES,
  aiBrollSchema,
  aiCaptionHighlightWordSchema,
  aiCaptionRevealSchema,
  aiCaptionStyleSchema,
  aiMusicSchema,
  aiSfxSchema,
  aiStickerSchema,
  aiStoryBeatSchema,
  aiTransitionSchema,
  type AIBroll,
  type AICaption,
  type AiQualityCategory,
  type AIMusic,
  type AISfx,
  type AISticker,
  type AIStoryBeat,
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
    // AI Video Director (2026-08-07) — see aiCaptionSchema's own doc
    // comment (validations/ai-timeline.ts) for the shared reason-field
    // convention. Optional so plan()'s own legacy zoom output (which
    // never sets this) keeps parsing unchanged.
    reason: z.string().min(1).max(280).optional(),
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
    // Power-word highlighting (2026-08-07) — see aiCaptionHighlightWordSchema's
    // own doc comment (validations/ai-timeline.ts).
    highlightWords: z.array(aiCaptionHighlightWordSchema).max(4).optional(),
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

// ---------------------------------------------------------------------
// AI Video Director (2026-08-07) — 5 new, focused agent calls replacing
// slices of `plan()`'s single combined prompt, per the approved plan
// (purring-foraging-graham.md). `plan()`/`reEdit()` above are UNCHANGED —
// these are purely additive methods on ReasoningProvider, used only when
// AI_EDIT_DIRECTOR_PIPELINE_ENABLED is on (director/orchestrator.ts).
// Each request only carries what that agent's own prompt genuinely needs
// (never the whole job context), matching the data-dependency chain the
// orchestrator threads through DirectorContext: Story -> Captions ->
// Visuals (broll+motion+transitions) -> Audio (music+sfx) -> Quality
// Reviewer.
// ---------------------------------------------------------------------

// Agent 3 — Story + Hook + Retention. Produces the shared narrative spine
// (story rhythm: hook -> curiosity -> value -> pattern interrupt ->
// visual reward -> proof -> cta) every downstream agent consumes.
export interface ReasoningStoryRequest {
  words: ReasoningPlanRequest["words"];
  videoAnalysis: ReasoningPlanRequest["videoAnalysis"];
  stylePreset?: string;
  referenceScript?: string;
  sourceDurationMs: number;
  repairMaxAttempts?: number;
}

// Beats use genuine timeline-absolute ms (same convention broll/zoom
// already use in plan() — only captions cite word INDICES, see
// reasoningCaptionRawSchema's own doc comment for why). Reuses
// aiStoryBeatSchema verbatim — same "the model's raw output and the
// app's own contract are the same schema" principle broll already
// established, not a parallel looser shape.
export const reasoningStoryOutputSchema = z.object({
  beats: z.array(aiStoryBeatSchema).min(1),
  hookText: z.string().min(1).max(200),
  hookStrengthReason: z.string().min(1).max(280).optional(),
  // LLM-judgment only — an opinion from this one call, never a trained
  // retention-prediction model. See aiStoryPlanSchema's own doc comment.
  retentionScore: z.number().min(0).max(100),
  retentionRisks: z.array(z.string().min(1)).max(6).default([]),
  ctaPresent: z.boolean().optional(),
  ctaText: z.string().min(1).max(200).optional(),
});
export type ReasoningStoryOutput = z.infer<typeof reasoningStoryOutputSchema>;

export interface ReasoningStoryResult {
  beats: AIStoryBeat[];
  hookText: string;
  hookStrengthReason?: string;
  retentionScore: number;
  retentionRisks: string[];
  ctaPresent?: boolean;
  ctaText?: string;
  providerRef?: string;
  usage?: { tokens?: number };
  warnings?: string[];
}

// Agent 4 — Captions. Reuses reasoningCaptionRawSchema/resolveCaptionTiming
// VERBATIM (the already-built viral/Hinglish/power-word/highlight engine —
// no rebuild), just now informed by the Story agent's beats so the hook
// and CTA lines land where the narrative actually puts them.
export interface ReasoningCaptionRequest {
  words: ReasoningPlanRequest["words"];
  stylePreset?: string;
  referenceScript?: string;
  storyBeats: AIStoryBeat[];
  hookText?: string;
  ctaText?: string;
  repairMaxAttempts?: number;
}

export interface ReasoningCaptionResult {
  captions: AICaption[];
  providerRef?: string;
  usage?: { tokens?: number };
  warnings?: string[];
}

// Agent 5 — "Visuals": B-roll + Motion (zoom/camera-punch) + Transitions.
// Needs the finalized captions (for real cut/zoom/broll timing) and the
// story beats (to know where pattern-interrupt/visual-reward moments
// land). Carries the variety ledger's "already used" lists so the model
// itself tries not to repeat a style/type — see variety-ledger.ts.
export interface ReasoningVisualsRequest {
  words: ReasoningPlanRequest["words"];
  videoAnalysis: ReasoningPlanRequest["videoAnalysis"];
  captions: AICaption[];
  storyBeats: AIStoryBeat[];
  brollDensity?: "MINIMAL" | "BALANCED" | "HEAVY";
  brollStockOnly?: boolean;
  sourceDurationMs: number;
  survivingSegmentCount: number;
  usedZoomStyles?: string[];
  usedTransitionTypes?: string[];
  usedStickerQueries?: string[];
  usedBrollStyles?: string[];
  repairMaxAttempts?: number;
}

export const reasoningVisualsOutputSchema = z.object({
  zoom: z.array(reasoningZoomItemSchema),
  broll: z.array(aiBrollSchema),
  stickers: z.array(aiStickerSchema).default([]),
  transitions: z.array(aiTransitionSchema).default([]),
});
export type ReasoningVisualsOutput = z.infer<typeof reasoningVisualsOutputSchema>;

export interface ReasoningVisualsResult {
  zoom: ReasoningZoomItem[];
  broll: AIBroll[];
  stickers: AISticker[];
  transitions: AITransitionPlan[];
  providerRef?: string;
  usage?: { tokens?: number };
  warnings?: string[];
}

// Agent 6 — "Audio": Music + SFX. Needs the finished visual/caption
// timeline to duck/sync against, per the brief ("automatically duck
// speech" / SFX tied to real timeline events). Reuses the existing
// ducking mechanism (EditorTrack.duckingEnabled/duckingVoiceTrackIds)
// unmodified — only the selection prompt gets richer.
export interface ReasoningAudioRequest {
  words: ReasoningPlanRequest["words"];
  storyBeats: AIStoryBeat[];
  captions: AICaption[];
  broll: AIBroll[];
  transitions: AITransitionPlan[];
  sourceDurationMs: number;
  usedSfxQueries?: string[];
  repairMaxAttempts?: number;
}

export const reasoningAudioOutputSchema = z.object({
  music: aiMusicSchema.optional(),
  sfx: z.array(aiSfxSchema).default([]),
});
export type ReasoningAudioOutput = z.infer<typeof reasoningAudioOutputSchema>;

export interface ReasoningAudioResult {
  music?: AIMusic;
  sfx: AISfx[];
  providerRef?: string;
  usage?: { tokens?: number };
  warnings?: string[];
}

// Agent 7 — Quality Reviewer. Scores ONLY the 4 categories that genuinely
// require judgment (Hook/Emotion/Retention/Story Flow) — everything
// structurally measurable (Captions/B-roll/Visual Variety/Pacing/Music/
// SFX) is scored deterministically by quality-review.ts without any LLM
// call. `deterministicScores` is fed IN so this call can reason about the
// full picture without re-deriving what's already known.
export interface ReasoningQualityReviewRequest {
  storySummary: { hookText: string; beats: AIStoryBeat[]; retentionScore: number };
  captions: AICaption[];
  broll: AIBroll[];
  zoom: ReasoningZoomItem[];
  stickers: AISticker[];
  transitions: AITransitionPlan[];
  music?: AIMusic;
  sfx: AISfx[];
  deterministicScores: Partial<Record<AiQualityCategory, number>>;
  sourceDurationMs: number;
  repairMaxAttempts?: number;
}

export const reasoningQualityReviewOutputSchema = z.object({
  hookScore: z.number().min(0).max(100),
  hookNote: z.string().min(1).max(280).optional(),
  emotionScore: z.number().min(0).max(100),
  emotionNote: z.string().min(1).max(280).optional(),
  retentionScore: z.number().min(0).max(100),
  retentionNote: z.string().min(1).max(280).optional(),
  storyFlowScore: z.number().min(0).max(100),
  storyFlowNote: z.string().min(1).max(280).optional(),
  // Which categories (from the full AI_QUALITY_CATEGORIES set, not just
  // this call's own 4 judged ones) the model itself flags as weak —
  // advisory input to quality-review.ts's own routing; the deterministic
  // categories' weakness is still decided by their own scorers, not by
  // asking the model to self-report on numbers it never computed.
  weakCategories: z.array(z.enum(AI_QUALITY_CATEGORIES)).default([]),
});
export type ReasoningQualityReviewOutput = z.infer<typeof reasoningQualityReviewOutputSchema>;

export interface ReasoningQualityReviewResult {
  hookScore: number;
  hookNote?: string;
  emotionScore: number;
  emotionNote?: string;
  retentionScore: number;
  retentionNote?: string;
  storyFlowScore: number;
  storyFlowNote?: string;
  weakCategories: AiQualityCategory[];
  providerRef?: string;
  usage?: { tokens?: number };
  warnings?: string[];
}

export interface ReasoningProvider extends GenerationProvider {
  plan(req: ReasoningPlanRequest, signal?: AbortSignal): Promise<ReasoningPlanResult>;
  reEdit(req: ReasoningReeditRequest, signal?: AbortSignal): Promise<ReasoningReeditResult>;
  // AI Video Director (2026-08-07) — additive, see the block comment above.
  planStory(req: ReasoningStoryRequest, signal?: AbortSignal): Promise<ReasoningStoryResult>;
  planCaptions(req: ReasoningCaptionRequest, signal?: AbortSignal): Promise<ReasoningCaptionResult>;
  planVisuals(req: ReasoningVisualsRequest, signal?: AbortSignal): Promise<ReasoningVisualsResult>;
  planAudio(req: ReasoningAudioRequest, signal?: AbortSignal): Promise<ReasoningAudioResult>;
  reviewQuality(req: ReasoningQualityReviewRequest, signal?: AbortSignal): Promise<ReasoningQualityReviewResult>;
}

// Phase 12 Module 10 — costUsd is attached by the Generation Engine itself
// (runGeneration, generation/engine.ts), not by any ReasoningProvider
// adapter — real per-call vendor cost, for the AI Auto-Editor cost preview.
export type ReasoningPlanResultWithProvider = ReasoningPlanResult & { providerId: string; costUsd?: number };
export type ReasoningReeditResultWithProvider = ReasoningReeditResult & { providerId: string; costUsd?: number };

// AI Video Director (2026-08-07) — same providerId/costUsd attachment
// convention as the two above, one per new agent capability.
export type ReasoningStoryResultWithProvider = ReasoningStoryResult & { providerId: string; costUsd?: number };
export type ReasoningCaptionResultWithProvider = ReasoningCaptionResult & { providerId: string; costUsd?: number };
export type ReasoningVisualsResultWithProvider = ReasoningVisualsResult & { providerId: string; costUsd?: number };
export type ReasoningAudioResultWithProvider = ReasoningAudioResult & { providerId: string; costUsd?: number };
export type ReasoningQualityReviewResultWithProvider = ReasoningQualityReviewResult & { providerId: string; costUsd?: number };
