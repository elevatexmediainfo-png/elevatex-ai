import type { IndustryKey } from "../types";
import type { IndustryEntry } from "../types";
import { UNIVERSAL_CONCEPTS, CONCEPT_ALIASES } from "./concepts";
import { restaurantIndustry } from "./industries/restaurant";
import { dentalIndustry } from "./industries/dental";
import { salonIndustry } from "./industries/salon";
import { realEstateIndustry } from "./industries/real-estate";
import { healthcareIndustry } from "./industries/healthcare";
import { jewelleryIndustry } from "./industries/jewellery";
import { fashionIndustry } from "./industries/fashion";
import { fitnessIndustry } from "./industries/fitness";
import { educationIndustry } from "./industries/education";
import { automobileIndustry } from "./industries/automobile";
import { technologyIndustry } from "./industries/technology";
import { genericIndustry } from "./industries/generic";

export { UNIVERSAL_CONCEPTS, CONCEPT_ALIASES };

export const ALL_INDUSTRIES: readonly IndustryEntry[] = [
  restaurantIndustry,
  dentalIndustry,
  salonIndustry,
  realEstateIndustry,
  healthcareIndustry,
  jewelleryIndustry,
  fashionIndustry,
  fitnessIndustry,
  educationIndustry,
  automobileIndustry,
  technologyIndustry,
  genericIndustry,
];

export const INDUSTRY_REGISTRY: Record<IndustryKey, IndustryEntry> = {
  restaurant: restaurantIndustry,
  dental: dentalIndustry,
  salon: salonIndustry,
  real_estate: realEstateIndustry,
  healthcare: healthcareIndustry,
  jewellery: jewelleryIndustry,
  fashion: fashionIndustry,
  fitness: fitnessIndustry,
  education: educationIndustry,
  automobile: automobileIndustry,
  technology: technologyIndustry,
  generic: genericIndustry,
};

/** Flat alias → industry key lookup built from every industry's aliases array. */
export const INDUSTRY_ALIASES: Record<string, IndustryKey> = (() => {
  const map: Record<string, IndustryKey> = {};
  for (const industry of ALL_INDUSTRIES) {
    for (const alias of industry.aliases) {
      const key = alias.toLowerCase();
      // First-match wins — more specific industries are listed before generic
      if (!(key in map)) {
        map[key] = industry.key;
      }
    }
  }
  return map;
})();
