import type { CreativeStrategy } from "../../creative-brain/types";
import type { PhotographyDirection } from "../types";
import { cf } from "./shared";
import { getCameraMood } from "../knowledge";

// Builder 6 — Photography Direction
// Sole responsibility: determine how the visual content should be captured/composed.
// Reads: strategy.visual, strategy.creative, strategy.business
// Never generates prompt text or technical camera specifications.

export function buildPhotographyDirection(strategy: CreativeStrategy): PhotographyDirection {
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;
  const luxury = strategy.visual.luxuryLevel.value;
  const focus = strategy.creative.focusPriority.value;
  const photoStyle = strategy.visual.photographyStyle.value;

  const cameraMood = cf(getCameraMood(industryKey ?? ""), "high",
    `Camera mood from industry knowledge bank for "${industryKey}"`);

  const shotType = (() => {
    if (photoStyle === "before_after") return cf("split_frame", "high", `Before/after format → split frame shot type`);
    if (photoStyle === "macro_detail") return cf("extreme_close_up", "high", `Macro photography style → extreme close-up shot type`);
    if (focus === "product") return cf("full_product", "high", `Product focus → full product shot that reveals all key details`);
    if (focus === "emotion" || focus === "person") return cf("close_up", "high", `Emotion/person focus → close-up captures micro-expression and connection`);
    if (focus === "information") return cf("medium", "high", `Information focus → medium shot provides context for data and text`);
    if (photoStyle === "aerial") return cf("aerial", "high", `Aerial photography style selected`);
    if (["real_estate", "luxury_property", "hospitality"].includes(industryKey ?? "")) {
      return cf("wide", "high", `${industryKey} → wide shot communicates scale and aspiration`);
    }
    return cf("medium", "medium", `Medium shot as default — balanced subject and context`);
  })();

  const framingStyle = (() => {
    if (luxury === "ultra_luxury" || luxury === "high") {
      return cf("negative_space_dominant", "high",
        `Luxury level="${luxury}" → negative space signals premium; clutter signals budget`);
    }
    if (focus === "transformation") {
      return cf("frame_within_frame", "high",
        `Transformation focus → frame within frame creates visual separation between before and after`);
    }
    if (photoStyle === "editorial") {
      return cf("edge_tension", "high", `Editorial style → edge tension creates dynamism and visual interest`);
    }
    return cf("rule_of_thirds", "medium", `Rule of thirds as the default — proven compositional clarity`);
  })();

  const perspective = (() => {
    if (["jewellery_luxury", "fine_jewellery"].includes(industryKey ?? "")) {
      return cf("overhead", "high", `Jewellery → overhead or table-top perspective isolates the piece in its full glory`);
    }
    if (["automotive", "car_dealership"].includes(industryKey ?? "")) {
      return cf("slightly_elevated", "high", `Automotive → slightly elevated perspective emphasises profile, proportion, and stance`);
    }
    if (["real_estate", "luxury_property"].includes(industryKey ?? "")) {
      return cf("eye_level", "medium", `Real estate → eye-level communicates lifestyle scale`);
    }
    return cf("eye_level", "medium", `Eye-level perspective creates connection and relatability`);
  })();

  const lensStyle = (() => {
    if (photoStyle === "macro_detail" || focus === "product") {
      return cf("macro_detail", "high", `Macro photography focus → macro lens reveals texture and craftsmanship`);
    }
    if (focus === "emotion" || focus === "person") {
      return cf("portrait_85mm", "high", `Portrait focus → 85mm equivalent creates natural, flattering compression`);
    }
    if (["real_estate", "hospitality"].includes(industryKey ?? "")) {
      return cf("wide_environmental", "high", `${industryKey} → wide angle captures scale and environment`);
    }
    if (luxury === "high" || luxury === "ultra_luxury") {
      return cf("portrait_85mm", "medium", `Luxury context → telephoto compression creates premium, intentional depth`);
    }
    return cf("standard_natural", "medium", `Standard natural lens — true-to-life rendering for commercial advertising`);
  })();

  const depth = (() => {
    if (focus === "emotion" || focus === "person") {
      return cf("shallow_romantic", "high", `Emotion/person focus → shallow depth isolates the subject and creates intimacy`);
    }
    if (focus === "transformation") {
      return cf("extreme_shallow_subject_isolation", "high",
        `Transformation focus → extreme shallow depth makes the result unmissable`);
    }
    if (focus === "information") {
      return cf("deep_environmental", "medium", `Information focus → deeper depth keeps all content readable`);
    }
    if (luxury === "high" || luxury === "ultra_luxury") {
      return cf("shallow_romantic", "medium", `Luxury visual treatment → shallow depth creates a refined, aspirational quality`);
    }
    return cf("medium_natural", "medium", `Medium depth — subject clear, background contextual`);
  })();

  const lightingIntent = (() => {
    const industryLighting: Record<string, PhotographyDirection["lightingIntent"]["value"]> = {
      dental:           "clinical_trust",
      dental_clinic:    "clinical_trust",
      healthcare:       "soft_approachable",
      food_beverage:    "warm_intimate",
      restaurant:       "warm_intimate",
      real_estate:      "golden_aspirational",
      luxury_property:  "golden_aspirational",
      finance:          "soft_approachable",
      education:        "natural_authentic",
      beauty_wellness:  "soft_approachable",
      hair_salon:       "soft_approachable",
      jewellery_luxury: "dramatic_luxury",
      fine_jewellery:   "dramatic_luxury",
      automotive:       "bold_energetic",
      car_dealership:   "bold_energetic",
      hospitality:      "warm_intimate",
      retail:           "natural_authentic",
    };
    const intent = industryLighting[industryKey ?? ""];
    if (intent) return cf(intent, "high", `Lighting intent "${intent}" selected for industry="${industryKey}"`);
    return cf("natural_authentic", "low", `Default natural lighting intent`);
  })();

  return { cameraMood, shotType, framingStyle, perspective, lensStyle, depth, lightingIntent };
}
