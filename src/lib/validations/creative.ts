import { z } from "zod";

import { CONTENT_LANGUAGES } from "./onboarding";
import { ASPECT_RATIOS } from "./video";
import { universalPromptSchema } from "@/lib/prompt-os/schema";

// Milestone 14 — mirrors the Prisma CreativeProjectKind enum as a literal
// array, same Prisma-free-module reasoning as VIDEO_OBJECTIVES in video.ts
// (this file is imported from client components, e.g. the preset picker).
export const CREATIVE_PROJECT_KINDS = ["AI_IMAGE", "SOCIAL_MEDIA", "MARKETING_CREATIVE"] as const;

interface CreativePreset {
  key: string;
  label: string;
  aspectRatio: (typeof ASPECT_RATIOS)[number];
  /** Exact pixel dimensions for this platform format. Undefined means "use the generated image's native size as-is" (no post-process crop/resize step). */
  targetWidth?: number;
  targetHeight?: number;
  /** True for the per-kind "Custom" entry — the UI collects width/height directly instead of using a fixed target. */
  isCustom?: boolean;
}

// Milestone 15 — maps arbitrary pixel dimensions to the nearest of the 3
// AspectRatio buckets the image provider can natively generate (that enum
// is shared with VideoProject and deliberately not widened). Distance is
// computed in log-space so e.g. 0.8 and 1.25 are equally "close" to 1:1 —
// aspect ratios are naturally multiplicative, not linear.
const BUCKET_RATIOS: Record<(typeof ASPECT_RATIOS)[number], number> = {
  RATIO_9_16: 9 / 16,
  RATIO_1_1: 1,
  RATIO_16_9: 16 / 9,
};

export function nearestAspectRatioBucket(width: number, height: number): (typeof ASPECT_RATIOS)[number] {
  const ratio = width / height;
  let closest: (typeof ASPECT_RATIOS)[number] = "RATIO_1_1";
  let smallestDistance = Infinity;
  for (const bucket of ASPECT_RATIOS) {
    const distance = Math.abs(Math.log(ratio / BUCKET_RATIOS[bucket]));
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closest = bucket;
    }
  }
  return closest;
}

// AI Image — general-purpose single image generation. No platform context,
// so presets are just common framing shapes.
export const AI_IMAGE_PRESETS: CreativePreset[] = [
  { key: "square", label: "Square Image", aspectRatio: "RATIO_1_1" },
  { key: "portrait", label: "Portrait Image", aspectRatio: "RATIO_9_16" },
  { key: "landscape", label: "Landscape Image", aspectRatio: "RATIO_16_9" },
  { key: "youtube_thumbnail", label: "YouTube Thumbnail", aspectRatio: "RATIO_16_9", targetWidth: 1280, targetHeight: 720 },
  { key: "custom", label: "Custom", aspectRatio: "RATIO_1_1", isCustom: true },
];

// Social Media — platform-shaped presets. Every platform maps to the
// nearest of the 3 existing AspectRatio values (decision: that enum is not
// widened for this milestone); named platform formats additionally carry
// exact `targetWidth`/`targetHeight` pixel dimensions so the post-process
// crop/resize step (lib/image/resize.ts) can hit them precisely, since the
// image provider itself can only ever produce one of 3 fixed sizes.
export const SOCIAL_MEDIA_PRESETS: CreativePreset[] = [
  { key: "instagram_post", label: "Instagram Square", aspectRatio: "RATIO_1_1", targetWidth: 1080, targetHeight: 1080 },
  { key: "instagram_portrait", label: "Instagram Portrait", aspectRatio: "RATIO_9_16", targetWidth: 1080, targetHeight: 1350 },
  { key: "instagram_story", label: "Instagram Story", aspectRatio: "RATIO_9_16", targetWidth: 1080, targetHeight: 1920 },
  { key: "instagram_carousel", label: "Instagram Carousel", aspectRatio: "RATIO_1_1", targetWidth: 1080, targetHeight: 1080 },
  { key: "facebook_post", label: "Facebook Post", aspectRatio: "RATIO_1_1" },
  { key: "facebook_feed", label: "Facebook Feed", aspectRatio: "RATIO_9_16", targetWidth: 1200, targetHeight: 1500 },
  { key: "facebook_cover", label: "Facebook Cover", aspectRatio: "RATIO_16_9", targetWidth: 1640, targetHeight: 624 },
  { key: "pinterest_pin", label: "Pinterest Pin", aspectRatio: "RATIO_9_16", targetWidth: 1000, targetHeight: 1500 },
  { key: "linkedin_post", label: "LinkedIn Post", aspectRatio: "RATIO_16_9", targetWidth: 1200, targetHeight: 627 },
  { key: "twitter_post", label: "X / Twitter Post", aspectRatio: "RATIO_16_9" },
  { key: "custom", label: "Custom", aspectRatio: "RATIO_1_1", isCustom: true },
];

