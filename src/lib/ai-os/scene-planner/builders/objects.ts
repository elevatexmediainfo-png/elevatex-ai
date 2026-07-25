import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { ObjectPlanning } from "../types";
import { sp } from "./shared";
import { REQUIRED_OBJECTS, EXCLUDED_OBJECTS } from "../knowledge";
import type { VTEEnrichment } from "../vte-bridge";
import { vteWouldDuplicate } from "../vte-bridge";

// Builder 5 — Object Planning
// Exactly what physical objects must appear, may appear, and must never appear.
// Phase 10.5A: VTE object primitives enrich requiredObjects and optionalObjects
// only when the Campaign Plan has not specified props.

export function buildObjectPlanning(bp: UniversalCampaignBlueprint, vte?: VTEEnrichment): ObjectPlanning {
  const strategy = bp.strategy;
  const campaign = bp.campaign;
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;
  const trustReq = strategy.audience.trustRequirement.value;
  const intentKey = strategy.marketing.campaignGoal.value;

  const requiredObjects = (() => {
    const planProps = campaign.visualDirection.props.value;
    if (planProps !== "unknown") return sp(planProps, "high", `Required objects from Campaign Plan Visual Direction props`);

    // Phase 10.5A — VTE object primitive specifies WHAT the prop IS rather than
    // the category it belongs to: "a dental implant model" → "a titanium implant
    // post catching the consultation-room light beside an open treatment chart".
    const kbRequired = REQUIRED_OBJECTS[industryKey ?? ""] ?? "Environment and subject elements appropriate to the industry";
    if (vte?.hasContent && vte.object[0] && !vteWouldDuplicate(kbRequired, vte.object[0].value)) {
      return sp(
        `${kbRequired}; ${vte.object[0].value}`,
        "high",
        `Required objects: industry KB enriched with VTE object primitive for "${vte.resolvedIndustry}"`
      );
    }

    return sp(kbRequired, "medium", `Required objects from industry knowledge bank for "${industryKey}"`);
  })();

  const optionalObjects = (() => {
    const optionalMap: Record<string, string> = {
      dental:       "Optional: before/after smile comparison card, digital X-ray display, comfort amenities visible in waiting area",
      healthcare:   "Optional: patient wellness chart, health information poster, amenity elements suggesting comfort",
      food_beverage:"Optional: sommelier toolkit, chef's whites visible in background, recipe elements for hero dish",
      real_estate:  "Optional: architectural blueprint as prop, lifestyle accessories (coffee book, flowers), outdoor furniture",
      finance:      "Optional: planning notebook, premium pen, financial publication in background",
      education:    "Optional: awards or recognition displays, student project samples, technology devices in use",
    };
    const kbOptional = optionalMap[industryKey ?? ""] ?? "Optional elements that reinforce brand quality or message depth without cluttering the scene";

    // Phase 10.5A — append VTE object[1] (the second object primitive, if any) to
    // optional objects when it doesn't duplicate what required already says.
    const reqVal = requiredObjects.value;
    const vteObject1 = vte?.hasContent ? vte.object[1] : undefined;
    if (vteObject1 && !vteWouldDuplicate(reqVal, vteObject1.value) && !vteWouldDuplicate(kbOptional, vteObject1.value)) {
      return sp(
        `${kbOptional}; ${vteObject1.value}`,
        "medium",
        `Optional objects: industry KB enriched with VTE object[1] primitive for "${vte?.resolvedIndustry}"`
      );
    }

    return sp(kbOptional, "medium", `Optional objects from industry knowledge bank`);
  })();

  const decorativeObjects = (() => {
    const luxury = strategy.visual.luxuryLevel.value;
    if (luxury === "ultra_luxury" || luxury === "high") {
      return sp("Minimal decorative elements — one premium material texture (marble, brass, natural wood) only. Restraint IS the luxury", "high",
        `High luxury → minimal decorative elements; excess decoration signals middle market`);
    }
    return sp("Subtle environmental details that add visual richness: plants, natural materials, ambient light sources", "low",
      `Standard decorative elements for commercial advertising context`);
  })();

  const trustObjects = (() => {
    if (trustReq === "critical" || trustReq === "high") {
      const trustMap: Record<string, string> = {
        dental:       "Visible certification/award plaque on clinic wall (background), professional qualifications implied by environment quality",
        healthcare:   "Clinical environment quality as implicit trust signal; visible qualifications; accreditation signage if appropriate",
        finance:      "Regulatory compliance suggested by professional environment; certification present but not forced",
        education:    "Academic achievement displays, institutional recognition, award plaques in background",
      };
      const val = trustMap[industryKey ?? ""] ?? "Trust signals appropriate to the industry (certifications, environment quality, professional attire)";
      return sp(val, "high", `Trust objects required: trustRequirement="${trustReq}" demands visible credibility signals`);
    }
    return sp("Trust signals embedded in environment quality — no explicit badge placement required", "medium",
      `Trust requirement="${trustReq}" — implicit trust through quality sufficient`);
  })();

  const educationalObjects = (() => {
    const adStructure = bp.campaign.advertisementStructure;
    const archetype = bp.campaign.concept.campaignArchetype.value;

    if (intentKey === "education" || intentKey === "awareness" || archetype === "educational_explainer") {
      const eduMap: Record<string, string> = {
        dental:       "A realistic dental implant cross-section model held clearly at mid-frame height between the doctor and patient — large enough (approximately 15-20% of frame width) to read its engineering detail, positioned so both the professional and the patient can reference it naturally",
        finance:      "A digital tablet or display screen showing an upward-trending growth chart — visible in the professional's hands or on desk, tasteful and readable, not overwhelming",
        mutual_fund:  "A digital tablet or display screen showing SIP growth visualization — the professional is pointing to a specific data point, the client is engaging with it",
        healthcare:   "A health information display or anatomical model that makes the service understandable — positioned between professional and patient, visible without dominating",
        education:    "Learning materials actively in use — student's notebook open, technology on desk, works-in-progress visible on wall behind",
      };
      const val = eduMap[industryKey ?? ""];
      if (val) return sp(val, "high", `Educational explainer archetype: specific object placement for "${industryKey}" — size and position specified for AI generation`);
    }

    // Timeline section → numbered step visual objects
    const timelineFormat = adStructure.timelineSection.value;
    if (timelineFormat !== "absent" && timelineFormat !== "unknown") {
      const stepMap: Record<string, string> = {
        dental:    "Three numbered process markers visible in the lower portion: '1 Consult', '2 Plan', '3 Implant' — rendered as premium icon+label pairs",
        healthcare:"Three numbered steps rendered as premium visual elements in the creative layout",
        finance:   "Three numbered investment milestones rendered as a visual timeline element",
      };
      const val = stepMap[industryKey ?? ""] ?? "Three numbered process steps visible as visual elements in the advertisement layout";
      return sp(val, "high", `Timeline section in advertisementStructure → numbered step objects required for "${industryKey}"`);
    }

    return sp("No dedicated educational objects required — information communicated through setting and subject", "medium",
      `Non-educational campaign context — environment communicates competence implicitly`);
  })();

  const brandObjects = (() => {
    const logoPresence = bp.layout.blocks.logoBlock.value;
    if (logoPresence !== "unknown") {
      return sp(`Brand mark placeholder (shape only — never attempt to render actual logo in generation). Logo added in post-production. Position: ${logoPresence}`, "high",
        `Brand objects: logo placeholder at "${logoPresence}" position from VisualLayoutPlan`);
    }
    return sp("Brand mark placeholder in standard corner position — never render actual logo, placeholder shape only", "medium",
      `Default brand object: logo placeholder, position to be determined in post`);
  })();

  const objectsToExclude = (() => {
    const kbExcluded = EXCLUDED_OBJECTS[industryKey ?? ""] ?? "Competitor products, anything that suggests low quality or undermines brand positioning";
    return sp(kbExcluded, "high", `Objects excluded based on industry knowledge bank for "${industryKey}" — these would damage the message`);
  })();

  return { requiredObjects, optionalObjects, decorativeObjects, trustObjects, educationalObjects, brandObjects, objectsToExclude };
}
