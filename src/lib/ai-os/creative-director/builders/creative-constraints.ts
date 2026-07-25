import type { CreativeStrategy } from "../../creative-brain/types";
import type { CreativeConstraints } from "../types";
import { cf, unknownCf } from "./shared";
import { getIndustryRestrictions } from "../knowledge";

// Builder 9 — Creative Constraints
// Sole responsibility: establish what must never and must always appear.
// Reads: strategy.business, strategy.platform, strategy.communication
// Protects brand, audience, platform compliance, and industry standards.

const NEVER_APPEAR_BY_INDUSTRY: Record<string, string> = {
  dental:           "Extreme fear-inducing dental imagery; before photos showing severe decay without clinical context; competitor brand mentions; unverified outcome claims; stock-photo smiles that look unnatural",
  dental_clinic:    "Extreme fear-inducing dental imagery; unverified outcome claims; stock-photo smiles that look unnatural",
  healthcare:       "Frightening medical imagery that causes anxiety; guaranteed outcome claims; competitor comparisons without current verified data; imagery that stigmatises illness",
  food_beverage:    "Low-quality food photography; artificial-looking food; unhygienic setting hints; competitor comparison without sourced data",
  real_estate:      "Misleading exterior/interior photography; pricing claims without full terms; renders presented as photography without disclosure",
  finance:          "Guaranteed return claims; historical returns implied as future results; unregistered investment advice; competitor fund comparisons without current SEBI data",
  mutual_fund:      "Guaranteed return claims; past-performance-as-future-guarantee; risk concealment",
  education:        "Misleading placement statistics; fabricated testimonials; exaggerated outcome claims; imagery that pressures rather than inspires",
  beauty_wellness:  "Extreme or digitally altered before/after results without disclosure; medical procedure claims for cosmetic treatments; unachievable results",
  jewellery_luxury: "Low-quality product photography; non-genuine material claims; celebrity likeness without permission",
  automotive:       "Unverified performance claims; safety feature claims without tested data; professional stunt driving without disclaimer",
  hospitality:      "Non-representative property imagery; amenity claims not currently available",
};

const PLATFORM_RESTRICTIONS_MAP: Record<string, string> = {
  instagram:  "No excessive text overlay (keep to <20% image area); no before/after imagery that promotes weight loss; no shocking or graphic medical imagery; no deceptive claims",
  facebook:   "No text-heavy images (penalised by algorithm); no misleading claims; no before/after weight loss imagery; no shocking imagery",
  linkedin:   "Professional context only; no inflammatory content; endorsement claims must be genuine and recent",
  google_display: "No malware or deceptive redirects; no misleading claims; healthcare/finance ads require pre-approval and certification",
  print:      "Local advertising standards apply; healthcare/finance require mandatory disclaimers in legible type",
  outdoor:    "Limited to 7 words for safety; no imagery that could distract drivers dangerously",
  general:    "Standard advertising standards: no misleading claims, no prohibited comparisons, no harmful stereotypes",
};

const BRAND_SAFETY_BY_INDUSTRY: Record<string, CreativeConstraints["brandSafety"]["value"]> = {
  dental:      "medical_grade",
  dental_clinic:"medical_grade",
  healthcare:  "medical_grade",
  finance:     "financial_compliant",
  mutual_fund: "financial_compliant",
  education:   "educational_appropriate",
  beauty_wellness: "elevated",
  automotive:  "elevated",
  general:     "standard",
};

export function buildCreativeConstraints(strategy: CreativeStrategy): CreativeConstraints {
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;
  const platform = strategy.platform.primaryPlatform.value;
  const { restrictions, musts } = getIndustryRestrictions(industryKey ?? "");

  const mustNeverAppear = (() => {
    const never = NEVER_APPEAR_BY_INDUSTRY[industryKey ?? ""];
    if (never) return cf(never, "high", `Industry-specific forbidden elements for "${industryKey}"`);
    return cf("Misleading visual claims; competitor brand names without permission; unverified performance data", "medium",
      `Default forbidden elements for all commercial advertising`);
  })();

  const mustAlwaysAppear = cf(musts, "high",
    `Mandatory elements for industry="${industryKey}" — legal and brand compliance`);

  const brandSafety = (() => {
    const safetyLevel = BRAND_SAFETY_BY_INDUSTRY[industryKey ?? ""] ?? "standard";
    return cf(safetyLevel, "high",
      `Brand safety level="${safetyLevel}" assigned for industry="${industryKey}"`);
  })();

  const platformRestrictions = (() => {
    const restrictions_val = PLATFORM_RESTRICTIONS_MAP[platform ?? ""] ?? PLATFORM_RESTRICTIONS_MAP.general;
    return cf(restrictions_val, platform !== "unknown" ? "high" : "medium",
      `Platform restrictions for "${platform}" — content policy compliance`);
  })();

  // Any restriction string that is NOT the generic fallback is industry-specific.
  const isGenericFallback = restrictions.startsWith("Standard advertising standards apply");
  const industryRestrictions = !isGenericFallback
    ? cf(restrictions, "high", `Industry-specific legal/ethical restrictions for "${industryKey}"`)
    : unknownCf("industryRestrictions");

  return { mustNeverAppear, mustAlwaysAppear, brandSafety, platformRestrictions, industryRestrictions };
}
