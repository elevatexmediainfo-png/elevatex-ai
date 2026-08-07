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

// Quality upgrade (2026-08-07, "cinematic editing — remove more than just
// silence") — "duplicate_phrase" is transcript-only (detectDuplicatePhrases,
// lib/transcription/segmentation.ts): a MULTI-WORD phrase repeated within
// a short window (a sentence restart that abandons and re-says several
// words, not just one — see detectFillerWords' own "repeated_word" for
// the single-word case this complements). "camera_adjustment" and
// "dead_reaction" are video-only (Gemini flaggedSegments,
// video-understanding/gemini.provider.ts) — VIDEO_FLAG_REASONS
// (video-understanding/types.ts) must stay a SUBSET of this list, since
// ai-edit-jobs.ts assigns a flagged segment's reason directly onto an
// AISceneRemoval.
export const AI_SCENE_REMOVAL_REASONS = [
  "silence",
  "filler_word",
  "bad_take",
  "duplicate_take",
  "quality_issue",
  "duplicate_phrase",
  "camera_adjustment",
  "dead_reaction",
] as const;
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
    // AI Video Director (2026-08-07) — human-editor-simulation reasoning:
    // a short, honest "why this wording/placement" note from whichever
    // agent produced this item. Display-only (review UI), never read by
    // the translator/apply path. Absent on any plan predating this field
    // or produced by the legacy single-call planner, same "shows 'not
    // available,' never fabricated" convention every other optional
    // review-only field here already follows.
    reason: z.string().min(1).max(280).optional(),
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

// Quality upgrade (2026-08-07, "smart zooms") — named style archetypes a
// real editor reaches for, rather than the model reasoning about raw
// scaleFrom/scaleTo numbers alone. Optional (not `.default()` — see
// aiBrollSchema's contentKind doc comment for why a Zod `.default()` on a
// field like this would break every existing hand-built AIZoom literal):
// absent means the item predates this field or the model didn't name one,
// in which case zoomStyleBucket's own scale-delta heuristic
// (variety-ledger.ts) is still the fallback for variety tracking.
export const AI_ZOOM_STYLES = ["fast_punch", "slow_push", "micro", "pull_out", "shake_punch", "question_zoom", "number_zoom", "reveal_zoom"] as const;
export type AIZoomStyle = (typeof AI_ZOOM_STYLES)[number];

export const aiZoomSchema = z
  .object({
    clipId: z.string().min(1),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    // Percentage, matching ClipTransform.scale's own convention (100 =
    // native size) — NOT a 0..1 or 1..N multiplier.
    scaleFrom: z.number().min(1).max(1000),
    scaleTo: z.number().min(1).max(1000),
    style: z.enum(AI_ZOOM_STYLES).optional(),
    // AI Video Director (2026-08-07) — see aiCaptionSchema's own doc
    // comment for the shared reason-field convention.
    reason: z.string().min(1).max(280).optional(),
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
    // "behave exactly as before this field existed." Cap raised 8 -> 10
    // (2026-08-07, TASK 3 quality upgrade — "generate 5-10 alternative
    // search queries, ranked") to fit the Director Visuals agent's own
    // widened ask; the legacy single-call prompt still only asks for 3-8
    // and is unaffected by a higher CEILING it never approaches.
    searchQueries: z.array(z.string().min(1)).max(10).optional(),
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
    // AI Video Director (2026-08-07) — see aiCaptionSchema's own doc
    // comment for the shared reason-field convention.
    reason: z.string().min(1).max(280).optional(),
    // "motion_graphic" is the SAME renderable shape as a plain b-roll
    // cutaway (OverlayLayer already plays any VIDEO/IMAGE asset full-frame
    // regardless of semantic label — no new render branch needed), just a
    // different semantic tag for scoring/review purposes and the seam a
    // future Phase 2 ("pip"/"split_screen"/etc.) would extend rather than
    // a brand-new schema. Deliberately `.optional()`, NOT `.default(...)`
    // — a Zod `.default()` makes the field non-optional in the INFERRED
    // TS type (z.infer's output type), which would break every existing
    // hand-constructed AIBroll object literal across the codebase (tests,
    // ai-broll-resolver.ts, translator) that predates this field. Callers
    // that need the effective value read `item.contentKind ?? "broll"`.
    contentKind: z.enum(["broll", "motion_graphic"]).optional(),
    // No-dead-screen rule (2026-08-07) — true only for items the
    // deterministic gap-fixer (visual-coverage.ts) synthesized itself,
    // never proposed by an agent. Lets the review UI/scoring distinguish
    // "the Director chose this" from "the safety net filled a gap."
    autoInserted: z.boolean().optional(),
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
    // AI Video Director (2026-08-07) — see aiCaptionSchema's own doc
    // comment for the shared reason-field convention.
    reason: z.string().min(1).max(280).optional(),
    autoInserted: z.boolean().optional(),
  })
  .refine(isValidRange, RANGE_ERROR)
  .refine((v) => !!v.assetQuery || !!v.assetId, { message: "either assetQuery or assetId is required" });
