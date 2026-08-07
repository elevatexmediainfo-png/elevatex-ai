import { z } from "zod";
import { BLEND_MODES } from "@/lib/video-editor/transform";

// Milestone 24 — Cloud Video Editor (non-AI). Validation schemas for the
// standalone Project/Folder/Asset/Track/Clip system — kept Prisma-free
// (safely importable from client components) and in its own file per this
// folder's one-file-per-domain convention, mirroring editor.ts but for a
// wholly separate, Scene/AI-decoupled data model.

// POST /api/editor/folders
export const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.string().min(1).optional(),
});

// PATCH /api/editor/folders/[id] — rename and/or move (reparent).
export const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export const EDITOR_ASPECT_RATIOS = ["RATIO_16_9", "RATIO_9_16", "RATIO_1_1", "RATIO_4_5", "CUSTOM"] as const;

// POST /api/editor/projects — the New Project dialog's Aspect Ratio picker
// already resolves a preset to concrete pixel dimensions client-side (and
// lets the user type their own for CUSTOM), so the route just persists
// whatever pair it's given rather than re-deriving it from the enum.
export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  folderId: z.string().min(1).optional(),
  aspectRatio: z.enum(EDITOR_ASPECT_RATIOS),
  widthPx: z.number().int().min(16).max(7680),
  heightPx: z.number().int().min(16).max(7680),
});

// PATCH /api/editor/projects/[id] — rename, move to a different folder,
// and/or switch aspect ratio (Preview window's quick-switch — Desktop/
// Mobile/Square only; RATIO_4_5/CUSTOM stay creation-only, no quick-switch
// button asks for them).
export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  folderId: z.string().min(1).nullable().optional(),
  aspectRatio: z.enum(["RATIO_16_9", "RATIO_9_16", "RATIO_1_1"]).optional(),
});

// POST /api/editor/projects/[id]/duplicate
export const duplicateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export const EDITOR_ASSET_KINDS = ["VIDEO", "AUDIO", "IMAGE", "FONT"] as const;

// POST /api/editor/assets/upload-url — mints a presigned PUT + a
// PENDING_UPLOAD EditorAsset row, same two-phase flow as the existing
// assetUploadUrlSchema. The 5GB ceiling here is a technical safety limit,
// not a business rule — the actual admin-configurable cap
// (EDITOR_MAX_UPLOAD_SIZE_BYTES) is enforced in lib/video-editor/assets.ts.
export const editorAssetUploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(100),
  kind: z.enum(EDITOR_ASSET_KINDS),
  fileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024 * 1024),
  // Fix (2026-07-12) — the Uploads panel's own uploads now belong to the
  // project they were dropped into (see EditorAsset.projectId's schema doc
  // comment). Optional, not required: Brand Kit's font-upload slot posts
  // here too for assets that are deliberately project-independent (a brand
  // font should stay usable in every project) — see
  // useUploadEditorAssetMutation's own doc comment in queries.ts.
  projectId: z.string().min(1).optional(),
});

// POST /api/editor/assets/[id]/confirm-upload — durationSeconds/widthPx/
// heightPx are optional client-read media metadata (the browser already
// decoded the file to preview it), same pragmatic pattern
// confirmAssetUploadSchema uses. Module 8 — waveformPeaks is the same
// "client already decoded it" convention: computePeaksFromChannelData()'s
// output, capped generously above WAVEFORM_PEAK_BUCKETS (2000) so a future
// bump to that constant doesn't need a schema change too.
export const confirmEditorAssetUploadSchema = z.object({
  durationSeconds: z
    .number()
    .min(0)
    .max(24 * 60 * 60)
    .optional(),
  widthPx: z.number().int().min(1).max(16384).optional(),
  heightPx: z.number().int().min(1).max(16384).optional(),
  waveformPeaks: z.array(z.number().min(0).max(1)).max(4000).optional(),
});

export const EDITOR_TRACK_KINDS = ["VIDEO", "AUDIO", "SUBTITLE", "TEXT", "OVERLAY", "EFFECTS"] as const;
// Module 8 — UI tag only (icon/color/label), not a track kind of its own.
export const EDITOR_AUDIO_SUBTYPES = ["VOICE", "MUSIC", "SFX"] as const;

