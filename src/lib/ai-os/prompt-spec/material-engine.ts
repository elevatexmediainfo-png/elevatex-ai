// Phase 10.4B — Material Intelligence Engine
//
// Provides physically accurate, brand-tier-matched material descriptions based
// on industry context. Injected as a SURFACE MATERIALS block in the provider
// prompt so image models render believable surfaces — not generic props.
//
// Rules:
//   1. Materials are derived from industry context — never invented.
//   2. Mass-market brands receive everyday manufactured materials.
//   3. Luxury / premium brands receive hand-finished, natural materials.
//   4. Medical / clinical industries have tier-independent core materials
//      (safety requirements override luxury aesthetics).
//   5. No industry-specific logic inside gpt-narrative.ts.

import type { SceneIndustry } from "./scene-builder";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";

// ─── Tier ─────────────────────────────────────────────────────────────────────

export type MaterialTier = "luxury" | "mid" | "mass";

// Probe: commercialStyle + campaignConcept + marketingObjective + environment.
// Together these carry the strongest brand-tier signal in the Direction.

const LUXURY_RE = /\b(luxury|luxur(?:y|ious)|premium|bespoke|haute|flagship|high-end|exclusive|artisan|handcraft(?:ed)?|boutique|fine[\s-]dining|ultra[\s-]premium|couture|prestige)\b/i;
const MASS_RE   = /\b(budget|affordable|everyday|value[\s-]for[\s-]money|discount|chain|mass[\s-]market|economy|low[\s-]cost|bargain|wholesale)\b/i;

export function detectMaterialTier(dir: GPTCampaignDirection): MaterialTier {
  const probe = [
    dir.commercialStyle    ?? "",
    dir.campaignConcept    ?? "",
    dir.marketingObjective ?? "",
    dir.environment        ?? "",
  ].join(" ");
  if (LUXURY_RE.test(probe)) return "luxury";
  if (MASS_RE.test(probe))   return "mass";
  return "mid";
}

// ─── Material table ───────────────────────────────────────────────────────────
// Each entry is a semicolon-separated list of physically specific material
// descriptors — short, observable, no marketing language.

const MATERIALS: Record<SceneIndustry, Record<MaterialTier, string>> = {
  restaurant: {
    luxury: "Solid walnut table top, visible end grain; hand-glazed ceramic plate, artisan rim; brushed brass cutlery, tactile weight; linen napkin, open woven texture; crystal glass, light dispersion at rim.",
    mid:    "Polished hardwood table; white porcelain plate, smooth glaze; stainless steel cutlery; pressed cotton napkin; clear glass tumbler, thick base.",
    mass:   "Laminate wood-effect table; standard glazed ceramic plate; stainless steel cutlery set; cotton napkin; tempered glass tumbler.",
  },
  dental: {
    luxury: "Medical-grade stainless steel instruments, mirror finish; matte ceramic implant display model; frosted glass partition panels; white composite surfaces; ergonomic chair, neutral textile upholstery.",
    mid:    "Stainless steel instrument tray; white ceramic surfaces; clear acrylic dividers; moulded plastic chair; laminate desk surface.",
    mass:   "Stainless steel tray; white composite walls; vinyl chair upholstery; plastic fittings; standard laminate surfaces.",
  },
  salon: {
    luxury: "Brushed chrome styling chair, genuine leather seat cushion; marble-effect acrylic basin; backlit vanity mirror, brushed gold frame; glass product shelf; large-format ceramic floor tile.",
    mid:    "Chrome styling chair, faux-leather seat; white ceramic basin; polished steel mirror frame; glass shelving unit; porcelain floor tile.",
    mass:   "Chrome chair, vinyl seat; plastic basin; frameless mirror; melamine shelf; linoleum floor.",
  },
  jewellery: {
    luxury: "18K polished gold surface, visible material grain; diamond facet, prismatic light dispersion; black velvet presentation tray, nap texture; mirror-polished borosilicate display case; brushed platinum mount.",
    mid:    "Sterling silver surface, brushed finish; cubic zirconia facet, clear dispersion; cream velvet tray insert; tempered glass display case; polished chrome stand.",
    mass:   "Gold-plated alloy surface; synthetic stone accent; foam-lined display tray; acrylic display case; metal wire stand.",
  },
  hospital: {
    luxury: "Medical-grade stainless steel, brushed finish; anti-microbial matte white composite; frosted glass partition; sealed epoxy resin floor; brushed aluminium trim on fixtures.",
    mid:    "Stainless steel equipment surfaces; painted composite walls; clear acrylic panels; vinyl floor; chrome-plated fittings.",
    mass:   "Stainless steel surfaces; white painted composite; clear partitions; standard vinyl floor; chrome fixtures.",
  },
  interior: {
    luxury: "Italian marble flooring, visible vein structure; natural oak veneer wall panel, open grain; floor-to-ceiling float glass; brushed aluminium window frame; woven wool upholstery panel.",
    mid:    "Engineered hardwood flooring; painted MDF wall panel; standard double-glazed unit; powder-coated steel frame; polyester-blend upholstery.",
    mass:   "Laminate flooring, wood-effect print; painted plasterboard; standard double-glazed window; PVC-coated steel frame; synthetic woven fabric.",
  },
  "real-estate": {
    luxury: "Italian marble flooring, book-matched vein; natural oak veneer cabinetry, open grain; floor-to-ceiling structural glass; brushed aluminium window frame; honed stone countertop.",
    mid:    "Engineered hardwood floor; oak veneer cabinetry; large-format double glazing; powder-coated steel window frame; quartz countertop.",
    mass:   "Laminate flooring; melamine cabinetry; standard double-glazed window; PVC window frame; laminate countertop.",
  },
  furniture: {
    luxury: "Solid teak frame, hand-oiled grain; natural full-grain leather upholstery, visible hide texture; hand-turned solid brass leg; woven wool fabric panel, tight weave structure.",
    mid:    "Solid pine or oak frame, stained finish; bonded leather seat cushion; powder-coated steel leg; cotton-blend upholstery fabric.",
    mass:   "Engineered wood frame; PU-coated synthetic fabric; chrome-plated steel leg; polyester-blend seat fabric.",
  },
  school: {
    luxury: "Solid beech desk surface; powder-coated tubular steel frame; acoustic fabric wall panel; rubber-backed carpet tile; tempered glass whiteboard.",
    mid:    "Laminate desk surface, beech effect; steel tube frame; foam-backed fabric wall panel; standard carpet tile; standard whiteboard.",
    mass:   "MDF desk, melamine finish; steel tube frame; painted plasterboard; vinyl floor; standard whiteboard surface.",
  },
  retail: {
    luxury: "Honed concrete display plinth; brushed steel fixture rail; backlit glass shelf; waxed cotton canvas accent element; matte ceramic floor tile.",
    mid:    "Painted MDF display unit; chrome wire fixture rail; tempered glass shelf; printed cotton display element; porcelain floor tile.",
    mass:   "Melamine shelving unit; chrome wire rack; acrylic shelf divider; polypropylene packaging element; standard vinyl floor.",
  },
  generic: {
    luxury: "Natural material surfaces, visible grain and texture; hand-finished details, natural imperfections; accurate specular response on surfaces.",
    mid:    "Standard professional material surfaces, clean finish; accurate material light response.",
    mass:   "Standard manufactured surfaces, consistent finish; everyday material response to light.",
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Return industry-and-tier-specific physical material descriptions. */
export function getMaterialDescriptions(
  industry: SceneIndustry,
  tier: MaterialTier,
): string {
  return MATERIALS[industry][tier];
}
