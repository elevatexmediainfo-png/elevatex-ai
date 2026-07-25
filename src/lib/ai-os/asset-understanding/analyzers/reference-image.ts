import { generateScript } from "@/lib/generation/llm";
import { assetAnalysisSchema, splitAssetAnalysis } from "@/lib/design-intelligence/schema";
import type { AssetAnalysisResult } from "@/lib/design-intelligence/schema";
import type { ReferenceImageIntelligence } from "../../types";
import {
  expandedReferenceAnalysisSchema,
  type ExpandedReferenceAnalysisRaw,
  fromLlm,
  computeAssetConfidenceScore,
  collectUnknownFields,
} from "../schema";

// Phase 3 — Reference Image Analyzer.
// Makes a single LLM vision call with an expanded prompt that covers ALL
// fields needed by BOTH the existing Creative Brain pipeline (AssetAnalysisResult
// shape, for DB caching) AND the new Phase 3 ReferenceImageIntelligence shape.
// One call, two outputs. No extra API cost vs. the Phase 1 approach.

const SYSTEM_PROMPT =
  "You are a senior creative director and visual analyst. You will be shown a reference image — a creative " +
  "advertisement, brand material, or design reference. Analyze it exhaustively and return ONLY a single JSON " +
  "object (no markdown, no prose, no code fences). Fill in as many fields as you can confidently determine " +
  "from the image; omit fields you cannot judge. Use specific, reusable descriptions — never self-referential " +
  "phrases like 'similar to the reference'. Describe the visual language itself.\n\n" +
  "Required string fields: industry, category, style, mood, platform, lighting, composition, typography, " +
  "camera, lens, perspective, depth, texture, hierarchy, whiteSpace, luxuryLevel, modernLevel, minimalism, " +
  "contrast, visualBalance, aspectRatio, headlinePosition, ctaPosition, logoPosition, marketingGoal, " +
  "marketingFeel, targetAudience, visualLanguage, subIndustry, visualStyle, creativeType, layoutType, " +
  "layoutArchetype, gridType, readingFlow, heroSubject, backgroundStyle, foregroundStyle, lightingStyle, " +
  "cameraAngle, cameraLens, depthOfField, emotion, visualDensity, informationDensity, typographyStyle, " +
  "typographyPlacement, fontStyle, alignment, whitespaceUsage, safeAreas, headlineZone, ctaZone, logoZone, " +
  "bodyCopyZone, iconUsage, illustrationStyle, photographyStyle, brandFeeling, visualHierarchy, " +
  "advertisementCategory, platformGuess, creativeDNA.\n\n" +
  "Required array fields (arrays of short strings): colorPalette, objects, supportingSubjects, accentColors, " +
  "trustElements.\n\n" +
  "creativeDNA must be a single concise sentence summarizing the visual essence (e.g. 'Premium medical brand " +
  "using clinical white space, deep navy authority palette, and serif confidence — trust through restraint').";

function parseJsonLoose(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  return JSON.parse(text);
}

/** Maps the expanded LLM response to the AssetAnalysisResult shape used by the
 *  existing DB cache and Creative Brain pipeline. Backward compat — no schema change. */
export function mapToLegacyResult(raw: ExpandedReferenceAnalysisRaw): AssetAnalysisResult {
  return assetAnalysisSchema.parse({
    industry: raw.industry,
    category: raw.category ?? raw.creativeType,
    style: raw.style ?? raw.visualStyle,
    mood: raw.mood,
    platform: raw.platform ?? raw.platformGuess,
    lighting: raw.lighting ?? raw.lightingStyle,
    composition: raw.composition,
    typography: raw.typography ?? raw.typographyStyle,
    camera: raw.camera ?? raw.cameraAngle,
    lens: raw.lens ?? raw.cameraLens,
    perspective: raw.perspective,
    depth: raw.depth ?? raw.depthOfField,
    texture: raw.texture,
    hierarchy: raw.hierarchy ?? raw.visualHierarchy,
    whiteSpace: raw.whiteSpace ?? raw.whitespaceUsage,
    luxuryLevel: raw.luxuryLevel,
    modernLevel: raw.modernLevel,
    minimalism: raw.minimalism ?? raw.visualDensity,
    contrast: raw.contrast,
    visualBalance: raw.visualBalance,
    aspectRatio: raw.aspectRatio,
    headlinePosition: raw.headlinePosition ?? raw.headlineZone,
    ctaPosition: raw.ctaPosition ?? raw.ctaZone,
    logoPosition: raw.logoPosition ?? raw.logoZone,
    marketingGoal: raw.marketingGoal,
    marketingFeel: raw.marketingFeel ?? raw.brandFeeling,
    targetAudience: raw.targetAudience,
    visualLanguage: raw.visualLanguage ?? raw.creativeDNA,
    colorPalette: raw.colorPalette,
    objects: raw.objects,
  });
}

