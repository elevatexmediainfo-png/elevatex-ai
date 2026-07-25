// Shared view types for the Cloud Video Editor (Milestone 24) — plain data
// shapes decoupled from Prisma, safe to import from client components.

import type { ClipTransform, Keyframeable } from "@/lib/video-editor/transform";
import type { RevealConfig, RichTextRun } from "@/lib/video-editor/text-style";
import type { TransitionDirection, TransitionEasing, TransitionType } from "@/lib/video-editor/transition-engine";

export const EDITOR_ASPECT_RATIO_PRESETS = [
  { value: "RATIO_16_9", label: "16:9 — Widescreen", widthPx: 1920, heightPx: 1080 },
  { value: "RATIO_9_16", label: "9:16 — Vertical", widthPx: 1080, heightPx: 1920 },
  { value: "RATIO_1_1", label: "1:1 — Square", widthPx: 1080, heightPx: 1080 },
  { value: "RATIO_4_5", label: "4:5 — Portrait", widthPx: 1080, heightPx: 1350 },
  { value: "CUSTOM", label: "Custom", widthPx: 1920, heightPx: 1080 },
] as const;

export type EditorAspectRatio = (typeof EDITOR_ASPECT_RATIO_PRESETS)[number]["value"];

export interface FolderView {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ProjectView {
  id: string;
  name: string;
  folderId: string | null;
  aspectRatio: EditorAspectRatio;
  widthPx: number;
  heightPx: number;
  durationMs: number;
  updatedAt: string;
  // Module 3 — frame-step math (1 frame = 1000/fps ms).
  fps: number;
}

export const EDITOR_TRACK_KINDS = ["VIDEO", "AUDIO", "SUBTITLE", "TEXT", "OVERLAY", "EFFECTS"] as const;
export type EditorTrackKind = (typeof EDITOR_TRACK_KINDS)[number];

export const EDITOR_AUDIO_SUBTYPES = ["VOICE", "MUSIC", "SFX"] as const;
export type EditorAudioSubtype = (typeof EDITOR_AUDIO_SUBTYPES)[number];

export interface TrackView {
  id: string;
  projectId: string;
  kind: EditorTrackKind;
  order: number;
  isMuted: boolean;
  isHidden: boolean;
  // Module 2 (Part A) — lock/resize.
  isLocked: boolean;
  heightPx: number;
  // Module 8 (Part C) — standard DAW solo: while any track is soloed,
  // every non-soloed track is silent in preview. See lib/video-editor/
  // audio.ts's isTrackAudible().
  soloed: boolean;
  // Module 8 — Voice/Music/SFX UI tag (icon/color/label only), AUDIO-kind
  // tracks only. NOT a separate track kind — see the Prisma schema's
  // EditorAudioSubtype doc comment.
  audioSubtype: EditorAudioSubtype | null;
  // Audio Ducking (2026-07-15) — see the Prisma schema's EditorTrack
  // doc comment for the full field-by-field reasoning. Computed
  // dynamically at render time, not baked keyframes.
  duckingEnabled: boolean;
  duckingAmountDb: number;
  duckingFadeMs: number;
  duckingVoiceTrackIds: string[];
}

export interface ClipContent {
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  // Module 7 — rich text styling. Field names deliberately flat
  // (strokeColor/strokeWidth, not a nested `stroke: {...}`) to match the
  // shape CONFIG_REGISTRY's TEXT_STYLE_PRESETS/CAPTION_STYLE_PRESETS
  // already anticipated (lib/admin/config.ts), so a preset's `style`
  // object can be spread directly into `content` with zero remapping.
  fontWeight?: number;
  // "Stroke" and "Outline" are the same thing in this app's DOM/CSS
  // rendering approach (-webkit-text-stroke around each glyph) — there is
  // no separate rendering mechanism that would make a distinct "outline"
  // look any different, so this module deliberately has ONE property, not
  // two. See PROJECT_STATUS.md's Module 7 entry for the reasoning.
  strokeColor?: string;
  strokeWidth?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  // Glow IS visually distinct from Shadow (omnidirectional, no offset) —
  // kept as its own property, rendered as stacked zero-offset text-shadows.
  glowColor?: string;
  glowBlur?: number;
  glowIntensity?: number;
  gradientColors?: string[];
  gradientAngleDeg?: number;
  letterSpacing?: number;
  lineHeight?: number;
  // Bold/italic/underline runs within `text` — see text-style.ts's
  // splitRichTextSegments() for how these render.
  richRuns?: RichTextRun[];
  // Word/character/karaoke reveal — a genuinely separate, non-keyframe
  // interpolation system, see text-style.ts's resolveRevealUnits().
  reveal?: RevealConfig;
  // Subtitle-specific. Editor-side by default (shown as a Timeline/
  // Properties label, not rendered into the composited output) unless
  // showSpeakerInOutput is explicitly set — burning "Speaker: " prefixes
  // into every caption by default reads as cluttered/unprofessional for
  // the common case (see PROJECT_STATUS.md's Module 7 entry).
  speaker?: string;
  showSpeakerInOutput?: boolean;
  // Module 8 — audio properties. Apply to AUDIO-kind clips; a VIDEO clip's
  // OWN embedded audio is controlled only by its track's mute/solo (Module
  // 8 scope, see PROJECT_STATUS.md) — these fields aren't read for VIDEO
  // clips. `volume` alone is `{value, keyframes}` (Module 4/6's shape,
  // future-proofed but not keyframe-editable yet); see audio.ts's doc
  // comment for why the rest stay plain values.
  volume?: Keyframeable<number>;
  pan?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  pitchSemitones?: number;
  speed?: number;
  [key: string]: unknown;
}

export interface ClipView {
  id: string;
  trackId: string;
  projectId: string;
  assetId: string | null;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  content: ClipContent | null;
  // Module 4 — universal per-clip transform. Null means "every property
  // at its default" — see DEFAULT_CLIP_TRANSFORM in lib/video-editor/transform.ts.
  transform: ClipTransform | null;
  // Module 2 — Group/Ungroup. Clips sharing a groupId move together.
  groupId: string | null;
}

// Module 2 — Timeline markers (time position only, see the EditorMarker
// schema comment for why this stays minimal).
export interface MarkerView {
  id: string;
  projectId: string;
  timeMs: number;
}

// Module 9 — a transition between two adjacent clips on the same track. See
// lib/video-editor/transition-engine.ts for the type/direction/easing enums
// and the compositor blend math, and lib/video-editor/transitions.ts (the
// DB service) for the overlap-window ripple-shift this creates.
export interface TransitionView {
  id: string;
  projectId: string;
  trackId: string;
  clipAId: string;
  clipBId: string;
  type: TransitionType;
  direction: TransitionDirection | null;
  durationMs: number;
  easing: TransitionEasing;
}

// Module 5 — Version History list entry. Deliberately doesn't include the
// full snapshot Json (list view only needs timestamp/label; the snapshot
// itself never leaves the server — restore is a server-side operation, not
// a client-side apply).
export interface VersionView {
  id: string;
  label: string | null;
  createdAt: string;
}

// Module 10 — Export Engine. One row per export run/history entry — see
// lib/video-editor/export-engine.ts for the format/resolution/codec enums
// and lib/video-editor/export-worker.ts for the render pipeline.
export type EditorExportFormat = "MP4" | "MOV" | "WEBM" | "GIF";
export type EditorExportResolution = "R720P" | "R1080P" | "R2K" | "R4K";
export type EditorExportCodec = "H264" | "H265" | "VP9";
export type EditorExportStatus = "QUEUED" | "RENDERING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface ExportView {
  id: string;
  projectId: string;
  format: EditorExportFormat;
  resolution: EditorExportResolution;
  fps: number;
  bitrateKbps: number | null;
  codec: EditorExportCodec | null;
  watermark: boolean;
  status: EditorExportStatus;
  progress: number;
  totalFrames: number | null;
  framesRendered: number;
  widthPx: number | null;
  heightPx: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Phase 12 Module 2 — AI Auto-Editor job progress. See the Prisma schema's
// AiEditJobStatus doc comment for the full state list/reasoning.
export type AiEditJobStatus =
  | "QUEUED"
  | "UPLOADING"
  | "TRANSCRIBING"
  | "ANALYZING_VIDEO"
  | "PLANNING_REMOVALS"
  | "PLANNING_TIMELINE"
  | "RESOLVING_ASSETS"
  | "BUILDING_TIMELINE"
  | "READY_FOR_REVIEW"
  | "FAILED"
  | "CANCELLED";

export interface AiEditJobView {
  id: string;
  projectId: string;
  sourceAssetId: string;
  status: AiEditJobStatus;
  progress: number;
  // Present once TRANSCRIBING has completed — kept loosely typed here
  // (the client only ever displays/passes it through, never re-validates
  // it) rather than importing the full TranscriptionResult shape from a
  // server-only generation module.
  transcript: { words: { word: string; startMs: number; endMs: number }[]; language: string; durationSeconds: number } | null;
  // Phase 12 Module 3 — present once ANALYZING_VIDEO has completed, ONLY
  // for VIDEO source assets (null for AUDIO-only jobs, or if Gemini's
  // call failed — video understanding degrades gracefully, see
  // ai-edit-jobs.ts). Loosely typed, same "client only displays/passes
  // through" convention as `transcript` above.
  videoAnalysis: {
    emphasisMoments: { startMs: number; endMs: number; description: string }[];
    emotionBeats: { startMs: number; endMs: number; emotion: string; description: string }[];
    visualContext: { startMs: number; endMs: number; description: string }[];
    gestures: { startMs: number; endMs: number; description: string }[];
    flaggedSegments: { startMs: number; endMs: number; reason: string; description: string }[];
    durationSeconds: number;
  } | null;
  // Present once BUILDING_TIMELINE has completed — the real AITimelinePlan
  // (lib/validations/ai-timeline.ts), re-validated with aiTimelinePlanSchema
  // before being applied (see ai-auto-edit-panel.tsx).
  timelinePlan: unknown | null;
  errorMessage: string | null;
  // Phase 12 Module 4 — the intake style preset the job was created with
  // (aiIntakeSchema.stylePreset), echoed back for display; null when none
  // was chosen.
  stylePreset: string | null;
  // Phase 12 Module 8 — the intake reference script the job was created
  // with (aiIntakeSchema.script), echoed back for display; null when
  // none was provided.
  script: string | null;
  // Phase 12 Module 4 — set ONLY when the REASONING (captions/zoom)
  // planning call failed validation even after a repair-prompt retry, or
  // errored outright. Distinct from `errorMessage` (whole-job failure) —
  // this job can still be READY_FOR_REVIEW with a real sceneRemoval list
  // and simply empty captions/zoom. Null on success.
  planningError: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Render Queue polish (2026-07-16) — a user-saved, reusable export-settings
// bundle. See the Prisma schema's EditorExportPreset doc comment for the
// user-vs-project scoping reasoning.
export interface ExportPresetView {
  id: string;
  name: string;
  format: EditorExportFormat;
  resolution: EditorExportResolution;
  fps: number;
  bitrateKbps: number | null;
  codec: EditorExportCodec | null;
  watermark: boolean;
  createdAt: string;
}

// Module 7 — FONT: custom brand font uploads, tied into the Brand Kit
// sidebar's font slot (woff2/woff/ttf, same presigned-upload flow as
// every other kind).
// Milestone 26 — ANIMATION: Lottie JSON, currently only ever created via
// the Admin Asset Library (never through this project's own user-upload
// flow), but included here since AssetView is fed directly from the
// server's EditorAssetView (lib/video-editor/assets.ts), which reflects
// the full Prisma EditorAssetKind.
export type EditorAssetKind = "VIDEO" | "AUDIO" | "IMAGE" | "FONT" | "ANIMATION";

export interface AssetView {
  id: string;
  kind: EditorAssetKind;
  // Upload normalization (2026-07-19) — QUEUED_FOR_NORMALIZATION/
  // NORMALIZING only ever appear for VIDEO uploads, between confirm and
  // the async H.264/AAC transcode-if-needed step completing.
  status: "PENDING_UPLOAD" | "QUEUED_FOR_NORMALIZATION" | "NORMALIZING" | "READY" | "FAILED";
  url: string;
  originalFilename: string;
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  createdAt: string;
  // Module 8 — downsampled peak amplitudes (0..1), computed client-side at
  // confirm-upload time for AUDIO-kind assets. See lib/video-editor/
  // audio.ts's computePeaksFromChannelData()/WAVEFORM_PEAK_BUCKETS.
  waveformPeaks: number[] | null;
  // 2026-07-12 visual-fidelity pass — see EditorAssetView's matching field
  // in lib/video-editor/assets.ts for why this is `null` for plain uploads.
  thumbnailUrl: string | null;
  // Fix (2026-07-13) — the real Timeline filmstrip, unlike thumbnailUrl
  // above, IS populated for plain "Upload media" VIDEO uploads. See
  // lib/video-editor/filmstrip.ts for FILMSTRIP_TILE_WIDTH/HEIGHT (the
  // fixed per-frame tile size a canvas renderer needs to slice this sprite
  // sheet) and EditorAssetView's matching field for the generation path.
  filmstripUrl: string | null;
  filmstripFrameCount: number | null;
}

export function clipEndMs(clip: Pick<ClipView, "startMs" | "durationMs">): number {
  return clip.startMs + clip.durationMs;
}

// mm:ss.cc (centiseconds, not true video frames — same pragmatic timecode
// format the existing AI editor's formatTimecode() uses).
export function formatTimecode(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centis = Math.floor((totalSeconds % 1) * 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
}
