import { z } from "zod";
import { AI_BROLL_DENSITIES, EDITOR_TRANSITION_TYPES } from "./video-editor";

// AI Auto-Editor (Phase 12 Module 1) — the AI's complete output contract:
// one versioned "Timeline JSON" document per AI editing pass, matching the
// founder's confirmed 13-step flow. Every section is designed to map onto
// an EXISTING editor concept (Modules 2-9's own clips/tracks/transitions/
// keyframes, and the Audio Ducking work) — nothing here requires a NEW
// editor-side data model. See ai-timeline-translator.ts
// (src/app/editor/[projectId]/) for how a parsed plan becomes a real
// Command sequence — this file only defines and validates the SHAPE.
//
// Standing rule for all of Phase 12 (per the founder): every AI-driven
// edit must execute through the exact same Command pattern manual editing
// already uses. This schema is the bridge's INPUT contract; the
// translator is the bridge itself.

export const AI_TIMELINE_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------
// intake
// ---------------------------------------------------------------------

// Mirrors createEditorProjectSchema's own aspect-ratio restriction
// (video-editor.ts) — RATIO_4_5/CUSTOM exist as client-only presets but
// aren't valid at project-creation time, so the AI's intake step doesn't
// offer them either.
export const AI_INTAKE_ASPECT_RATIOS = ["RATIO_16_9", "RATIO_9_16", "RATIO_1_1"] as const;

export const aiIntakeSchema = z.object({
  aspectRatio: z.enum(AI_INTAKE_ASPECT_RATIOS),
  stylePreset: z.string().min(1).max(80).optional(),
  brollDensity: z.enum(AI_BROLL_DENSITIES).optional(),
  // Founder policy (2026-07-18) — see AiEditJob.brollStockOnly's own doc
  // comment (prisma/schema.prisma). Echoed back for the same "record of
  // what informed this plan" reason every other intake field is.
  brollStockOnly: z.boolean().optional(),
  // Phase 12 Module 8 — pasted reference text (not a file upload — this
  // app has no script-parsing pipeline, and a plain paste-text field
  // covers the same "if I have one, use it" case with far less new
  // surface area). Echoed back into the persisted plan for the same
  // reason stylePreset already is: a record of what actually informed
  // this plan, not re-derived. Never a substitute for real transcription
  // — only ever used as extra context for correcting near-miss caption
  // TEXT; timing always comes from the real transcript's own words.
  script: z.string().min(1).max(20_000).optional(),
});
export type AIIntake = z.infer<typeof aiIntakeSchema>;

// ---------------------------------------------------------------------
// Shared "a time range on the timeline" refinement
// ---------------------------------------------------------------------

function isValidRange(v: { startMs: number; endMs: number }): boolean {
  return v.endMs > v.startMs;
}
const RANGE_ERROR = { message: "endMs must be after startMs" };

// ---------------------------------------------------------------------
// sceneRemoval — unwanted content to cut (silence/filler/bad takes/etc.)
// ---------------------------------------------------------------------

export const AI_SCENE_REMOVAL_REASONS = ["silence", "filler_word", "bad_take", "duplicate_take", "quality_issue"] as const;
export type AISceneRemovalReason = (typeof AI_SCENE_REMOVAL_REASONS)[number];

export const aiSceneRemovalSchema = z
  .object({
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    reason: z.enum(AI_SCENE_REMOVAL_REASONS),
  })
  .refine(isValidRange, RANGE_ERROR);
export type AISceneRemoval = z.infer<typeof aiSceneRemovalSchema>;

// ---------------------------------------------------------------------
// captions — mirrors ClipContent's real text/style fields (types.ts) and
// RevealConfig exactly (lib/video-editor/text-style.ts), NOT a simplified
// alternate shape the translator would have to guess-fill.
// ---------------------------------------------------------------------

// Exported (2026-07-22) so gpt5.provider.ts's own raw-response schema
// (indices, not ms — see reasoningCaptionRawSchema in ./reasoning/types.ts
// for why) can reuse these verbatim instead of re-declaring them — only
// the caption's startMs/endMs representation differs between the model's
// raw output and this app's own contract, never style/reveal.
export const aiCaptionRevealSchema = z.object({
  mode: z.enum(["NONE", "WORD", "CHARACTER", "KARAOKE"]),
  unitDurationMs: z.number().int().min(20).max(2000).default(200),
  style: z.enum(["FADE", "POP", "COLOR_SWEEP"]).default("FADE"),
  highlightColor: z.string().min(1).default("#FFD60A"),
});

