import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { FontWeightPlanning } from "../types";
import { tf } from "./shared";

// Builder 3 — Font Weight Planning
// Sole responsibility: assign a font weight to every text level.

export function buildFontWeightPlanning(
  strategy: CreativeStrategy,
  plan: CampaignPlan
): FontWeightPlanning {
  const luxury = strategy.visual.luxuryLevel.value;
  const tone = strategy.communication.tone.value;
  const urgency = strategy.communication.urgency.value;

  // Hero headline weight — heaviest text on the page
  const heroHeadlineWeight = (() => {
    if (urgency === "immediate" || urgency === "high") {
      return tf("extra_bold", "high", `High urgency → extra_bold creates maximum impact and immediacy`);
    }
    if (luxury === "ultra_luxury" || luxury === "high") {
      return tf("bold", "high",
        `Luxury: headline is bold, NOT extra_bold — restraint in weight signals refinement over aggression`);
    }
    if (tone === "minimal") return tf("light", "high",
      `Minimal tone → light weight hero headline; the contrast with the canvas creates power, not the weight`);
    return tf("extra_bold", "medium", `Standard advertising default — extra_bold commands the most attention`);
  })();

  // Headline weight
  const headlineWeight = (() => {
    if (luxury === "ultra_luxury") return tf("light", "high",
      `Ultra-luxury: counter-intuitive light headline weight signals extreme confidence — heavy is for mass market`);
    if (urgency === "high" || urgency === "immediate") return tf("bold", "high",
      `Urgency → bold headline delivers the message with force`);
    return tf("bold", "medium", `Standard bold for headline — clear dominance in the hierarchy`);
  })();

  // Subheadline weight
  const subheadlineWeight = (() => {
    if (luxury === "ultra_luxury" || luxury === "high") return tf("light", "medium",
      `Luxury: subheadline is light to contrast with the bold headline`);
    return tf("regular", "medium", `Regular or medium weight — clearly lighter than headline, clearly heavier than body`);
  })();

  // Body weight
  const bodyWeight = (() => {
    if (tone === "educational") return tf("regular", "high",
      `Educational tone → regular weight optimises long-form readability`);
    return tf("regular", "medium", `Body is always regular or light — never competes with headline or CTA`);
  })();

  // CTA weight — always prominent
  const ctaWeight = (() => {
    if (plan.advertisementStructure.ctaSection.value === "directional_cta") {
      return tf("semi_bold", "medium", `Directional CTA — semi_bold is sufficient; the direction arrow provides the impact`);
    }
    return tf("bold", "high", `CTA must be bold — the action must read instantly and decisively`);
  })();

  // Statistics weight
  const statisticWeight = tf("extra_bold", "high",
    `Statistics always use extra_bold — the number IS the message; weight makes it undeniable`);

  // Labels weight
  const labelWeight = tf("regular", "medium",
    `Labels use regular weight — they annotate without competing with surrounding content`);

  return { heroHeadlineWeight, headlineWeight, subheadlineWeight, bodyWeight, ctaWeight, statisticWeight, labelWeight };
}
