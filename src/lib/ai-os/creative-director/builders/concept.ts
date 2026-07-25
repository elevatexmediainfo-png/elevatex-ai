import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignConcept } from "../types";
import { cf, unknownCf } from "./shared";
import { getCampaignTheme, getMarketingAngle, EMOTIONAL_HOOKS } from "../knowledge";

// Builder 1 — Campaign Concept
// Sole responsibility: determine the unifying creative idea for this campaign.
// Reads: strategy.marketing, strategy.business, strategy.audience, strategy.communication
// Never generates headlines, copy, or typography.

export function buildCampaignConcept(strategy: CreativeStrategy): CampaignConcept {
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value !== "unknown"
    ? strategy.business.industry.value
    : undefined;
  const campaignGoal = strategy.marketing.campaignGoal.value;

  // Campaign theme
  const themeValue = getCampaignTheme(industryKey ?? "", campaignGoal ?? "");
  const campaignTheme = cf(themeValue, campaignGoal !== "unknown" ? "high" : "medium",
    `Derived from industry="${industryKey}" × campaignGoal="${campaignGoal}" combination`);

  // Core message: the single most important thing to communicate
  const coreMessage = (() => {
    const usp = strategy.business.usp.value;
    const goal = strategy.marketing.campaignGoal.value;
    if (usp !== "unknown" && goal !== "unknown") {
      return cf(`Communicate the ${goal} through: ${usp}`, "high",
        `Core message synthesized from campaign goal="${goal}" and USP signals`);
    }
    if (usp !== "unknown") return cf(usp, "medium", `USP-driven core message`);
    return unknownCf("coreMessage");
  })();

  // Big idea: the creative territory that makes this campaign distinctive
  const bigIdea = (() => {
    const theme = campaignTheme.value;
    const emotion = strategy.campaign.campaignCategory.value;
    const industry = industryKey ?? "general";
    if (theme !== "unknown") {
      return cf(
        `${theme} — expressed through ${strategy.visual.photographyStyle.value !== "unknown" ? strategy.visual.photographyStyle.value.replace(/_/g, " ") : "authentic visual storytelling"}`,
        "medium",
        `Big idea: the campaign theme executed through the specific visual language of "${industry}"`
      );
    }
    if (emotion !== "unknown") {
      return cf(`A ${emotion} campaign that puts the audience's ${strategy.audience.desires.value !== "unknown" ? "desires first" : "outcome first"}`,
        "medium", `Big idea inferred from campaign category "${emotion}" and audience desires`);
    }
    return unknownCf("bigIdea");
  })();

  // Emotional hook
  const hookValue = EMOTIONAL_HOOKS[campaignGoal ?? ""]
    ?? EMOTIONAL_HOOKS[strategy.campaign.campaignCategory.value ?? ""]
    ?? "unknown";
  const emotionalHook = hookValue !== "unknown"
    ? cf(hookValue as CampaignConcept["emotionalHook"]["value"], "high",
        `Emotional hook mapped from campaignGoal="${campaignGoal}" and campaignCategory="${strategy.campaign.campaignCategory.value}"`)
    : unknownCf("emotionalHook") as CampaignConcept["emotionalHook"];

  // Marketing angle
  const angleValue = getMarketingAngle(industryKey ?? "", campaignGoal ?? "unknown");
  const marketingAngle = cf(angleValue as CampaignConcept["marketingAngle"]["value"], "medium",
    `Marketing angle: "${angleValue}" selected for industry="${industryKey}" × goal="${campaignGoal}"`);

  // Customer promise: what the brand commits to the audience
  const customerPromise = (() => {
    const desires = strategy.audience.desires.value;
    const trust = strategy.audience.trustRequirement.value;
    if (desires !== "unknown") {
      return cf(
        `We deliver on: ${desires} — without the doubts: ${strategy.audience.objections.value !== "unknown" ? strategy.audience.objections.value.split(",")[0].trim() : "common hesitations"}`,
        "medium",
        `Customer promise built from audience desires and primary objection override`
      );
    }
    if (trust === "critical") {
      return cf("Trust-first commitment: proven outcomes, transparent process, expert hands", "low",
        `Critical trust requirement demands a trust-first customer promise`);
    }
    return unknownCf("customerPromise");
  })();

  // Value proposition: why this over any alternative
  const valueProposition = strategy.business.usp.value !== "unknown"
    ? cf(strategy.business.usp.value, strategy.business.usp.confidence,
        `Value proposition = USP from Creative Brain industry knowledge`)
    : unknownCf("valueProposition");

  // Campaign archetype — the fundamental creative format this advertisement uses
  const campaignArchetype = (() => {
    const goal = campaignGoal;
    const intent = strategy.campaign.campaignCategory.value;
    const industry = industryKey ?? "";
    const trust = strategy.audience.trustRequirement.value;
    const focus = strategy.creative.focusPriority.value;

    // Before/after always produces a transformation story regardless of industry
    if (focus === "transformation" || strategy.visual.photographyStyle.value === "before_after") {
      return cf("transformation_story", "high", `Before/after focus → transformation story archetype`);
    }

    // Promotional/offer campaigns
    if (goal === "sales" || intent === "promotion" || strategy.business.offerType.value === "discount") {
      return cf("offer_promotional", "high", `Promotional/sales goal → offer archetype with urgency and CTA focus`);
    }

    // Luxury and premium brand
    if (["jewellery_luxury", "fine_jewellery", "luxury_property"].includes(industry)) {
      return cf("premium_brand", "high", `Luxury industry → premium brand archetype: minimal, aspirational, hero-product focus`);
    }

    // Product showcase
    if (focus === "product" || strategy.creative.creativeCategory.value === "advertisement" && strategy.visual.productPriority.value === "hero") {
      return cf("product_hero", "high", `Product-hero focus → product hero archetype: product celebrated as the entire message`);
    }

    // Educational explainer — dental, healthcare, finance explaining a service or procedure
    const eduIndustries = ["dental", "dental_clinic", "healthcare", "finance", "mutual_fund", "education"];
    if ((goal === "education" || intent === "educational") && eduIndustries.includes(industry)) {
      return cf("educational_explainer", "high", `${industry} educational campaign → explainer archetype: expert demonstrating, multi-layer information`);
    }

    // Trust/authority campaigns for regulated or high-stakes industries
    if (trust === "critical" && ["dental", "healthcare", "finance", "legal"].includes(industry)) {
      return cf("trust_authority", "high", `Critical trust requirement in ${industry} → authority archetype: credentials, expertise, evidence`);
    }

    // Expert consultation — professional services
    if (["finance", "legal", "real_estate", "education"].includes(industry) && goal === "lead_generation") {
      return cf("expert_consultation", "high", `${industry} lead generation → expert consultation archetype: professional + outcome + CTA`);
    }

    // Social proof / testimonial
    if (focus === "emotion" && (trust === "high" || trust === "critical")) {
      return cf("social_proof_testimonial", "medium", `Emotion-focused high-trust campaign → social proof archetype: real people, real results`);
    }

    // Local lead generation
    if (goal === "lead_generation" && strategy.business.businessType.value === "local_service") {
      return cf("lead_generation_local", "high", `Local service lead generation → local lead gen archetype: trust + results + call to action`);
    }

    // Default to awareness lifestyle
    return cf("awareness_lifestyle", "medium", `Campaign goal "${goal}" → awareness lifestyle archetype: aspirational moment in context`);
  })();

  return { campaignTheme, coreMessage, bigIdea, emotionalHook, marketingAngle, customerPromise, valueProposition, campaignArchetype };
}
