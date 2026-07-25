import type { CreativeStrategy } from "../../creative-brain/types";
import type { AdvertisementStructure, CampaignConcept } from "../types";
import { cf } from "./shared";

// Builder 4 — Advertisement Structure
// Sole responsibility: decide which sections appear and what role each plays.
// Reads: strategy.marketing, strategy.audience, strategy.campaign, strategy.business, concept
// Never generates copy — only structural decisions.

export function buildAdvertisementStructure(strategy: CreativeStrategy, concept?: CampaignConcept): AdvertisementStructure {
  const campaignGoal = strategy.marketing.campaignGoal.value;
  const trust = strategy.audience.trustRequirement.value;
  const offerType = strategy.business.offerType.value;
  const density = strategy.creative.informationDensity.value;
  const focus = strategy.creative.focusPriority.value;
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;

  // Hero section — always present, format depends on focus AND industry
  const heroSection = (() => {
    const archetype = concept?.campaignArchetype?.value ?? "unknown";
    // Archetype-first routing — most precise
    if (archetype === "educational_explainer") return cf("lifestyle_scene", "high", `Educational explainer archetype → lifestyle scene: human interaction educates`);
    if (archetype === "transformation_story")  return cf("transformation_split", "high", `Transformation story archetype → split before/after format`);
    if (archetype === "product_hero")          return cf("product_hero", "high", `Product hero archetype → hero product shot`);
    if (archetype === "premium_brand")         return cf("full_bleed_visual", "high", `Premium brand archetype → full-bleed aspirational visual`);
    if (archetype === "offer_promotional")     return cf("headline_dominant", "high", `Promotional archetype → headline dominant with offer featured`);
    if (archetype === "trust_authority")       return cf("lifestyle_scene", "high", `Trust authority archetype → lifestyle scene with professional credibility`);
    if (archetype === "expert_consultation")   return cf("lifestyle_scene", "high", `Expert consultation archetype → lifestyle scene: professional in context`);
    if (archetype === "social_proof_testimonial") return cf("lifestyle_scene", "high", `Social proof archetype → lifestyle scene: real person, real result`);

    // Fallback to focus map (never use "headline_dominant" for person/emotion focus)
    const focusMap: Record<string, AdvertisementStructure["heroSection"]["value"]> = {
      transformation:   "transformation_split",
      product:          "product_hero",
      emotion:          "lifestyle_scene",
      person:           "lifestyle_scene",
      information:      "lifestyle_scene",  // informative = show, not tell
      brand:            "full_bleed_visual",
    };
    const format = focusMap[focus ?? ""] ?? "full_bleed_visual";
    return cf(format, "medium", `Hero section format="${format}" from focusPriority="${focus}"`);
  })();

  // Benefits section
  const benefitsSection = (() => {
    const showBenefits = ["lead_generation", "sales", "trust", "education"].includes(campaignGoal ?? "");
    if (!showBenefits) return cf("absent", "medium", `Campaign goal="${campaignGoal}" does not require a benefits section`);
    const format = density === "single_message" ? "single_dominant_benefit"
      : density === "two_elements" ? "single_dominant_benefit"
      : ["dental", "healthcare", "finance", "education"].includes(industryKey ?? "") ? "three_column_icons"
      : "horizontal_strip";
    return cf(format as AdvertisementStructure["benefitsSection"]["value"], "high",
      `Benefits section format="${format}" for industry="${industryKey}" and density="${density}"`);
  })();

  // Features section — only for detail-oriented categories
  const featuresSection = (() => {
    const needsFeatures = density === "complex_infographic" || density === "multi_element"
      || ["education", "automotive", "finance"].includes(industryKey ?? "");
    if (!needsFeatures) return cf("absent", "medium", `Features section absent — campaign favours benefits over features`);
    return cf("icon_label_pairs", "medium", `Feature grid for information-dense industry "${industryKey}"`);
  })();

  // Trust section — critical or high trust industries
  const trustSection = (() => {
    if (trust === "critical") {
      const industryTrust: Record<string, AdvertisementStructure["trustSection"]["value"]> = {
        dental:    "certification_badges",
        healthcare:"certification_badges",
        finance:   "certification_badges",
        education: "awards",
      };
      const format = industryTrust[industryKey ?? ""] ?? "certification_badges";
      return cf(format, "high", `CRITICAL trust requirement for "${industryKey}" → trust section mandatory with "${format}"`);
    }
    if (trust === "high") return cf("years_of_experience", "high", `High trust requirement → experience-based trust section`);
    return cf("absent", "medium", `Trust requirement="${trust}" — standalone trust section not required`);
  })();

  // Social proof section
  const socialProofSection = (() => {
    const needsProof = trust === "critical" || trust === "high"
      || focus === "transformation"
      || ["lead_generation", "sales"].includes(campaignGoal ?? "");
    if (!needsProof) return cf("absent", "medium", `Social proof not required for this campaign structure`);
    const proofFormat = focus === "transformation" ? "before_after_pair"
      : industryKey === "finance" ? "outcome_statistic"
      : "quote_with_photo";
    return cf(proofFormat as AdvertisementStructure["socialProofSection"]["value"], "high",
      `Social proof format="${proofFormat}" selected for focus="${focus}" and industry="${industryKey}"`);
  })();

  // Comparison section — only for challenger positioning or comparison campaigns
  const comparisonSection = (() => {
    const position = strategy.business.competitivePosition.value;
    // "comparison" is signalled by challenger positioning; no creativeCategory=="comparison" in Brain enums
    const needsComparison = position === "challenger";
    if (needsComparison) return cf("side_by_side", "high", `Challenger positioning warrants a comparison — side-by-side format`);
    return cf("absent", "medium", `Comparison section absent — not a challenger campaign`);
  })();

  // Statistics section — data-driven industries, educational campaigns
  const statisticsSection = (() => {
    const needsStats = ["finance", "mutual_fund", "healthcare", "education"].includes(industryKey ?? "")
      && ["education", "awareness", "trust"].includes(campaignGoal ?? "");
    if (needsStats) {
      const statFormat = industryKey === "finance" || industryKey === "mutual_fund"
        ? "growth_chart" : "percentage_highlight";
      return cf(statFormat as AdvertisementStructure["statisticsSection"]["value"], "high",
        `Statistics section required for trust+data-driven "${industryKey}" campaign`);
    }
    return cf("absent", "medium", `Statistics section absent — not a data-driven campaign context`);
  })();

  // Timeline section — process campaigns
  const timelineSection = (() => {
    const needsTimeline = campaignGoal === "education" && ["dental", "healthcare"].includes(industryKey ?? "");
    if (needsTimeline) return cf("numbered_steps", "high", `Process education campaign for "${industryKey}" → numbered steps timeline`);
    return cf("absent", "medium", `Timeline section not needed for this campaign structure`);
  })();

  // Offer section — promotional campaigns only
  const offerSection = (() => {
    if (offerType === "none" || offerType === "unknown") return cf("absent", "high", `No offer detected — offer section absent`);
    if (offerType === "discount") return cf("limited_time_banner", "high", `Discount offer → limited time banner creates urgency`);
    if (offerType === "event") return cf("event_details", "high", `Event offer → event details section with date/time/place`);
    if (offerType === "free_consultation") return cf("package_card", "medium", `Free consultation → service package card`);
    if (offerType === "product_launch") return cf("limited_time_banner", "medium", `Product launch → introductory offer banner`);
    return cf("package_card", "low", `Offer section present for offerType="${offerType}"`);
  })();

  // CTA section — always present
  const ctaSection = (() => {
    const urgency = strategy.communication.urgency.value;
    const platform = strategy.platform.primaryPlatform.value;
    if (platform === "print" || platform === "outdoor") return cf("phone_plus_button", "high", `Print/outdoor format → phone number + visual CTA button for immediate response`);
    if (urgency === "immediate" || urgency === "high") return cf("single_button", "high", `High urgency → single dominant CTA button maximises conversion focus`);
    if (industryKey === "healthcare" || industryKey === "dental") return cf("phone_plus_button", "high", `Healthcare → phone number alongside button for caller preference`);
    return cf("single_button", "medium", `Standard single CTA button for "${campaignGoal}" campaign`);
  })();

  // Footer section
  const footerSection = (() => {
    const platform = strategy.platform.primaryPlatform.value;
    if (platform === "outdoor") return cf("absent", "high", `Outdoor format → footer absent, message must be in main body`);
    if (platform === "instagram" || platform === "facebook") return cf("logo_only", "medium", `Social media → minimal footer, brand logo only`);
    return cf("logo_contact_tagline", "medium", `Standard footer with logo, contact, and tagline for print/general`);
  })();

  return {
    heroSection, benefitsSection, featuresSection, trustSection, socialProofSection,
    comparisonSection, statisticsSection, timelineSection, offerSection, ctaSection, footerSection,
  };
}
