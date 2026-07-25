import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { MarketingContext } from "../types";
import { psf, unknownPsf } from "./shared";

// Builder 8 — Marketing Context
// Phase 10.4H: 11 previously-dead fields are now activated:
//   coreMessage, customerPromise, valueProposition → from campaign.concept
//   urgencySignal, visualTone → from strategy.communication
//   audiencePainPoints, audienceDesires → from strategy.audience
//   uniqueSellingPoint → from strategy.business.usp
//   attentionStrategy, supportingMessages → from campaign.marketingStructure
//   emotionalDriver → from strategy.creativeMatrix (plain string)

export function buildMarketingContext(bp: UniversalCampaignBlueprint, scene: VisualScenePlan): MarketingContext {
  const strategy = bp.strategy;
  const campaign = bp.campaign;

  const campaignGoal = (() => {
    const goal = strategy.marketing.campaignGoal.value;
    if (goal !== "unknown") return psf(goal.replace(/_/g, " "), strategy.marketing.campaignGoal.confidence,
      `[marketing] Campaign goal from Creative Strategy`);
    return unknownPsf("campaignGoal");
  })();

  const emotionalGoal = (() => {
    const raw = scene.sceneObjective.emotionalGoal.value;
    if (raw !== "unknown") return psf(raw.replace(/_and_/g, " & ").replace(/_/g, " "), scene.sceneObjective.emotionalGoal.confidence,
      `[marketing] Emotional goal from Visual Scene Plan`);
    return unknownPsf("emotionalGoal");
  })();

  const marketingGoal = (() => {
    const obj = strategy.marketing.marketingObjective.value;
    if (obj !== "unknown") return psf(obj.slice(0, 150), strategy.marketing.marketingObjective.confidence,
      `[marketing] Specific marketing objective from Creative Strategy`);
    return unknownPsf("marketingGoal");
  })();

  const targetAudience = (() => {
    const aud = strategy.audience.primaryAudience.value;
    if (aud !== "unknown") return psf(aud.slice(0, 100), strategy.audience.primaryAudience.confidence,
      `[marketing] Primary target audience from Creative Strategy`);
    return unknownPsf("targetAudience");
  })();

  const trustStrategy = (() => {
    const ts = campaign.marketingStructure.trustStrategy.value;
    const trust = strategy.audience.trustRequirement.value;
    if (ts !== "unknown") return psf(`${ts.replace(/_/g, " ")} (trust requirement: ${trust})`, "high",
      `[marketing] Trust strategy from Campaign Plan + trust requirement level`);
    return unknownPsf("trustStrategy");
  })();

  const conversionIntent = (() => {
    const action = scene.sceneObjective.primaryUserAction.value;
    const cs = campaign.marketingStructure.conversionStrategy.value;
    if (action !== "unknown") return psf(action.slice(0, 150), "high",
      `[marketing] Conversion intent from Visual Scene Plan user action`);
    if (cs !== "unknown") return psf(cs.replace(/_/g, " "), "medium",
      `[marketing] Conversion strategy from Campaign Plan`);
    return unknownPsf("conversionIntent");
  })();

  const ep = strategy.experienceProfile;
  const experienceEmotionalCore = ep?.emotionalCore
    ? psf(ep.emotionalCore, ep.confidence, "[marketing] Experience Engine emotional core — first-class directive, preserve verbatim")
    : undefined;
  const experienceVisualImplication = ep?.visualImplication
    ? psf(ep.visualImplication, ep.confidence, "[marketing] Experience Engine visual implication — first-class directive, preserve verbatim")
    : undefined;
  const experienceType = ep?.primary
    ? psf(ep.primary, ep.confidence, "[marketing] Experience Engine primary experience type")
    : undefined;

  // Phase 10.4H — previously-dead campaign.concept fields
  const coreMessage = (() => {
    const msg = campaign.concept.coreMessage.value;
    if (msg !== "unknown") return psf(msg.slice(0, 200), campaign.concept.coreMessage.confidence,
      `[marketing] Core campaign message from Creative Director concept`);
    return undefined;
  })();

  const customerPromise = (() => {
    const promise = campaign.concept.customerPromise.value;
    if (promise !== "unknown") return psf(promise.slice(0, 200), campaign.concept.customerPromise.confidence,
      `[marketing] Brand promise to customer from Creative Director concept`);
    return undefined;
  })();

  const valueProposition = (() => {
    const vp = campaign.concept.valueProposition.value;
    if (vp !== "unknown") return psf(vp.slice(0, 200), campaign.concept.valueProposition.confidence,
      `[marketing] Value proposition from Creative Director concept`);
    return undefined;
  })();

  // Phase 10.4H — previously-dead strategy.communication fields
  const urgencySignal = (() => {
    const urgency = strategy.communication.urgency.value;
    if (urgency !== "none" && urgency !== "unknown") {
      const label = urgency === "immediate" ? "Extreme urgency — act now, time is running out"
        : urgency === "high" ? "High urgency — limited time or limited availability"
        : urgency === "medium" ? "Moderate urgency — time-sensitive offer"
        : "Low urgency — gentle time pressure";
      return psf(label, strategy.communication.urgency.confidence,
        `[marketing] Urgency level "${urgency}" from Creative Strategy communication`);
    }
    return undefined;
  })();

  const visualTone = (() => {
    const tone = strategy.communication.tone.value;
    if (tone !== "unknown") {
      return psf(tone.replace(/_/g, " "), strategy.communication.tone.confidence,
        `[marketing] Visual communication tone from Creative Strategy`);
    }
    return undefined;
  })();

  // Phase 10.4H — previously-dead strategy.audience fields
  const audiencePainPoints = (() => {
    const pp = strategy.audience.painPoints.value;
    if (pp !== "unknown") return psf(pp.slice(0, 200), strategy.audience.painPoints.confidence,
      `[marketing] Core audience pain points from Creative Strategy audience analysis`);
    return undefined;
  })();

  const audienceDesires = (() => {
    const d = strategy.audience.desires.value;
    if (d !== "unknown") return psf(d.slice(0, 200), strategy.audience.desires.confidence,
      `[marketing] Audience aspirations and desires from Creative Strategy audience analysis`);
    return undefined;
  })();

  // Phase 10.4H — previously-dead strategy.business.usp
  const uniqueSellingPoint = (() => {
    const usp = strategy.business.usp.value;
    if (usp !== "unknown") return psf(usp.slice(0, 200), strategy.business.usp.confidence,
      `[marketing] Unique selling proposition from Creative Strategy business intelligence`);
    return undefined;
  })();

  // Phase 10.4H — previously-dead campaign.marketingStructure fields
  const attentionStrategy = (() => {
    const att = campaign.marketingStructure.attentionStrategy.value;
    if (att !== "unknown") {
      const label = att === "visual_shock"            ? "Visual shock — an unexpected, striking image that stops the scroll"
        : att === "emotional_trigger"                 ? "Emotional trigger — an image that immediately activates an emotional response"
        : att === "curiosity_gap"                     ? "Curiosity gap — the image creates intrigue that makes the viewer want to know more"
        : att === "transformation_reveal"             ? "Transformation reveal — before/after or result-first presentation"
        : att === "strong_claim"                      ? "Strong claim — a bold visual statement that asserts a clear benefit"
        : att === "relatable_pain"                    ? "Relatable pain — the image shows the problem the audience recognises"
        : "Aspirational image — shows the desired outcome or lifestyle";
      return psf(label, campaign.marketingStructure.attentionStrategy.confidence,
        `[marketing] Attention capture strategy "${att}" from Creative Director marketing structure`);
    }
    return undefined;
  })();

  const supportingMessages = (() => {
    const sm = campaign.marketingStructure.supportingMessages.value;
    if (sm !== "unknown") return psf(sm.slice(0, 200), campaign.marketingStructure.supportingMessages.confidence,
      `[marketing] Supporting messages from Creative Director marketing structure`);
    return undefined;
  })();

  // Phase 10.4H — emotionalDriver from creativeMatrix (plain string, not StrategyField)
  const emotionalDriver = (() => {
    const ed = strategy.creativeMatrix.emotionalDriver;
    if (ed && ed !== "") return psf(ed, "high",
      `[marketing] Core psychological emotional driver from Creative Matrix`);
    return undefined;
  })();

  return {
    campaignGoal, emotionalGoal, marketingGoal, targetAudience, trustStrategy, conversionIntent,
    ...(experienceEmotionalCore     ? { experienceEmotionalCore }     : {}),
    ...(experienceVisualImplication ? { experienceVisualImplication } : {}),
    ...(experienceType              ? { experienceType }              : {}),
    ...(coreMessage                 ? { coreMessage }                 : {}),
    ...(customerPromise             ? { customerPromise }             : {}),
    ...(valueProposition            ? { valueProposition }            : {}),
    ...(urgencySignal               ? { urgencySignal }               : {}),
    ...(visualTone                  ? { visualTone }                  : {}),
    ...(audiencePainPoints          ? { audiencePainPoints }          : {}),
    ...(audienceDesires             ? { audienceDesires }             : {}),
    ...(uniqueSellingPoint          ? { uniqueSellingPoint }          : {}),
    ...(attentionStrategy           ? { attentionStrategy }           : {}),
    ...(supportingMessages          ? { supportingMessages }          : {}),
    ...(emotionalDriver             ? { emotionalDriver }             : {}),
  };
}
