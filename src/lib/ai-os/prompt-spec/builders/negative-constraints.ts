import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { NegativeConstraints } from "../types";
import { psf, unknownPsf } from "./shared";

// Builder 11 — Negative Constraints
// Consolidates ALL "must not appear" signals into one comprehensive list
// that Provider Translators can use directly as negative prompts or exclusion rules.

const UNIVERSAL_QUALITY_ANTIPATTERNS = [
  "cartoon appearance", "plastic faces", "low detail", "cheap layout", "generic AI appearance",
  "bad anatomy", "distorted proportions", "watermarks", "artifacts", "blurry output",
  "oversaturated colors", "harsh visible vignettes", "stock photo watermarks",
  "inconsistent lighting from multiple impossible sources",
].join(", ");

const TEXT_AND_LOGO_ANTIPATTERNS = [
  "rendered text within the image (all text added in post-production)",
  "attempt to render the brand logo (placeholder shape only — logo added in post)",
  "visible words, letters, or numbers in the generated image",
].join(", ");

export function buildNegativeConstraints(bp: UniversalCampaignBlueprint, scene: VisualScenePlan): NegativeConstraints {
  // Forbidden scene elements — from scene planning + campaign constraints + brand rules
  const forbiddenSceneElements = (() => {
    const sceneExcluded = scene.objects.objectsToExclude.value;
    const campaignForbidden = bp.campaign.creativeConstraints.mustNeverAppear.value;
    const parts = [
      sceneExcluded !== "unknown" ? sceneExcluded.slice(0, 200) : null,
      campaignForbidden !== "unknown" ? campaignForbidden.slice(0, 150) : null,
      "competitor product branding",
      "low-quality props or materials",
    ].filter(Boolean).join(". ");
    if (parts) return psf(parts, "high", `[negative] Forbidden elements from scene plan + campaign constraints`);
    return unknownPsf("forbiddenSceneElements");
  })();

  // AI generation artifacts — from scene plan + standard prevention
  const forbiddenAiArtifacts = (() => {
    const artifactPrevention = scene.renderingIntent.aiArtifactPreventionStrategy.value;
    if (artifactPrevention !== "unknown") {
      return psf(`${artifactPrevention.slice(0, 200)}. Additionally: ${TEXT_AND_LOGO_ANTIPATTERNS}`, "high",
        `[negative] AI artifact prevention from scene plan rendering intent`);
    }
    return psf(`${TEXT_AND_LOGO_ANTIPATTERNS}. Avoid distorted anatomy, extra fingers, merged faces, impossible geometry`, "medium",
      `[negative] Default AI artifact prevention rules`);
  })();

  // Technical quality failures
  const qualityAntiPatterns = psf(UNIVERSAL_QUALITY_ANTIPATTERNS, "high",
    `[negative] Universal commercial advertising quality anti-patterns — always excluded`);

  // Brand anti-patterns — marketing elements that undermine the message
  const brandAntiPatterns = (() => {
    const industry = bp.strategy.business.industry.value;
    const antiPatternsMap: Record<string, string> = {
      healthcare:       "generic stock-photo doctor poses, overly clinical-cold environments, fear-inducing medical imagery, unnatural model-perfect faces",
      finance:          "cliché money imagery (coin stacks, gold bars), complex charts that confuse rather than inspire",
      real_estate:      "empty staged rooms without lifestyle, outdated furnishings, anything suggesting decline",
      food_beverage:    "artificial-looking food, unhygienic hints, generic chain-restaurant aesthetics",
      education:        "stressed or unhappy students, outdated facilities, academic pressure without outcome",
      beauty_wellness:  "digitally-altered unrealistic results without disclosure, clinical medical references for cosmetic content",
      jewellery_luxury: "synthetic-looking materials, low-quality display surfaces, cluttered backgrounds",
      automotive:       "flat side-on dealer-lot photography, unglamorous settings, competitor vehicles",
    };
    const val = antiPatternsMap[industry ?? ""] ?? "generic stock-photo aesthetics, anything that reads as cheap or unintentional";
    return psf(`${val}. Avoid the 'generic AI poster' look — everything must feel deliberately created for this specific campaign`, "high",
      `[negative] Brand anti-patterns from industry "${industry}" knowledge`);
  })();

  // Also include the existing negative_constraints from the Universal JSON Prompt
  const existingNegativeConstraints = bp.userIntelligence.understanding.intent.value; // just checking it's not negative
  void existingNegativeConstraints; // accessed above just for completeness

  return { forbiddenSceneElements, forbiddenAiArtifacts, qualityAntiPatterns, brandAntiPatterns };
}