export const aiCaptionStyleSchema = z.object({
  fontFamily: z.string().min(1).optional(),
  fontSize: z.number().int().min(8).max(200).optional(),
  color: z.string().min(1).optional(),
  // Bold-caption support (2026-07-21) — mirrors ClipContent's own
  // fontWeight (Module 7, manual editing), a numeric CSS font-weight
  // scale (400 normal, 700 bold, 900 heaviest). Previously the AI had no
  // way to express "bold" at all — the schema simply didn't carry it, and
  // the translator had nothing to map even if a model somehow guessed it.
  fontWeight: z.number().int().min(100).max(900).optional(),
  // Maps to ClipContent's y (0..1 fraction-of-frame) via the translator —
  // a preset the AI can reason about directly, rather than asking it to
  // pick a raw fraction.
  position: z.enum(["top", "center", "bottom"]).optional(),
});

// Power-word highlighting (2026-08-07) — the AI names WHICH word(s) in this
// caption's own `text` deserve a distinct color and what color, rather than
// producing character offsets itself (error-prone for a model to get
// exactly right character-for-character). ai-timeline-translator.ts
// resolves each `word` to its real character range within `text` (case-
// insensitive, first occurrence) and builds a real RichTextRun from it —
// the AI never touches offsets directly, same "AI proposes semantics, app
// computes the precise mechanics" convention captions' own
// sourceWordStartIndex/sourceWordEndIndex already established one layer up.
export const aiCaptionHighlightWordSchema = z.object({
  word: z.string().min(1).max(30),
  color: z.string().min(1).max(20),
});
export type AICaptionHighlightWord = z.infer<typeof aiCaptionHighlightWordSchema>;

export const aiCaptionSchema = z
  .object({
    text: z.string().min(1),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    style: aiCaptionStyleSchema.optional(),
    // Optional — the translator falls back to DEFAULT_REVEAL_CONFIG's
    // mode/style/highlightColor (WORD-by-word being the sensible AI
    // Auto-Editor default) when omitted, not a hard requirement on every
    // caption item.
    reveal: aiCaptionRevealSchema.optional(),
    // Power-word highlighting — capped at a small number so a caption
    // never becomes a wall of competing colors; most captions have zero.
    highlightWords: z.array(aiCaptionHighlightWordSchema).max(4).optional(),
  })
  .refine(isValidRange, RANGE_ERROR);
export type AICaption = z.infer<typeof aiCaptionSchema>;

// ---------------------------------------------------------------------
// zoom — scale keyframes on an EXISTING clip (Module 6 Motion Engine)
// ---------------------------------------------------------------------

// Phase 12 Module 4 — the REASONING call (GPT-5.x) proposes zoom windows
// in SOURCE-relative time, the same convention sceneRemoval already
// established (Module 2/3), since it has no way to know the real,
// server-minted timeline clip id in advance. It emits this placeholder
// for `clipId`; the apply step (ai-auto-edit-panel.tsx's handleApply)
// substitutes the actual target clip's id — and remaps startMs/endMs to
// timeline-absolute — the same moment sceneRemoval's own windows get
// remapped, right before translateAITimelinePlan() runs.
export const AI_ZOOM_SOURCE_CLIP_PLACEHOLDER = "__source_clip__";

export const aiZoomSchema = z
  .object({
    clipId: z.string().min(1),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    // Percentage, matching ClipTransform.scale's own convention (100 =
    // native size) — NOT a 0..1 or 1..N multiplier.
    scaleFrom: z.number().min(1).max(1000),
    scaleTo: z.number().min(1).max(1000),
  })
  .refine(isValidRange, RANGE_ERROR);
export type AIZoom = z.infer<typeof aiZoomSchema>;

// ---------------------------------------------------------------------
// broll — stock search OR generation fallback, decided per-item by the
// planning step (not a global switch)
// ---------------------------------------------------------------------

export const AI_BROLL_SOURCES = ["stock", "generate"] as const;
export const AI_GENERATION_KINDS = ["image", "video"] as const;