// POST /api/editor/projects/[id]/tracks
// insertBelowOrder (2026-07-19) — see addTrack()'s own doc comment
// (lib/video-editor/tracks.ts) for why this exists: pins a new track
// below a specific existing order value instead of the default
// prepend-to-top, used by the AI Auto-Editor to guarantee captions
// render above b-roll regardless of track-creation order.
export const createEditorTrackSchema = z.object({
  kind: z.enum(EDITOR_TRACK_KINDS),
  audioSubtype: z.enum(EDITOR_AUDIO_SUBTYPES).optional(),
  insertBelowOrder: z.number().int().optional(),
});

// PATCH /api/editor/projects/[id]/tracks/[trackId] — Layers panel's
// mute/hide toggles. Lock and track-resize land in Module 2.
export const updateEditorTrackSchema = z.object({
  isMuted: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  heightPx: z.number().int().min(28).max(200).optional(),
  // Module 8 (Part C).
  soloed: z.boolean().optional(),
  // Audio Ducking (2026-07-15) — see the Prisma schema's EditorTrack doc
  // comment for the full field-by-field reasoning. `duckingAmountDb` is
  // bounded to a sane DAW range (0 = no reduction, -60 = effectively
  // silent) rather than left unbounded.
  duckingEnabled: z.boolean().optional(),
  duckingAmountDb: z.number().min(-60).max(0).optional(),
  duckingFadeMs: z.number().int().min(0).max(5000).optional(),
  duckingVoiceTrackIds: z.array(z.string().min(1)).optional(),
});

// POST /api/editor/projects/[id]/tracks/[trackId]/reorder — 0-based
// target position among the project's tracks sorted by order ascending.
export const reorderEditorTrackSchema = z.object({
  targetIndex: z.number().int().min(0),
});

// Module 4/6 — each keyframe's easing is `{in, out}` (see transform.ts's
// KeyframeEasing doc comment: a segment's bezier is built from ONE
// keyframe's `out` side and the NEXT keyframe's `in` side), each side
// either a named preset or a custom single control point. Defined here
// (ahead of editorClipContentSchema) since Module 8 reuses
// keyframeableSchema for `content.volume`, not just clipTransformSchema.
const easingPresetSchema = z.enum(["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_OUT"]);
const easingSideSchema = z.union([
  z.object({ type: easingPresetSchema }),
  z.object({ type: z.literal("CUSTOM"), point: z.object({ x: z.number().min(0).max(1), y: z.number() }) }),
]);
const keyframeEasingSchema = z.object({ in: easingSideSchema, out: easingSideSchema });

function keyframeableSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    // null/[] means "static value" (Module 4's original behavior); Module
    // 6 is what actually writes entries here.
    keyframes: z
      .array(
        z.object({
          id: z.string().min(1),
          timeMs: z.number().int().min(0),
          value: valueSchema,
          easing: keyframeEasingSchema,
        })
      )
      .nullable(),
  });
}

// Module 7 — one bold/italic/underline run over a [start, end) character
// range of `content.text`. Mirrors lib/video-editor/text-style.ts's
// RichTextRun. `color` (2026-08-07, AI Auto-Edit power-word highlighting)
// is an explicit literal color override for this run — see that file's
// own doc comment for why this is distinct from the Highlight Engine's
// theme-driven color mixing.
const richTextRunSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color: z.string().min(1).max(20).optional(),
});

// Module 7 — word/character/karaoke reveal config. Mirrors
// lib/video-editor/text-style.ts's RevealConfig — deliberately NOT part of
// clipTransformSchema/Keyframeable, see that file's header comment.
const revealConfigSchema = z.object({
  mode: z.enum(["NONE", "WORD", "CHARACTER", "KARAOKE"]),
  unitDurationMs: z.number().int().min(20).max(5000),
  style: z.enum(["FADE", "POP", "COLOR_SWEEP"]),
  highlightColor: z.string().max(20),
});

