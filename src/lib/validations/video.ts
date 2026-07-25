import { z } from "zod";

import { CONTENT_LANGUAGES } from "./onboarding";

// Mirrors the Prisma VideoObjective enum as a literal array — keeps this
// module Prisma-free so it stays usable from client components (the
// create-video wizard imports this directly). Platform/aspectRatio are
// inherited from the chosen Template, not picked independently, so those two
// enums have no client-side mirror here.
export const VIDEO_OBJECTIVES = [
  "PROMOTION",
  "NEW_LAUNCH",
  "FESTIVAL_GREETING",
  "TESTIMONIAL",
  "ANNOUNCEMENT",
  "OFFER_DISCOUNT",
  "BRAND_AWARENESS",
] as const;

// Founder decision, 2026-07-11: hide Festival Greeting from every
// user-facing objective picker — UI-only, deliberately not a schema/enum
// change (VIDEO_OBJECTIVES, VideoObjective, and resolveTemplateForProject()'s
// objective-override path all stay untouched; admin-facing template
// management still sees the full list on purpose, since an admin genuinely
// manages that template). Originally applied only inside create/video/page.tsx
// as a locally-defined filter — found 2026-07-12 that create/talking-head/page.tsx
// (reached via that same page's own "Upload a video instead" link) had its
// own separate, never-filtered VIDEO_OBJECTIVES.map(), the exact "a fix
// applied to one copy doesn't reach a second copy" failure mode. Centralized
// here as the one shared constant so a future third caller can't silently
// diverge the same way again.
export const VISIBLE_OBJECTIVES = VIDEO_OBJECTIVES.filter((o) => o !== "FESTIVAL_GREETING");

// Milestone 8 Script Studio — a fixed creative-content enum (like
// VIDEO_OBJECTIVES above), not admin-configurable: tone is a per-request
// creative choice, not a business rule.
export const SCRIPT_TONES = [
  "FRIENDLY",
  "PROFESSIONAL",
  "PLAYFUL",
  "URGENT",
  "LUXURY",
  "INSPIRATIONAL",
  "BOLD",
] as const;

// PRD Section 10 Flow 2, Step 2 — the brief inputs the prompt engine needs.
// Kept deliberately small for this milestone; Json column on VideoProject.brief
// lets this grow without a migration. `tone` added in Milestone 8 (Script Studio).
export const videoBriefSchema = z.object({
  productOrService: z.string().trim().min(1).max(120),
  keyMessage: z.string().trim().min(1).max(400),
  offerDetails: z.string().trim().max(200).optional().or(z.literal("")),
  callToAction: z.string().trim().max(80).optional().or(z.literal("")),
  tone: z.enum(SCRIPT_TONES).optional(),
});

export type VideoBriefInput = z.infer<typeof videoBriefSchema>;

// POST /api/videos — create a draft + generate the AI script. No templateId
// from the client anymore — the "pick a template" step was removed (every
// seeded template had identical platform/aspectRatio/durationSeconds/
// creditCost; the only things that actually varied were vertical and the
// script-tone promptTemplate, and vertical is already on the user's own
// Profile from onboarding). The route resolves the right Template
// server-side instead — see resolveTemplateForProject() in
// app/api/videos/route.ts.
export const createVideoProjectSchema = z.object({
  title: z.string().trim().min(1).max(150),
  objective: z.enum(VIDEO_OBJECTIVES),
  contentLanguage: z.enum(CONTENT_LANGUAGES),
  brief: videoBriefSchema,
});

export type CreateVideoProjectInput = z.infer<typeof createVideoProjectSchema>;

// Milestone 11 — Talking Head uploads have no Template to inherit
// platform/aspectRatio from, so those two are picked directly here. Mirrors
// the Prisma VideoPlatform/AspectRatio enums as literal arrays, same
// Prisma-free-module reasoning as VIDEO_OBJECTIVES above.
export const VIDEO_PLATFORMS = [
  "INSTAGRAM_REEL",
  "INSTAGRAM_POST",
  "FACEBOOK",
  "YOUTUBE_SHORTS",
  "WHATSAPP_STATUS",
  "GOOGLE_BUSINESS",
] as const;

export const ASPECT_RATIOS = ["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"] as const;

// POST /api/videos/talking-head — create a project from an already-uploaded
// video (sourceAssetId, from the presigned-upload flow) instead of an
// AI-generated script. No templateId/brief: those are GENERATED-flow-only.
export const createTalkingHeadProjectSchema = z.object({
  sourceAssetId: z.string().min(1),
  title: z.string().trim().min(1).max(150),
  objective: z.enum(VIDEO_OBJECTIVES),
  platform: z.enum(VIDEO_PLATFORMS),
  aspectRatio: z.enum(ASPECT_RATIOS),
  contentLanguage: z.enum(CONTENT_LANGUAGES),
});

export type CreateTalkingHeadProjectInput = z.infer<typeof createTalkingHeadProjectSchema>;

// Quick Video (4-option restructure Step 3, 2026-07-12) — the 5-question
// single-clip redesign of /create/video. `mood` reuses SCRIPT_TONES rather
// than a new enum: they already read as ad moods (Friendly/Playful/Urgent/
// Luxury/etc.) and are already validated/labeled elsewhere (Script Studio),
// so a second near-identical enum would be exactly the "dup logic" the
// engineering rules rule out. No duration question — generateVeoLiteVideo()
// always produces a fixed 8-second clip (Veo 3.1 Lite's actual output
// length), so asking would just be a control with no effect.
export const createQuickVideoProjectSchema = z.object({
  about: z.string().trim().min(1).max(500),
  see: z.string().trim().max(500).optional().or(z.literal("")),
  speechEnabled: z.boolean(),
  spokenLine: z.string().trim().max(300).optional().or(z.literal("")),
  mood: z.enum(SCRIPT_TONES).optional(),
  avoid: z.string().trim().max(300).optional().or(z.literal("")),
  aspectRatio: z.enum(ASPECT_RATIOS),
});

