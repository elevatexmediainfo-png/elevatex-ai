// Phase 8.7A — Commercial Asset Registry.
// Canonical definitions for every commercial asset: priority, importance dimensions.
// Data only — no logic, no text generation.

import type { AssetDefinition, CommercialAssetId } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Full registry — one entry per CommercialAssetId
// ─────────────────────────────────────────────────────────────────────────────

export const ASSET_REGISTRY: Record<CommercialAssetId, AssetDefinition> = {

  // ── Primary communication ──────────────────────────────────────────────────

  headline: {
    id:                   "headline",
    label:                "Headline",
    priority:             10,
    commercialImportance: "critical",
    visualImportance:     "dominant",
    placementImportance:  "primary_zone",
    description:          "Primary message — the single most important text element in the ad",
  },

  subheadline: {
    id:                   "subheadline",
    label:                "Subheadline",
    priority:             8,
    commercialImportance: "high",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Secondary message that elaborates or qualifies the headline",
  },

  cta: {
    id:                   "cta",
    label:                "CTA",
    priority:             10,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Call to action — the direct instruction that drives the conversion",
  },

  benefits: {
    id:                   "benefits",
    label:                "Benefits",
    priority:             7,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "secondary_zone",
    description:          "Bullet-point value propositions that support the main headline",
  },

  feature_icons: {
    id:                   "feature_icons",
    label:                "Feature Icons",
    priority:             5,
    commercialImportance: "medium",
    visualImportance:     "supporting",
    placementImportance:  "secondary_zone",
    description:          "Icon + label pairs for product or service features",
  },

  // ── Social proof ───────────────────────────────────────────────────────────

  review_stars: {
    id:                   "review_stars",
    label:                "Review Stars",
    priority:             7,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "secondary_zone",
    description:          "Star rating display — 3.5–5 stars with review count",
  },

  google_rating: {
    id:                   "google_rating",
    label:                "Google Rating",
    priority:             7,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "secondary_zone",
    description:          "Official Google rating badge with score and review count",
  },

  trust_badge: {
    id:                   "trust_badge",
    label:                "Trust Badge",
    priority:             6,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "edge_zone",
    description:          "Generic trust/safety indicator badge — verified, insured, guaranteed",
  },

  certification: {
    id:                   "certification",
    label:                "Certification",
    priority:             7,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "edge_zone",
    description:          "Professional or industry-specific certification mark",
  },

  award_badge: {
    id:                   "award_badge",
    label:                "Award Badge",
    priority:             6,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "edge_zone",
    description:          "Industry award or recognition badge",
  },

  before_after_badge: {
    id:                   "before_after_badge",
    label:                "Before After Badge",
    priority:             6,
    commercialImportance: "high",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Split visual showing transformation — before state vs after result",
  },

  // ── Promotional overlays ───────────────────────────────────────────────────

  offer_ribbon: {
    id:                   "offer_ribbon",
    label:                "Offer Ribbon",
    priority:             8,
    commercialImportance: "high",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Diagonal or banner ribbon announcing an offer or promotion",
  },

  limited_time_badge: {
    id:                   "limited_time_badge",
    label:                "Limited Time Badge",
    priority:             7,
    commercialImportance: "high",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Urgency badge indicating a time-limited offer",
  },

  discount_badge: {
    id:                   "discount_badge",
    label:                "Discount Badge",
    priority:             7,
    commercialImportance: "high",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Price reduction badge — percentage off, flat discount amount",
  },

  festival_sticker: {
    id:                   "festival_sticker",
    label:                "Festival Sticker",
    priority:             5,
    commercialImportance: "medium",
    visualImportance:     "supporting",
    placementImportance:  "edge_zone",
    description:          "Seasonal or festival-specific decorative overlay",
  },

  opening_badge: {
    id:                   "opening_badge",
    label:                "Opening Badge",
    priority:             8,
    commercialImportance: "high",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Grand opening or new launch announcement badge",
  },

  // ── Contact assets ─────────────────────────────────────────────────────────

  phone: {
    id:                   "phone",
    label:                "Phone",
    priority:             8,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "secondary_zone",
    description:          "Phone number with call icon",
  },

  whatsapp: {
    id:                   "whatsapp",
    label:                "WhatsApp",
    priority:             8,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "secondary_zone",
    description:          "WhatsApp contact number with WhatsApp icon",
  },

  website: {
    id:                   "website",
    label:                "Website",
    priority:             6,
    commercialImportance: "medium",
    visualImportance:     "subtle",
    placementImportance:  "edge_zone",
    description:          "Website URL",
  },

  address: {
    id:                   "address",
    label:                "Address",
    priority:             6,
    commercialImportance: "medium",
    visualImportance:     "subtle",
    placementImportance:  "edge_zone",
    description:          "Physical address with map pin icon",
  },

  email: {
    id:                   "email",
    label:                "Email",
    priority:             4,
    commercialImportance: "low",
    visualImportance:     "subtle",
    placementImportance:  "edge_zone",
    description:          "Email address",
  },

  social_icons: {
    id:                   "social_icons",
    label:                "Social Icons",
    priority:             4,
    commercialImportance: "low",
    visualImportance:     "subtle",
    placementImportance:  "edge_zone",
    description:          "Social media platform icons — Instagram, Facebook, YouTube handles",
  },

  qr_code: {
    id:                   "qr_code",
    label:                "QR Code",
    priority:             6,
    commercialImportance: "medium",
    visualImportance:     "supporting",
    placementImportance:  "edge_zone",
    description:          "Scannable QR code for digital action",
  },

  // ── Action buttons ─────────────────────────────────────────────────────────

  appointment_button: {
    id:                   "appointment_button",
    label:                "Appointment Button",
    priority:             9,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Book appointment CTA — used for healthcare, dental, professional services",
  },

  booking_button: {
    id:                   "booking_button",
    label:                "Booking Button",
    priority:             9,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Reserve / book CTA — used for hospitality, events, salons",
  },

  // ── Brand identity ─────────────────────────────────────────────────────────

  logo: {
    id:                   "logo",
    label:                "Logo",
    priority:             9,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Brand logo mark",
  },

  // ── Industry-specific credentials ──────────────────────────────────────────

  doctor_credentials: {
    id:                   "doctor_credentials",
    label:                "Doctor Credentials",
    priority:             8,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "secondary_zone",
    description:          "Doctor's degree, specialisation, years of experience",
  },

  doctor_name: {
    id:                   "doctor_name",
    label:                "Doctor Name",
    priority:             9,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "secondary_zone",
    description:          "Doctor's full name with title prefix (Dr.)",
  },

  clinic_logo: {
    id:                   "clinic_logo",
    label:                "Clinic Logo",
    priority:             9,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Clinic or hospital brand logo",
  },

  chef_recommendation: {
    id:                   "chef_recommendation",
    label:                "Chef Recommendation",
    priority:             6,
    commercialImportance: "medium",
    visualImportance:     "supporting",
    placementImportance:  "secondary_zone",
    description:          "Chef's endorsement badge or signature quote",
  },

  builder_logo: {
    id:                   "builder_logo",
    label:                "Builder Logo",
    priority:             9,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "primary_zone",
    description:          "Real estate developer or builder brand logo",
  },

  developer_seal: {
    id:                   "developer_seal",
    label:                "Developer Seal",
    priority:             7,
    commercialImportance: "high",
    visualImportance:     "supporting",
    placementImportance:  "secondary_zone",
    description:          "Official developer certification or guarantee seal",
  },

  // ── Real estate specifics ──────────────────────────────────────────────────

  location: {
    id:                   "location",
    label:                "Location",
    priority:             9,
    commercialImportance: "critical",
    visualImportance:     "prominent",
    placementImportance:  "secondary_zone",
    description:          "Property location — area, city, landmark proximity",
  },

  possession_date: {
    id:                   "possession_date",
    label:                "Possession Date",
    priority:             8,
    commercialImportance: "high",
    visualImportance:     "prominent",
    placementImportance:  "secondary_zone",
    description:          "Ready-to-move or possession timeline badge",
  },

  rera_number: {
    id:                   "rera_number",
    label:                "RERA Number",
    priority:             6,
    commercialImportance: "high",
    visualImportance:     "subtle",
    placementImportance:  "edge_zone",
    description:          "RERA registration number — regulatory compliance element",
  },

  price_tag: {
    id:                   "price_tag",
    label:                "Price Tag",
    priority:             7,
    commercialImportance: "high",
    visualImportance:     "prominent",
    placementImportance:  "secondary_zone",
    description:          "Starting price or price range indicator",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Accessors
// ─────────────────────────────────────────────────────────────────────────────

export function getAssetDefinition(id: CommercialAssetId): AssetDefinition {
  return ASSET_REGISTRY[id];
}

export function getAllAssets(): AssetDefinition[] {
  return Object.values(ASSET_REGISTRY);
}
