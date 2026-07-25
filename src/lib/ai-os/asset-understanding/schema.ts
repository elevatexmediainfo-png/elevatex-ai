import { z } from "zod";
import type { AssetIntelligenceField, FieldConfidence } from "../types";

// Phase 3 — Asset Understanding schema helpers.
// Zod schemas for validating LLM vision responses, plus factory helpers for
// constructing AssetIntelligenceField objects from raw LLM values.

// ─────────────────────────────────────────────────────────────────────────────
// Field builder helpers
// ─────────────────────────────────────────────────────────────────────────────

type FieldSource = AssetIntelligenceField["source"];

/** Creates an AssetIntelligenceField from a raw LLM-returned value.
 *  - Non-empty string → confidence "high", source as provided
 *  - Array of strings → joined, confidence "high"
 *  - null / undefined / empty → "unknown" with confidence "unknown" */
export function fromLlm<T extends string = string>(
  rawValue: unknown,
  source: FieldSource = "llm_vision",
  fieldName = "field"
): AssetIntelligenceField<T> {
  if (Array.isArray(rawValue)) {
    const joined = (rawValue as string[]).filter(Boolean).join(", ");
    if (!joined) {
      return { value: "unknown" as T | "unknown", confidence: "unknown", source: "default", reason: `No values returned for ${fieldName}` };
    }
    return { value: joined as T | "unknown", confidence: "high", source, reason: `Extracted from LLM vision analysis (${rawValue.length} items)` };
  }
  if (typeof rawValue === "string" && rawValue.trim()) {
    return { value: rawValue.trim() as T | "unknown", confidence: "high", source, reason: `Extracted from LLM vision analysis` };
  }
  return { value: "unknown", confidence: "unknown", source: "default", reason: `Field "${fieldName}" was not provided by the LLM` };
}

/** Creates an AssetIntelligenceField from a DB-cached value. */
export function fromDb<T extends string = string>(
  rawValue: string | null | undefined,
  fieldName = "field"
): AssetIntelligenceField<T> {
  if (rawValue && rawValue.trim()) {
    return { value: rawValue.trim() as T | "unknown", confidence: "high", source: "db_cache", reason: `Loaded from cached analysis` };
  }
  return { value: "unknown", confidence: "unknown", source: "default", reason: `Field "${fieldName}" was not present in cached analysis` };
}

/** Creates an AssetIntelligenceField with an inferred value (derived from other fields). */
export function fromInference<T extends string = string>(
  value: string,
  reason: string,
  confidence: FieldConfidence = "medium"
): AssetIntelligenceField<T> {
  return { value: value as T | "unknown", confidence, source: "inferred", reason };
}

/** Creates an AssetIntelligenceField from a brand kit DB value. */
export function fromBrandKit<T extends string = string>(
  rawValue: string | null | undefined,
  fieldName = "field"
): AssetIntelligenceField<T> {
  if (rawValue && rawValue.trim()) {
    return { value: rawValue.trim() as T | "unknown", confidence: "high", source: "brand_kit_db", reason: `Loaded from user's Brand Kit` };
  }
  return { value: "unknown", confidence: "unknown", source: "default", reason: `Field "${fieldName}" not set in user's Brand Kit` };
}

/** Creates an unknown AssetIntelligenceField for stub/future use. */
export function unknownAssetField(fieldName: string): AssetIntelligenceField {
  return { value: "unknown", confidence: "unknown", source: "default", reason: `${fieldName} analysis not yet available for this asset type` };
}

/** Computes a 0–100 confidence score from a map of fields. */
export function computeAssetConfidenceScore(
  fields: Record<string, AssetIntelligenceField>
): number {
  const weights: Record<FieldConfidence, number> = { high: 1, medium: 0.6, low: 0.3, unknown: 0 };
  const entries = Object.values(fields);
  if (!entries.length) return 0;
  const total = entries.reduce((sum, f) => sum + weights[f.confidence], 0);
  return Math.round((total / entries.length) * 100);
}

/** Returns a list of field names where value === "unknown". */
export function collectUnknownFields(fields: Record<string, AssetIntelligenceField>): string[] {
  return Object.entries(fields)
    .filter(([, f]) => f.value === "unknown" || f.confidence === "unknown")
    .map(([k]) => k);
}

