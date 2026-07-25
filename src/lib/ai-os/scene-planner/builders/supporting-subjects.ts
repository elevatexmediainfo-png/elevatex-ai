import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { SupportingSubjectPlanning } from "../types";
import { sp, unknownSp } from "./shared";
import type { VTEEnrichment } from "../vte-bridge";
import { vteWouldDuplicate } from "../vte-bridge";

// Builder 3 — Supporting Subject Planning
// What else is in the scene, how does it relate to the hero, and what
// advertisement layers appear alongside the hero composition?
//
// CRITICAL: This builder now reads blueprint.campaign.advertisementStructure
// to translate the AdvertisementStructure decisions into concrete visual
// placement instructions. This closes the "orphaned ad structure" gap.

// ─────────────────────────────────────────────────────────────────────────────
// Advertisement section → visual placement descriptions
// ─────────────────────────────────────────────────────────────────────────────

const BENEFIT_DESCRIPTIONS: Record<string, string> = {
  dental:           "Benefit 1: Permanent natural-looking results | Benefit 2: Painless procedure | Benefit 3: Same-day consultation",
  dental_clinic:    "Benefit 1: Permanent natural-looking results | Benefit 2: Painless procedure | Benefit 3: Same-day consultation",
  healthcare:       "Benefit 1: Expert medical team | Benefit 2: Advanced equipment | Benefit 3: Compassionate care",
  finance:          "Benefit 1: Start with as low as ₹500/month | Benefit 2: 15%+ annual returns | Benefit 3: SEBI regulated",
  mutual_fund:      "Benefit 1: Start with as low as ₹500/month | Benefit 2: Power of compounding | Benefit 3: Expert fund management",
  education:        "Benefit 1: Industry-experienced faculty | Benefit 2: 95% placement rate | Benefit 3: Modern campus",
  real_estate:      "Benefit 1: Prime location | Benefit 2: World-class amenities | Benefit 3: Ready possession",
  beauty_wellness:  "Benefit 1: Premium products | Benefit 2: Expert stylists | Benefit 3: Guaranteed results",
  food_beverage:    "Benefit 1: Farm-fresh ingredients | Benefit 2: Chef-crafted recipes | Benefit 3: Dine-in or delivery",
  automotive:       "Benefit 1: Advanced safety features | Benefit 2: Fuel efficiency | Benefit 3: 5-year warranty",
};

