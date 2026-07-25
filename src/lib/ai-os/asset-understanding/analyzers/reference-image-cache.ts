import type { ReferenceImageIntelligence } from "../../types";
import { fromDb, computeAssetConfidenceScore, collectUnknownFields } from "../schema";

// Maps a previously-stored AssetAnalysis details blob (which may already
// contain Phase 3 fields if it was cached by the Phase 3 analyzer) back
// into a ReferenceImageIntelligence object without making another LLM call.

type RawDetails = Record<string, unknown>;

function s(details: RawDetails, key: string): string | undefined {
  const v = details[key];
  return typeof v === "string" ? v : undefined;
}

function arr(details: RawDetails, key: string): unknown[] | undefined {
  const v = details[key];
  return Array.isArray(v) ? v : undefined;
}

export function mapToReferenceIntelligence(details: RawDetails): ReferenceImageIntelligence {
  const fields: Omit<ReferenceImageIntelligence, "confidenceScore" | "unknownFields"> = {
    industry:            fromDb(s(details, "industry"),            "industry"),
    subIndustry:         fromDb(s(details, "subIndustry"),         "subIndustry"),
    visualStyle:         fromDb(s(details, "visualStyle") ?? s(details, "style"), "visualStyle"),
    creativeType:        fromDb(s(details, "creativeType") ?? s(details, "category"), "creativeType"),
    layoutType:          fromDb(s(details, "layoutType"),          "layoutType"),
    layoutArchetype:     fromDb(s(details, "layoutArchetype"),     "layoutArchetype"),
    gridType:            fromDb(s(details, "gridType"),            "gridType"),
    composition:         fromDb(s(details, "composition"),         "composition"),
    readingFlow:         fromDb(s(details, "readingFlow"),         "readingFlow"),
    heroSubject:         fromDb(s(details, "heroSubject"),         "heroSubject"),
    supportingSubjects:  fromDb(arr(details, "supportingSubjects")?.join(", ") ?? undefined, "supportingSubjects"),
    objects:             fromDb(arr(details, "objects")?.join(", ") ?? undefined, "objects"),
    backgroundStyle:     fromDb(s(details, "backgroundStyle"),     "backgroundStyle"),
    foregroundStyle:     fromDb(s(details, "foregroundStyle"),     "foregroundStyle"),
    lightingStyle:       fromDb(s(details, "lightingStyle") ?? s(details, "lighting"), "lightingStyle"),
    cameraAngle:         fromDb(s(details, "cameraAngle") ?? s(details, "camera"), "cameraAngle"),
    cameraLens:          fromDb(s(details, "cameraLens") ?? s(details, "lens"),     "cameraLens"),
    depthOfField:        fromDb(s(details, "depthOfField") ?? s(details, "depth"),  "depthOfField"),
    mood:                fromDb(s(details, "mood"),                "mood"),
    emotion:             fromDb(s(details, "emotion"),             "emotion"),
    luxuryLevel:         fromDb(s(details, "luxuryLevel"),         "luxuryLevel"),
    visualDensity:       fromDb(s(details, "visualDensity") ?? s(details, "minimalism"), "visualDensity"),
    informationDensity:  fromDb(s(details, "informationDensity"),  "informationDensity"),
    typographyStyle:     fromDb(s(details, "typographyStyle") ?? s(details, "typography"), "typographyStyle"),
    typographyPlacement: fromDb(s(details, "typographyPlacement"), "typographyPlacement"),
    fontStyle:           fromDb(s(details, "fontStyle"),           "fontStyle"),
    alignment:           fromDb(s(details, "alignment"),           "alignment"),
    whitespaceUsage:     fromDb(s(details, "whitespaceUsage") ?? s(details, "whiteSpace"), "whitespaceUsage"),
    safeAreas:           fromDb(s(details, "safeAreas"),           "safeAreas"),
    headlineZone:        fromDb(s(details, "headlineZone") ?? s(details, "headlinePosition"), "headlineZone"),
    ctaZone:             fromDb(s(details, "ctaZone") ?? s(details, "ctaPosition"),     "ctaZone"),
    logoZone:            fromDb(s(details, "logoZone") ?? s(details, "logoPosition"),   "logoZone"),
    bodyCopyZone:        fromDb(s(details, "bodyCopyZone"),        "bodyCopyZone"),
    iconUsage:           fromDb(s(details, "iconUsage"),           "iconUsage"),
    illustrationStyle:   fromDb(s(details, "illustrationStyle"),   "illustrationStyle"),
    photographyStyle:    fromDb(s(details, "photographyStyle"),    "photographyStyle"),
    colorPalette:        fromDb(arr(details, "colorPalette")?.join(", ") ?? undefined, "colorPalette"),
    accentColors:        fromDb(arr(details, "accentColors")?.join(", ") ?? undefined, "accentColors"),
    brandFeeling:        fromDb(s(details, "brandFeeling") ?? s(details, "marketingFeel"), "brandFeeling"),
    trustElements:       fromDb(arr(details, "trustElements")?.join(", ") ?? undefined, "trustElements"),
    visualHierarchy:     fromDb(s(details, "visualHierarchy") ?? s(details, "hierarchy"), "visualHierarchy"),
    marketingFeel:       fromDb(s(details, "marketingFeel"),       "marketingFeel"),
    advertisementCategory: fromDb(s(details, "advertisementCategory"), "advertisementCategory"),
    platformGuess:       fromDb(s(details, "platformGuess") ?? s(details, "platform"), "platformGuess"),
    creativeDNA:         fromDb(s(details, "creativeDNA") ?? s(details, "visualLanguage"), "creativeDNA"),
  };

  const confidenceScore = computeAssetConfidenceScore(fields as Parameters<typeof computeAssetConfidenceScore>[0]);
  const unknownFields = collectUnknownFields(fields as Parameters<typeof collectUnknownFields>[0]);

  return { ...fields, confidenceScore, unknownFields };
}