export type AISticker = z.infer<typeof aiStickerSchema>;

// ---------------------------------------------------------------------
// music — AUDIO/MUSIC track clip, wires directly into the EXISTING Audio
// Ducking feature (EditorTrack.duckingEnabled/duckingVoiceTrackIds) —
// reused, not reimplemented.
// ---------------------------------------------------------------------

// Quality upgrade (2026-08-07, "music should evolve") — a plain
// (position, level) point list describing how loud the music bed should
// be at each moment, 0-100 (100 = full pre-ducking volume; real-time
// speech ducking still applies ON TOP of this via the existing
// duckingEnabled/duckingAmountDb mechanism — this is the bed's OWN energy
// curve, not a duck override). `atFraction` (0-1) is a FRACTION of the
// music clip's own total duration, deliberately NOT an absolute
// millisecond — the story beats this is computed from (director/
// music-envelope.ts's buildMusicVolumeEnvelope) are timed in ORIGINAL
// SOURCE-relative ms, but the music clip itself plays across the FINAL,
// POST-SCENE-REMOVAL edited timeline (a different, generally shorter
// duration with a non-trivial time mapping — see
// ai-timeline-translator.ts's own computeSurvivingSegments for how
// involved that remap already is for OTHER sections). Expressing the
// envelope as a proportion of total progress through the edit sidesteps
// needing that same remap machinery here: the curve's SHAPE (low->build->
// uplifting) is preserved proportionally regardless of exactly where cuts
// landed, which is what "the music should evolve across the video's own
// arc" actually calls for — an honest, simpler, equally-correct
// interpretation, not a shortcut that loses meaning. Computed
// DETERMINISTICALLY from the Story agent's own beats — never asked of the
// model, so this costs zero extra reasoning tokens. Optional/absent means
// a flat, unchanging volume (today's pre-existing behavior) — old plans
// and the legacy single-call path never populate this.
export const aiMusicVolumePointSchema = z.object({
  atFraction: z.number().min(0).max(1),
  volumeLevel: z.number().min(0).max(100),
});
export type AIMusicVolumePoint = z.infer<typeof aiMusicVolumePointSchema>;

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
    // AI Video Director (2026-08-07) — see aiCaptionSchema's own doc
    // comment for the shared reason-field convention.
    reason: z.string().min(1).max(280).optional(),
    volumeEnvelope: z.array(aiMusicVolumePointSchema).optional(),
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
    // AI Video Director (2026-08-07) — see aiCaptionSchema's own doc
    // comment for the shared reason-field convention.
    reason: z.string().min(1).max(280).optional(),
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
  // AI Video Director (2026-08-07) — see aiCaptionSchema's own doc
  // comment for the shared reason-field convention.
  reason: z.string().min(1).max(280).optional(),
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
// story — AI Video Director (2026-08-07). The Story+Hook+Retention
// agent's structured narrative spine, built once and consumed by every
// downstream agent (Captions needs to know where the hook/CTA beats
// land; Visuals needs to know where pattern-interrupt/visual-reward
// beats land). Purely additive/optional on the plan — absent on the
// legacy single-call planner's output and on any plan predating this
// field, same "not available, never fabricated" convention as `cost`.
// ---------------------------------------------------------------------

export const AI_STORY_BEAT_KINDS = ["hook", "curiosity", "value", "pattern_interrupt", "visual_reward", "proof", "cta"] as const;
export type AIStoryBeatKind = (typeof AI_STORY_BEAT_KINDS)[number];

export const aiStoryBeatSchema = z
  .object({
    kind: z.enum(AI_STORY_BEAT_KINDS),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    description: z.string().min(1).max(280),
    reason: z.string().min(1).max(280).optional(),
  })
  .refine(isValidRange, RANGE_ERROR);
export type AIStoryBeat = z.infer<typeof aiStoryBeatSchema>;