// Clip.content's shape varies by the track kind it lives on (TEXT/OVERLAY
// use different subsets, plain VIDEO/AUDIO clips need none of it) —
// validated as one superset-of-fields schema, same approach editor.ts's
// clipContentSchema takes, since every field here is optional anyway.
export const editorClipContentSchema = z
  .object({
    text: z.string().max(500),
    fontFamily: z.string().max(60),
    fontSize: z.number().int().min(8).max(200),
    color: z.string().max(20),
    // Overlay placement — normalized 0..1 fractions of the frame, not
    // pixels, so it survives an aspect-ratio/resolution change.
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    scale: z.number().min(0.1).max(5),
    rotation: z.number().min(-180).max(180),
    opacity: z.number().min(0).max(1),
    // Module 7 — rich text styling (TEXT/SUBTITLE clips).
    fontWeight: z.number().int().min(100).max(900),
    strokeColor: z.string().max(20),
    strokeWidth: z.number().min(0).max(20),
    shadowOffsetX: z.number().min(-50).max(50),
    shadowOffsetY: z.number().min(-50).max(50),
    shadowBlur: z.number().min(0).max(50),
    shadowColor: z.string().max(20),
    glowColor: z.string().max(20),
    glowBlur: z.number().min(0).max(50),
    glowIntensity: z.number().min(0).max(10),
    gradientColors: z.array(z.string().max(20)).min(2).max(6),
    gradientAngleDeg: z.number().min(0).max(360),
    letterSpacing: z.number().min(-10).max(50),
    lineHeight: z.number().min(0.5).max(3),
    richRuns: z.array(richTextRunSchema).max(50),
    reveal: revealConfigSchema,
    speaker: z.string().max(60),
    showSpeakerInOutput: z.boolean(),
    // Module 8 — audio properties (AUDIO-kind clips). `volume` alone is
    // keyframeable (see lib/video-editor/audio.ts's doc comment for why);
    // pan/fade/pitch/speed are plain values.
    volume: keyframeableSchema(z.number().min(0).max(2)),
    pan: z.number().min(-1).max(1),
    fadeInMs: z.number().int().min(0).max(60_000),
    fadeOutMs: z.number().int().min(0).max(60_000),
    pitchSemitones: z.number().min(-12).max(12),
    speed: z.number().min(0.25).max(4),
    // Theme selection persistence (2026-07-28) — see ClipContent's matching
    // fields in app/editor/types.ts for the full reasoning. Storage only;
    // nothing reads these to change rendering yet.
    themeId: z.string().min(1).max(60),
    themeVersion: z.number().int().positive(),
    brandStyleId: z.string().min(1).max(60),
  })
  .partial()
  .refine((data) => (data.themeId === undefined) === (data.themeVersion === undefined), {
    message: "themeVersion is required whenever themeId is set, and vice versa — a theme reference must always be pinned to an exact version.",
    path: ["themeVersion"],
  });

// Module 4 — universal per-clip transform. Mirrors the hand-written
// ClipTransform type in lib/video-editor/transform.ts (same
// independently-maintained-mirror relationship editorClipContentSchema
// above already has with app/editor/types.ts's ClipContent) — kept here,
// not there, since that file must stay Prisma-free-but-zod-free (pure
// math only, safely importable by a future server-side export compositor
// with zero validation-library weight).
const point2DSchema = z.object({ x: z.number(), y: z.number() });
const cropRectSchema = z.object({
  top: z.number().min(0).max(100),
  right: z.number().min(0).max(100),
  bottom: z.number().min(0).max(100),
  left: z.number().min(0).max(100),
});

export const clipTransformSchema = z.object({
  scale: keyframeableSchema(z.number().min(1).max(1000)),
  scaleY: keyframeableSchema(z.number().min(1).max(1000)).nullable(),
  position: keyframeableSchema(point2DSchema),
  rotation: keyframeableSchema(z.number().min(-180).max(180)),
  opacity: keyframeableSchema(z.number().min(0).max(100)),
  crop: keyframeableSchema(cropRectSchema),
  flipH: z.boolean(),
  flipV: z.boolean(),
  blendMode: z.enum(BLEND_MODES),
});

// POST /api/editor/projects/[id]/clips — add a clip to a track.
export const createEditorClipSchema = z.object({
  trackId: z.string().min(1),
  assetId: z.string().min(1).optional(),
  startMs: z.number().int().min(0),
  durationMs: z.number().int().min(50),
  trimStartMs: z.number().int().min(0).optional(),
  content: editorClipContentSchema.optional(),
  transform: clipTransformSchema.optional(),
});