export const aiBrollSchema = z
  .object({
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    // A hint like "broll" or "overlay", not a real track id yet — the
    // translator resolves this to an existing track or a
    // createAddTrackAndClipCommand for a new one.
    trackHint: z.string().min(1),
    source: z.enum(AI_BROLL_SOURCES),
    searchQuery: z.string().min(1).optional(),
    // Query expansion (2026-08-07) — semantic/synonym/category-expanded
    // variants of `searchQuery` (e.g. "doctor" -> ["doctor consultation",
    // "hospital", "patient", "clinic", "stethoscope"]), tried IN ORDER by
    // the resolver (ai-broll-resolver.ts's resolveStockBroll) before it
    // falls back to its own token-dropping broadening — a semantically
    // related query ("hospital") finds real, relevant stock footage far
    // more often than a purely narrower/broader phrasing of the SAME
    // literal words ever could. `searchQuery` stays the PRIMARY query
    // (first tried, and what relevance is always scored against — see
    // buildBroadenedQueries' own doc comment for why scoring stays
    // anchored to one fixed query even as the search text varies);
    // `searchQueries` is additive, optional, and empty/absent means
    // "behave exactly as before this field existed."
    searchQueries: z.array(z.string().min(1)).max(8).optional(),
    generation: z
      .object({
        kind: z.enum(AI_GENERATION_KINDS),
        prompt: z.string().min(1),
      })
      .optional(),
    // Filled in by a LATER module (stock search / generation execution),
    // not this one. When absent, the translator emits an explicit
    // "needs resolution" marker instead of silently dropping the item —
    // see ai-timeline-translator.ts's UnresolvedBrollItem.
    resolvedAssetId: z.string().min(1).optional(),
    // Phase 12 Module 5 — set alongside resolvedAssetId, purely for the
    // review UI (a thumbnail/preview URL to show before apply) so the
    // panel never needs a second round trip to look the asset back up.
    // The translator/apply path only ever reads resolvedAssetId; this is
    // display-only, same "client only displays/passes through" convention
    // transcript/videoAnalysis already use on AiEditJobView.
    resolvedAssetUrl: z.string().min(1).optional(),
    // Phase 12 Module 5 — set ONLY when resolution was attempted and
    // failed (no usable stock match, generation unavailable/errored) —
    // the founder's own "clearly flag any that failed to resolve rather
    // than silently skipping them" requirement. Absent + no
    // resolvedAssetId means "not attempted yet"; present + no
    // resolvedAssetId means "attempted and failed, here's why."
    resolutionNote: z.string().min(1).optional(),
    // Phase 12 Module 10 — real vendor cost this ITEM's resolution
    // incurred, threaded straight from the Generation Engine's own
    // computeCost() (see generation/engine.ts's runGeneration) — never
    // recomputed here. 0 for a stock match (no vendor generation call);
    // absent means resolution wasn't attempted (mirrors resolutionNote's
    // own "absent vs. present" convention).
    costUsd: z.number().min(0).optional(),
  })
  .refine(isValidRange, RANGE_ERROR)
  .refine((v) => v.source !== "stock" || !!v.searchQuery, { message: "source:\"stock\" requires searchQuery" })
  .refine((v) => v.source !== "generate" || !!v.generation, { message: "source:\"generate\" requires a generation block" });
export type AIBroll = z.infer<typeof aiBrollSchema>;

// ---------------------------------------------------------------------
// stickers — OVERLAY track clips
// ---------------------------------------------------------------------

export const aiStickerSchema = z
  .object({
    assetQuery: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    // Fraction-of-frame (0..1), matching ClipContent.x/y's own convention.
    position: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
    // Phase 12 Module 6 — same three-field "resolution result" convention
    // aiBrollSchema already established (Module 5): resolvedAssetUrl is
    // display-only (review UI thumbnail), resolutionNote is set ONLY when
    // resolution was attempted and failed (curated library had no match
    // AND stock icon search came back empty) — never a forced placeholder,
    // per the "don't fake it" principle applied everywhere else here.
    resolvedAssetUrl: z.string().min(1).optional(),
    resolutionNote: z.string().min(1).optional(),
  })
  .refine(isValidRange, RANGE_ERROR)
  .refine((v) => !!v.assetQuery || !!v.assetId, { message: "either assetQuery or assetId is required" });
export type AISticker = z.infer<typeof aiStickerSchema>;

// ---------------------------------------------------------------------
// music — AUDIO/MUSIC track clip, wires directly into the EXISTING Audio
// Ducking feature (EditorTrack.duckingEnabled/duckingVoiceTrackIds) —
// reused, not reimplemented.
// ---------------------------------------------------------------------

export const aiMusicSchema = z
  .object({
    searchQuery: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    duckingEnabled: z.boolean().default(true),
    // A hint like "voice" / "narration" — the translator resolves this to
    // real VOICE-subtype track id(s) for duckingVoiceTrackIds. Omitted =
    // the ducking feature's own existing "auto: every VOICE track" default
    // (empty duckingVoiceTrackIds array).
    duckingVoiceTrackHint: z.string().min(1).optional(),
    // Phase 12 Module 6 — see aiStickerSchema's own doc comment for the
    // shared resolution-result convention.
    resolvedAssetUrl: z.string().min(1).optional(),
    resolutionNote: z.string().min(1).optional(),
  })
  .refine((v) => !!v.searchQuery || !!v.assetId, { message: "either searchQuery or assetId is required" });
export type AIMusic = z.infer<typeof aiMusicSchema>;

// ---------------------------------------------------------------------
// sfx — one-shot AUDIO clips at a point in time
// ---------------------------------------------------------------------

