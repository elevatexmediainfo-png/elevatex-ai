import type { CreativeStrategy } from "../../creative-brain/types";
import type { MarketingStructure } from "../types";
import { cf, unknownCf } from "./shared";
import { TRUST_STRATEGIES, getConversionStrategy, EMOTIONAL_HOOKS } from "../knowledge";

// Builder 8 — Marketing Structure
// Sole responsibility: design the strategic messaging architecture.
// Reads: strategy.marketing, strategy.communication, strategy.audience, strategy.business
// Never generates headlines, CTA text, or body copy.

export function buildMarketingStructure(strategy: CreativeStrategy): MarketingStructure {
  const goal = strategy.marketing.campaignGoal.value;
  const trust = strategy.audience.trustRequirement.value;
  const urgency = strategy.communication.urgency.value;
  const objections = strategy.audience.objections.value;
  const desires = strategy.audience.desires.value;
  const painPoints = strategy.audience.painPoints.value;

  // Primary message: the ONE thing the audience must remember
  const primaryMessage = (() => {
    const usp = strategy.business.usp.value;
    const promise = strategy.marketing.marketingObjective.value;
    if (usp !== "unknown" && promise !== "unknown") {
      return cf(`${usp} — delivered through ${promise.toLowerCase()}`, "high",
        `Primary message = USP + marketing objective synthesis`);
    }
    if (usp !== "unknown") return cf(usp, "medium", `Primary message derived from industry USP`);
    if (desires !== "unknown") {
      return cf(`The audience's primary desire is: ${desires.split(",")[0].trim()} — our message must speak directly to this`,
        "medium", `Primary message anchored in the audience's core desire`);
    }
    return unknownCf("primaryMessage");
  })();

  // Supporting messages: 2-3 points that reinforce the primary
  const supportingMessages = (() => {
    const industryKey = strategy.business.subIndustry.value !== "unknown"
      ? strategy.business.subIndustry.value
      : strategy.business.industry.value;
    const msgMap: Record<string, Record<string, string>> = {
      dental:      { education: "How it works + Duration + Recovery, Why us + Patient results + Technology", lead_generation: "What to expect + Our team + Results guarantee" },
      healthcare:  { awareness: "How often + What's included + How easy it is", lead_generation: "Our credentials + Process + What patients say" },
      finance:     { education: "How much to start + How compounding works + Time vs. amount", lead_generation: "Returns comparison + Safety + Simplicity" },
      education:   { lead_generation: "Faculty credentials + Outcomes data + Facilities", awareness: "Success stories + Program highlights + Community" },
      real_estate: { awareness: "Location advantages + Lifestyle features + Investment value", lead_generation: "Limited availability + What's included + Next steps" },
      beauty_wellness: { awareness: "The transformation + The process + The team", lead_generation: "Before/after + Booking simplicity + Pricing transparency" },
    };
    const specific = msgMap[industryKey ?? ""]?.[goal ?? ""];
    if (specific) return cf(specific, "high", `Supporting messages designed for industry="${industryKey}" × goal="${goal}"`);
    if (painPoints !== "unknown") {
      return cf(
        `Address top concern: "${painPoints.split(",")[0].trim()}" + Reinforce key benefit + Simplify next step`,
        "medium", `Supporting messages structured to address primary pain point, benefit, and action`);
    }
    return unknownCf("supportingMessages");
  })();

  // Trust strategy
  const trustStrategy = (() => {
    const strategy_val = TRUST_STRATEGIES[trust ?? ""] ?? "results_first";
    return cf(strategy_val as MarketingStructure["trustStrategy"]["value"], trust !== "unknown" ? "high" : "medium",
      `Trust strategy="${strategy_val}" selected for trustRequirement="${trust}"`);
  })();

  // Objection handling
  const objectionHandling = (() => {
    if (objections !== "unknown") {
      const topObjection = objections.split(",")[0].trim();
      return cf(
        `Primary objection to address: "${topObjection}" — acknowledge it, then resolve it with proof, not dismissal`,
        "high", `Objection handling targets the primary barrier from audience intelligence`);
    }
    return unknownCf("objectionHandling");
  })();

  // Attention strategy — emotional hook derived directly from strategy signals
  const attentionStrategy = (() => {
    const hook = EMOTIONAL_HOOKS[goal ?? ""]
      ?? EMOTIONAL_HOOKS[strategy.campaign.campaignCategory.value ?? ""]
      ?? goal
      ?? "unknown";
    const attentionMap: Record<string, MarketingStructure["attentionStrategy"]["value"]> = {
      curiosity:     "curiosity_gap",
      aspiration:    "aspirational_image",
      fomo:          "visual_shock",
      empowerment:   "relatable_pain",
      reassurance:   "relatable_pain",
      hope:          "transformation_reveal",
      excitement:    "emotional_trigger",
      identity:      "aspirational_image",
      trust:         "strong_claim",
    };
    const val = attentionMap[hook ?? ""] ?? "emotional_trigger";
    return cf(val, hook !== "unknown" ? "high" : "medium",
      `Attention strategy="${val}" mapped from emotional hook="${hook}"`);
  })();

  // Retention strategy
  const retentionStrategy = (() => {
    const buyerStage = strategy.audience.buyerStage.value;
    if (buyerStage === "awareness") return cf("story_progression", "high",
      `Awareness stage → story progression keeps the viewer engaged through narrative`);
    if (buyerStage === "consideration") return cf("benefit_revelation", "high",
      `Consideration stage → progressive benefit revelation rewards deeper engagement`);
    if (buyerStage === "decision") return cf("social_proof_cascade", "high",
      `Decision stage → cascading social proof removes hesitation and keeps attention`);
    if (trust === "critical") return cf("data_credibility", "medium",
      `Critical trust context → data and credentials hold attention through credibility`);
    return cf("benefit_revelation", "low", `Default retention through progressive benefit revelation`);
  })();

  // Conversion strategy
  const conversionStrategy = (() => {
    const strategy_val = getConversionStrategy(urgency ?? "none", goal ?? "awareness");
    return cf(strategy_val as MarketingStructure["conversionStrategy"]["value"], "high",
      `Conversion strategy="${strategy_val}" for urgency="${urgency}" × goal="${goal}"`);
  })();

  return { primaryMessage, supportingMessages, trustStrategy, objectionHandling, attentionStrategy, retentionStrategy, conversionStrategy };
}
