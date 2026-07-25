import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { VisualPriorityEngine } from "../types";
import { lf } from "./shared";
import { getVisualPriorityOrder } from "../knowledge";

// Builder 8 — Visual Priority Engine
// Sole responsibility: assign every element an explicit rendering priority
// so the image generation engine knows exactly what must be most visible.
// Priority 1 = maximum visual dominance; Priority 7 = ambient/decorative.

export function buildVisualPriorityEngine(strategy: CreativeStrategy, plan: CampaignPlan): VisualPriorityEngine {
  const goal = strategy.marketing.campaignGoal.value;
  const category = strategy.campaign.campaignCategory.value;
  const order = getVisualPriorityOrder(goal ?? "", category ?? "");

  const [p1, p2, p3, p4, p5, p6, p7] = [
    order[0] ?? "hero_subject",
    order[1] ?? "headline_area",
    order[2] ?? "supporting_elements",
    order[3] ?? "information_blocks",
    order[4] ?? "trust_signals",
    order[5] ?? "logo",
    order[6] ?? "decorative_elements",
  ];

  const heroSubject = plan.visualDirection.heroSubject.value;

  const priority1 = lf(
    heroSubject !== "unknown" ? `${p1.replace(/_/g, " ")} — ${heroSubject.slice(0, 80)}` : p1.replace(/_/g, " "),
    "high",
    `Priority 1: "${p1}" must occupy the largest visual real estate and highest contrast — it IS the campaign`
  );

  const priority2 = lf(
    `${p2.replace(/_/g, " ")} — the headline or secondary visual that delivers the campaign message`,
    "high",
    `Priority 2: "${p2}" — the eye lands here immediately after the primary; it frames the primary for the viewer`
  );

  const priority3 = lf(
    `${p3.replace(/_/g, " ")} — ${plan.visualDirection.supportingElements.value !== "unknown" ? plan.visualDirection.supportingElements.value.slice(0, 60) : "visual elements that reinforce the primary message"}`,
    "high",
    `Priority 3: "${p3}" — supporting layer that deepens the story without competing with priorities 1-2`
  );

  const priority4 = lf(
    `${p4.replace(/_/g, " ")} — body copy, benefits, or information blocks`,
    "medium",
    `Priority 4: "${p4}" — informational content that justifies the claim made in priorities 1-3`
  );

  const priority5 = lf(
    `${p5.replace(/_/g, " ")} — ${plan.advertisementStructure.trustSection.value !== "absent" ? "trust indicators (certifications, testimonials, ratings)" : "CTA zone — action prompt"}`,
    "medium",
    `Priority 5: "${p5}" — proof or action layer; viewed after the story is understood`
  );

  const priority6 = lf(
    `${p6.replace(/_/g, " ")} — brand mark, logo, tagline at standard platform-convention position`,
    "medium",
    `Priority 6: "${p6}" — brand identity confirms the source; should be visible but not compete`
  );

  const priority7 = lf(
    `${p7.replace(/_/g, " ")} — ambient textures, background gradients, decorative graphic elements`,
    "low",
    `Priority 7: "${p7}" — decorative layer adds visual richness without drawing eye; lowest rendering priority`
  );

  return { priority1, priority2, priority3, priority4, priority5, priority6, priority7 };
}