export const aiSfxSchema = z
  .object({
    assetQuery: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    atMs: z.number().int().min(0),
    // Phase 12 Module 6 — see aiStickerSchema's own doc comment.
    resolvedAssetUrl: z.string().min(1).optional(),
    resolutionNote: z.string().min(1).optional(),
  })
  .refine((v) => !!v.assetQuery || !!v.assetId, { message: "either assetQuery or assetId is required" });
export type AISfx = z.infer<typeof aiSfxSchema>;

// ---------------------------------------------------------------------
// transitions — Module 9's real six types/addTransition command, unchanged.
// ---------------------------------------------------------------------

// Phase 12 Module 6 — GPT can't know a real, server-minted clip id for a
// clip that doesn't exist yet (the exact same problem zoom/broll already
// solved for their own sections — see AI_ZOOM_SOURCE_CLIP_PLACEHOLDER's
// own doc comment). Transitions are scoped to "genuine scene-change
// boundaries" (the founder's own framing) — which maps exactly onto the
// boundary BETWEEN two adjacent surviving segments of the source clip
// after sceneRemoval's own cuts, since those are already guaranteed
// gap-free-adjacent (computeSurvivingSegments), the exact precondition
// addTransition's own ripple-shift expects. Reuses aiTransitionSchema's
// EXISTING betweenClipIds tuple (no schema change) with an encoding
// convention instead of real ids: `${PREFIX}${segmentIndex}` for each
// side, e.g. ["__scene_segment_0__", "__scene_segment_1__"] means "the
// boundary between the 1st and 2nd surviving segment." Resolved to real
// ids inside createSceneRemovalCommand's own sequential execute() (see
// its SegmentBoundaryTransition), the same place zoom gets resolved.
export const AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX = "__scene_segment_";

export const aiTransitionSchema = z.object({
  betweenClipIds: z.tuple([z.string().min(1), z.string().min(1)]),
  type: z.enum(EDITOR_TRANSITION_TYPES),
  durationMs: z.number().int().min(100).max(10_000),
});
export type AITransitionPlan = z.infer<typeof aiTransitionSchema>;

// ---------------------------------------------------------------------
// cost — Phase 12 Module 10. A snapshot of what THIS run's real provider
// calls actually cost, computed once in processAiEditJob (ai-edit-jobs.ts)
// at job-completion time from the SAME costUsd numbers the Generation
// Engine already computed per call (never recomputed/estimated a second
// time) and persisted onto the plan itself — no separate DB column, this
// reuses the exact Json blob the review UI already re-validates. Absent
// entirely on any plan persisted before this field existed (older jobs'
// review UI shows "not available" rather than a fabricated retrofit).
// ---------------------------------------------------------------------

export const aiCostSummarySchema = z.object({
  totalUsd: z.number().min(0),
  transcriptionUsd: z.number().min(0),
  videoUnderstandingUsd: z.number().min(0),
  reasoningUsd: z.number().min(0),
  brollGenerationUsd: z.number().min(0),
});
export type AICostSummary = z.infer<typeof aiCostSummarySchema>;

// TASK 12 (2026-08-07) — same "no separate DB column, persisted onto the
// plan's own Json blob" convention as `cost` above. See
// lib/video-editor/ai-edit-quality-scoring.ts for how these are computed
// and what each one means. Absent on any plan persisted before this field
// existed, same "shows 'not available,' never a fabricated retrofit"
// convention.
export const aiQualityScoresSchema = z.object({
  editingScore: z.number().min(0).max(100),
  captionScore: z.number().min(0).max(100),
  visualScore: z.number().min(0).max(100),
  pacingScore: z.number().min(0).max(100),
});
export type AIQualityScores = z.infer<typeof aiQualityScoresSchema>;

// ---------------------------------------------------------------------
// The full plan
// ---------------------------------------------------------------------

export const aiTimelinePlanSchema = z.object({
  version: z.literal(AI_TIMELINE_SCHEMA_VERSION),
  intake: aiIntakeSchema,
  sceneRemoval: z.array(aiSceneRemovalSchema).default([]),
  captions: z.array(aiCaptionSchema).default([]),
  zoom: z.array(aiZoomSchema).default([]),
  broll: z.array(aiBrollSchema).default([]),
  stickers: z.array(aiStickerSchema).default([]),
  music: aiMusicSchema.optional(),
  sfx: z.array(aiSfxSchema).default([]),
  transitions: z.array(aiTransitionSchema).default([]),
  cost: aiCostSummarySchema.optional(),
  qualityScores: aiQualityScoresSchema.optional(),
});
export type AITimelinePlan = z.infer<typeof aiTimelinePlanSchema>;