// ─────────────────────────────────────────────────────────────────────────────
// Expanded LLM response schema for reference image analysis
// Superset of the existing assetAnalysisSchema — all original fields included
// so one LLM call serves BOTH the DB cache AND the rich Phase 3 output.
// ─────────────────────────────────────────────────────────────────────────────

export const expandedReferenceAnalysisSchema = z
  .object({
    // ── Existing fields (backward compat with assetAnalysisSchema) ────────────
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
    contrast: z.string().optional(),
    visualBalance: z.string().optional(),
    aspectRatio: z.string().optional(),
    headlinePosition: z.string().optional(),
    ctaPosition: z.string().optional(),
    logoPosition: z.string().optional(),
    marketingGoal: z.string().optional(),
    marketingFeel: z.string().optional(),
    targetAudience: z.string().optional(),
    visualLanguage: z.string().optional(),
    colorPalette: z.array(z.string()).default([]),
    objects: z.array(z.string()).default([]),

    // ── Phase 3 new fields ────────────────────────────────────────────────────
    subIndustry: z.string().optional(),
    visualStyle: z.string().optional(),
    creativeType: z.string().optional(),
    layoutType: z.string().optional(),
    layoutArchetype: z.string().optional(),
    gridType: z.string().optional(),
    readingFlow: z.string().optional(),
    heroSubject: z.string().optional(),
    supportingSubjects: z.array(z.string()).optional(),
    backgroundStyle: z.string().optional(),
    foregroundStyle: z.string().optional(),
    lightingStyle: z.string().optional(),
    cameraAngle: z.string().optional(),
    cameraLens: z.string().optional(),
    depthOfField: z.string().optional(),
    emotion: z.string().optional(),
    visualDensity: z.string().optional(),
    informationDensity: z.string().optional(),
    typographyStyle: z.string().optional(),
    typographyPlacement: z.string().optional(),
    fontStyle: z.string().optional(),
    alignment: z.string().optional(),
    whitespaceUsage: z.string().optional(),
    safeAreas: z.string().optional(),
    headlineZone: z.string().optional(),
    ctaZone: z.string().optional(),
    logoZone: z.string().optional(),
    bodyCopyZone: z.string().optional(),
    iconUsage: z.string().optional(),
    illustrationStyle: z.string().optional(),
    photographyStyle: z.string().optional(),
    accentColors: z.array(z.string()).optional(),
    brandFeeling: z.string().optional(),
    trustElements: z.array(z.string()).optional(),
    visualHierarchy: z.string().optional(),
    advertisementCategory: z.string().optional(),
    platformGuess: z.string().optional(),
    creativeDNA: z.string().optional(),
  })
  .catchall(z.unknown());

export type ExpandedReferenceAnalysisRaw = z.infer<typeof expandedReferenceAnalysisSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Logo analysis schema
// ─────────────────────────────────────────────────────────────────────────────

export const logoAnalysisSchema = z
  .object({
    brandColors: z.array(z.string()).default([]),
    typography: z.string().optional(),
    logoType: z.string().optional(),
    luxuryLevel: z.string().optional(),
    visualStyle: z.string().optional(),
    brandPersonality: z.string().optional(),
    preferredPlacement: z.string().optional(),
    safeArea: z.string().optional(),
  })
  .catchall(z.unknown());

export type LogoAnalysisRaw = z.infer<typeof logoAnalysisSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Product image analysis schema
// ─────────────────────────────────────────────────────────────────────────────

export const productAnalysisSchema = z
  .object({
    productCategory: z.string().optional(),
    primaryProduct: z.string().optional(),
    secondaryObjects: z.array(z.string()).optional(),
    material: z.string().optional(),
    texture: z.string().optional(),
    packaging: z.string().optional(),
    reflection: z.string().optional(),
    shadow: z.string().optional(),
    surface: z.string().optional(),
    scale: z.string().optional(),
    heroAngle: z.string().optional(),
    suitableCameraAngle: z.string().optional(),
    suitableLighting: z.string().optional(),
    backgroundRecommendation: z.string().optional(),
    bestPresentationStyle: z.string().optional(),
    marketingSuitability: z.string().optional(),
  })
  .catchall(z.unknown());

export type ProductAnalysisRaw = z.infer<typeof productAnalysisSchema>;