// Marketing Creative — print/web collateral shapes.
export const MARKETING_CREATIVE_PRESETS: CreativePreset[] = [
  { key: "poster", label: "Poster", aspectRatio: "RATIO_9_16" },
  { key: "flyer", label: "Flyer", aspectRatio: "RATIO_9_16" },
  { key: "banner", label: "Website Banner", aspectRatio: "RATIO_16_9", targetWidth: 1600, targetHeight: 400 },
  { key: "business_card", label: "Business Card", aspectRatio: "RATIO_16_9" },
  { key: "brochure_cover", label: "Brochure Cover", aspectRatio: "RATIO_9_16" },
  { key: "email_header", label: "Email Header", aspectRatio: "RATIO_16_9" },
  { key: "custom", label: "Custom", aspectRatio: "RATIO_1_1", isCustom: true },
];

export const PRESETS_BY_KIND: Record<(typeof CREATIVE_PROJECT_KINDS)[number], CreativePreset[]> = {
  AI_IMAGE: AI_IMAGE_PRESETS,
  SOCIAL_MEDIA: SOCIAL_MEDIA_PRESETS,
  MARKETING_CREATIVE: MARKETING_CREATIVE_PRESETS,
};

// Server-side style guidance injected ahead of the user's own prompt — kept
// here (not hardcoded in the engine) so it stays next to the preset list it
// describes. Deliberately short: a steering prefix, not a full template —
// the heavy lifting now happens in lib/prompt-os/builder.ts's structured
// Universal JSON Prompt system prompt.
export const PRESET_PROMPT_PREFIX: Record<string, string> = {
  square: "A clean, well-composed square image.",
  portrait: "A vertical portrait-orientation image, subject centered for mobile viewing.",
  landscape: "A wide landscape-orientation image.",
  youtube_thumbnail: "A bold, high-contrast YouTube thumbnail with clear focal subject, click-worthy and legible at small sizes.",
  instagram_post: "A vibrant, on-trend Instagram feed post, square composition.",
  instagram_portrait: "A vibrant Instagram feed post in portrait orientation.",
  instagram_story: "A full-bleed vertical Instagram Story graphic with room for overlay text near the top and bottom.",
  instagram_carousel: "A cohesive carousel slide design, square composition, consistent with a slide series.",
  facebook_post: "An eye-catching Facebook feed post image.",
  facebook_feed: "An eye-catching Facebook feed post image, portrait orientation.",
  facebook_cover: "A wide Facebook cover photo with a clear focal point that survives the profile-picture overlay.",
  pinterest_pin: "A tall, scroll-stopping Pinterest pin graphic with a clear visual hierarchy.",
  linkedin_post: "A polished, professional LinkedIn feed graphic.",
  twitter_post: "A concise, high-impact graphic sized for the X/Twitter timeline.",
  poster: "A striking promotional poster layout with a strong focal point and space for headline text.",
  flyer: "An informative flyer layout balancing visuals with space for details.",
  banner: "A wide promotional web banner with a clear call-to-action area.",
  business_card: "A clean, professional business card front design.",
  brochure_cover: "An inviting brochure cover design.",
  email_header: "A wide email newsletter header graphic.",
};

const MIN_CUSTOM_DIMENSION = 256;
const MAX_CUSTOM_DIMENSION = 2048;

