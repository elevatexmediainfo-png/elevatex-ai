import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { LayoutBlocks } from "../types";
import { lf } from "./shared";

// Builder 3 — Layout Blocks
// Sole responsibility: assign each content block to a spatial position
// in the layout. Positions are described in layout terms, not pixels.

export function buildLayoutBlocks(strategy: CreativeStrategy, plan: CampaignPlan): LayoutBlocks {
  const adStruct = plan.advertisementStructure;
  const platform = strategy.platform.primaryPlatform.value;
  const density = strategy.creative.informationDensity.value;
  const heroFormat = adStruct.heroSection.value;

  // Hero block — maps hero section format to spatial placement
  const heroBlock = (() => {
    const formatMap: Record<string, LayoutBlocks["heroBlock"]["value"]> = {
      full_bleed_visual:      "upper_half_full_bleed",
      transformation_split:   "upper_half_full_bleed",
      split_visual_text:      "left_half_split",
      product_hero:           "center_dominant",
      lifestyle_scene:        "upper_half_full_bleed",
      headline_dominant:      "top_third_full_width",
    };
    const val = formatMap[heroFormat ?? ""] ?? "upper_half_full_bleed";
    return lf(val, heroFormat !== "unknown" ? "high" : "medium",
      `Hero block placement "${val}" derived from hero section format "${heroFormat}"`);
  })();

  // Headline block — positioned relative to the hero
  const headlineBlock = (() => {
    if (heroFormat === "headline_dominant" || density === "single_message") {
      return lf("centered_standalone", "high", `Headline-dominant format → headline floats centred with full visual weight`);
    }
    if (heroFormat === "split_visual_text") {
      return lf("beside_hero_right", "high", `Split format → headline occupies the right half beside the visual`);
    }
    if (heroFormat === "full_bleed_visual" || heroFormat === "lifestyle_scene") {
      return lf("below_hero", "high", `Full-bleed hero → headline anchors below the visual`);
    }
    if (heroFormat === "transformation_split") {
      return lf("below_hero", "high", `Transformation split → headline delivers the proof statement below`);
    }
    return lf("below_hero", "medium", `Default headline placement — below the hero visual`);
  })();

  // Subheadline block
  const subheadlineBlock = (() => {
    if (density === "single_message" || platform === "outdoor") {
      return lf("absent", "high", `Single message / outdoor → no room or need for subheadline`);
    }
    return lf("below_headline", "medium", `Subheadline follows the headline in the natural reading sequence`);
  })();

  // Body block
  const bodyBlock = (() => {
    if (platform === "outdoor") return lf("absent", "high", `Outdoor format — no body copy; 7 words maximum rule`);
    if (density === "single_message") return lf("absent", "high", `Single message density — body copy absent`);
    if (density === "complex_infographic") return lf("right_column", "medium", `Complex content → body copy in right column alongside infographic`);
    return lf("below_subheadline", "medium", `Body copy below subheadline in the natural reading sequence`);
  })();

  // Feature block
  const featureBlock = (() => {
    const val = adStruct.featuresSection.value;
    if (val === "absent") return lf("absent", "high", `Features section absent per Campaign Plan`);
    return lf("three_columns_below_hero", "medium", `Feature icons in three-column row below the hero content area`);
  })();

  // Benefits block
  const benefitsBlock = (() => {
    const val = adStruct.benefitsSection.value;
    if (val === "absent") return lf("absent", "high", `Benefits section absent per Campaign Plan`);
    if (val === "three_column_icons") return lf("three_icon_row", "high", `Three-icon benefits row below the headline/subheadline`);
    if (val === "single_dominant_benefit") return lf("below_hero_strip", "high", `Single dominant benefit strip below hero`);
    return lf("below_hero_strip", "medium", `Benefits strip positioned below the hero section`);
  })();

  // Statistics block
  const statisticsBlock = (() => {
    const val = adStruct.statisticsSection.value;
    if (val === "absent") return lf("absent", "high", `Statistics section absent per Campaign Plan`);
    return lf("standalone_section", "medium", `Statistics section as a standalone module below benefits`);
  })();

  // Trust block
  const trustBlock = (() => {
    const val = adStruct.trustSection.value;
    if (val === "absent") return lf("absent", "high", `Trust section absent per Campaign Plan`);
    if (val === "certification_badges") return lf("top_corner_badge", "high", `Certification badge in top corner — establishes credibility before content is read`);
    if (val === "years_of_experience") return lf("below_headline", "medium", `Experience indicator below headline — reinforces the authority claim`);
    return lf("footer_row", "medium", `Trust elements in footer row — present but not competing with primary message`);
  })();

  // CTA block
  const ctaBlock = (() => {
    const val = adStruct.ctaSection.value;
    const ctaMap: Record<string, LayoutBlocks["ctaBlock"]["value"]> = {
      single_button:    "bottom_center_prominent",
      phone_plus_button:"lower_third_centered",
      directional_cta:  "bottom_right_accent",
      qr_code:          "bottom_right_accent",
      form_preview:     "bottom_center_prominent",
    };
    const pos = ctaMap[val ?? ""] ?? "bottom_center_prominent";
    return lf(pos, val !== "unknown" ? "high" : "medium",
      `CTA block at "${pos}" — maximum visibility, below the information hierarchy, always above the fold`);
  })();

  // Logo block — position follows platform convention
  const logoBlock = (() => {
    const conventionMap: Record<string, LayoutBlocks["logoBlock"]["value"]> = {
      instagram: "top_right",
      facebook:  "top_right",
      linkedin:  "top_left",
      print:     "bottom_right",
      poster:    "bottom_right",
      outdoor:   "bottom_right",
    };
    const val = conventionMap[platform ?? ""] ?? "top_left";
    return lf(val, platform !== "unknown" ? "high" : "medium",
      `Logo at "${val}" follows ${platform !== "unknown" ? platform : "default"} platform convention`);
  })();

  // Footer block
  const footerBlock = (() => {
    const val = adStruct.footerSection.value;
    if (val === "absent") return lf("absent", "high", `Footer section absent per Campaign Plan`);
    return lf("bottom_strip", "medium", `Footer strip at bottom — contact, logo, legal`);
  })();

  return { heroBlock, headlineBlock, subheadlineBlock, bodyBlock, featureBlock, benefitsBlock, statisticsBlock, trustBlock, ctaBlock, logoBlock, footerBlock };
}
