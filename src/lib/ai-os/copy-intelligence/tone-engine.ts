// Phase 8.8A — Tone Engine.
// Derives ToneProfile from communication style, luxury level, brand type, and industry.
// Deterministic — no LLM, no randomness.

import type { ToneType, ToneProfile, FormLevel, EnergyLevel } from "./types";
import type { SupportedIndustryId, BrandType } from "../commercial-assets/types";

// ─────────────────────────────────────────────────────────────────────────────
// Tone adjectives — used by headline engine for {adjective} slot filling
// ─────────────────────────────────────────────────────────────────────────────

export const TONE_ADJECTIVES: Record<ToneType, string[]> = {
  luxury:        ["Exquisite", "Exceptional", "Unparalleled", "Refined", "Bespoke", "Prestige"],
  premium:       ["Premium", "Superior", "Finest", "Distinguished", "High-Quality"],
  professional:  ["Expert", "Trusted", "Professional", "Certified", "Reliable"],
  friendly:      ["Perfect", "Amazing", "Wonderful", "Your Favorite", "Special"],
  authoritative: ["Award-Winning", "Proven", "Industry-Leading", "Recognized", "Elite"],
  minimal:       ["Better", "Simple", "Pure", "Essential", "Clear"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Industry default tones
// ─────────────────────────────────────────────────────────────────────────────

const INDUSTRY_DEFAULT_TONE: Record<SupportedIndustryId, ToneType> = {
  restaurant:  "friendly",
  dental:      "professional",
  real_estate: "professional",
  healthcare:  "authoritative",
  jewelry:     "luxury",
  salon:       "friendly",
  education:   "authoritative",
  automotive:  "premium",
  finance:     "authoritative",
  tech:        "minimal",
  fashion:     "premium",
  events:      "friendly",
  general:     "professional",
};

// ─────────────────────────────────────────────────────────────────────────────
// Communication style → ToneType
// ─────────────────────────────────────────────────────────────────────────────

function styleToTone(style: string | undefined | null): ToneType | null {
  switch (style) {
    case "luxury":       return "luxury";
    case "premium":      return "premium";
    case "professional": return "professional";
    case "authority":    return "authoritative";
    case "educational":  return "authoritative";
    case "minimal":      return "minimal";
    case "friendly":
    case "emotional":    return "friendly";
    default:             return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BrandType → ToneType
// ─────────────────────────────────────────────────────────────────────────────

function brandTypeToTone(brandType: BrandType): ToneType {
  switch (brandType) {
    case "luxury":       return "luxury";
    case "premium":      return "premium";
    case "professional": return "professional";
    case "mass_market":  return "friendly";
    case "affordable":   return "friendly";
    case "startup":      return "minimal";
    default:             return "professional";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formality per tone
// ─────────────────────────────────────────────────────────────────────────────

const TONE_FORMALITY: Record<ToneType, FormLevel> = {
  luxury:        "formal",
  premium:       "formal",
  professional:  "semi_formal",
  authoritative: "formal",
  minimal:       "semi_formal",
  friendly:      "casual",
};

// ─────────────────────────────────────────────────────────────────────────────
// Energy level per tone
// ─────────────────────────────────────────────────────────────────────────────

const TONE_ENERGY: Record<ToneType, EnergyLevel> = {
  luxury:        "low",
  premium:       "low",
  professional:  "medium",
  authoritative: "medium",
  minimal:       "low",
  friendly:      "high",
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function deriveTone(
  communicationStyle: string | undefined | null,
  luxuryLevel: string | undefined | null,
  brandType: BrandType,
  industry: SupportedIndustryId,
): ToneProfile {
  // Luxury level is the strongest signal
  if (luxuryLevel === "ultra_luxury" || luxuryLevel === "high") {
    return { primary: "luxury", secondary: "premium", formality: "formal", energyLevel: "low" };
  }
  if (luxuryLevel === "medium") {
    return { primary: "premium", secondary: "professional", formality: "formal", energyLevel: "low" };
  }

  // Communication style override
  const styleTone = styleToTone(communicationStyle);
  if (styleTone) {
    const secondary = INDUSTRY_DEFAULT_TONE[industry];
    return {
      primary:    styleTone,
      secondary:  secondary !== styleTone ? secondary : null,
      formality:  TONE_FORMALITY[styleTone],
      energyLevel: TONE_ENERGY[styleTone],
    };
  }

  // Brand type as tiebreaker
  const brandTone  = brandTypeToTone(brandType);
  const indTone    = INDUSTRY_DEFAULT_TONE[industry];
  const primary    = brandTone;
  const secondary  = indTone !== brandTone ? indTone : null;

  return {
    primary,
    secondary,
    formality:  TONE_FORMALITY[primary],
    energyLevel: TONE_ENERGY[primary],
  };
}