// POST /api/creative-projects — create + generate. `presetKey` is validated
// against the chosen `kind`'s preset list via refine, mirroring the way
// VideoProject inherits platform/aspectRatio from its Template rather than
// trusting an unrelated pair of fields. `targetWidth`/`targetHeight` are
// required when presetKey is "custom" (the UI collects them directly) and
// optional otherwise (the named preset's own dimensions are used).
export const createCreativeProjectSchema = z
  .object({
    kind: z.enum(CREATIVE_PROJECT_KINDS),
    presetKey: z.string().min(1),
    title: z.string().trim().min(1).max(150),
    prompt: z.string().trim().min(1).max(6000),
    negativePrompt: z.string().trim().max(500).optional().or(z.literal("")),
    contentLanguage: z.enum(CONTENT_LANGUAGES),
    referenceAssetId: z.string().min(1).optional(),
    logoAssetId: z.string().min(1).optional(),
    targetWidth: z.number().int().min(MIN_CUSTOM_DIMENSION).max(MAX_CUSTOM_DIMENSION).optional(),
    targetHeight: z.number().int().min(MIN_CUSTOM_DIMENSION).max(MAX_CUSTOM_DIMENSION).optional(),
    // Milestone 16 — the structured Universal JSON Prompt produced by the
    // enhance-prompt step, round-tripped through the client and persisted
    // alongside `prompt` (the final text). Optional: a project created
    // without ever calling enhance-prompt simply has no structured record.
    universalPrompt: universalPromptSchema.optional(),
    // True when `prompt` already came out of POST /enhance-prompt (every
    // current caller sets this). Lets generateCreativeImage() skip
    // re-wrapping an already-optimized prompt in tool.promptTemplate/
    // stylePrefix. Defaults false so a caller that posts a raw prompt
    // directly (bypassing enhance-prompt) keeps today's wrapped behavior.
    promptEnhanced: z.boolean().optional().default(false),
    // Canvas-compositor Step 2 — the user's original one-line idea, distinct
    // from `prompt` (which, when promptEnhanced is true, is the essay-style
    // translateForProvider output, not the raw idea). Optional and currently
    // unconsumed by generateCreativeImage(); will feed the server-side
    // blueprint re-derivation once the compositor path is wired in.
    rawIdea: z.string().trim().max(500).optional(),
  })
  .refine((data) => PRESETS_BY_KIND[data.kind].some((p) => p.key === data.presetKey), {
    message: "presetKey is not valid for the given kind",
    path: ["presetKey"],
  })
  .refine(
    (data) => {
      const preset = PRESETS_BY_KIND[data.kind].find((p) => p.key === data.presetKey);
      return !preset?.isCustom || (data.targetWidth !== undefined && data.targetHeight !== undefined);
    },
    { message: "targetWidth and targetHeight are required for the Custom format", path: ["targetWidth"] }
  );

export type CreateCreativeProjectInput = z.infer<typeof createCreativeProjectSchema>;

// POST /api/creative-projects/enhance-prompt — a short idea (optionally plus
// a reference image) in, an LLM-expanded prompt out. Deliberately separate
// from createCreativeProjectSchema: this never creates a CreativeProject row
// or charges credits, it's a stateless prompt-rewrite step ahead of
// generation, shared across all three CreativeProjectKind modules.
export const enhanceCreativePromptSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  // Phase 2 — optional: the Universal Creative Engine's zero-config entry
  // point omits both, and the Creative Brain infers them (resolveKindAndPreset
  // in resolve-kind.ts). The existing 3 /create routes still always pass
  // both explicitly, so their behavior is unchanged byte-for-byte.
  kind: z.enum(CREATIVE_PROJECT_KINDS).optional(),
  presetKey: z.string().min(1).optional(),
  referenceAssetId: z.string().min(1).optional(),
  // Phase 3 — logo asset for logo intelligence analysis
  logoAssetId: z.string().min(1).optional(),
});

export type EnhanceCreativePromptInput = z.infer<typeof enhanceCreativePromptSchema>;
