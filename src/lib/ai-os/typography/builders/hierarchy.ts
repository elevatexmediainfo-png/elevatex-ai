import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { VisualLayoutPlan } from "../../visual-layout/types";
import type { TypographyHierarchy } from "../types";
import { tf } from "./shared";

// Builder 1 — Typography Hierarchy
// Sole responsibility: decide the relative visual scale and presence of
// every text level in the advertisement.

export function buildTypographyHierarchy(
  strategy: CreativeStrategy,
  plan: CampaignPlan,
  layout: VisualLayoutPlan
): TypographyHierarchy {
  const adStruct = plan.advertisementStructure;
  const density = strategy.creative.informationDensity.value;
  const platform = strategy.platform.primaryPlatform.value;
  // heroSection from Phase 5 (format type) vs heroBlock from Phase 6 (position)
  const heroSectionFormat = plan.advertisementStructure.heroSection.value;

  // Hero headline — present for all formats, size varies by design
  const heroHeadline = (() => {
    if (platform === "outdoor") return tf("ultra_large_dominant", "high",
      `Outdoor: hero headline must be visible from 50m — ultra_large_dominant is mandatory`);
    if (density === "single_message") return tf("ultra_large_dominant", "high",
      `Single message density → hero headline carries the entire creative`);
    if (heroSectionFormat === "headline_dominant") return tf("ultra_large_dominant", "high",
      `Headline-dominant ad section format → headline IS the hero, must fill the canvas`);
    return tf("large_commanding", "high", `Standard commanding headline presence for advertising`);
  })();

  // Headline — distinct from hero headline when both exist
  const headline = (() => {
    if (density === "single_message") return tf("large_prominent", "high",
      `Single message: headline = hero headline, large_prominent`);
    return tf("large_prominent", "medium", `Primary headline at large_prominent — clearly readable, not ultra-dominant`);
  })();

  // Subheadline — check presence from Phase 6 layout blocks (where block decisions live)
  const subheadline = (() => {
    const val = layout.blocks.subheadlineBlock.value;
    if (val === "absent") return tf("absent", "high", `Subheadline absent per Visual Layout Plan`);
    return tf("medium_supporting", "medium", `Subheadline supports the headline at medium_supporting scale`);
  })();

  // Body copy — from Phase 6 layout blocks
  const body = (() => {
    const val = layout.blocks.bodyBlock.value;
    if (val === "absent") return tf("absent", "high", `Body copy absent per Visual Layout Plan`);
    if (platform === "outdoor") return tf("absent", "high", `Outdoor: no body copy — only headline and CTA`);
    return tf("standard_readable", "medium", `Body at standard_readable — clear without competing with headline`);
  })();

  // Feature text — from Phase 6 layout blocks
  const featureText = (() => {
    const val = layout.blocks.featureBlock.value;
    if (val === "absent") return tf("absent", "high", `Feature block absent per Visual Layout Plan`);
    return tf("medium_label", "medium", `Feature labels at medium_label — scannable at a glance`);
  })();

  // Benefits
  const benefits = (() => {
    const val = adStruct.benefitsSection.value;
    if (val === "absent") return tf("absent", "high", `Benefits section absent per Campaign Plan`);
    return tf("medium_benefit", "medium", `Benefits at medium_benefit — parallel list, readable quickly`);
  })();

  // Statistics
  const statistics = (() => {
    const val = adStruct.statisticsSection.value;
    if (val === "absent") return tf("absent", "high", `Statistics section absent`);
    return tf("large_numeral", "high",
      `Statistics use large_numeral — numbers must be immediately impactful at a glance`);
  })();

  // CTA — always present
  const cta = (() => {
    const val = adStruct.ctaSection.value;
    if (val === "single_button" || val === "directional_cta") {
      return tf("prominent_action", "high", `Single or directional CTA → prominent_action weight makes it unmissable`);
    }
    return tf("standard_action", "medium", `Standard CTA presence — clearly readable, action-oriented`);
  })();

  // Disclaimer
  const disclaimer = (() => {
    const val = adStruct.footerSection.value;
    if (val === "absent") return tf("absent", "medium", `Footer absent — no disclaimer space`);
    const industry = strategy.business.industry.value;
    if (["finance", "healthcare"].includes(industry ?? "")) {
      return tf("ultra_small_legal", "high", `Finance/healthcare must include legal disclaimer — ultra_small_legal but present`);
    }
    return tf("small_legal", "low", `Optional disclaimer at small_legal — below primary reading level`);
  })();

  // Footer
  const footer = (() => {
    const val = adStruct.footerSection.value;
    if (val === "absent") return tf("absent", "high", `Footer block absent per Campaign Plan`);
    return tf("small_footer", "medium", `Footer text at small_footer — brand name, contact, website`);
  })();

  // Labels
  const labels = (() => {
    if (layout.blocks.featureBlock.value !== "absent") {
      return tf("small_label", "medium", `Feature icons have small_label captions below them`);
    }
    return tf("absent", "low", `No icon/feature labels needed for this creative structure`);
  })();

  return { heroHeadline, headline, subheadline, body, featureText, benefits, statistics, cta, disclaimer, footer, labels };
}
