// Phase 8.7A — Industry Asset Rules.
// Defines which commercial assets are mandatory, optional, or forbidden per industry.
// Pure data — no logic, no text generation.

import type { IndustryAssetRules, SupportedIndustryId } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Industry rule definitions
// ─────────────────────────────────────────────────────────────────────────────

const INDUSTRY_RULES: Record<SupportedIndustryId, IndustryAssetRules> = {

  restaurant: {
    industryId: "restaurant",
    must:     ["headline", "cta", "booking_button", "logo"],
    optional: [
      "subheadline", "chef_recommendation", "google_rating", "review_stars",
      "qr_code", "offer_ribbon", "address", "phone", "whatsapp",
      "social_icons", "festival_sticker", "opening_badge", "discount_badge",
    ],
    never: [
      "doctor_credentials", "doctor_name", "clinic_logo", "certification",
      "before_after_badge", "developer_seal", "builder_logo", "rera_number",
      "possession_date", "appointment_button",
    ],
  },

  dental: {
    industryId: "dental",
    must:     ["doctor_name", "clinic_logo", "appointment_button", "doctor_credentials"],
    optional: [
      "headline", "subheadline", "google_rating", "review_stars",
      "before_after_badge", "phone", "whatsapp", "trust_badge",
      "certification", "address", "website", "social_icons",
    ],
    never: [
      "chef_recommendation", "booking_button", "offer_ribbon", "festival_sticker",
      "discount_badge", "builder_logo", "rera_number", "developer_seal",
      "possession_date", "price_tag",
    ],
  },

  real_estate: {
    industryId: "real_estate",
    must:     ["builder_logo", "location", "possession_date", "cta"],
    optional: [
      "headline", "subheadline", "rera_number", "price_tag",
      "developer_seal", "trust_badge", "phone", "whatsapp",
      "website", "qr_code", "award_badge",
    ],
    never: [
      "chef_recommendation", "doctor_credentials", "doctor_name", "clinic_logo",
      "before_after_badge", "booking_button", "appointment_button",
      "festival_sticker", "discount_badge", "review_stars",
    ],
  },

  healthcare: {
    industryId: "healthcare",
    must:     ["doctor_name", "certification", "appointment_button", "headline"],
    optional: [
      "subheadline", "doctor_credentials", "clinic_logo", "trust_badge",
      "google_rating", "review_stars", "phone", "whatsapp", "address",
      "website", "cta", "award_badge",
    ],
    never: [
      "chef_recommendation", "booking_button", "offer_ribbon", "festival_sticker",
      "discount_badge", "builder_logo", "rera_number", "developer_seal",
      "possession_date", "price_tag",
    ],
  },

  jewelry: {
    industryId: "jewelry",
    must:     ["headline", "logo", "cta"],
    optional: [
      "subheadline", "offer_ribbon", "limited_time_badge", "festival_sticker",
      "award_badge", "certification", "phone", "whatsapp", "website",
      "social_icons", "qr_code",
    ],
    never: [
      "doctor_credentials", "doctor_name", "clinic_logo", "chef_recommendation",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
      "before_after_badge", "appointment_button", "booking_button",
      "google_rating", "review_stars",
    ],
  },

  salon: {
    industryId: "salon",
    must:     ["headline", "booking_button", "logo"],
    optional: [
      "subheadline", "cta", "before_after_badge", "offer_ribbon", "limited_time_badge",
      "discount_badge", "google_rating", "review_stars", "phone", "whatsapp",
      "address", "social_icons", "festival_sticker",
    ],
    never: [
      "doctor_credentials", "doctor_name", "clinic_logo", "certification",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
      "appointment_button", "price_tag",
    ],
  },

  education: {
    industryId: "education",
    must:     ["headline", "cta", "logo"],
    optional: [
      "subheadline", "benefits", "certification", "award_badge",
      "trust_badge", "limited_time_badge", "offer_ribbon", "phone",
      "whatsapp", "website", "address", "social_icons", "qr_code",
    ],
    never: [
      "chef_recommendation", "doctor_credentials", "doctor_name", "clinic_logo",
      "before_after_badge", "booking_button", "appointment_button",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
      "price_tag",
    ],
  },

  automotive: {
    industryId: "automotive",
    must:     ["headline", "logo", "cta"],
    optional: [
      "subheadline", "benefits", "feature_icons", "offer_ribbon",
      "limited_time_badge", "discount_badge", "award_badge", "trust_badge",
      "phone", "whatsapp", "website", "qr_code", "social_icons",
    ],
    never: [
      "chef_recommendation", "doctor_credentials", "doctor_name", "clinic_logo",
      "before_after_badge", "booking_button", "appointment_button",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
      "certification",
    ],
  },

  finance: {
    industryId: "finance",
    must:     ["headline", "cta", "logo", "certification"],
    optional: [
      "subheadline", "benefits", "trust_badge", "award_badge",
      "phone", "whatsapp", "website", "address", "qr_code",
      "social_icons", "limited_time_badge",
    ],
    never: [
      "chef_recommendation", "doctor_credentials", "doctor_name", "clinic_logo",
      "before_after_badge", "booking_button", "appointment_button",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
      "festival_sticker", "discount_badge", "offer_ribbon",
    ],
  },

  tech: {
    industryId: "tech",
    must:     ["headline", "cta", "logo"],
    optional: [
      "subheadline", "benefits", "feature_icons", "trust_badge",
      "award_badge", "certification", "limited_time_badge",
      "phone", "website", "social_icons", "qr_code",
    ],
    never: [
      "chef_recommendation", "doctor_credentials", "doctor_name", "clinic_logo",
      "before_after_badge", "booking_button", "appointment_button",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
      "festival_sticker",
    ],
  },

  fashion: {
    industryId: "fashion",
    must:     ["headline", "logo", "cta"],
    optional: [
      "subheadline", "offer_ribbon", "limited_time_badge", "discount_badge",
      "festival_sticker", "social_icons", "website", "phone",
      "whatsapp", "qr_code",
    ],
    never: [
      "chef_recommendation", "doctor_credentials", "doctor_name", "clinic_logo",
      "before_after_badge", "booking_button", "appointment_button",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
      "certification", "award_badge",
    ],
  },

  events: {
    industryId: "events",
    must:     ["headline", "cta", "booking_button"],
    optional: [
      "subheadline", "logo", "festival_sticker", "opening_badge",
      "limited_time_badge", "offer_ribbon", "phone", "whatsapp",
      "website", "address", "social_icons", "qr_code",
    ],
    never: [
      "chef_recommendation", "doctor_credentials", "doctor_name", "clinic_logo",
      "before_after_badge", "appointment_button",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
      "certification", "price_tag",
    ],
  },

  general: {
    industryId: "general",
    must:     ["headline", "cta", "logo"],
    optional: [
      "subheadline", "benefits", "feature_icons", "trust_badge",
      "phone", "whatsapp", "website", "address", "social_icons",
      "qr_code", "offer_ribbon",
    ],
    never: [
      "doctor_credentials", "doctor_name", "clinic_logo",
      "before_after_badge", "chef_recommendation",
      "builder_logo", "rera_number", "developer_seal", "possession_date",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Accessors
// ─────────────────────────────────────────────────────────────────────────────

export function getRulesForIndustry(industryId: SupportedIndustryId): IndustryAssetRules {
  return INDUSTRY_RULES[industryId];
}

export function getAllIndustryRules(): IndustryAssetRules[] {
  return Object.values(INDUSTRY_RULES);
}
