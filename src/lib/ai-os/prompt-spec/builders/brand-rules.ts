import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { BrandRules } from "../types";
import { psf, unknownPsf } from "./shared";

// Builder 10 — Brand Rules
// Consolidates brand safety, restrictions, mandatory and forbidden elements
// from the Blueprint's Campaign Plan creative constraints.

export function buildBrandRules(bp: UniversalCampaignBlueprint): BrandRules {
  const constraints = bp.campaign.creativeConstraints;
  const quality = bp.quality;

  const brandSafety = (() => {
    const bsLevel = constraints.brandSafety.value;
    if (bsLevel !== "unknown") {
      return psf(`BRAND SAFETY: ${bsLevel.replace(/_/g, " ")} — ${
        bsLevel === "medical_grade" ? "healthcare content requires full medical compliance"
        : bsLevel === "financial_compliant" ? "financial content requires regulatory disclaimer compliance"
        : bsLevel === "educational_appropriate" ? "educational content must be age-appropriate and factually accurate"
        : "standard advertising compliance applies"
      }`, "high", `[brand] Brand safety level from Campaign Plan creative constraints`);
    }
    // Fall back to quality warnings
    const hasWarnings = quality.warnings.some(w => w.includes("compliance") || w.includes("disclaimer"));
    if (hasWarnings) return psf("BRAND SAFETY: elevated — compliance warnings detected, verify industry requirements", "medium",
      `[brand] Brand safety elevated due to quality warnings`);
    return psf("BRAND SAFETY: standard — standard advertising compliance applies", "low",
      `[brand] Default brand safety level`);
  })();

  const industryRestrictions = (() => {
    const ir = constraints.industryRestrictions.value;
    if (ir !== "unknown") return psf(`INDUSTRY RESTRICTIONS: ${ir.slice(0, 200)}`, "high",
      `[brand] Industry restrictions from Campaign Plan creative constraints`);
    return unknownPsf("industryRestrictions");
  })();

  const mandatoryElements = (() => {
    const me = constraints.mustAlwaysAppear.value;
    if (me !== "unknown") {
      // Also include objects that must appear from scene planning
      const trustObjects = bp.campaign.visualDirection.trustBadges.value;
      const brandObjects = bp.layout.blocks.logoBlock.value;
      const parts = [
        `MANDATORY: ${me.slice(0, 150)}`,
        brandObjects !== "unknown" ? `Logo placeholder at ${brandObjects} position` : null,
        trustObjects !== "none" && trustObjects !== "unknown" ? `Trust badges: ${trustObjects}` : null,
      ].filter(Boolean).join(". ");
      return psf(parts, "high", `[brand] Mandatory elements from Campaign Plan + layout + trust badges`);
    }
    return unknownPsf("mandatoryElements");
  })();

  const forbiddenElements = (() => {
    const fe = constraints.mustNeverAppear.value;
    if (fe !== "unknown") return psf(`FORBIDDEN: ${fe.slice(0, 200)}`, "high",
      `[brand] Forbidden elements from Campaign Plan creative constraints`);
    return unknownPsf("forbiddenElements");
  })();

  return { brandSafety, industryRestrictions, mandatoryElements, forbiddenElements };
}
