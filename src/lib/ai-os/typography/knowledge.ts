// Phase 8 — Typography Intelligence knowledge banks.
// Every decision here is based on typographic principles and advertising
// best practices — NOT on specific font files or pixel values.
// Pure data, no I/O, no dependencies.

// ─────────────────────────────────────────────────────────────────────────────
// Font personality rules by industry and design style
// ─────────────────────────────────────────────────────────────────────────────

export const FONT_PERSONALITY_BY_INDUSTRY: Record<string, string> = {
  dental:           "medical",
  dental_clinic:    "medical",
  healthcare:       "medical",
  general_hospital: "medical",
  health_clinic:    "medical",
  finance:          "corporate",
  mutual_fund:      "corporate",
  banking:          "corporate",
  insurance:        "corporate",
  real_estate:      "luxury",
  luxury_property:  "luxury",
  jewellery_luxury: "luxury",
  fine_jewellery:   "luxury",
  food_beverage:    "friendly",
  restaurant:       "friendly",
  cafe:             "friendly",
  education:        "editorial",
  school:           "editorial",
  college_university:"editorial",
  beauty_wellness:  "editorial",
  hair_salon:       "editorial",
  automotive:       "bold",
  car_dealership:   "bold",
  hospitality:      "luxury",
  retail:           "modern",
  technology:       "technology",
};

export const FONT_PERSONALITY_BY_STYLE: Record<string, string> = {
  editorial_clean:       "editorial",
  luxury_minimal:        "luxury",
  corporate_professional:"corporate",
  modern_bold:           "bold",
  warm_approachable:     "friendly",
  informational_structured:"minimal",
  dramatic_cinematic:    "bold",
};