// PATCH /api/editor/projects/[id]/clips/[clipId] — move/resize/restyle.
export const updateEditorClipSchema = z.object({
  trackId: z.string().min(1).optional(),
  startMs: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(50).optional(),
  trimStartMs: z.number().int().min(0).optional(),
  content: editorClipContentSchema.optional(),
  transform: clipTransformSchema.optional(),
});

// Module 2 — Timeline core operations.

// POST /api/editor/projects/[id]/clips/[clipId]/split — offsetMs is
// measured from the clip's own start, mirroring splitClipSchema's
// convention in editor.ts (the AI editor's equivalent).
export const splitEditorClipSchema = z.object({
  offsetMs: z.number().int().min(1),
});

// PATCH /api/editor/projects/[id]/clips/[clipId]/replace-source — swap
// which asset a clip plays, keeping its timing/content untouched.
export const replaceEditorClipSourceSchema = z.object({
  assetId: z.string().min(1),
});

// Phase 12 Module 9 — POST /api/editor/projects/[id]/clips/[clipId]/re-edit.
export const reeditClipSchema = z.object({
  instruction: z.string().min(1).max(300),
});

// POST /api/editor/projects/[id]/clips/group and .../ungroup — group
// requires 2+ clips (grouping one clip alone is meaningless); ungroup
// accepts 1+ so a single clip can be pulled out of a group individually.
export const groupEditorClipsSchema = z.object({
  clipIds: z.array(z.string().min(1)).min(2).max(200),
});

export const ungroupEditorClipsSchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1).max(200),
});

// POST /api/editor/projects/[id]/markers
export const createEditorMarkerSchema = z.object({
  timeMs: z.number().int().min(0),
});

// Module 9 — Transitions. Mirrors lib/video-editor/transition-engine.ts's
// TransitionType/TransitionDirection/TransitionEasing exactly (the same
// independently-maintained-mirror relationship every other type in this
// file already has with its pure-math counterpart).
export const EDITOR_TRANSITION_TYPES = ["CROSSFADE", "DISSOLVE", "WIPE", "SLIDE", "ZOOM", "FLASH"] as const;
export const EDITOR_TRANSITION_DIRECTIONS = ["LEFT", "RIGHT", "UP", "DOWN", "IN", "OUT"] as const;

const transitionEasingSchema = z.union([
  z.object({ type: z.enum(["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_OUT"]) }),
  z.object({
    type: z.literal("CUSTOM"),
    x1: z.number().min(0).max(1),
    y1: z.number(),
    x2: z.number().min(0).max(1),
    y2: z.number(),
  }),
]);

// POST /api/editor/projects/[id]/transitions
export const createEditorTransitionSchema = z.object({
  trackId: z.string().min(1),
  clipAId: z.string().min(1),
  clipBId: z.string().min(1),
  type: z.enum(EDITOR_TRANSITION_TYPES),
  direction: z.enum(EDITOR_TRANSITION_DIRECTIONS).optional(),
  durationMs: z.number().int().min(100).max(10_000),
  easing: transitionEasingSchema.optional(),
});

// PATCH /api/editor/projects/[id]/transitions/[transitionId] — resize
// (durationMs, dragged handle) and/or re-pick (type/direction/easing).
export const updateEditorTransitionSchema = z.object({
  type: z.enum(EDITOR_TRANSITION_TYPES).optional(),
  direction: z.enum(EDITOR_TRANSITION_DIRECTIONS).nullable().optional(),
  durationMs: z.number().int().min(100).max(10_000).optional(),
  easing: transitionEasingSchema.optional(),
});

// POST /api/editor/projects/[id]/versions — Module 5's autosave hook calls
// this on its periodic/command-count timer; label is optional (null for a
// routine automatic snapshot).
export const createEditorVersionSchema = z.object({
  label: z.string().min(1).max(120).optional(),
});

// Module 10 — Export Engine. Mirrors lib/video-editor/export-engine.ts's
// ExportFormat/ExportResolution/ExportCodec exactly.
export const EDITOR_EXPORT_FORMATS = ["MP4", "MOV", "WEBM", "GIF"] as const;
export const EDITOR_EXPORT_RESOLUTIONS = ["R720P", "R1080P", "R2K", "R4K"] as const;
export const EDITOR_EXPORT_CODECS = ["H264", "H265", "VP9"] as const;

