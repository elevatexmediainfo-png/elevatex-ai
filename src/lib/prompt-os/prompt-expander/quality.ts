import type { UniversalPrompt } from "../schema";
import type { CreativeBrief } from "../creative-director";
import type { IndustryProfile, PromptRichnessTier } from "./types";

// Pure function of kind/luxury signal/industry/visualDensity — controls how
// many curated phrase banks composition.ts/lighting.ts/quality.ts pull in.
// "The goal is quality, not character count." Richer tiers naturally produce
// longer prose as a side effect of pulling in more genuinely relevant phrase
// banks, never by padding.
//
// Image Quality Stabilization — visualDensity override: the Creative Director
// now makes an explicit density decision ("minimal" / "medium" / "rich")
// which takes precedence over the implicit luxury-level inference. This means
// a luxury jewellery campaign the Director marks as "minimal" won't be
// buried in cinematic phrase banks — and a finance infographic the Director
// marks as "rich" will get the full density it needs regardless of luxury level.
const INHERENTLY_LUXURY_INDUSTRIES = new Set(["real_estate", "jewellery", "finance", "salon"]);

export function determineRichnessTier(prompt: UniversalPrompt, profile: IndustryProfile): PromptRichnessTier {
  const luxury = (prompt.style.luxuryLevel ?? "").toLowerCase();
  const isHighLuxury = ["high", "luxury", "premium", "elevated"].some((kw) => luxury.includes(kw));
  const inherentlyLuxuryIndustry = INHERENTLY_LUXURY_INDUSTRIES.has(profile.key);

  let tier: PromptRichnessTier;
  if (isHighLuxury && inherentlyLuxuryIndustry) {
    tier = "cinematic";
  } else if (isHighLuxury || inherentlyLuxuryIndustry) {
    tier = "luxury";
  } else {
    const typeSignal = `${prompt.creative_type ?? ""} ${prompt.platform ?? ""}`.toLowerCase();
    const hasMarketingSignal =
      ["marketing", "social", "campaign", "advertis", "promo"].some((kw) => typeSignal.includes(kw)) ||
      Boolean(prompt.marketing.goal);
    tier = hasMarketingSignal ? "marketing" : "simple";
  }

  // Image Quality Stabilization — apply the Director's explicit density
  // decision as an override. "minimal" caps at marketing (never cinematic/
  // luxury phrase banks regardless of industry). "rich" upgrades marketing
  // → luxury so feature-heavy infographics get the depth they need.
  const brief = prompt.creativeBrief as CreativeBrief | undefined;
  const density = brief?.visualDensity?.toLowerCase();
  if (density === "minimal" && (tier === "luxury" || tier === "cinematic")) {
    tier = "marketing";
  } else if (density === "rich" && tier === "marketing") {
    tier = "luxury";
  }

  return tier;
}

// Full-sentence quality descriptors — woven into the prompt as prose, not tag lists.
// Each string is a complete sentence so composeFluently() in the adapter renders
// them as independent statements, never comma-spliced.
const BASE_SENTENCES = [
  "Shot with photorealistic precision and natural material detail at the standard of professional commercial photography.",
];
const MARKETING_SENTENCES = [
  "Composed with balanced whitespace, readable typography-safe zones, and a scroll-stopping visual hierarchy that meets premium advertising production standards.",
];
const LUXURY_SENTENCES = [
  "Elevated with luxury brand aesthetics and cinematic color grading — rich, realistic materials presented at the standard of high-end editorial photography.",
];
const CINEMATIC_SENTENCES = [
  "Crafted at the production level of a global luxury advertising campaign: an immediately recognizable focal subject, designed to maximize attention and engagement as if directed by an award-winning creative director.",
];

export function buildQualityKeywords(prompt: UniversalPrompt, tier: PromptRichnessTier): string[] {
  const bank = [...BASE_SENTENCES];
  if (tier === "marketing" || tier === "luxury" || tier === "cinematic") bank.push(...MARKETING_SENTENCES);
  if (tier === "luxury" || tier === "cinematic") bank.push(...LUXURY_SENTENCES);
  if (tier === "cinematic") bank.push(...CINEMATIC_SENTENCES);

  const extra = [prompt.quality.realism, prompt.quality.resolution].filter((v): v is string => Boolean(v));
  const existing = [...(prompt.quality.keywords ?? []), ...extra];
  const merged = [...existing, ...bank].map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(merged));
}
