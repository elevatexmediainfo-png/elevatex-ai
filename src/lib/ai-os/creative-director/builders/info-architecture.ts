import type { CreativeStrategy } from "../../creative-brain/types";
import type { InformationArchitecture } from "../types";
import { cf, unknownCf } from "./shared";
import { getSectionSequence, STORY_FLOWS } from "../knowledge";

// Builder 3 — Information Architecture
// Sole responsibility: determine how information is sequenced and structured.
// Reads: strategy.marketing, strategy.audience, strategy.campaign, strategy.creative
// Never generates copy or layouts.

export function buildInformationArchitecture(strategy: CreativeStrategy): InformationArchitecture {
  const campaignGoal = strategy.marketing.campaignGoal.value;
  const campaignCategory = strategy.campaign.campaignCategory.value;
  const platform = strategy.platform.primaryPlatform.value;
  const density = strategy.creative.informationDensity.value;

  const sectionSequence = (() => {
    const seq = getSectionSequence(campaignGoal ?? "", campaignCategory ?? "");
    return cf(seq, campaignGoal !== "unknown" ? "high" : "medium",
      `Section sequence designed for campaignGoal="${campaignGoal}" and campaignCategory="${campaignCategory}"`);
  })();

  const primaryFocus = (() => {
    const focus = strategy.creative.focusPriority.value;
    const focusMap: Record<string, string> = {
      transformation: "The transformation/before-after visual — this is the primary focus because it IS the argument",
      product:        "The hero product shot — visual dominance must make the product unmissable",
      emotion:        "The human emotional moment — the face or gesture that communicates outcome better than any claim",
      information:    "The information architecture itself — the clarity of the data structure is the persuasion device",
      brand:          "Brand identity — every element reinforces the brand rather than any single message",
      person:         "The hero person — their presence, confidence, and authenticity drive the primary focus",
    };
    const val = focusMap[focus ?? ""];
    if (val) return cf(val, "high", `Primary focus determined by Creative Brain focus priority="${focus}"`);
    return unknownCf("primaryFocus");
  })();

  const secondaryFocus = (() => {
    const goal = campaignGoal;
    const secondary: Record<string, string> = {
      lead_generation: "Trust signals — certifications, testimonials, or credentials that justify the primary ask",
      sales:           "The offer mechanics — what exactly the viewer gets and why it's exceptional value",
      education:       "The key insight — the one piece of information that makes everything else make sense",
      awareness:       "Brand personality — a visual or tonal element that communicates the brand distinctively",
      trust:           "Social proof — evidence that others have made this decision successfully",
    };
    const val = secondary[goal ?? ""];
    if (val) return cf(val, "medium", `Secondary focus selected to reinforce primary focus for goal="${goal}"`);
    return unknownCf("secondaryFocus");
  })();

  const contentPriority = (() => {
    const pain = strategy.audience.painPoints.value;
    const desires = strategy.audience.desires.value;
    const stage = strategy.audience.buyerStage.value;
    if (stage === "decision") {
      return cf("Trust and proof take priority — the audience already wants this; remove doubt", "high",
        `Buyer stage=decision → proof over persuasion`);
    }
    if (stage === "awareness" && pain !== "unknown") {
      return cf(`Problem recognition: ${pain.split(",")[0].trim()} — make the problem real before introducing the solution`, "high",
        `Buyer stage=awareness → problem identification comes before solution`);
    }
    if (desires !== "unknown") {
      return cf(`Desire activation: ${desires.split(",")[0].trim()} — the audience's aspiration is the hook`, "medium",
        `Audience desires drive the content priority for this campaign`);
    }
    return unknownCf("contentPriority");
  })();

  const informationFlow = (() => {
    if (platform === "print" || platform === "outdoor") {
      return cf("top_to_bottom", "high", `Print/outdoor format → top-to-bottom reading flow is universal`);
    }
    if (density === "single_message") {
      return cf("single_focus", "high", `Single message density → all visual energy converges on one point`);
    }
    if (density === "complex_infographic") {
      return cf("progressive_disclosure", "high", `Complex infographic → information unfolds progressively to avoid overwhelm`);
    }
    return cf("top_to_bottom", "medium", `Default vertical reading flow for commercial advertising`);
  })();

  const storyFlow = (() => {
    const flow = STORY_FLOWS[campaignGoal ?? ""] ?? STORY_FLOWS[campaignCategory ?? ""];
    if (flow) {
      return cf(flow as InformationArchitecture["storyFlow"]["value"], "high",
        `Story flow mapped from campaignGoal="${campaignGoal}"`);
    }
    return cf("emotion_proof_action", "low", `Default story flow — emotional engagement, proof, then action`);
  })();

  const readingFlow = (() => {
    if (density === "single_message") return cf("center_weighted", "high", `Single message → viewer's eye anchors on the center`);
    if (platform === "instagram" || platform === "facebook") return cf("z_pattern", "high", `Social media feeds → Z-pattern reading matches natural scroll behavior`);
    if (platform === "print" || platform === "outdoor") return cf("top_dominant", "high", `Print/outdoor → headline dominates the top, rest follows`);
    if (density === "complex_infographic") return cf("f_pattern", "high", `Complex content → F-pattern reading preserves top-left information priority`);
    return cf("z_pattern", "medium", `Z-pattern as the default for commercial advertising — proven to work`);
  })();

  return { sectionSequence, primaryFocus, secondaryFocus, contentPriority, informationFlow, storyFlow, readingFlow };
}