// POST /api/editor/projects/[id]/exports — queues a new export. `codec` is
// optional (the service resolves a per-format default when omitted or
// invalid for the chosen format — see export-engine.ts's resolveCodec).
export const createEditorExportSchema = z.object({
  format: z.enum(EDITOR_EXPORT_FORMATS),
  resolution: z.enum(EDITOR_EXPORT_RESOLUTIONS),
  fps: z.number().int().min(1).max(120),
  bitrateKbps: z.number().int().min(100).max(200_000).optional(),
  codec: z.enum(EDITOR_EXPORT_CODECS).optional(),
  // Export presets (2026-07-15) — see the Prisma schema's EditorExport doc
  // comment.
  watermark: z.boolean().optional(),
});

// POST /api/editor/export-presets — a user-saved, reusable export-settings
// bundle. See the Prisma schema's EditorExportPreset doc comment for why
// this is user-scoped (not per-project) and separate from
// createEditorExportSchema above (this validates the SAVED template;
// that validates one actual queued export).
export const createEditorExportPresetSchema = z.object({
  name: z.string().min(1).max(60),
  format: z.enum(EDITOR_EXPORT_FORMATS),
  resolution: z.enum(EDITOR_EXPORT_RESOLUTIONS),
  fps: z.number().int().min(1).max(120),
  bitrateKbps: z.number().int().min(100).max(200_000).optional(),
  codec: z.enum(EDITOR_EXPORT_CODECS).optional(),
  watermark: z.boolean().optional(),
});

// Phase 12 Module 2 — POST /api/editor/projects/[id]/ai-edit-jobs.
// stylePreset (Module 4) mirrors aiIntakeSchema.stylePreset's own
// constraint exactly (lib/validations/ai-timeline.ts) — optional free
// text that influences the REASONING call's caption reveal-style choice.
// Phase 12 Module 8 — script (pasted reference text, not a file — see
// aiIntakeSchema.script's own doc comment for why) is deliberately capped
// well above a realistic script's length (a ~10-minute talking-head
// script is a few thousand characters) purely as a sanity ceiling against
// pasting something absurd, not a real expected-length constraint.
// Founder request (2026-07-18) — how aggressively TASK 3 (b-roll) should
// propose cutaway windows. "BALANCED" is the pre-existing calibration
// (0-3, propose zero when nothing fits) — omitting this field entirely
// keeps that exact behavior. Defined here (not ai-timeline.ts, where
// aiIntakeSchema also needs it) since ai-timeline.ts already imports
// EDITOR_TRANSITION_TYPES from this file — importing the other direction
// would create a circular module dependency.
export const AI_BROLL_DENSITIES = ["MINIMAL", "BALANCED", "HEAVY"] as const;

// Module selection (founder request, 2026-07-30) — lets the Intake form run
// a SUBSET of the pipeline's proposal sections instead of always producing
// all eight. "sceneRemoval" is its own independent step; the other seven
// (captions/zoom/broll/stickers/music/sfx/transitions) all come back from
// the SAME single planTimeline() reasoning call (see ai-edit-jobs.ts's own
// doc comment) — selecting only some of them still makes that one call
// (there's no way to ask GPT for a subset), it just discards the sections
// the caller didn't ask for before they reach asset resolution/the plan.
// Omitted entirely = every module runs, preserving the exact pre-existing
// behavior for any caller that doesn't send this field.
export const AI_EDIT_MODULES = ["captions", "sceneRemoval", "zoom", "broll", "music", "sfx", "stickers", "transitions"] as const;
export type AiEditModule = (typeof AI_EDIT_MODULES)[number];

// brollDensity mirrors stylePreset's own shape exactly.
// brollStockOnly (2026-07-18) — per-job override of the AI_EDIT_BROLL_
// STOCK_ONLY admin default (see AiEditJob.brollStockOnly's own doc
// comment, prisma/schema.prisma). Optional: omitted means "use whatever
// the admin config says right now," same convention as every other
// admin-default-with-optional-override setting in this codebase.
export const createAiEditJobSchema = z.object({
  assetId: z.string().min(1),
  stylePreset: z.string().min(1).max(80).optional(),
  brollDensity: z.enum(AI_BROLL_DENSITIES).optional(),
  brollStockOnly: z.boolean().optional(),
  script: z.string().min(1).max(20_000).optional(),
  selectedModules: z.array(z.enum(AI_EDIT_MODULES)).min(1).optional(),
});
