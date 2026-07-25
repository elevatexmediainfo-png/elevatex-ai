import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { LightingPlanning } from "../types";
import { sp } from "./shared";
import { LIGHTING_BY_STYLE } from "../knowledge";
import type { VTEEnrichment } from "../vte-bridge";
import { vteWouldDuplicate } from "../vte-bridge";

// Builder 8 — Lighting Planning
// How is the scene illuminated? What does the light communicate?
// Phase 10.5A: VTE lighting primitive enriches primaryLight when no specific
// lightingIntent is briefed (i.e. when falling back to the photography-style KB).

export function buildLightingPlanning(bp: UniversalCampaignBlueprint, vte?: VTEEnrichment): LightingPlanning {
  const photoDir = bp.campaign.photographyDirection;
  const strategy = bp.strategy;
  const photoStyle = strategy.visual.photographyStyle.value;
  const lightingSpec = LIGHTING_BY_STYLE[photoStyle !== "unknown" ? photoStyle : "lifestyle"];

  const primaryLight = (() => {
    const lightIntent = photoDir.lightingIntent.value;
    const intentDesc: Record<string, string> = {
      clinical_trust:           "Bright, even, soft-box quality overhead light with warm fill — clinical precision without cold sterility. The light signals competence and cleanliness simultaneously",
      warm_intimate_golden:     "Warm-toned directional key light from upper left — golden hour quality, 3200K colour temperature feel. Intimate and inviting, never harsh",
      dramatic_luxury:          "High-contrast directional light from a precise angle — reveals material surfaces (facets, polish, texture) with maximum drama. Single source, no fill",
      soft_approachable:        "Large, diffused soft-box light close to the subject — wraps naturally, flattering, approachable. No harsh shadows anywhere",
      bold_energetic:           "Strong directional light with moderate contrast — communicates energy and confidence. Some shadow defines form without dominating",
      natural_authentic:        "Available-light quality — diffused window light or outdoor shade. Honest, real, not produced. The absence of production is the production",
      golden_aspirational:      "Golden hour quality light washing the scene — warm, magical, aspirational. The light makes everything look like the best version of itself",
    };

    // When a specific lightingIntent was briefed, it wins — VTE does not override it.
    if (lightIntent !== "unknown" && intentDesc[lightIntent ?? ""]) {
      return sp(intentDesc[lightIntent!], "high", `Primary light from photography lighting intent "${lightIntent}"`);
    }

    // Phase 10.5A — VTE lighting primitive adds concept-derived light quality to the
    // photography-style KB fallback: "soft commercial lighting" becomes "soft commercial
    // lighting with a warm directional fill that catches the subject's confidence".
    const kbLight = lightingSpec.primaryLight;
    if (vte?.hasContent && vte.lighting[0] && !vteWouldDuplicate(kbLight, vte.lighting[0].value)) {
      return sp(
        `${kbLight}; ${vte.lighting[0].value}`,
        "high",
        `Primary light: photography style KB enriched with VTE lighting primitive for "${vte.resolvedIndustry}"`
      );
    }

    return sp(kbLight, "medium", `Primary light from photography style "${photoStyle}" lighting specification (no specific intent briefed)`);
  })();

  const secondaryLight = (() => {
    return sp(lightingSpec.secondaryLight, "medium",
      `Secondary light from photography style "${photoStyle}" lighting specification`);
  })();

  const moodLighting = (() => {
    const lightIntent = photoDir.lightingIntent.value;
    const moodMap: Record<string, LightingPlanning["moodLighting"]["value"]> = {
      clinical_trust:       "cool_clinical_precise",
      warm_intimate_golden: "warm_intimate_golden",
      dramatic_luxury:      "dramatic_contrasty_luxury",
      soft_approachable:    "soft_diffused_approachable",
      bold_energetic:       "bright_even_commercial",
      natural_authentic:    "natural_authentic_ambient",
      golden_aspirational:  "warm_intimate_golden",
    };
    const val = moodMap[lightIntent ?? ""] ?? "soft_diffused_approachable";
    return sp(val, lightIntent !== "unknown" ? "high" : "medium", `Mood lighting "${val}" from intent "${lightIntent}"`);
  })();

  const shadowStyle = (() => {
    const luxury = strategy.visual.luxuryLevel.value;
    if (luxury === "ultra_luxury" || luxury === "high") {
      return sp("soft_diffused_shadows", "high", `Luxury context → soft shadows signal quality; hard shadows read as budget`);
    }
    if (photoStyle === "editorial" || strategy.visual.luxuryLevel.value === "high") {
      return sp("directional_subtle", "high", `Editorial/high-luxury → directional but refined shadows add dimension`);
    }
    if (photoStyle === "studio_product") {
      return sp("soft_diffused_shadows", "high", `Product photography → soft shadows reveal form without creating distraction`);
    }
    if (photoStyle === "macro_detail") {
      return sp("no_shadow_product", "medium", `Macro photography → shadows may obscure detail; minimal or controlled`);
    }
    return sp("soft_diffused_shadows", "medium", `Default: soft shadows for commercial advertising — approachable and professional`);
  })();

  const reflectionStyle = (() => {
    const humanPresence = strategy.visual.humanPresence.value;
    const productPriority = strategy.visual.productPriority.value;
    if (humanPresence === "hero" || humanPresence === "supporting") {
      return sp("catchlight_eyes", "high", `Human hero → catchlight in eyes is mandatory for a living, present subject`);
    }
    if (["jewellery_luxury", "fine_jewellery"].includes(strategy.business.subIndustry.value ?? "")) {
      return sp("specular_product_highlight", "high", `Jewellery → precisely choreographed specular highlights reveal craftsmanship on every facet`);
    }
    if (productPriority === "hero") {
      return sp("surface_material_reflection", "medium", `Product hero → surface reflection communicates material quality and premium finish`);
    }
    return sp("surface_material_reflection", "low", `Default: natural surface reflections add depth and realism`);
  })();

  return { primaryLight, secondaryLight, moodLighting, shadowStyle, reflectionStyle };
}
