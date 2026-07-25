import type { StrategyField } from "../types";

// Phase 8 — Typography & Design System Intelligence types.
// TypographyPlan is the output of the Typography Engine: every decision
// about how content should visually appear in terms of scale, weight,
// character, alignment, spacing, and readability — before any prompt,
// font file, or layout is generated.
//
// STRICT RULES:
//   ✗ Never names an actual font family (Inter, Helvetica, Georgia, etc.)
//   ✗ Never specifies pixel sizes
//   ✗ Never generates colors
//   ✗ Never generates layouts or prompts
//   ✓ Only defines typographic CHARACTER and INTELLIGENCE

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder for future Phase 7 — CopywritingPlan
// The Typography Engine accepts CopywritingPlan as an optional input.
// When present, it informs text-level character limits and hierarchy.
// When absent (current state — Phase 7 not yet built), the engine falls back
// to signals from CreativeStrategy and CampaignPlan.
// ─────────────────────────────────────────────────────────────────────────────

export interface CopywritingPlan {
  /** Explicit placeholder — Phase 7 will populate this with real content. */
  readonly _placeholder: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 1 — Typography Hierarchy
// Every text level in the advertisement, sized relative to each other.
// ─────────────────────────────────────────────────────────────────────────────

export interface TypographyHierarchy {
  /** The dominant text element — largest, boldest, first eye-stop. */
  heroHeadline: StrategyField<"ultra_large_dominant" | "large_commanding" | "absent">;
  /** Primary headline — the main message. */
  headline: StrategyField<"large_prominent" | "medium_prominent" | "small_accent">;
  /** Subheadline — bridges headline and body. */
  subheadline: StrategyField<"medium_supporting" | "small_supporting" | "absent">;
  /** Body copy — longest text, smallest in hierarchy. */
  body: StrategyField<"standard_readable" | "small_detailed" | "absent">;
  /** Feature labels — short descriptor text for icons or callouts. */
  featureText: StrategyField<"medium_label" | "small_label" | "absent">;
  /** Benefit items — parallel, scannable list. */
  benefits: StrategyField<"medium_benefit" | "small_benefit" | "absent">;
  /** Statistics and key numbers — often large and bold. */
  statistics: StrategyField<"large_numeral" | "medium_numeral" | "absent">;
  /** CTA button text — action-oriented, distinct from headline. */
  cta: StrategyField<"prominent_action" | "standard_action">;
  /** Legal disclaimer — minimum viable legibility. */
  disclaimer: StrategyField<"ultra_small_legal" | "small_legal" | "absent">;
  /** Footer text — brand name, contact, website. */
  footer: StrategyField<"small_footer" | "ultra_small_footer" | "absent">;
  /** Short text labels for icons, categories, or chips. */
  labels: StrategyField<"small_label" | "ultra_small_label" | "absent">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 2 — Font Intelligence
// NOT actual font names — only typographic character and personality.
// ─────────────────────────────────────────────────────────────────────────────

export interface FontIntelligence {
  /** The overall typographic personality this creative requires. */
  fontPersonality: StrategyField<"luxury" | "medical" | "corporate" | "editorial" | "technology" | "modern" | "traditional" | "friendly" | "bold" | "minimal">;
  /** The character of the headline typeface — not its name. */
  headlineFontCharacter: StrategyField;
  /** The character of the body typeface — not its name. */
  bodyFontCharacter: StrategyField;
  /** Whether system/web-safe fonts serve this creative adequately. */
  systemFontSufficient: StrategyField<"yes_system_fonts_appropriate" | "no_brand_font_required" | "yes_with_careful_selection">;
  /** Whether this creative requires a distinctive or branded typeface. */
  distinctiveTypefaceNeeded: StrategyField<"essential" | "preferred" | "optional" | "not_needed">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 3 — Font Weight Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface FontWeightPlanning {
  heroHeadlineWeight: StrategyField<"light" | "regular" | "medium" | "semi_bold" | "bold" | "extra_bold">;
  headlineWeight:     StrategyField<"light" | "regular" | "medium" | "semi_bold" | "bold" | "extra_bold">;
  subheadlineWeight:  StrategyField<"light" | "regular" | "medium" | "semi_bold" | "bold">;
  bodyWeight:         StrategyField<"light" | "regular" | "medium">;
  ctaWeight:          StrategyField<"medium" | "semi_bold" | "bold" | "extra_bold">;
  statisticWeight:    StrategyField<"bold" | "extra_bold" | "semi_bold">;
  labelWeight:        StrategyField<"light" | "regular" | "medium">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 4 — Text Alignment
// ─────────────────────────────────────────────────────────────────────────────

export interface TextAlignment {
  /** The dominant alignment for this creative. */
  primaryAlignment: StrategyField<"center" | "left" | "right" | "mixed">;
  headlineAlignment:    StrategyField<"center" | "left" | "right">;
  bodyAlignment:        StrategyField<"center" | "left" | "right" | "justified">;
  ctaAlignment:         StrategyField<"center" | "left" | "right">;
  /** Any platform-specific alignment rules that override the above. */
  platformSpecificNote: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 5 — Readability Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadabilityIntelligence {
  /** Relative line length constraint for the headline. */
  maxCharsPerHeadlineLine: StrategyField<"very_short_1_to_5_words" | "short_5_to_8_words" | "medium_8_to_12_words" | "long_12_plus_words">;
  /** How many lines the hero headline can span before losing impact. */
  maxLinesForHeroHeadline: StrategyField<"1_line_max" | "2_lines_max" | "3_lines_max">;
  /** Maximum body copy length before the reader disengages. */
  maxLinesForBody: StrategyField<"3_lines_max" | "5_lines_max" | "7_lines_max" | "no_limit_long_form">;
  /** The reading pace this creative should support. */
  readingSpeed: StrategyField<"instant_3_seconds" | "fast_7_seconds" | "medium_15_seconds" | "slow_full_read">;
  /** Mobile-specific readability consideration. */
  mobileReadabilityNote: StrategyField;
  /** Desktop/large-format readability consideration. */
  desktopReadabilityNote: StrategyField;
  /** The minimum text level below which type becomes illegible on this canvas. */
  minimumTextSizeCategory: StrategyField<"labels_okay" | "body_minimum" | "headline_minimum_only">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 6 — Information Priority
// ─────────────────────────────────────────────────────────────────────────────

export interface InformationPriority {
  /** The single text element that must visually dominate all others. */
  dominantText: StrategyField;
  /** Text that should always appear smaller and never compete. */
  subordinateText: StrategyField;
  /** Text elements that must never compete with the headline or CTA. */
  neverCompetes: StrategyField;
  /** The relative scale relationship between text levels (descriptive, not ratios). */
  textHierarchyRatio: StrategyField<"high_contrast_3x" | "moderate_contrast_2x" | "low_contrast_1_5x" | "flat_informational">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 7 — Text Safe Areas
// Spatial zones where each text level should be placed, derived from the
// VisualLayoutPlan's block positions. Text must not overlap these zones.
// ─────────────────────────────────────────────────────────────────────────────

export interface TextSafeAreas {
  /** Where the headline must live — aligns with the headline block. */
  headlineSafeZone: StrategyField;
  /** Where body copy can be placed without interfering with other elements. */
  bodySafeZone: StrategyField;
  /** The CTA text zone — always reserved, never overridden. */
  ctaSafeZone: StrategyField;
  /** Clear space around the logo — no text encroachment. */
  logoSafeZone: StrategyField;
  /** Where fine print, legal, and disclaimer text lives. */
  disclaimerSafeZone: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 8 — Typography Rhythm
// The spatial relationships between all text elements.
// ─────────────────────────────────────────────────────────────────────────────

export interface TypographyRhythm {
  /** The relationship between font size and line height. */
  lineHeight: StrategyField<"tight_1_0_to_1_2" | "comfortable_1_3_to_1_5" | "generous_1_5_to_1_8" | "editorial_1_8_plus">;
  /** The space between paragraphs or text blocks. */
  paragraphGap: StrategyField<"tight_minimal" | "medium_comfortable" | "generous_spacious">;
  /** The horizontal spacing between letters. */
  letterSpacing: StrategyField<"tight_condensed" | "normal_default" | "loose_airy" | "ultra_loose_luxury">;
  /** Whether the spacing varies across the creative or stays even. */
  visualRhythm: StrategyField<"even_geometric" | "varied_editorial" | "dynamic_expressive">;
  /** The overall spatial breathing philosophy for text elements. */
  breathingSpace: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// TypographyPlan — complete output of the Typography Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface TypographyPlan {
  hierarchy:           TypographyHierarchy;
  fontIntelligence:    FontIntelligence;
  fontWeights:         FontWeightPlanning;
  alignment:           TextAlignment;
  readability:         ReadabilityIntelligence;
  informationPriority: InformationPriority;
  textSafeAreas:       TextSafeAreas;
  rhythm:              TypographyRhythm;

  /** 0–100 overall confidence across all 8 domains. */
  confidenceScore: number;
  /** Fields where value is "unknown". */
  unknownFields: string[];
}
