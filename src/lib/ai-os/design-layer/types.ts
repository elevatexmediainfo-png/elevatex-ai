// Phase 8 — Design Intelligence Layer types.
//
// Four specialized AI Directors + Prompt Compiler.
// All directors are pure deterministic functions — no LLM, no I/O.
// Intelligence comes from encoded domain expertise, not from LLM inference.

import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { CreativeStrategy } from "../creative-brain/types";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface DesignIntelligenceInput {
  gptDirection: GPTCampaignDirection;
  strategy:     CreativeStrategy;
  aspectRatio?: "9:16" | "1:1" | "16:9";
}

// ─── Design Director ──────────────────────────────────────────────────────────

export interface NegativeSpacePlan {
  top:    string;  // e.g. "28%"
  bottom: string;
  left:   string;
  right:  string;
}

export type DesignBalance  = "centered" | "left-heavy" | "right-heavy" | "top-heavy" | "bottom-heavy";
export type DesignDensity  = "minimal" | "balanced" | "rich";
export type LuxuryLevel    = 1 | 2 | 3 | 4 | 5;

export interface DesignDirectorOutput {
  heroWeight:         number;       // % of total visual attention
  headlineWeight:     number;
  ctaWeight:          number;
  logoWeight:         number;
  decorativeWeight:   number;
  negativeSpace:      NegativeSpacePlan;
  readingFlow:        string[];     // ordered visual journey
  grid:               string;       // e.g. "12-column editorial"
  balance:            DesignBalance;
  premiumFeel:        string;
  whitespaceStrategy: string;
  designDensity:      DesignDensity;
  luxuryLevel:        LuxuryLevel;
  editorialFeel:      string;
}

// ─── Photography Director ─────────────────────────────────────────────────────

export type DepthOfField = "shallow" | "medium" | "deep";

export interface PhotographyDirectorOutput {
  lens:                string;  // e.g. "50mm"
  focalLength:         string;  // e.g. "50mm prime"
  cameraHeight:        string;  // e.g. "table eye level"
  distance:            string;  // e.g. "medium close"
  framing:             string;  // e.g. "rule of thirds"
  crop:                string;  // e.g. "medium portrait crop"
  perspective:         string;  // e.g. "slight low angle"
  focus:               string;  // what is in sharp focus
  depth:               DepthOfField;
  lighting:            string;  // primary lighting description
  lightingTemperature: string;  // e.g. "3200K warm"
  backlight:           string;  // e.g. "steam as natural backlight"
  reflection:          string;  // e.g. "polished glassware"
  shadows:             string;  // shadow behavior
  motion:              string;  // motion or freeze detail
  texture:             string;  // texture emphasis
  atmosphere:          string;  // overall atmospheric quality
  decisiveMoment:      string;  // THE photographic instant to capture
}

// ─── Typography Director ──────────────────────────────────────────────────────

export type TextAlignment       = "left" | "center" | "right";
export type CtaSize             = "small" | "medium" | "large" | "dominant";
export type CtaContrast         = "standard" | "high" | "maximum";
export type LogoVisibility      = "subtle" | "medium" | "prominent";
export type ReadabilityPriority = "maximum" | "high" | "balanced";

export interface HeadlineTypography {
  dominance:   number;       // 1–10
  width:       string;       // e.g. "68% of frame width"
  maxLines:    number;
  alignment:   TextAlignment;
  personality: string;       // prose description of how headline should feel
  safeZone:    string;       // where to reserve space for headline
}

export interface CtaTypography {
  dominance: number;
  size:      CtaSize;
  contrast:  CtaContrast;
  position:  string;
  safeZone:  string;
}

export interface LogoTypography {
  visibility: LogoVisibility;
  position:   string;
  safeZone:   string;
}

export interface TypographyDirectorOutput {
  headline:              HeadlineTypography;
  cta:                   CtaTypography;
  logo:                  LogoTypography;
  readabilityPriority:   ReadabilityPriority;
  typographyPersonality: string;
  spacingBehavior:       string;
}

// ─── Layout Director ──────────────────────────────────────────────────────────

export interface LayoutRegion {
  zone:          string;    // human label, e.g. "top 25%"
  verticalStart: string;    // e.g. "0%"
  verticalEnd:   string;    // e.g. "25%"
  priority:      number;    // 1–10, must-reserve priority
  contents:      string[];  // what belongs here
}

export interface LayoutDirectorOutput {
  regions: {
    headline: LayoutRegion;
    hero:     LayoutRegion;
    cta:      LayoutRegion;
    logo:     LayoutRegion;
    footer:   LayoutRegion;
  };
  safeMargins: {
    top:    string;
    bottom: string;
    left:   string;
    right:  string;
  };
  visualRhythm:   string;
  alignmentGuide: string;
  asciiLayout:    string;
}

// ─── Composite output ─────────────────────────────────────────────────────────

export interface DesignIntelligenceOutput {
  designPlan:      DesignDirectorOutput;
  photographyPlan: PhotographyDirectorOutput;
  typographyPlan:  TypographyDirectorOutput;
  layoutPlan:      LayoutDirectorOutput;
  /** Ready-to-use provider prompt. Replaces buildNarrativePrompt() when DIL is enabled. */
  compiledPrompt:  string;
}

// ─── Industry category (internal to design-layer) ────────────────────────────

export type IndustryCategory =
  | "food_hospitality"
  | "jewelry_fashion_luxury"
  | "healthcare_medical"
  | "real_estate"
  | "education"
  | "tech_software"
  | "fitness_wellness"
  | "beauty_cosmetics"
  | "financial_services"
  | "retail_ecommerce"
  | "events_entertainment"
  | "automotive"
  | "general";
