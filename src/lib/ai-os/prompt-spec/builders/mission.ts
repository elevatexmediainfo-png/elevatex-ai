import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { GenerationMission } from "../types";
import { psf, unknownPsf } from "./shared";

// Builder 1 — Generation Mission
// The executive brief: what, why, success criteria, and now also the single-frame
// narrative and campaign theme that tie together every visual decision.

export function buildGenerationMission(bp: UniversalCampaignBlueprint, scene: VisualScenePlan): GenerationMission {
  const whatToGenerate = (() => {
    const heroSubject = scene.heroSubject.exactHeroSubject.value;
    const envType = scene.environment.environmentType.value;
    const industry = bp.strategy.business.industry.value;
    const archetype = bp.campaign.concept.campaignArchetype.value;
    const campaignGoal = bp.strategy.marketing.campaignGoal.value;
    const adStructure = bp.campaign.advertisementStructure;

    // Determine what advertisement sections are active
    const hasbenefits = adStructure.benefitsSection.value !== "absent" && adStructure.benefitsSection.value !== "unknown";
    const hasTrust = adStructure.trustSection.value !== "absent" && adStructure.trustSection.value !== "unknown";
    const hasTimeline = adStructure.timelineSection.value !== "absent" && adStructure.timelineSection.value !== "unknown";
    const hasProof = adStructure.socialProofSection.value !== "absent" && adStructure.socialProofSection.value !== "unknown";
    const hasCta = (adStructure.ctaSection.value as string) !== "absent" && adStructure.ctaSection.value !== "unknown";

    const activeSections: string[] = [];
    if (hasbenefits) activeSections.push("benefits strip");
    if (hasTrust) activeSections.push("trust credentials");
    if (hasTimeline) activeSections.push("numbered process steps");
    if (hasProof) activeSections.push("social proof element");
    if (hasCta) activeSections.push("CTA zone");

    // Build an advertisement-intent-first mission statement
    const archetypeName = archetype !== "unknown"
      ? archetype.replace(/_/g, " ")
      : `${campaignGoal !== "unknown" ? campaignGoal.replace(/_/g, " ") : ""} campaign`;

    const sectionList = activeSections.length > 0
      ? ` The complete advertisement must include: ${activeSections.join(", ")}.`
      : "";

    if (heroSubject !== "unknown" && envType !== "unknown") {
      return psf(
        `Generate a complete, premium ${industry !== "unknown" ? industry : ""} ${archetypeName} advertisement. ` +
        `The primary visual scene: ${heroSubject.slice(0, 150)}, set within a ${envType.replace(/_/g, " ")} environment. ` +
        `This is a multi-element advertisement — NOT a single-subject photograph.${sectionList}`,
        "high",
        `Advertisement-first mission: archetype="${archetype}", sections=[${activeSections.join(", ")}]`
      );
    }
    if (heroSubject !== "unknown") {
      return psf(
        `Generate a complete, premium ${archetypeName} advertisement featuring: ${heroSubject.slice(0, 150)}. ` +
        `This is a multi-element advertisement — NOT a single-subject photograph.${sectionList}`,
        "medium",
        `Advertisement-first mission with hero subject`
      );
    }
    return unknownPsf("whatToGenerate");
  })();

  const whyItMatters = (() => {
    const purpose = scene.sceneObjective.scenePurpose.value;
    if (purpose !== "unknown") return psf(purpose.slice(0, 200), "high", `Why from Visual Scene Plan scene objective`);
    const goal = bp.strategy.marketing.campaignGoal.value;
    if (goal !== "unknown") return psf(`This image serves a ${goal} campaign — it must convert viewers through visual storytelling alone`, "medium",
      `Why from Creative Strategy marketing goal "${goal}"`);
    return unknownPsf("whyItMatters");
  })();

  const primarySuccessCriteria = (() => {
    const emotionalGoal = scene.sceneObjective.emotionalGoal.value;
    const heroImportance = scene.heroSubject.heroImportance.value;
    const userAction = scene.sceneObjective.primaryUserAction.value;
    const criteria = [
      emotionalGoal !== "unknown" ? `1. The image must create a feeling of "${emotionalGoal.replace(/_/g, " ")}" in the viewer before any text is read` : null,
      heroImportance !== "unknown" ? `2. The hero subject must register as "${heroImportance.replace(/_/g, " ")}" — it cannot be missed or confused` : null,
      userAction !== "unknown" ? `3. After viewing, the viewer should feel: "${userAction.slice(0, 80)}"` : null,
    ].filter(Boolean).join(". ");
    if (criteria) return psf(criteria, "high", `Success criteria synthesized from scene emotional goal, hero importance, and user action intent`);
    return unknownPsf("primarySuccessCriteria");
  })();

  const nonNegotiableElement = (() => {
    const heroSubject = scene.heroSubject.exactHeroSubject.value;
    const heroImportance = scene.heroSubject.heroImportance.value;
    if (heroImportance === "the_entire_message" && heroSubject !== "unknown") {
      return psf(`THE NON-NEGOTIABLE: ${heroSubject.slice(0, 100)} — if this element fails, the entire creative fails`, "high",
        `Hero is the entire message — non-negotiable`);
    }
    const missionHero = bp.campaign.visualDirection.heroSubject.value;
    if (missionHero !== "unknown") {
      return psf(`The hero subject: ${missionHero.slice(0, 100)} — it must be unmistakably present and correctly rendered`, "high",
        `Non-negotiable from Campaign Plan visual direction hero subject`);
    }
    return unknownPsf("nonNegotiableElement");
  })();

  // campaignTheme — the overarching creative theme
  const campaignTheme = (() => {
    const theme = bp.campaign.concept.campaignTheme.value;
    if (theme !== "unknown") return psf(theme.slice(0, 150), bp.campaign.concept.campaignTheme.confidence,
      `Campaign theme from Creative Director concept`);
    return undefined;
  })();

  // storyNarrative — the single-frame visual narrative
  const storyNarrative = (() => {
    const narrative = scene.storytelling.singleFrameNarrative.value;
    if (narrative !== "unknown") return psf(narrative.slice(0, 300), scene.storytelling.singleFrameNarrative.confidence,
      `Single-frame narrative from Visual Scene Storytelling`);
    // Fallback: compose from beginning + end
    const beginning = scene.storytelling.beginning.value;
    const end = scene.storytelling.end.value;
    if (beginning !== "unknown" && end !== "unknown") {
      return psf(`${beginning.slice(0, 120)} — ending with: ${end.slice(0, 100)}`, "medium",
        `Story narrative composed from scene beginning + end`);
    }
    return undefined;
  })();

  return {
    whatToGenerate, whyItMatters, primarySuccessCriteria, nonNegotiableElement,
    ...(campaignTheme  ? { campaignTheme }  : {}),
    ...(storyNarrative ? { storyNarrative } : {}),
  };
}
