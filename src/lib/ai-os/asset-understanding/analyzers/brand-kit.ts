import type { BrandKitIntelligence } from "../../types";
import { fromBrandKit, fromInference, unknownAssetField, computeAssetConfidenceScore, collectUnknownFields } from "../schema";

// Phase 3 — Brand Kit Analyzer.
// Derives structured BrandKitIntelligence entirely from the user's persisted
// BrandKit DB record — no LLM call, no I/O beyond what the caller already
// fetched. Pure mapping: DB values → AssetIntelligenceField objects.

/** Input shape matching the Prisma BrandKit model's relevant fields. */
export interface BrandKitRecord {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
}

/** Infers a brand voice from the available color/font signals. */
function inferBrandVoice(
  record: BrandKitRecord
): BrandKitIntelligence["brandVoice"] {
  // No LLM — we make a minimal inference from the available signals.
  // This will be enriched in future phases when logo/design files are available.
  const hasColors = !!(record.primaryColor || record.secondaryColor);
  const hasFont = !!record.fontFamily;
  if (!hasColors && !hasFont) {
    return unknownAssetField("brandVoice") as BrandKitIntelligence["brandVoice"];
  }
  const font = record.fontFamily?.toLowerCase() ?? "";
  const isSerif = /serif|times|georgia|palatino|garamond|baskerville/.test(font);
  const isDisplay = /display|headline|title|impact|bebas/.test(font);
  if (isSerif) {
    return fromInference("professional", "Serif font family suggests a professional, authoritative brand voice", "medium");
  }
  if (isDisplay) {
    return fromInference("inspirational", "Display font family suggests an aspirational, impactful brand voice", "low");
  }
  return fromInference("friendly", "Sans-serif or unrecognised font — defaulting to friendly/approachable voice", "low");
}

/** Infers an icon style from brand characteristics — stub for Phase 3.
 *  Will be enriched when logo/icon assets are available. */
function inferIconStyle(): BrandKitIntelligence["iconStyle"] {
  return fromInference("line", "No icon assets provided — defaulting to line icons as a safe universal choice", "low");
}

/** Converts a BrandKit DB record into structured BrandKitIntelligence. */
export function analyzeBrandKit(record: BrandKitRecord | null | undefined): BrandKitIntelligence | undefined {
  if (!record) return undefined;

  const hasAnything = !!(record.primaryColor || record.secondaryColor || record.fontFamily);
  if (!hasAnything) return undefined;

  const brandColors = (() => {
    const colors = [record.primaryColor, record.secondaryColor].filter(Boolean).join(", ");
    return fromBrandKit(colors || null, "brandColors");
  })();

  const primaryFont = fromBrandKit(record.fontFamily, "primaryFont");
  const secondaryFont = unknownAssetField("secondaryFont") as BrandKitIntelligence["secondaryFont"];
  const brandVoice = inferBrandVoice(record);
  const iconStyle = inferIconStyle();

  // These fields require design documentation that isn't in the current BrandKit
  // model — they'll be populated in future phases.
  const visualRules = unknownAssetField("visualRules") as BrandKitIntelligence["visualRules"];
  const spacingRules = unknownAssetField("spacingRules") as BrandKitIntelligence["spacingRules"];
  const photographyRules = unknownAssetField("photographyRules") as BrandKitIntelligence["photographyRules"];
  const brandPersonality = unknownAssetField("brandPersonality") as BrandKitIntelligence["brandPersonality"];

  const fields = {
    brandColors,
    primaryFont,
    secondaryFont,
    brandVoice,
    visualRules,
    spacingRules,
    iconStyle,
    photographyRules,
    brandPersonality,
  };

  const confidenceScore = computeAssetConfidenceScore(fields);
  const unknownFields = collectUnknownFields(fields);

  return { ...fields, confidenceScore, unknownFields };
}
