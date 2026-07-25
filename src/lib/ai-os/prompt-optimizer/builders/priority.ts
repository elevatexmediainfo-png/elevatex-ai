import type { PromptSpecification } from "../../prompt-spec/types";
import type { SectionPriority } from "../types";
import { clamp100 } from "./shared";

// Builder 1 — Priority Engine
// Assigns 0-100 weights to every section based on the campaign characteristics.
// Base priorities follow the spec: Hero=100, Negative=100, Rendering=95, Composition=95.
// Adjusted up/down based on what THIS specific spec emphasises.

export function buildSectionPriority(spec: PromptSpecification): SectionPriority {
  const heroImportance = spec.hero.heroImportance.value;
  const luxuryLevel = spec.rendering.luxuryLevel.value;
  const campaignGoal = spec.marketing.campaignGoal.value;
  const moodLighting = spec.lighting.moodLighting.value;
  const envType = spec.environment.environmentType.value;

  // Base priorities from spec definition
  let hero          = 100;
  const negativeConstraints = 100;
  let rendering     = 95;
  let composition   = 95;
  const storytelling = 90;
  let marketing     = 85;
  let lighting      = 80;
  let environment   = 75;
  const typography   = 70;
  let camera        = 65;
  // Supporting contains the advertisement layers (benefits, trust, steps) — must be high priority
  // for multi-element campaigns so they are not compressed away
  let supporting    = 75;
  let brandRules    = 55;
  const mission      = 50;

  // Adjustments based on campaign characteristics
  if (heroImportance === "absolute_mandatory") hero = 100; // no adjustment needed
  if (heroImportance === "strong_supporting") hero = clamp100(hero - 5);

  // Luxury campaigns boost composition and rendering
  if (luxuryLevel === "ultra_prestige_perfect" || luxuryLevel === "luxury_refined") {
    rendering   = clamp100(rendering + 5);
    composition = clamp100(composition + 3);
    lighting    = clamp100(lighting + 5);
  }

  // Trust campaigns boost marketing
  if (campaignGoal === "trust" || campaignGoal === "lead generation") {
    marketing  = clamp100(marketing + 8);
    brandRules = clamp100(brandRules + 10);
  }

  // Multi-element advertisements: supporting section carries the full ad structure
  // (benefits strip, trust badges, process steps) — must rank near the top
  const hasAdLayers = spec.supporting.advertisementLayers?.value &&
    spec.supporting.advertisementLayers.value !== "unknown" &&
    spec.supporting.advertisementLayers.value.length > 20;
  if (hasAdLayers) {
    supporting = clamp100(supporting + 15);  // 90 — near-critical for multi-layer ads
    marketing  = clamp100(marketing + 5);    // 90 — marketing intent drives ad structure
  }

  // Warm intimate lighting boosts environment context
  if (moodLighting === "warm_intimate_golden") {
    environment = clamp100(environment + 8);
    lighting    = clamp100(lighting + 5);
  }

  // Product environments boost composition and environment
  if (envType === "controlled_product_table" || envType === "professional_studio") {
    composition = clamp100(composition + 5);
    camera      = clamp100(camera + 5);
  }

  const top3 = [
    { name: "hero", val: hero },
    { name: "negativeConstraints", val: negativeConstraints },
    { name: "rendering", val: rendering },
  ].sort((a, b) => b.val - a.val).slice(0, 3);

  const priorityReasoning = `Top 3 priorities: ${top3.map(t => `${t.name} (${t.val})`).join(", ")}. ` +
    `Hero is ${heroImportance !== "unknown" ? heroImportance : "primary anchor"} — ` +
    `rendering requires ${luxuryLevel !== "unknown" ? luxuryLevel.replace(/_/g, " ") : "professional quality"}.`;

  return {
    hero, negativeConstraints, rendering, composition, storytelling,
    marketing, lighting, environment, typography, camera,
    supporting, brandRules, mission, priorityReasoning,
  };
}
