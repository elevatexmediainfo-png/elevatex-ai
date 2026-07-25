import { z } from "zod";

// Milestone 16, extended Phase 2.2 (Reference Intelligence) — the Design
// Intelligence Library's structured extraction schema, a.k.a. "Creative
// DNA": industry, category, style, mood, lighting, composition, typography,
// camera, lens, perspective, depth, texture, hierarchy, white space,
// luxury/modern/minimalism level, contrast, visual balance, platform,
// aspect ratio, headline/CTA/logo position, marketing goal/feel, target
// audience, color palette, objects, visual language — every field optional,
// since a vision model won't always have a confident answer for every one,
// and a partial analysis is still useful. `.catchall()` keeps this
// extensible the same way the Universal Prompt schema is.
export const assetAnalysisSchema = z
  .object({
    industry: z.string().optional(),
    category: z.string().optional(),
    style: z.string().optional(),
    mood: z.string().optional(),
    platform: z.string().optional(),

    lighting: z.string().optional(),
    composition: z.string().optional(),
    typography: z.string().optional(),
    camera: z.string().optional(),
    lens: z.string().optional(),
    perspective: z.string().optional(),
    depth: z.string().optional(),
    texture: z.string().optional(),
    hierarchy: z.string().optional(),
    whiteSpace: z.string().optional(),

    luxuryLevel: z.string().optional(),
    modernLevel: z.string().optional(),
    minimalism: z.string().optional(),

    aspectRatio: z.string().optional(),
    headlinePosition: z.string().optional(),
    ctaPosition: z.string().optional(),
    logoPosition: z.string().optional(),

    marketingGoal: z.string().optional(),
    targetAudience: z.string().optional(),
    // Phase 2.2 — Reference Intelligence: 3 fields named explicitly in the
    // brief that weren't already covered by an existing field.
    // marketingFeel is the emotional/promotional tone (e.g. "urgent
    // limited-time offer" vs "aspirational lifestyle"), distinct from the
    // more structural marketingGoal/targetAudience above.
    contrast: z.string().optional(),
    visualBalance: z.string().optional(),
    marketingFeel: z.string().optional(),

    colorPalette: z.array(z.string()).default([]),
    objects: z.array(z.string()).default([]),
    visualLanguage: z.string().optional(),
  })
  .catchall(z.unknown());

export type AssetAnalysisResult = z.infer<typeof assetAnalysisSchema>;

// The 5 fields promoted to real AssetAnalysis columns (filterable); the
// rest lands in the `details` Json column as-is.
const INDEXED_FIELDS = ["industry", "category", "style", "mood", "platform"] as const;

export function splitAssetAnalysis(result: AssetAnalysisResult) {
  const indexed: Record<(typeof INDEXED_FIELDS)[number], string | null> = {
    industry: result.industry ?? null,
    category: result.category ?? null,
    style: result.style ?? null,
    mood: result.mood ?? null,
    platform: result.platform ?? null,
  };
  const details: Record<string, unknown> = { ...result };
  for (const field of INDEXED_FIELDS) delete details[field];
  return { indexed, details };
}