export const aiStoryPlanSchema = z.object({
  beats: z.array(aiStoryBeatSchema).min(1),
  hookText: z.string().min(1).max(200),
  hookStrengthReason: z.string().min(1).max(280).optional(),
  // LLM-judgment only — an opinion from the Story agent's own call, never
  // a trained retention-prediction model. Cross-checked against the
  // Quality Reviewer's own independent retentionScore (see
  // ai-edit-quality-scoring.ts) and averaged, not treated as ground truth
  // on its own.
  retentionScore: z.number().min(0).max(100).optional(),
  retentionRisks: z.array(z.string().min(1)).max(6).default([]),
  ctaPresent: z.boolean().optional(),
  ctaText: z.string().min(1).max(200).optional(),
});
export type AIStoryPlan = z.infer<typeof aiStoryPlanSchema>;

// ---------------------------------------------------------------------
// qualityScores v2 — AI Video Director (2026-08-07). Extends the original
// 4-dimension score (editingScore/captionScore/visualScore/pacingScore,
// kept above as aiQualityScoresSchema for backward compatibility with
// plans already persisted under that shape) to the full 10-category
// rubric the iterative quality-review loop scores against. `qualityScores`
// on the plan is a union of both shapes so old rows keep parsing exactly
// as before; every NEW plan the Director pipeline produces always writes
// this v2 shape.
//
// Category set realigned (2026-08-07, quality-upgrade pass — TASK 10)
// to the founder's own exact 10-category rubric: Hook, Retention,
// Caption, B-roll, Music, SFX, Zoom (new), Story (was storyFlow), Visual
// Variety, Editing Rhythm (was pacing). "Emotion" was dropped — it isn't
// part of the new rubric, and this shape was never enabled for real users
// (AI_EDIT_DIRECTOR_PIPELINE_ENABLED defaults false, still does), so
// evolving it in place is safe — no v3 needed, nothing depends on the old
// field names externally. Zoom is now scored DETERMINISTICALLY (count-vs-
// video-length reasonableness + named-style diversity from the variety
// ledger, ai-edit-jobs quality-review.ts's scoreZoomDeterministic) rather
// than asking the LLM — narrowing the Quality Reviewer's own judged set
// from 4 categories to 3 (hook/retention/story), a genuine cost/
// simplicity improvement, not just a rename.
// ---------------------------------------------------------------------

export const AI_QUALITY_CATEGORIES = [
  "hook", "retention", "captions", "broll", "music", "sfx", "zoom", "story", "visualVariety", "editingRhythm",
] as const;
export type AiQualityCategory = (typeof AI_QUALITY_CATEGORIES)[number];

export const aiQualityScoresV2Schema = z.object({
  // Deterministic, structural — no LLM call.
  captionScore: z.number().min(0).max(100),
  brollScore: z.number().min(0).max(100),
  musicScore: z.number().min(0).max(100),
  sfxScore: z.number().min(0).max(100),
  zoomScore: z.number().min(0).max(100),
  visualVarietyScore: z.number().min(0).max(100),
  editingRhythmScore: z.number().min(0).max(100),
  // LLM-judged — from the Quality Reviewer agent's own call.
  hookScore: z.number().min(0).max(100),
  retentionScore: z.number().min(0).max(100),
  storyScore: z.number().min(0).max(100),
  // Weighted aggregate of the 10 above (see AI_EDIT_QUALITY_CATEGORY_WEIGHTS
  // admin config) and the Final Director gate's own comparison value.
  overallScore: z.number().min(0).max(100),
  // Honest "did we actually hit the target, or did we just run out of
  // iterations and keep the best attempt seen" flag — never silently
  // pretends to have cleared the bar it didn't clear.
  thresholdMet: z.boolean(),
  iterations: z.number().int().min(1),
  weakCategoriesFinal: z.array(z.enum(AI_QUALITY_CATEGORIES)).default([]),
});
export type AiQualityScoresV2 = z.infer<typeof aiQualityScoresV2Schema>;

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
  // Union — old (v1) persisted plans keep parsing under aiQualityScoresSchema;
  // every plan the Director pipeline produces going forward always writes
  // the v2 shape. See aiQualityScoresV2Schema's own doc comment.
  qualityScores: z.union([aiQualityScoresV2Schema, aiQualityScoresSchema]).optional(),
  // AI Video Director (2026-08-07) — absent when produced by the legacy
  // single-call planner (feature flag off) or on any plan predating this
  // field.
  story: aiStoryPlanSchema.optional(),
});
export type AITimelinePlan = z.infer<typeof aiTimelinePlanSchema>;
