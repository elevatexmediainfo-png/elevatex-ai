// Shared types for the Marketing Templates admin UI (2026-08-03 rewrite).
// Mirrors the real Prisma shapes returned by the existing, unmodified
// backend APIs — nothing here changes what the server sends or accepts.

export type OutputType = "IMAGE" | "VIDEO";
export type AspectRatio = "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
export type AssetRole = "STYLE" | "COMPOSITION" | "LIGHTING" | "COLOR" | "TYPOGRAPHY" | "BRANDING";

export const ASSET_ROLE_OPTIONS: AssetRole[] = ["STYLE", "COMPOSITION", "LIGHTING", "COLOR", "TYPOGRAPHY", "BRANDING"];

export const ASSET_ROLE_LABELS: Record<AssetRole, string> = {
  STYLE: "Style",
  COMPOSITION: "Composition",
  LIGHTING: "Lighting",
  COLOR: "Color",
  TYPOGRAPHY: "Typography",
  BRANDING: "Branding",
};

export const OUTPUT_TYPE_OPTIONS: OutputType[] = ["IMAGE", "VIDEO"];

// Sentinel values for Select components — Radix Select rejects an empty
// string as a real value, so "no fallback provider" / "no role" need a
// real, non-empty placeholder value instead of "".
export const NO_FALLBACK = "__none__";
export const NO_ROLE = "__none__";

export interface ProviderOption {
  id: string;
  label: string;
}

export interface ReferenceAsset {
  assetId: string;
  role: AssetRole | null;
  asset: { id: string; storageKey: string; mimeType: string | null; url: string };
}

export interface MarketingTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  outputType: OutputType;
  aspectRatio: AspectRatio;
  referenceAssets: ReferenceAsset[];
  promptTemplate: string;
  primaryProviderId: string | null;
  fallbackProviderId: string | null;
  userAssetRequired: boolean;
  creditCost: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  updatedAt: string;
  _count: { generations: number };
}

export function isTemplateReady(template: MarketingTemplate): boolean {
  return Boolean(template.primaryProviderId) && template.promptTemplate.trim().length > 0;
}
