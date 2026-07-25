// Prompt Expander Engine — shared types. Every module in this folder is a
// pure function (no I/O, no generateScript calls) so the whole engine is
// exhaustively unit-testable, the same discipline resolve-kind.ts already
// established for deterministic prompt-os logic.

// Controls how many embellishment clauses composition.ts/lighting.ts/
// quality.ts pull in — NOT a hard character-count target ("the goal is
// quality, not character count"). Higher tiers naturally produce longer,
// richer prose because more curated phrase banks get woven in.
export type PromptRichnessTier = "simple" | "marketing" | "luxury" | "cinematic";

// One curated visual-language profile per business category — the brief's
// literal "every industry should receive its own visual language" ask.
export interface IndustryProfile {
  key: string;
  label: string;
  /** Lowercase keywords checked against industry/creative_type/intent text. */
  keywords: string[];
  /** Overall mood/setting phrase — folded into the lighting clause. */
  atmosphere: string;
  /** Color-language phrase — folded into the composition/colors clause. */
  paletteLanguage: string;
  /** Materials/textures/premium-detail phrase — folded into composition. */
  premiumDetails: string;
  /** Typical subject matter phrasing (who/what should be in frame). */
  subjectHints: string;
  /** Industry-specific trust signals, appended to the marketing clause. */
  trustElements: string[];
}