export type CreateQuickVideoProjectInput = z.infer<typeof createQuickVideoProjectSchema>;

// AI Film styles — a fixed creative-content enum (like SCRIPT_TONES),
// not admin-configurable: visual style is a per-request creative choice.
export const FILM_STYLES = [
  "CINEMATIC",
  "DOCUMENTARY",
  "ANIMATED",
  "COMMERCIAL",
  "VINTAGE",
  "MINIMALIST",
] as const;

// POST /api/videos/film — the Input screen (idea/duration/character-count/
// style/aspect-ratio). No objective/platform picked here — Film doesn't
// have a meaningful choice for either yet, the route fills sensible
// defaults (BRAND_AWARENESS/INSTAGRAM_REEL) purely to satisfy
// VideoProject's existing required columns, same reasoning
// TALKING_HEAD_UPLOAD already applies to fields that don't fit its flow.
// Narrowed from the original 30-600s range to exactly {10, 20} (2026-07-24)
// — MAX_VIDEO_GENERATION_TOTAL_SECONDS (lib/video-generation-limits.ts)
// applies to FILM's total stitched output, confirmed with the founder.
export const createFilmProjectSchema = z.object({
  title: z.string().trim().min(1).max(150),
  idea: z.string().trim().min(1).max(1000),
  durationSeconds: z.union([z.literal(10), z.literal(20)]),
  characterCount: z.number().int().min(1).max(6),
  style: z.enum(FILM_STYLES),
  aspectRatio: z.enum(ASPECT_RATIOS),
});

export type CreateFilmProjectInput = z.infer<typeof createFilmProjectSchema>;

// PATCH /api/videos/[id] — user edits the AI-generated script before render.
export const updateScriptSchema = z.object({
  generatedScript: z.string().trim().min(1).max(4000),
});

const SCENE_TRANSITIONS = ["CUT", "FADE", "DISSOLVE", "SLIDE"] as const;

// Milestone 11 Part 4 — mirrors the Prisma SceneVisualType enum as a literal
// array, same Prisma-free-module reasoning as VIDEO_OBJECTIVES above.
export const SCENE_VISUAL_TYPES = [
  "FACE_ONLY",
  "B_ROLL",
  "IMAGE",
  "LOGO",
  "SCREENSHOT",
  "WEBSITE",
  "GRAPH",
  "CHART",
  "ICON",
  "ANIMATION",
  "TEXT_OVERLAY",
] as const;

// PATCH /api/videos/[id]/scenes/[sceneId] — Milestone 7 allowed this only on
// a FAILED scene (fix-then-rerender). Milestone 8's Scene Editor also allows
// it on a DRAFT scene (pre-render editing) and adds the Prompt Studio /
// voice / background-music / subtitle fields — see the route for the exact
// status gate. Milestone 11: visualType lets the user manually override the
// AI Visual Planner's per-scene choice (Part 4's "allow manual edits") —
// no new route, this same PATCH just gained one more field.
export const updateSceneSchema = z.object({
  prompt: z.string().trim().min(1).max(2000).optional(),
  negativePrompt: z.string().trim().max(500).optional().or(z.literal("")),
  imagePrompt: z.string().trim().max(2000).optional().or(z.literal("")),
  videoPrompt: z.string().trim().max(2000).optional().or(z.literal("")),
  subtitleText: z.string().trim().max(500).optional().or(z.literal("")),
  durationSeconds: z.number().int().min(3).max(120).optional(),
  transition: z.enum(SCENE_TRANSITIONS).optional(),
  voiceId: z.string().trim().max(100).optional().or(z.literal("")),
  backgroundMusicUrl: z.string().trim().max(500).optional().or(z.literal("")),
  visualType: z.enum(SCENE_VISUAL_TYPES).optional(),
});

// POST /api/videos/[id]/scenes/reorder — Scene Editor drag-and-drop.
export const reorderScenesSchema = z.object({
  sceneIds: z.array(z.string().min(1)).min(1),
});

// POST /api/videos/[id]/thumbnail — Scene Editor's thumbnail picker.
export const setThumbnailSchema = z.object({
  sceneId: z.string().min(1),
});

// POST /api/videos/[id]/script/transform — Script Studio's
// Rewrite/Expand/Shorten/Translate operations.
export const SCRIPT_TRANSFORM_OPERATIONS = ["rewrite", "expand", "shorten", "translate"] as const;
export const scriptTransformSchema = z.object({
  operation: z.enum(SCRIPT_TRANSFORM_OPERATIONS),
  tone: z.enum(SCRIPT_TONES).optional(),
  targetLanguage: z.enum(CONTENT_LANGUAGES).optional(),
});

// POST /api/videos/[id]/script/variants — Script Studio's Hook/CTA generators.
export const SCRIPT_VARIANT_KINDS = ["hook", "cta"] as const;
export const scriptVariantsSchema = z.object({
  kind: z.enum(SCRIPT_VARIANT_KINDS),
  count: z.number().int().min(1).max(5).optional(),
});

// POST/DELETE /api/prompt-templates — Prompt Studio's saved templates.
export const PROMPT_TEMPLATE_CATEGORIES = ["SCRIPT", "IMAGE", "VIDEO"] as const;
export const createPromptTemplateSchema = z.object({
  category: z.enum(PROMPT_TEMPLATE_CATEGORIES),
  title: z.string().trim().min(1).max(100),
  promptText: z.string().trim().min(1).max(2000),
  negativePromptText: z.string().trim().max(500).optional().or(z.literal("")),
});
