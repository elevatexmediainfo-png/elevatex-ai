import { z } from "zod";

// Milestone 9 — Professional Video Editor: Timeline (Track/Clip), Caption
// Editor, and Export validation schemas. Kept in their own module rather
// than growing video.ts further, mirroring this folder's one-file-per-domain
// convention.

export const TRACK_KINDS = ["VIDEO", "IMAGE", "TEXT", "CAPTION", "STICKER", "AUDIO", "MUSIC"] as const;

// POST /api/videos/[id]/timeline/tracks — add a layer/track.
export const createTrackSchema = z.object({
  kind: z.enum(TRACK_KINDS),
});

// PATCH /api/videos/[id]/timeline/tracks/[trackId] — Layers panel's
// mute/hide toggles.
export const updateTrackSchema = z.object({
  isMuted: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const moveTrackSchema = z.object({
  direction: z.enum(["UP", "DOWN"]),
});

// Text Editor's animation choices — a fixed creative enum (like SCRIPT_TONES
// in video.ts), not admin-configurable: this is a UX/creative concern, not a
// business rule.
export const TEXT_ANIMATIONS = ["NONE", "FADE_IN", "SLIDE_UP", "POP", "TYPEWRITER", "FLY_IN", "BOUNCE", "SPIN"] as const;

const motionPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const cropDefinitionSchema = z.object({
  top: z.number().min(0).max(100),
  right: z.number().min(0).max(100),
  bottom: z.number().min(0).max(100),
  left: z.number().min(0).max(100),
});

const maskDefinitionSchema = z.object({
  shape: z.enum(["rectangle", "ellipse", "custom"]),
  path: z.string().trim().max(2000).optional(),
});

const motionEasingSchema = z.union([
  z.enum(["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_OUT"]),
  z.object({
    type: z.literal("BEZIER"),
    x1: z.number().min(0).max(1),
    y1: z.number().min(0).max(1),
    x2: z.number().min(0).max(1),
    y2: z.number().min(0).max(1),
  }),
]);

const motionKeyframeSchema = z.object({
  id: z.string().trim().min(1).max(60),
  parameter: z.enum(["position", "scale", "rotation", "opacity", "blur", "crop", "mask", "motionPath"]),
  timeMs: z.number().int().min(0),
  value: z.union([
    z.number(),
    motionPointSchema,
    cropDefinitionSchema,
    maskDefinitionSchema,
    z.array(motionPointSchema).min(1),
  ]),
  easing: motionEasingSchema,
});

const FONT_WEIGHTS = z.enum(["normal", "bold", "bolder", "lighter", "100", "200", "300", "400", "500", "600", "700", "800", "900"]);
const FONT_STYLES = z.enum(["normal", "italic", "oblique"]);
const TEXT_DECORATIONS = z.enum(["none", "underline", "line-through", "underline line-through"]);
const TEXT_ALIGNMENTS = z.enum(["left", "center", "right"]);

// Clip.content's shape varies by the track kind it lives on (TEXT/STICKER/
// CAPTION each use a different subset) — validated as one superset-of-fields
// schema rather than a discriminated union, since the route doesn't always
// know the track kind without an extra query, and every field here is
// optional anyway.
export const clipContentSchema = z
  .object({
    text: z.string().max(500),
    fontFamily: z.string().max(60),
    fontSize: z.number().int().min(8).max(200),
    color: z.string().max(20),
    fontWeight: FONT_WEIGHTS,
    fontStyle: FONT_STYLES,
    textDecoration: TEXT_DECORATIONS,
    textAlign: TEXT_ALIGNMENTS,
    lineHeight: z.number().min(0.5).max(3),
    letterSpacing: z.number().min(-5).max(20),
    gradientStartColor: z.string().max(20),
    gradientEndColor: z.string().max(20),
    gradientAngle: z.number().min(0).max(360),
    backgroundColor: z.string().max(20),
    strokeColor: z.string().max(20),
    strokeWidth: z.number().min(0).max(20),
    shadowColor: z.string().max(20),
    shadowBlur: z.number().min(0).max(40),
    glowColor: z.string().max(20),
    glowIntensity: z.number().min(0).max(100),
    glowSpread: z.number().min(0).max(50),
    animation: z.enum(TEXT_ANIMATIONS),
    // Sticker placement — normalized 0..1 fractions of the frame, not pixels,
    // so it survives an aspect-ratio/resolution change at export time.
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    scale: z.number().min(0.1).max(5),
    rotation: z.number().min(-180).max(180),
    captionBlockId: z.string().min(1),
    motionPresetId: z.string().min(1).max(60),
    motionKeyframes: z.array(motionKeyframeSchema),
    // Media Library's "Stock" tab drags a STOCK_ASSET_LIBRARY entry straight
    // onto the Timeline — a static URL reference, no Asset row, same pattern
    // Scene.backgroundMusicUrl already uses. Only meaningful on a clip with
    // neither sceneId nor assetId set.
    sourceUrl: z.string().trim().min(1).max(2000),
  })
  .partial();

// POST /api/videos/[id]/timeline/clips — add a clip to a track.
export const createClipSchema = z.object({
  trackId: z.string().min(1),
  sceneId: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
  startMs: z.number().int().min(0),
  durationMs: z.number().int().min(50),
  trimStartMs: z.number().int().min(0).optional(),
  content: clipContentSchema.optional(),
});

// PATCH /api/videos/[id]/timeline/clips/[clipId] — move/resize/retag/restyle.
export const updateClipSchema = z.object({
  trackId: z.string().min(1).optional(),
  startMs: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(50).optional(),
  trimStartMs: z.number().int().min(0).optional(),
  content: clipContentSchema.optional(),
});

// POST /api/videos/[id]/timeline/clips/[clipId]/split — split at an offset
// (ms) measured from the clip's own start, not the timeline's.
export const splitClipSchema = z.object({
  offsetMs: z.number().int().min(1),
});

// POST /api/videos/[id]/timeline/clips/merge — combine two adjacent clips on
// the same track into one.
export const mergeClipsSchema = z.object({
  clipId: z.string().min(1),
  withClipId: z.string().min(1),
});

// PATCH /api/videos/[id]/captions/[sceneId] — Caption Editor's word-level
// edits + auto-timing adjustments + style preset selection.
export const updateCaptionWordsSchema = z.object({
  words: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(60),
        startMs: z.number().int().min(0),
        endMs: z.number().int().min(0),
        // Milestone 11 Part 7 — Smart Captions' word-highlight/animated
        // styling, settable per word (emphasis e.g. "bold"/"emoji:🔥";
        // highlightColor a CSS color, typically from the Brand Kit).
        emphasis: z.string().trim().max(50).optional(),
        highlightColor: z.string().trim().max(20).optional(),
      })
    )
    .min(1)
    .max(500),
  stylePresetId: z.string().min(1).optional(),
});

