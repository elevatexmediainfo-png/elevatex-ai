import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { RenderingSpec } from "../types";
import { promoteField, psf } from "./shared";

// Builder 12 — Rendering Specification
// Promotes rendering intent from VisualScenePlan into the Specification.
// Phase 10.4H: overallDesignStyle (from designDirection) and visualArchetype
//   (from creativeMatrix) were previously dead — now activated.

export function buildRenderingSpec(scene: VisualScenePlan, bp: UniversalCampaignBlueprint): RenderingSpec {
  const overallDesignStyle = (() => {
    const style = bp.campaign.designDirection.overallDesignStyle.value;
    if (style !== "unknown") {
      const label = style.replace(/_/g, " ");
      return psf(`${label} design style`, bp.campaign.designDirection.overallDesignStyle.confidence,
        `Overall design style direction from Creative Director DesignDirection`);
    }
    return undefined;
  })();

  const visualArchetype = (() => {
    const arch = bp.strategy.creativeMatrix.visualArchetype;
    if (arch && arch !== "") {
      return psf(arch, "high",
        `Visual archetype from Creative Matrix — synthesised from experience profile and industry cluster`);
    }
    return undefined;
  })();

  return {
    photorealismLevel:  promoteField(scene.renderingIntent.photorealismLevel,              "scene.rendering.photorealism"),
    commercialQuality:  promoteField(scene.renderingIntent.commercialQuality,              "scene.rendering.commercial"),
    editorialQuality:   promoteField(scene.renderingIntent.editorialQuality,               "scene.rendering.editorial"),
    luxuryLevel:        promoteField(scene.renderingIntent.luxuryLevel,                    "scene.rendering.luxury"),
    realismTarget:      promoteField(scene.renderingIntent.realismTarget,                  "scene.rendering.target"),
    artifactPrevention: promoteField(scene.renderingIntent.aiArtifactPreventionStrategy,   "scene.rendering.artifacts"),
    ...(overallDesignStyle ? { overallDesignStyle } : {}),
    ...(visualArchetype    ? { visualArchetype }    : {}),
  };
}
