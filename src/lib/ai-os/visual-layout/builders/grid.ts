import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { GridIntelligence } from "../types";
import { lf } from "./shared";
import { getGridSpec } from "../knowledge";

// Builder 4 — Grid Intelligence
// Sole responsibility: select and describe the grid system for the layout.

export function buildGridIntelligence(strategy: CreativeStrategy, plan: CampaignPlan): GridIntelligence {
  const designStyle = plan.designDirection.overallDesignStyle.value;
  const density = strategy.creative.informationDensity.value;
  const platform = strategy.platform.primaryPlatform.value;

  const spec = getGridSpec(designStyle !== "unknown" ? designStyle : "editorial_clean");

  const gridSystem = lf(
    spec.system as GridIntelligence["gridSystem"]["value"],
    designStyle !== "unknown" ? "high" : "medium",
    `${spec.note} — system selected for design style="${designStyle}"`
  );

  const columns = lf(
    spec.columns as GridIntelligence["columns"]["value"],
    "high",
    `${spec.columns}-column layout for "${designStyle}" grid system`
  );

  const rows = (() => {
    if (platform === "outdoor") return lf("2", "high", `Outdoor billboard → maximum 2 rows (hero + CTA zone)`);
    if (density === "single_message") return lf("2", "high", `Single message density → 2-zone layout: hero and CTA`);
    if (density === "complex_infographic") return lf("5", "high", `Complex infographic → 5-row structure for all information layers`);
    return lf(spec.rows as GridIntelligence["rows"]["value"], "medium", `Row count from grid specification for "${designStyle}"`);
  })();

  const spacing = lf(
    spec.spacing as GridIntelligence["spacing"]["value"],
    "high",
    `Spacing system "${spec.spacing}" for "${designStyle}" design`
  );

  const alignment = (() => {
    if (designStyle === "luxury_minimal") return lf("centered", "high", `Luxury minimal → centered alignment projects confidence and refinement`);
    if (designStyle === "corporate_professional") return lf("left_aligned", "high", `Corporate professional → left-aligned follows Western reading convention and credibility`);
    if (platform === "instagram" || platform === "facebook") return lf("centered", "high", `Social platform → centred alignment maximises impact in feed`);
    return lf(spec.alignment as GridIntelligence["alignment"]["value"], "medium", `Default alignment from grid specification`);
  })();

  const balance = (() => {
    if (designStyle === "luxury_minimal") return lf("asymmetric_left_heavy", "medium",
      `Luxury editorial — asymmetric tension is more refined than perfect symmetry`);
    if (plan.advertisementStructure.heroSection.value === "split_visual_text") return lf("symmetrical", "high",
      `Split hero format → balanced symmetry between visual and text halves`);
    return lf("symmetrical", "medium", `Default symmetrical balance for commercial advertising`);
  })();

  const symmetry = (() => {
    if (designStyle === "luxury_minimal" || designStyle === "dramatic_cinematic") {
      return lf("asymmetric_intentional", "high", `${designStyle} → deliberate asymmetry is a design choice, not an error`);
    }
    if (plan.advertisementStructure.heroSection.value === "split_visual_text") {
      return lf("bilateral", "high", `Split format → bilateral symmetry between left and right halves`);
    }
    return lf("bilateral", "medium", `Default bilateral symmetry for balanced commercial layouts`);
  })();

  return { gridSystem, columns, rows, spacing, alignment, balance, symmetry };
}