export const EXPORT_RESOLUTIONS = ["R720P", "R1080P", "R4K"] as const;
export const EXPORT_CODECS = ["H264", "H265", "VP9"] as const;

// POST /api/videos/[id]/exports — Export System.
export const createExportSchema = z.object({
  resolution: z.enum(EXPORT_RESOLUTIONS),
  codec: z.enum(EXPORT_CODECS),
  watermark: z.boolean(),
});

export const ASSET_UPLOAD_KINDS = ["IMAGE", "VIDEO", "VOICE", "STICKER"] as const;
// User-facing uploads are always UPLOAD or BRAND — AI_GENERATED/STOCK come
// from the render pipeline and the admin-curated stock library, never a user
// upload, so they're deliberately excluded from this schema.
export const ASSET_UPLOAD_SOURCES = ["UPLOAD", "BRAND"] as const;

// Shared by both the multipart route (app/api/assets/upload) and the
// presigned-upload route (app/api/assets/upload-url) — one allow-list, not
// duplicated per route.
export const ALLOWED_MIME_BY_KIND: Record<string, string[]> = {
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  VIDEO: ["video/mp4", "video/quicktime", "video/webm"],
  VOICE: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg"],
  STICKER: ["image/png", "image/webp", "image/gif"],
};

// POST /api/assets/upload — Media Library's "Upload assets"/"Brand assets".
// Validates the non-file form fields; the file itself is checked (presence,
// size, MIME type) directly in the route since Zod doesn't model File well.
export const assetUploadMetaSchema = z.object({
  kind: z.enum(ASSET_UPLOAD_KINDS),
  source: z.enum(ASSET_UPLOAD_SOURCES).default("UPLOAD"),
  label: z.string().trim().max(100).optional(),
});

// Milestone 11 — POST /api/assets/upload-url. Large (multi-GB) talking-head
// video uploads can't fit through a serverless function body, so the
// browser PUTs bytes directly to storage instead; this just mints the
// presigned URL + a PENDING_UPLOAD Asset row to upload against.
export const assetUploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(100),
  kind: z.enum(ASSET_UPLOAD_KINDS),
  fileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024 * 1024),
});

// POST /api/assets/[id]/confirm-upload — finalizes a presigned upload once
// the browser's PUT has completed. durationSeconds is optional client-read
// media metadata (Part 1's "generate metadata"); real adapters could later
// probe it server-side instead, but the client already has it for free from
// the <video> element it just loaded the file into.
export const confirmAssetUploadSchema = z.object({
  durationSeconds: z.number().min(0).max(24 * 60 * 60).optional(),
});

// POST /api/videos/[id]/scenes/[sceneId]/regenerate — AI Editing's
// "Regenerate scene", optionally with a new image/video prompt ("Change
// image prompt"/"Change video prompt" apply together with the regenerate,
// since editing a COMPLETED scene's prompt any other way would race the
// render worker — see lib/render/pipeline.ts's regenerateScene).
export const regenerateSceneSchema = z.object({
  imagePrompt: z.string().max(2000).optional(),
  videoPrompt: z.string().max(2000).optional(),
});

// POST /api/videos/[id]/scenes/[sceneId]/replace — AI Editing's "Replace
// scene": swap which Scene/Asset backs every clip referencing this scene.
export const replaceSceneSourceSchema = z
  .object({
    sceneId: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
  })
  .refine((d) => Boolean(d.sceneId) !== Boolean(d.assetId), {
    message: "Provide exactly one of sceneId or assetId.",
  });