export function getFontPersonality(industryKey: string, designStyle: string): string {
  return FONT_PERSONALITY_BY_INDUSTRY[industryKey]
    ?? FONT_PERSONALITY_BY_INDUSTRY[industryKey?.split("_")[0]]
    ?? FONT_PERSONALITY_BY_STYLE[designStyle]
    ?? "modern";
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline font character by personality
// ─────────────────────────────────────────────────────────────────────────────

export const HEADLINE_FONT_CHARACTER: Record<string, string> = {
  luxury:       "High-contrast serif or refined geometric sans — hairline to ultra-bold contrast ratio; elegant, precise, unmistakably premium",
  medical:      "Humanist sans-serif character — warm precision, professional clarity, never cold or mechanical",
  corporate:    "Geometric or transitional serif character — structured authority, institutional trust, conservative strength",
  editorial:    "High-quality serif or editorial sans character — sophistication, craft, long-form readability at any size",
  technology:   "Geometric sans character — clean, precise, forward-looking; each letterform deliberate",
  modern:       "Contemporary sans character — neutral, versatile, legible at all sizes; not trendy, not traditional",
  traditional:  "Classical serif character — respect for convention, heritage, enduring quality",
  friendly:     "Rounded or humanist sans character — approachable curves, warm open forms, invites engagement",
  bold:         "Extended or condensed display character — maximum visual impact, commands attention from distance",
  minimal:      "Ultra-light or thin character — sophisticated restraint; the font itself is invisible, the message leads",
};

export const BODY_FONT_CHARACTER: Record<string, string> = {
  luxury:       "Refined serif or optical-size-aware sans — perfect for long captions, never intrudes on the visual story",
  medical:      "Clean readable sans — optimised for comprehension, clinical but warm, never distorts under stress",
  corporate:    "Conservative humanist sans — reliable, professional, legible across all output conditions",
  editorial:    "Text-grade serif — designed for reading, generous x-height, smooth rhythm across paragraphs",
  technology:   "Monospaced or technical sans option available — precision implies competence",
  modern:       "Neutral sans — disappears behind the words, lets the message lead",
  traditional:  "Companion text serif to the headline — consistent with the classical positioning",
  friendly:     "Rounded or warm humanist sans — matches the headline personality, feels conversational",
  bold:         "Readable companion sans — body must NOT compete with the bold headline; retreat, don't fight",
  minimal:      "Ultra-clean sans — as invisible as possible; the design carries the message, not the typeface",
};

// ─────────────────────────────────────────────────────────────────────────────
// Readability rules by platform / canvas type
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadabilityRule {
  maxHeadlineWords:  string;
  maxHeadlineLines:  string;
  maxBodyLines:      string;
  readingSpeed:      string;
  mobileNote:        string;
  desktopNote:       string;
  minSizeCategory:   string;
}

export const READABILITY_BY_PLATFORM: Record<string, ReadabilityRule> = {
  instagram: {
    maxHeadlineWords:  "short_5_to_8_words",
    maxHeadlineLines:  "2_lines_max",
    maxBodyLines:      "3_lines_max",
    readingSpeed:      "instant_3_seconds",
    mobileNote:        "90%+ of Instagram is mobile — headline must be legible at 375px width without zooming",
    desktopNote:       "Desktop layout mirrors mobile; text size requirements remain mobile-first",
    minSizeCategory:   "body_minimum",
  },
  story: {
    maxHeadlineWords:  "very_short_1_to_5_words",
    maxHeadlineLines:  "1_line_max",
    maxBodyLines:      "3_lines_max",
    readingSpeed:      "instant_3_seconds",
    mobileNote:        "Story occupies full mobile screen — text must not fall in top 14% or bottom 20% (UI chrome). Headline in vertical centre band",
    desktopNote:       "Stories are mobile-only; desktop preview exists but design for mobile first",
    minSizeCategory:   "body_minimum",
  },
  facebook: {
    maxHeadlineWords:  "short_5_to_8_words",
    maxHeadlineLines:  "2_lines_max",
    maxBodyLines:      "5_lines_max",
    readingSpeed:      "fast_7_seconds",
    mobileNote:        "Caption text (up to 125 chars) shown below image — in-image body copy must be minimal",
    desktopNote:       "Slightly more body copy acceptable on desktop feed; keep within 20% text area rule",
    minSizeCategory:   "body_minimum",
  },
  poster: {
    maxHeadlineWords:  "medium_8_to_12_words",
    maxHeadlineLines:  "3_lines_max",
    maxBodyLines:      "7_lines_max",
    readingSpeed:      "medium_15_seconds",
    mobileNote:        "Print poster is not mobile — this note refers to the digital thumbnail of the poster (Instagram share); ensure headline remains legible",
    desktopNote:       "Viewed at ~60cm distance — minimum body text should pass RNIB legibility at A4 scale",
    minSizeCategory:   "labels_okay",
  },
  print: {
    maxHeadlineWords:  "medium_8_to_12_words",
    maxHeadlineLines:  "3_lines_max",
    maxBodyLines:      "no_limit_long_form",
    readingSpeed:      "slow_full_read",
    mobileNote:        "Not applicable for print — this refers to digital repro of the print asset",
    desktopNote:       "Viewed at comfortable reading distance — full typographic hierarchy can be expressed",
    minSizeCategory:   "labels_okay",
  },
  outdoor: {
    maxHeadlineWords:  "very_short_1_to_5_words",
    maxHeadlineLines:  "1_line_max",
    maxBodyLines:      "3_lines_max",
    readingSpeed:      "instant_3_seconds",
    mobileNote:        "Not mobile — but digital OOH at transit stops may have 3-second dwell; same constraints apply",
    desktopNote:       "Viewed from 10-50m at speed — text must be legible in peripheral vision; no body copy",
    minSizeCategory:   "headline_minimum_only",
  },
  general: {
    maxHeadlineWords:  "short_5_to_8_words",
    maxHeadlineLines:  "2_lines_max",
    maxBodyLines:      "5_lines_max",
    readingSpeed:      "fast_7_seconds",
    mobileNote:        "Design for mobile first; test legibility at 375px viewport minimum",
    desktopNote:       "Desktop allows slightly more content; maintain hierarchy",
    minSizeCategory:   "body_minimum",
  },
};

export function getReadabilityRule(platform: string): ReadabilityRule {
  return READABILITY_BY_PLATFORM[platform] ?? READABILITY_BY_PLATFORM.general;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typography rhythm by design style
// ─────────────────────────────────────────────────────────────────────────────

export const RHYTHM_BY_STYLE: Record<string, { lineHeight: string; paragraphGap: string; letterSpacing: string; visualRhythm: string }> = {
  luxury_minimal:        { lineHeight: "editorial_1_8_plus", paragraphGap: "generous_spacious", letterSpacing: "ultra_loose_luxury", visualRhythm: "varied_editorial" },
  editorial_clean:       { lineHeight: "generous_1_5_to_1_8", paragraphGap: "medium_comfortable", letterSpacing: "normal_default", visualRhythm: "even_geometric" },
  corporate_professional:{ lineHeight: "comfortable_1_3_to_1_5", paragraphGap: "medium_comfortable", letterSpacing: "tight_condensed", visualRhythm: "even_geometric" },
  modern_bold:           { lineHeight: "tight_1_0_to_1_2", paragraphGap: "tight_minimal", letterSpacing: "normal_default", visualRhythm: "dynamic_expressive" },
  warm_approachable:     { lineHeight: "comfortable_1_3_to_1_5", paragraphGap: "medium_comfortable", letterSpacing: "normal_default", visualRhythm: "even_geometric" },
  informational_structured:{ lineHeight: "comfortable_1_3_to_1_5", paragraphGap: "medium_comfortable", letterSpacing: "tight_condensed", visualRhythm: "even_geometric" },
  dramatic_cinematic:    { lineHeight: "generous_1_5_to_1_8", paragraphGap: "generous_spacious", letterSpacing: "loose_airy", visualRhythm: "dynamic_expressive" },
};

export function getRhythmSpec(designStyle: string) {
  return RHYTHM_BY_STYLE[designStyle] ?? RHYTHM_BY_STYLE.editorial_clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text hierarchy contrast ratio by luxury level
// ─────────────────────────────────────────────────────────────────────────────

export const HIERARCHY_CONTRAST: Record<string, string> = {
  ultra_luxury:  "high_contrast_3x",   // hero headline is 3× the body size
  high:          "high_contrast_3x",
  medium:        "moderate_contrast_2x",
  low:           "moderate_contrast_2x",
  none:          "low_contrast_1_5x",
  utility:       "flat_informational",
};

export function getHierarchyContrast(luxuryLevel: string): string {
  return HIERARCHY_CONTRAST[luxuryLevel] ?? HIERARCHY_CONTRAST.medium;
}