const TRUST_VISUAL: Record<string, string> = {
  dental:           "certification badge (e.g. 'IDA Certified') positioned in the upper-right corner, small but clearly legible",
  dental_clinic:    "certification badge visible in upper-right; '10+ years experience' or patient count indicator",
  healthcare:       "accreditation badge ('NABH Accredited' or similar) in upper corner; doctor credentials beneath the professional",
  finance:          "SEBI registration badge, star rating badge, or '₹X Crore AUM' credential in upper-right corner",
  education:        "accreditation badge, NAAC grade badge, or 'Ranked #1 in...' badge visible near the top",
  real_estate:      "RERA registration badge, project awards, or developer credentials in corner",
  beauty_wellness:  "'Certified Professionals' badge, brand partnership logos, or years-in-business indicator",
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  dental:           "Step 1: Free consultation | Step 2: Custom treatment plan | Step 3: Painless implant procedure",
  dental_clinic:    "Step 1: Free consultation | Step 2: Custom treatment plan | Step 3: Painless procedure & recovery",
  healthcare:       "Step 1: Book appointment | Step 2: Expert diagnosis | Step 3: Personalised treatment",
  finance:          "Step 1: Set your goal | Step 2: Choose your SIP amount | Step 3: Watch your money grow",
  education:        "Step 1: Apply online | Step 2: Attend interview | Step 3: Begin your journey",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper — translate advertisementStructure.benefitsSection to a visual instruction
// ─────────────────────────────────────────────────────────────────────────────

function buildBenefitLayerDescription(industryKey: string, benefitsSectionFormat: string): string {
  const benefits = BENEFIT_DESCRIPTIONS[industryKey] ?? "Benefit 1: Quality | Benefit 2: Value | Benefit 3: Trust";
  if (benefitsSectionFormat === "three_column_icons") {
    return `Three distinct benefit elements arranged horizontally in the lower section of the image — each with a premium icon above and a short label below. ${benefits}. Visual treatment: minimal line icons, premium typography, subtle separator lines between columns`;
  }
  if (benefitsSectionFormat === "horizontal_strip") {
    return `A horizontal strip of 3–4 key benefits across the lower portion of the image. ${benefits}. Clean, evenly-spaced layout`;
  }
  if (benefitsSectionFormat === "single_dominant_benefit") {
    return `One bold benefit statement prominently visible. Primary benefit: ${benefits.split("|")[0].trim()}`;
  }
  return "";
}

function buildTrustLayerDescription(industryKey: string, trustSectionFormat: string): string {
  const trustVisual = TRUST_VISUAL[industryKey] ?? "trust badge visible in upper-right corner";
  if (trustSectionFormat === "certification_badges") {
    return `Trust credential element: ${trustVisual}. The badge must be clearly visible as a foreground element, not buried in the background`;
  }
  if (trustSectionFormat === "years_of_experience") {
    return `Experience indicator visible: '15+ Years of Excellence' or similar years-in-service badge prominently placed`;
  }
  if (trustSectionFormat === "awards") {
    return `Award or recognition badge visible: academic accreditation or industry recognition mark in the upper portion`;
  }
  return "";
}

function buildTimelineLayerDescription(industryKey: string): string {
  const steps = STEP_DESCRIPTIONS[industryKey] ?? "Step 1: Enquire | Step 2: Consult | Step 3: Begin";
  return `Numbered process steps visible in the mid-to-lower section: ${steps}. Visual treatment: numbered circles (1, 2, 3) with connecting line, each step clearly labelled`;
}

function buildSocialProofDescription(industryKey: string, proofFormat: string): string {
  if (proofFormat === "quote_with_photo") {
    return `Testimonial element: a small patient/customer photo with a short quote visible in the creative (e.g. a satisfied dental patient quote). Not the main hero — a supporting proof element`;
  }
  if (proofFormat === "before_after_pair") {
    return `Before/after comparison element visible — showing the transformation result`;
  }
  if (proofFormat === "outcome_statistic") {
    return `Key outcome statistic visible: e.g. '₹1 Lakh grew to ₹3.2 Lakh in 5 years' or '10,000+ satisfied patients'`;
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildSupportingSubjectPlanning(bp: UniversalCampaignBlueprint, vte?: VTEEnrichment): SupportingSubjectPlanning {
  const strategy = bp.strategy;
  const campaign = bp.campaign;
  const adStructure = campaign.advertisementStructure;
  const humanPresence = strategy.visual.humanPresence.value;
  const productPriority = strategy.visual.productPriority.value;
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;

  // Base supporting subjects — the human/subject-level context
  const baseSupportingSubjects = (() => {
    const brainSupports = campaign.visualDirection.supportingElements.value;
    if (brainSupports !== "unknown") return brainSupports;
    const industrySupports: Record<string, string> = {
      dental:           "Dental implant model or diagram (educational prop), trust badge if credibility campaign, soft background clinical equipment",
      healthcare:       "Healthcare professional in clean attire, subtle medical equipment as background, welcoming clinic details",
      food_beverage:    "Complementary garnish or beverage, premium tableware, ambient restaurant lighting and atmosphere",
      real_estate:      "Architectural details, manicured landscaping, lifestyle props",
      finance:          "Clean lifestyle elements: premium coffee cup, tasteful plant, simple desk items",
      education:        "Learning materials, student work, classroom technology",
      beauty_wellness:  "Premium styling products as props, professional tools in background",
      jewellery_luxury: "Premium display surface texture, minimal lifestyle accent",
    };
    const kbSupports = industrySupports[industryKey ?? ""] ?? "Environmental context elements that reinforce quality and brand positioning";

    // Phase 10.5A — VTE person primitive turns a generic type description into a
    // specific human presence: "professional in clean attire" becomes "A specialist
    // who places a gentle hand on the patient's shoulder while reviewing digital X-rays".
    if (vte?.hasContent && vte.person[0] && !vteWouldDuplicate(kbSupports, vte.person[0].value)) {
      return `${kbSupports}; ${vte.person[0].value}`;
    }

    return kbSupports;
  })();

  // Build advertisement layer descriptions from advertisementStructure
  const adLayerParts: string[] = [];

  const benefitsFormat = adStructure.benefitsSection.value;
  if (benefitsFormat !== "absent" && benefitsFormat !== "unknown") {
    const benefitDesc = buildBenefitLayerDescription(industryKey ?? "", benefitsFormat);
    if (benefitDesc) adLayerParts.push(benefitDesc);
  }

  const trustFormat = adStructure.trustSection.value;
  if (trustFormat !== "absent" && trustFormat !== "unknown") {
    const trustDesc = buildTrustLayerDescription(industryKey ?? "", trustFormat);
    if (trustDesc) adLayerParts.push(trustDesc);
  }

  const timelineFormat = adStructure.timelineSection.value;
  if (timelineFormat !== "absent" && timelineFormat !== "unknown") {
    const timelineDesc = buildTimelineLayerDescription(industryKey ?? "");
    if (timelineDesc) adLayerParts.push(timelineDesc);
  }

  const proofFormat = adStructure.socialProofSection.value;
  if (proofFormat !== "absent" && proofFormat !== "unknown") {
    const proofDesc = buildSocialProofDescription(industryKey ?? "", proofFormat);
    if (proofDesc) adLayerParts.push(proofDesc);
  }

  // Combine base supporting subjects with advertisement layer descriptions
  const adLayersText = adLayerParts.length > 0
    ? `\n\nADVERTISEMENT LAYERS: ${adLayerParts.join(". \n")}`
    : "";

  const supportingSubjects = sp(
    `${baseSupportingSubjects}${adLayersText}`,
    adLayerParts.length > 0 ? "high" : "medium",
    adLayerParts.length > 0
      ? `Supporting subjects from visual direction plus ${adLayerParts.length} advertisement layer(s) from AdvertisementStructure`
      : `Supporting subjects from Campaign Plan Visual Direction`
  );

  // Subject relationships
  const subjectRelationships = (() => {
    if (humanPresence === "none" && productPriority === "hero") return sp("product_in_use", "high", `No human, product hero → contextual product presentation`);
    if (humanPresence === "hero" && productPriority === "supporting") return sp("direct_interaction", "high", `Human hero with supporting product → human and product in natural interaction`);
    if (humanPresence === "incidental") return sp("contextual_background", "high", `Incidental human presence → environmental background only`);
    if (strategy.creative.focusPriority.value === "transformation") return sp("parallel_presence", "high", `Transformation focus → before and after states in parallel`);
    return sp("direct_interaction", "medium", `Default: subjects in natural, meaningful interaction that tells the story`);
  })();

  // Interaction logic — narrative relationship description, not a flat list
  const interactionLogic = (() => {
    const archetype = campaign.concept.campaignArchetype.value;
    if (archetype === "educational_explainer") {
      return sp(
        `The doctor/expert is actively explaining or demonstrating to the patient/audience — not posing. ` +
        `The patient is engaged, leaning forward slightly, looking at the educational material being shown. ` +
        `The implant model or educational prop is held at mid-frame height, clearly visible between them. ` +
        `This creates a triangle of visual energy: expert → demonstration object → patient reaction`,
        "high",
        `Educational explainer archetype → specific interaction logic: expert demonstrates, audience learns`
      );
    }
    if (archetype === "trust_authority") {
      return sp(
        `Professional projects calm authority — posture is confident, expression is reassuring, not salesy. ` +
        `Any patient or supporting subject expresses trust and comfort, not anxiety. ` +
        `The environment reinforces expertise through clean, modern, premium clinical context`,
        "high",
        `Trust authority archetype → professional credibility interaction logic`
      );
    }
    if (archetype === "transformation_story") {
      return sp(`No interaction between the two states — they exist in separate but equal zones of the frame, separated by a clean dividing element`, "high",
        `Transformation focus → parallel states with clear visual separation`);
    }
    const focusPriority = strategy.creative.focusPriority.value;
    if (focusPriority === "product") {
      return sp("The product exists in pristine isolation — any human elements serve only to contextualise its scale and desirability", "high", `Product focus → product-primary`);
    }
    if (humanPresence === "hero") {
      return sp("Human subject relates naturally to any product or environmental elements — the relationship reads as genuine, not staged", "medium", `Human hero → natural relationship`);
    }
    return unknownSp("interactionLogic");
  })();

  // Relative scale
  const relativeScale = (() => {
    const focusPriority = strategy.creative.focusPriority.value;
    if (focusPriority === "product" || humanPresence === "none") return sp("product_hero_human_secondary", "high", `Product focus → product fills the frame`);
    if (focusPriority === "transformation") return sp("same_scale", "high", `Transformation → both states at equal scale for fair comparison`);
    if (humanPresence === "hero") return sp("hero_twice_as_large", "medium", `Human hero → person dominates the scale`);
    return sp("hero_dominant_others_small", "medium", `Default: hero dominates, supporting elements subordinate`);
  })();

  return { supportingSubjects, subjectRelationships, interactionLogic, relativeScale };
}
