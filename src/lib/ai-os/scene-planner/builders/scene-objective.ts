import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { SceneObjective } from "../types";
import { sp, unknownSp } from "./shared";

// Builder 1 — Scene Objective
// Why does this scene exist? What must it accomplish before any text is read?

export function buildSceneObjective(bp: UniversalCampaignBlueprint): SceneObjective {
  const strategy = bp.strategy;
  const campaign = bp.campaign;
  const goal = strategy.marketing.campaignGoal.value;

  const scenePurpose = (() => {
    const marketingObj = campaign.marketingStructure.primaryMessage.value;
    if (marketingObj !== "unknown") {
      return sp(`This scene must visually communicate: ${marketingObj.slice(0, 100)} — before any text is read, the image alone must carry this message`, "high",
        `Scene purpose derived from Campaign Plan primary marketing message`);
    }
    if (goal !== "unknown") {
      return sp(`This scene must convert ${goal === "lead_generation" ? "viewers into qualified enquiries" : goal === "awareness" ? "unknown audiences into brand-aware prospects" : "viewers into customers"} through visual storytelling alone`, "medium",
        `Scene purpose inferred from campaign goal "${goal}"`);
    }
    return unknownSp("scenePurpose");
  })();

  const emotionalGoal = (() => {
    const hook = campaign.concept.emotionalHook.value as string;
    const goalMap: Record<string, SceneObjective["emotionalGoal"]["value"]> = {
      reassurance:  "trust_and_reassurance",
      trust:        "trust_and_reassurance",
      aspiration:   "aspiration_and_desire",
      fomo:         "excitement_and_urgency",
      excitement:   "excitement_and_urgency",
      hope:         "transformation_and_hope",
      transformation:"transformation_and_hope",
      empowerment:  "authority_and_expertise",
      curiosity:    "curiosity_and_intrigue",
      identity:     "aspiration_and_desire",
      joy:          "joy_and_delight",
    };
    const val = goalMap[hook ?? ""] ?? "trust_and_reassurance";
    return sp(val, hook !== "unknown" ? "high" : "medium",
      `Emotional goal "${val}" mapped from campaign emotional hook "${hook}"`);
  })();

  const marketingGoal = strategy.marketing.marketingObjective.value !== "unknown"
    ? sp(strategy.marketing.marketingObjective.value.slice(0, 150), strategy.marketing.marketingObjective.confidence,
        `Marketing goal from Creative Strategy marketing objective`)
    : unknownSp("marketingGoal");

  const primaryUserAction = (() => {
    const cta = campaign.concept.customerPromise.value;
    const ctaAction = strategy.marketing.campaignGoal.value;
    const actionMap: Record<string, string> = {
      lead_generation: "Book a consultation or make an enquiry — the scene must make this feel the obvious next step",
      sales:           "Purchase or visit — the scene must make the product irresistible and the decision easy",
      awareness:       "Remember this brand — the scene must be memorable enough to recall when the need arises",
      education:       "Understand a concept — the scene must make the information feel accessible and trustworthy",
      trust:           "Believe in this brand — the scene must communicate credibility without a single claim",
      engagement:      "Share or save — the scene must be emotionally resonant enough that viewers want to spread it",
    };
    const val = actionMap[ctaAction ?? ""] ?? "Feel compelled to act — the scene must remove hesitation and create positive urgency";
    return sp(val, ctaAction !== "unknown" ? "high" : "medium",
      `Primary user action derived from campaign goal "${ctaAction}" and customer promise`);
    void cta;
  })();

  const ep = strategy.experienceProfile;
  const experienceEmotionalCore = ep?.emotionalCore
    ? sp(ep.emotionalCore, ep.confidence, "Experience Engine emotional core — first-class directive, preserve verbatim")
    : undefined;
  const experienceVisualImplication = ep?.visualImplication
    ? sp(ep.visualImplication, ep.confidence, "Experience Engine visual implication — first-class directive, preserve verbatim")
    : undefined;
  const experienceType = ep?.primary
    ? sp(ep.primary, ep.confidence, "Experience Engine primary experience type")
    : undefined;

  return {
    scenePurpose, emotionalGoal, marketingGoal, primaryUserAction,
    ...(experienceEmotionalCore     ? { experienceEmotionalCore }     : {}),
    ...(experienceVisualImplication ? { experienceVisualImplication } : {}),
    ...(experienceType              ? { experienceType }              : {}),
  };
}
