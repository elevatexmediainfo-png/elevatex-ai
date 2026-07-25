export { generateCommercialCopy, buildCopyFromBlueprintInputs, strategyToCopyInput } from "./copy-engine";
export { generateHeadline, extractKeywords }  from "./headline-engine";
export { generateCTA }                        from "./cta-engine";
export { generateBenefits }                   from "./benefits-engine";
export { generateSocialProof }                from "./social-proof-engine";
export { generateOfferCopy, generateBadge }   from "./offer-engine";
export { getDisclaimer, requiresDisclaimer }  from "./disclaimer-engine";
export { deriveTone, TONE_ADJECTIVES }        from "./tone-engine";
export type {
  ToneType,
  FormLevel,
  EnergyLevel,
  ToneProfile,
  HeadlineCandidate,
  HeadlineResult,
  CommercialCopy,
  CopyMetadata,
  CopyInput,
  HeadlineTemplate,
} from "./types";
