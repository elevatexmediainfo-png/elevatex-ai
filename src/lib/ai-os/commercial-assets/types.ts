// Phase 8.7A — Commercial Asset Planning Engine types.
// Pure interfaces — no business logic, no text generation.
// The planner decides WHAT assets should exist. It never renders, writes, or generates content.

// ─────────────────────────────────────────────────────────────────────────────
// Asset identifiers
// ─────────────────────────────────────────────────────────────────────────────

export type CommercialAssetId =
  | "headline"
  | "subheadline"
  | "cta"
  | "benefits"
  | "feature_icons"
  | "review_stars"
  | "google_rating"
  | "award_badge"
  | "offer_ribbon"
  | "limited_time_badge"
  | "qr_code"
  | "phone"
  | "whatsapp"
  | "website"
  | "address"
  | "email"
  | "social_icons"
  | "trust_badge"
  | "certification"
  | "doctor_credentials"
  | "chef_recommendation"
  | "builder_logo"
  | "developer_seal"
  | "festival_sticker"
  | "opening_badge"
  | "discount_badge"
  | "appointment_button"
  | "booking_button"
  | "doctor_name"
  | "clinic_logo"
  | "before_after_badge"
  | "logo"
  | "location"
  | "possession_date"
  | "rera_number"
  | "price_tag";

// ─────────────────────────────────────────────────────────────────────────────
// Asset importance dimensions
// ─────────────────────────────────────────────────────────────────────────────

export type AssetPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type CommercialImportance = "critical" | "high" | "medium" | "low";
export type VisualImportance     = "dominant" | "prominent" | "supporting" | "subtle";
export type PlacementImportance  = "primary_zone" | "secondary_zone" | "edge_zone" | "flexible";

// ─────────────────────────────────────────────────────────────────────────────
// Asset registry entry — one definition per asset type
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetDefinition {
  id:                   CommercialAssetId;
  label:                string;
  priority:             AssetPriority;
  commercialImportance: CommercialImportance;
  visualImportance:     VisualImportance;
  placementImportance:  PlacementImportance;
  description:          string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Industry identifiers
// ─────────────────────────────────────────────────────────────────────────────

export type SupportedIndustryId =
  | "restaurant"
  | "dental"
  | "real_estate"
  | "healthcare"
  | "jewelry"
  | "salon"
  | "education"
  | "automotive"
  | "finance"
  | "tech"
  | "fashion"
  | "events"
  | "general";

// ─────────────────────────────────────────────────────────────────────────────
// Industry rules — which assets are mandated, allowed, or forbidden
// ─────────────────────────────────────────────────────────────────────────────

export interface IndustryAssetRules {
  industryId: SupportedIndustryId;
  must:       CommercialAssetId[];
  optional:   CommercialAssetId[];
  never:      CommercialAssetId[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Planner input
// ─────────────────────────────────────────────────────────────────────────────

export type CommercialObjective =
  | "lead_generation"
  | "brand_awareness"
  | "direct_sale"
  | "appointment_booking"
  | "footfall"
  | "event_attendance"
  | "trust_building"
  | "product_launch";

export type BrandType =
  | "luxury"
  | "premium"
  | "professional"
  | "mass_market"
  | "affordable"
  | "startup";

export interface AssetPlannerInput {
  industry:            SupportedIndustryId;
  campaign:            string;
  audience:            string;
  creativeRoute?:      string;
  commercialObjective: CommercialObjective;
  brandType:           BrandType;
  offer?:              string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Planner output
// ─────────────────────────────────────────────────────────────────────────────

export interface PlannedAsset {
  id:                   CommercialAssetId;
  priority:             AssetPriority;
  mandatory:            boolean;
  commercialImportance: CommercialImportance;
  visualImportance:     VisualImportance;
  placementImportance:  PlacementImportance;
}

export interface CommercialAssetPlan {
  /** All assets that should be present — mandatory + selected optional. */
  assets:    PlannedAsset[];
  /** Asset IDs ordered by effective priority (highest first). */
  priority:  CommercialAssetId[];
  /** IDs that must appear — violation breaks industry compliance. */
  mandatory: CommercialAssetId[];
  /** IDs that are available but not required for this context. */
  optional:  CommercialAssetId[];
  /** IDs that must never appear — violation is a compliance failure. */
  forbidden: CommercialAssetId[];
}