/** Maps the expanded LLM response to the rich ReferenceImageIntelligence shape. */
function mapToReferenceIntelligence(raw: ExpandedReferenceAnalysisRaw): ReferenceImageIntelligence {
  const f = <T extends string = string>(key: keyof ExpandedReferenceAnalysisRaw, label: string) =>
    fromLlm<T>(raw[key], "llm_vision", label);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {
    industry:           f("industry",            "industry"),
    subIndustry:        f("subIndustry",          "subIndustry"),
    visualStyle:        f("visualStyle",          "visualStyle"),
    creativeType:       f("creativeType",         "creativeType"),
    layoutType:         f("layoutType",           "layoutType"),
    layoutArchetype:    f("layoutArchetype",      "layoutArchetype"),
    gridType:           f("gridType",             "gridType"),
    composition:        f("composition",          "composition"),
    readingFlow:        f("readingFlow",          "readingFlow"),
    heroSubject:        f("heroSubject",          "heroSubject"),
    supportingSubjects: fromLlm(raw.supportingSubjects, "llm_vision", "supportingSubjects"),
    objects:            fromLlm(raw.objects, "llm_vision", "objects"),
    backgroundStyle:    f("backgroundStyle",      "backgroundStyle"),
    foregroundStyle:    f("foregroundStyle",      "foregroundStyle"),
    lightingStyle:      f("lightingStyle",        "lightingStyle"),
    cameraAngle:        f("cameraAngle",          "cameraAngle"),
    cameraLens:         f("cameraLens",           "cameraLens"),
    depthOfField:       f("depthOfField",         "depthOfField"),
    mood:               f("mood",                 "mood"),
    emotion:            f("emotion",              "emotion"),
    luxuryLevel:        f("luxuryLevel",          "luxuryLevel"),
    visualDensity:      f("visualDensity",        "visualDensity"),
    informationDensity: f("informationDensity",   "informationDensity"),
    typographyStyle:    f("typographyStyle",      "typographyStyle"),
    typographyPlacement:f("typographyPlacement",  "typographyPlacement"),
    fontStyle:          f("fontStyle",            "fontStyle"),
    alignment:          f("alignment",            "alignment"),
    whitespaceUsage:    f("whitespaceUsage",      "whitespaceUsage"),
    safeAreas:          f("safeAreas",            "safeAreas"),
    headlineZone:       f("headlineZone",         "headlineZone"),
    ctaZone:            f("ctaZone",              "ctaZone"),
    logoZone:           f("logoZone",             "logoZone"),
    bodyCopyZone:       f("bodyCopyZone",         "bodyCopyZone"),
    iconUsage:          f("iconUsage",            "iconUsage"),
    illustrationStyle:  f("illustrationStyle",    "illustrationStyle"),
    photographyStyle:   f("photographyStyle",     "photographyStyle"),
    colorPalette:       fromLlm(raw.colorPalette,  "llm_vision", "colorPalette"),
    accentColors:       fromLlm(raw.accentColors,  "llm_vision", "accentColors"),
    brandFeeling:       f("brandFeeling",         "brandFeeling"),
    trustElements:      fromLlm(raw.trustElements, "llm_vision", "trustElements"),
    visualHierarchy:    f("visualHierarchy",      "visualHierarchy"),
    marketingFeel:      f("marketingFeel",        "marketingFeel"),
    advertisementCategory: f("advertisementCategory", "advertisementCategory"),
    platformGuess:      f("platformGuess",        "platformGuess"),
    creativeDNA:        f("creativeDNA",          "creativeDNA"),
  };

  const confidenceScore = computeAssetConfidenceScore(fields);
  const unknownFields = collectUnknownFields(fields);

  return { ...fields, confidenceScore, unknownFields } as ReferenceImageIntelligence;
}

export interface ReferenceAnalysisOutput {
  intelligence: ReferenceImageIntelligence;
  legacyResult: AssetAnalysisResult;
  /** Extracted indexed columns for DB storage — same shape splitAssetAnalysis returns. */
  indexed: { industry: string | null; category: string | null; style: string | null; mood: string | null; platform: string | null };
  details: Record<string, unknown>;
}

/** Runs the expanded LLM vision analysis on a reference image URL.
 *  Returns both the rich ReferenceImageIntelligence AND the legacy AssetAnalysisResult
 *  so the caller can persist to DB and feed the Creative Brain without any extra API call. */
export async function analyzeReferenceImage(imageUrl: string, userId: string): Promise<ReferenceAnalysisOutput> {
  const result = await generateScript(
    {
      prompt: "Analyze this reference image and return the JSON object described above.",
      contentLanguage: "EN",
      systemPrompt: SYSTEM_PROMPT,
      imageUrl,
      responseFormat: "json",
    },
    { userId },
    "design_intelligence_analysis"
  );

  let parsed: unknown;
  try {
    parsed = parseJsonLoose(result.text);
  } catch {
    throw new Error("Reference image analysis did not return valid JSON.");
  }

  const raw = expandedReferenceAnalysisSchema.parse(parsed);
  const legacyResult = mapToLegacyResult(raw);
  const intelligence = mapToReferenceIntelligence(raw);

  // Extract the 5 indexed DB columns from the legacy result (unchanged schema).
  const { indexed } = splitAssetAnalysis(legacyResult);

  // CACHE FIX (Phase 3.5): Store the FULL expanded raw object in `details`, not just
  // the legacy result's subset. This ensures all Phase 3 fields (creativeDNA, heroSubject,
  // layoutType, etc.) are persisted and available on cache read without a new LLM call.
  // Also embed metadata so cache entries are self-describing and version-detectable.
  const INDEXED_FIELDS = new Set(["industry", "category", "style", "mood", "platform"]);
  const details: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!INDEXED_FIELDS.has(k)) details[k] = v; // skip the 5 already-indexed columns
  }
  // Provider and schema metadata — used as cache sentinels and for debugging.
  details._aiOsVersion = "3";
  details._analyzedAt = new Date().toISOString();
  details._analyzer = "reference-image-v3";

  return { intelligence, legacyResult, indexed, details };
}
