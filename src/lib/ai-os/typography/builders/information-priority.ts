import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { VisualLayoutPlan } from "../../visual-layout/types";
import type { InformationPriority } from "../types";
import { tf, unknownTf } from "./shared";
import { getHierarchyContrast } from "../knowledge";

// Builder 6 — Information Priority
// Sole responsibility: declare which text dominates, which is subordinate,
// and which must never compete with the primary elements.

export function buildInformationPriority(
  strategy: CreativeStrategy,
  plan: CampaignPlan,
  layout: VisualLayoutPlan
): InformationPriority {
  const luxury = strategy.visual.luxuryLevel.value;
  const goal = strategy.marketing.campaignGoal.value;

  const dominantText = (() => {
    const focus = strategy.creative.focusPriority.value;
    if (focus === "information") {
      return tf("The headline and key statistic or benefit — both share visual dominance in an informational layout", "high",
        `Information focus → headline + statistic co-dominate; neither can fully outrank the other`);
    }
    if (focus === "transformation") {
      return tf("The headline below the transformation visual — the visual IS the dominant element, headline reinforces it", "high",
        `Transformation focus → visual dominates, headline is the second-strongest element`);
    }
    if (goal === "lead_generation") {
      return tf("The CTA — in a lead generation creative, the action must be the most visually persistent element after the hero", "high",
        `Lead gen: CTA fights for dominance alongside the headline`);
    }
    return tf("The hero headline — the single most important text element, given maximum visual weight and prominence", "high",
      `Default: hero headline always dominates the text hierarchy`);
  })();

  const subordinateText = (() => {
    // bodyBlock is a Phase 6 decision (VisualLayoutPlan); benefitsSection is Phase 5 (CampaignPlan)
    const bodyPresent = layout.blocks.bodyBlock.value !== "absent";
    const benefitsPresent = plan.advertisementStructure.benefitsSection.value !== "absent";
    if (bodyPresent) return tf(
      "Body copy — clearly smaller and lighter than headline; readable but never competing",
      "high", `Body copy is always subordinate to headline and CTA`);
    if (benefitsPresent) return tf(
      "Benefits strip — visible and scannable but always smaller than the headline",
      "medium", `Benefits are subordinate supporting information`);
    return unknownTf("subordinateText");
  })();

  const neverCompetes = (() => {
    const footerPresent = plan.advertisementStructure.footerSection.value !== "absent";
    const disclaimerNeeded = ["finance", "healthcare"].includes(strategy.business.industry.value ?? "");
    const nonCompeting = [
      footerPresent ? "Footer text (logo, contact, website)" : null,
      disclaimerNeeded ? "Legal disclaimer" : null,
      "Labels below feature icons",
    ].filter(Boolean).join("; ");
    if (nonCompeting) return tf(nonCompeting, "high",
      `These text elements must always read BELOW the primary hierarchy — they are functional, not persuasive`);
    return tf("Footer and disclaimer text — must always be clearly subordinate", "medium",
      `Default non-competing text elements`);
  })();

  const textHierarchyRatio = (() => {
    const contrast = getHierarchyContrast(luxury ?? "medium");
    return tf(
      contrast as InformationPriority["textHierarchyRatio"]["value"],
      luxury !== "unknown" ? "high" : "medium",
      `Hierarchy contrast "${contrast}" for luxury level="${luxury}" — describes the scale gap between levels`
    );
  })();

  return { dominantText, subordinateText, neverCompetes, textHierarchyRatio };
}
