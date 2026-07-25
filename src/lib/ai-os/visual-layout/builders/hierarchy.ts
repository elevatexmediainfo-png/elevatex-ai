import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { VisualHierarchy } from "../types";
import { lf } from "./shared";

// Builder 2 — Visual Hierarchy
// Sole responsibility: determine how the eye moves through the creative.

export function buildVisualHierarchy(strategy: CreativeStrategy, plan: CampaignPlan): VisualHierarchy {
  const focus = strategy.creative.focusPriority.value;
  const goal = strategy.marketing.campaignGoal.value;
  const heroSubject = plan.visualDirection.heroSubject.value;
  const infoFlow = plan.informationArchitecture.informationFlow.value;
  const readingFlowPlan = plan.informationArchitecture.readingFlow.value;

  const primaryFocus = heroSubject !== "unknown"
    ? lf(heroSubject.slice(0, 120), "high", `Primary focus = hero subject from Campaign Plan visual direction`)
    : lf(`The ${focus !== "unknown" ? focus.replace(/_/g, " ") : "dominant"} element as determined by the Creative Brain focus priority`, "medium",
        `Primary focus derived from Creative Brain focus priority="${focus}"`);

  const secondaryFocus = (() => {
    const structureMap: Record<string, string> = {
      lead_generation: "Headline communicating the primary benefit and value proposition",
      sales:           "The offer visual or benefit strip immediately below the hero",
      education:       "The information block or process diagram reinforcing the hero",
      awareness:       "Brand personality element — typography tone or campaign graphic",
      trust:           "Trust signals: certifications, credentials, or social proof adjacent to the hero",
    };
    const val = structureMap[goal ?? ""] ?? "Headline or caption that contextualises the hero subject";
    return lf(val, goal !== "unknown" ? "high" : "medium",
      `Secondary focus selected for campaign goal="${goal}"`);
  })();

  const tertiaryFocus = (() => {
    if (plan.advertisementStructure.benefitsSection.value !== "absent") {
      return lf("Benefits section — three-item or strip format reinforcing the primary message", "medium",
        `Benefits section present in ad structure → becomes tertiary focus`);
    }
    if (plan.advertisementStructure.trustSection.value !== "absent") {
      return lf("Trust indicators — badges, certifications, or testimonial excerpt", "medium",
        `Trust section present → becomes tertiary focal point`);
    }
    return lf("Supporting visual elements and brand identity cues", "low",
      `No specific tertiary focus — brand elements carry this layer`);
  })();

  const eyeFlow = (() => {
    const map: Record<string, VisualHierarchy["eyeFlow"]["value"]> = {
      z_pattern:    "z_pattern",
      f_pattern:    "f_pattern",
      center_out:   "center_out",
      top_to_bottom:"top_to_bottom",
      top_dominant: "top_to_bottom",
      single_focus: "center_out",
    };
    const val = map[readingFlowPlan ?? ""] ?? "z_pattern";
    return lf(val, readingFlowPlan !== "unknown" ? "high" : "medium",
      `Eye flow "${val}" mapped from information architecture reading flow "${readingFlowPlan}"`);
  })();

  const readingDirection = (() => {
    if (infoFlow === "single_focus") return lf("single_focus", "high", `Single message layout → eye goes directly to centre`);
    if (infoFlow === "progressive_disclosure") return lf("top_dominant", "high", `Progressive disclosure → top-to-bottom reading`);
    return lf("left_to_right_top_bottom", "medium", `Default Western reading direction`);
  })();

  const attentionOrder = (() => {
    const sequence = `${primaryFocus.value.slice(0, 50)} → ${secondaryFocus.value.slice(0, 40)} → ${tertiaryFocus.value.slice(0, 40)} → CTA`;
    return lf(sequence, "medium", `Attention order synthesized from priority hierarchy decisions`);
  })();

  return { primaryFocus, secondaryFocus, tertiaryFocus, eyeFlow, readingDirection, attentionOrder };
}
