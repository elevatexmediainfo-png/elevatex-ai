// Phase 8.7C — Commercial Composition Engine types.
// Defines WHERE every commercial asset belongs on the canvas.
// Pure interfaces — no generation, no rendering, no text output.

import type { CommercialAssetId, CommercialAssetPlan, SupportedIndustryId, AssetPriority } from "../commercial-assets/types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { VisualLayoutPlan } from "../visual-layout/types";

// ─────────────────────────────────────────────────────────────────────────────
// Named zones on the composition grid
// ─────────────────────────────────────────────────────────────────────────────

export type LayoutRegion =
  | "top_left"       | "top_center"      | "top_right"
  | "mid_left"       | "mid_center"      | "mid_right"
  | "bottom_left"    | "bottom_center"   | "bottom_right"
  | "below_headline" | "above_cta"       | "below_hero"
  | "footer_left"    | "footer_center"   | "footer_right"
  | "overlay_hero"   | "hero_zone";

export type AlignmentX     = "left" | "center" | "right";
export type AssetSize      = "small" | "medium" | "large" | "auto";
export type Density        = "sparse" | "balanced" | "dense";
export type Prominence     = "critical" | "high" | "medium" | "low" | "subtle";
export type CompositionGrade = "A" | "B" | "C" | "D";
export type ReadingDirection = "ltr" | "rtl" | "center_out";

// ─────────────────────────────────────────────────────────────────────────────
// The 14 named composition strategies
// ─────────────────────────────────────────────────────────────────────────────

export type CompositionStrategyId =
  | "luxury"     | "minimal"     | "editorial"  | "product"
  | "healthcare" | "real_estate" | "restaurant" | "fashion"
  | "corporate"  | "social"      | "mobile_first"
  | "landscape"  | "square"      | "vertical";

// ─────────────────────────────────────────────────────────────────────────────
// Placement of a single commercial asset
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetPlacement {
  assetId:           CommercialAssetId;
  region:            LayoutRegion;
  alignment:         AlignmentX;
  /** Minimum clearance from the nearest canvas edge, as % of canvas dimension. */
  safeZonePercent:   number;
  priority:          AssetPriority;
  prominence:        Prominence;
  /** Minimum clear space around the asset (breathing room), % of canvas width. */
  clearSpace:        number;
  size:              AssetSize;
  /** % of canvas area this asset occupies — for large/dominant elements. */
  dominancePercent?: number;
  /** For multi-column layouts (benefits, feature_icons). */
  columns?:          number;
  /** z-index equivalent: higher = rendered in front. */
  stackOrder:        number;
  /** Gap from the nearest element above/below, % of canvas height. */
  spacing?:          number;
}

// ─────────────────────────────────────────────────────────────────────────────
// The hero image zone — where the AI-generated visual lives
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroZone {
  region:            LayoutRegion;
  /** % of total canvas area occupied by the image. */
  dominancePercent:  number;
  aspectMode:        "fill" | "fit" | "bleed";
  /** Minimum margin kept around the image boundary, % of canvas. */
  safeZonePercent:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Eye flow — the reading and attention order for the layout
// ─────────────────────────────────────────────────────────────────────────────

export interface EyeFlow {
  /** The element the viewer notices first. */
  primary:               CommercialAssetId | "hero_zone";
  /** The element the viewer notices second. */
  secondary:             CommercialAssetId | "hero_zone";
  /** The element the viewer notices third. */
  tertiary:              CommercialAssetId | "hero_zone";
  readingDirection:      ReadingDirection;
  /** All elements ordered by visual weight (size × prominence × dominance). */
  visualWeightOrder:     Array<CommercialAssetId | "hero_zone">;
  /** All commercial assets ordered by commercial conversion importance. */
  commercialWeightOrder: CommercialAssetId[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Whitespace specification
// ─────────────────────────────────────────────────────────────────────────────

export interface WhitespaceSpec {
  /** Global canvas padding as % of canvas dimension. */
  globalPaddingPercent:   number;
  /** Vertical gap between major zones (hero/headline/cta) as % of canvas height. */
  sectionSpacingPercent:  number;
  /** Gap between individual elements within a zone as % of canvas height. */
  elementSpacingPercent:  number;
  density:                Density;
  /** 0 = completely open; 100 = severely overcrowded. */
  crowdingScore:          number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe zone map — minimum margins per element type
// ─────────────────────────────────────────────────────────────────────────────

export interface SafeZoneMap {
  topPercent:    number;
  bottomPercent: number;
  leftPercent:   number;
  rightPercent:  number;
  headline:      number;
  cta:           number;
  logo:          number;
  qr:            number;
  footer:        number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict detection and resolution
// ─────────────────────────────────────────────────────────────────────────────

export type ConflictType =
  | "logo_overlaps_cta"
  | "qr_blocks_hero"
  | "headline_overflow_risk"
  | "badge_cluster"
  | "footer_crowded"
  | "duplicate_hierarchy"
  | "element_outside_safe_zone";

export interface ConflictResolution {
  conflictType:   ConflictType;
  affectedAssets: CommercialAssetId[];
  resolution:     string;
  regionChange?:  { asset: CommercialAssetId; from: LayoutRegion; to: LayoutRegion };
}

// ─────────────────────────────────────────────────────────────────────────────
// CommercialCompositionPlan — the complete output
// ─────────────────────────────────────────────────────────────────────────────

export interface CommercialCompositionPlan {
  /** Which strategy governed this layout. */
  strategyId:       CompositionStrategyId;
  /** Where the AI-generated image lives on the canvas. */
  heroZone:         HeroZone;
  /** Placement spec for every commercial asset in the campaign. */
  placements:       AssetPlacement[];
  /** Reading and visual attention sequence. */
  eyeFlow:          EyeFlow;
  /** Padding, spacing, and density metrics. */
  whitespace:       WhitespaceSpec;
  /** Minimum margin enforced per element type and edge. */
  safeZoneMap:      SafeZoneMap;
  /** All detected conflicts and how they were resolved. */
  conflicts:        ConflictResolution[];
  /** A=excellent, B=good, C=acceptable, D=poor (too crowded or conflicted). */
  compositionGrade: CompositionGrade;
  totalAssets:      number;
  /** Non-fatal notices about composition choices. */
  warnings:         string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Input to the composition engine
// ─────────────────────────────────────────────────────────────────────────────

export interface CompositionInput {
  strategy:         CreativeStrategy;
  commercialAssets: CommercialAssetPlan;
  layoutPlan:       VisualLayoutPlan;
  industry:         SupportedIndustryId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: strategy definition used by placement-strategies.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetPlacementDefaults {
  region:            LayoutRegion;
  alignment:         AlignmentX;
  safeZonePercent:   number;
  prominence:        Prominence;
  clearSpace:        number;
  size:              AssetSize;
  stackOrder:        number;
  dominancePercent?: number;
  columns?:          number;
  spacing?:          number;
}

export interface StrategyDefinition {
  id:                CompositionStrategyId;
  heroZone:          HeroZone;
  whitespaceDefaults: Omit<WhitespaceSpec, "crowdingScore">;
  safeZones:         SafeZoneMap;
  assetDefaults:     Partial<Record<CommercialAssetId, AssetPlacementDefaults>>;
  /** Fallback for any asset not specifically defined in this strategy. */
  fallbackPlacement: AssetPlacementDefaults;
}
