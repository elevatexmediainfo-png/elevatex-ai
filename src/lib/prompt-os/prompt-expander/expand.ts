import type { UniversalPrompt } from "../schema";
import { matchIndustryProfile } from "./industry";
import { determineRichnessTier, buildQualityKeywords } from "./quality";
import { buildCompositionEnrichment } from "./composition";
import { buildLightingEnrichment } from "./lighting";
import { buildMarketingEnrichment } from "./marketing";
import { buildNegativeConstraints } from "./negative";

// The Prompt Expander Engine's single entry point. Pure function: takes the
// Universal JSON Prompt the existing pipeline already builds (Creative
// Brain + Creative Director + Reference Intelligence all already reasoned
// about the idea by this point) and returns a NEW Universal JSON Prompt of
// the IDENTICAL shape, with the string fields the Provider Adapters already
// read (style/layout/typography/lighting/camera/composition/colors/
// marketing/quality/negative_constraints) replaced by much richer,
// agency-quality phrasing. Every other field (objects, output, industry,
// platform, creativeBrief, referenceAnalysis, intent, creative_type) passes
// through unchanged.
//
// This is the ONLY mechanism by which "the output of Prompt Expander
// becomes the single input for Provider Adapters" — the existing adapters
// (lib/prompt-os/adapters/*.ts) are never modified; they just concatenate
// whatever is already in these fields, so richer fields mechanically
// produce a richer final prompt with zero adapter code changes.
export function expandUniversalPrompt(prompt: UniversalPrompt): UniversalPrompt {
  const profile = matchIndustryProfile(prompt);
  const tier = determineRichnessTier(prompt, profile);

  const composition = buildCompositionEnrichment(prompt, profile, tier);
  const lighting = buildLightingEnrichment(prompt, profile, tier);
  const marketing = buildMarketingEnrichment(prompt, profile, tier);
  const qualityKeywords = buildQualityKeywords(prompt, tier);
  const negativeConstraints = buildNegativeConstraints(prompt);

  return {
    ...prompt,
    style: { ...prompt.style, ...marketing.style },
    typography: { ...prompt.typography, ...marketing.typography },
    marketing: { ...prompt.marketing, ...marketing.marketing },
    composition: { ...prompt.composition, ...composition.composition },
    layout: { ...prompt.layout, ...composition.layout },
    camera: { ...prompt.camera, ...composition.camera },
    lighting: { ...prompt.lighting, ...lighting.lighting },
    colors: { ...prompt.colors, ...lighting.colors },
    quality: { ...prompt.quality, keywords: qualityKeywords },
    negative_constraints: negativeConstraints,
  };
}
