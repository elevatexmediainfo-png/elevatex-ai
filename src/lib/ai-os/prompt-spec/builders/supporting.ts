import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { SceneGraph } from "../../scene-graph/types";
import type { SupportingElements } from "../types";
import { promoteField, psf, unknownPsf, sceneGraphJoin } from "./shared";

// Builder 3 — Supporting Elements
// Promotes ALL supporting subject and object decisions from VisualScenePlan,
// and builds the advertisementLayers field that captures the complete
// multi-layer advertisement structure for AI generation.
//
// Phase 10.4H: Previously-dead fields now activated:
//   trustObjects, educationalObjects, brandObjects → from scene.objects
//   subjectRelationships, relativeScale → from scene.supportingSubjects
//   iconElements, infographicElements → from campaign.visualDirection
//   featuresSection, statisticsSection, offerSection → from campaign.advertisementStructure
//
// Phase 10.6C: relationships prefers Scene Graph's OBJECT CONTACT graph when
// present — a physical description of what hands are doing (contactDescription
// + a supporting subject's own independent contact clause) replaces the
// abstract scene.interactionLogic sentence rather than sitting alongside it.

export function buildSupportingElements(scene: VisualScenePlan, bp: UniversalCampaignBlueprint, graph?: SceneGraph): SupportingElements {
  // Standard fields — promoted from scene plan
  const supportingSubjects = promoteField(scene.supportingSubjects.supportingSubjects, "scene.supportingSubjects");
  const relationships = (() => {
    if (graph) {
      const bits = sceneGraphJoin([graph.objectContact.contactDescription, graph.objectContact.secondaryContact]);
      if (bits.length > 0) return psf(bits.join(". "), "high", "[scene.interactionLogic] provided by Scene Graph OBJECT CONTACT — not independently regenerated");
    }
    return promoteField(scene.supportingSubjects.interactionLogic, "scene.interactionLogic");
  })();
  const requiredObjects    = promoteField(scene.objects.requiredObjects,                "scene.objects.required");
  const optionalObjects    = promoteField(scene.objects.optionalObjects,                "scene.objects.optional");
  const decorativeElements = promoteField(scene.objects.decorativeObjects,             "scene.objects.decorative");

  // Phase 10.4H — previously-dead scene.supportingSubjects fields
  const subjectRelationships = (() => {
    const rel = scene.supportingSubjects.subjectRelationships.value;
    if (rel !== "unknown") return promoteField(scene.supportingSubjects.subjectRelationships, "scene.subjectRelationships");
    return undefined;
  })();

  const relativeScale = (() => {
    const rs = scene.supportingSubjects.relativeScale.value;
    if (rs !== "unknown") return promoteField(scene.supportingSubjects.relativeScale, "scene.relativeScale");
    return undefined;
  })();

  // Phase 10.4H — previously-dead scene.objects trust/educational/brand fields
  const trustObjects = (() => {
    const t = scene.objects.trustObjects.value;
    if (t !== "unknown") return promoteField(scene.objects.trustObjects, "scene.objects.trust");
    return undefined;
  })();

  const educationalObjects = (() => {
    const e = scene.objects.educationalObjects.value;
    if (e !== "unknown") return promoteField(scene.objects.educationalObjects, "scene.objects.educational");
    return undefined;
  })();

  const brandObjects = (() => {
    const b = scene.objects.brandObjects.value;
    if (b !== "unknown") return promoteField(scene.objects.brandObjects, "scene.objects.brand");
    return undefined;
  })();

  // Phase 10.4H — previously-dead campaign.visualDirection icon/infographic fields
  const iconElements = (() => {
    const icons = bp.campaign.visualDirection.icons.value;
    if (icons !== "unknown") return psf(icons.slice(0, 150), bp.campaign.visualDirection.icons.confidence,
      `Icon elements from Creative Director visual direction`);
    return undefined;
  })();

  const infographicElements = (() => {
    const infos = bp.campaign.visualDirection.infographics.value;
    if (infos !== "unknown") return psf(infos.slice(0, 150), bp.campaign.visualDirection.infographics.confidence,
      `Infographic elements from Creative Director visual direction`);
    return undefined;
  })();

  // Phase 10.4H — previously-dead advertisementStructure fields
  const featuresSection = (() => {
    const fs = bp.campaign.advertisementStructure.featuresSection.value;
    if (fs !== "absent" && fs !== "unknown") {
      const desc = fs === "feature_grid"
        ? "Feature grid: multiple product/service features displayed in a structured grid layout"
        : fs === "specification_list"
        ? "Specification list: key specifications in a clean vertical list format"
        : "Icon-label feature pairs: each feature shown with a paired icon and short label";
      return psf(desc, bp.campaign.advertisementStructure.featuresSection.confidence,
        `Features section format "${fs}" from Campaign Plan AdvertisementStructure`);
    }
    return undefined;
  })();

  const statisticsSection = (() => {
    const ss = bp.campaign.advertisementStructure.statisticsSection.value;
    if (ss !== "absent" && ss !== "unknown") {
      const desc = ss === "key_metric_callout"
        ? "Key metric callout: one large, bold statistic displayed prominently"
        : ss === "percentage_highlight"
        ? "Percentage highlight: key percentage statistic in a visually distinct format"
        : "Growth chart: data visualization showing upward trend";
      return psf(desc, bp.campaign.advertisementStructure.statisticsSection.confidence,
        `Statistics section format "${ss}" from Campaign Plan AdvertisementStructure`);
    }
    return undefined;
  })();

  const offerSection = (() => {
    const os = bp.campaign.advertisementStructure.offerSection.value;
    if (os !== "absent" && os !== "unknown") {
      const desc = os === "discount_badge"
        ? "Discount badge: a bold, high-contrast badge showing the discount or offer prominently"
        : os === "event_details"
        ? "Event details panel: date, time, and venue displayed in a structured format"
        : os === "limited_time_banner"
        ? "Limited-time banner: urgency-signalling banner with offer expiry"
        : "Package card: a structured card showing package contents and price";
      return psf(desc, bp.campaign.advertisementStructure.offerSection.confidence,
        `Offer section format "${os}" from Campaign Plan AdvertisementStructure`);
    }
    return undefined;
  })();

  // advertisementLayers — translates AdvertisementStructure into a complete
  // spatial description of all advertisement zones for AI generation
  const advertisementLayers = (() => {
    const adStructure = bp.campaign.advertisementStructure;
    const archetype = bp.campaign.concept.campaignArchetype.value;
    const industryKey = bp.strategy.business.subIndustry.value !== "unknown"
      ? bp.strategy.business.subIndustry.value
      : bp.strategy.business.industry.value;
    const campaignGoal = bp.strategy.marketing.campaignGoal.value;

    const layers: string[] = [];

    // Layer 1: Hero zone description (upper portion)
    const heroFormat = adStructure.heroSection.value;
    if (heroFormat !== "unknown") {
      const heroZone = heroFormat === "transformation_split"
        ? `UPPER ZONE (top 60%): Split-frame transformation — left half shows the before state, right half shows the after state with a clean vertical divider`
        : heroFormat === "product_hero"
        ? `UPPER ZONE (top 65%): Hero product shot — product centered or on the rule-of-thirds intersection, extreme detail visible, premium lighting`
        : heroFormat === "headline_dominant"
        ? `UPPER ZONE (top 50%): Strong visual image with headline text area preserved above — clear reading hierarchy top to bottom`
        : `UPPER ZONE (top 60%): ${archetype === "educational_explainer" ? "Doctor/expert demonstrating to patient — both figures visible, educational interaction mid-frame" : "Hero lifestyle scene — subject fills the upper portion naturally"}`;
      layers.push(heroZone);
    }

    // Layer 2: Benefits strip (lower third)
    const benefitFormat = adStructure.benefitsSection.value;
    if (benefitFormat !== "absent" && benefitFormat !== "unknown") {
      if (benefitFormat === "three_column_icons") {
        const benefitContent = {
          dental:       "① Painless Procedure  ② Permanent Results  ③ Expert Care",
          healthcare:   "① Expert Doctors  ② Advanced Facilities  ③ Compassionate Care",
          finance:      "① Low Monthly Investment  ② High Returns  ③ SEBI Regulated",
          mutual_fund:  "① Start at ₹500/month  ② Power of Compounding  ③ Expert Management",
          education:    "① Experienced Faculty  ② High Placement Rate  ③ Modern Campus",
          real_estate:  "① Prime Location  ② World-class Amenities  ③ Ready Possession",
          beauty_wellness:"① Certified Stylists  ② Premium Products  ③ Guaranteed Results",
        }[industryKey ?? ""] ?? "① Quality  ② Value  ③ Trust";
        layers.push(`LOWER ZONE — BENEFITS STRIP: Three equal-width columns each with a premium icon and a short label. The three benefits are: ${benefitContent}. Subtle separator lines between columns. Clean, uncluttered typography area`);
      } else if (benefitFormat === "horizontal_strip") {
        layers.push(`LOWER ZONE — BENEFIT BAR: A horizontal benefits strip with 3 key points evenly spaced, each with a small icon. Clear, legible layout`);
      } else if (benefitFormat === "single_dominant_benefit") {
        layers.push(`LOWER ZONE — KEY BENEFIT: One bold benefit statement or number prominently visible (e.g. '10,000+ successful treatments' or 'Starting at ₹499')`);
      }
    }

    // Layer 3: Trust badge
    const trustFormat = adStructure.trustSection.value as string;
    if (trustFormat !== "absent" && trustFormat !== "unknown") {
      const trustPosMap: Record<string, string> = {
        certification_badges: `TRUST ELEMENT (upper-right corner): Certification or accreditation badge — small, clearly legible, high contrast. Examples for ${industryKey}: ${industryKey === "dental" || industryKey === "dental_clinic" ? "'IDA Certified' or '15+ Years Experience'" : industryKey === "finance" || industryKey === "mutual_fund" ? "'SEBI Registered' or 'AMFI Certified'" : "'Accredited' or 'Certified Excellence'"}`,
        years_of_experience: `TRUST ELEMENT (upper area): Years-in-business indicator — e.g. '15 Years of Trusted Excellence' rendered as a small but prominent credential element`,
        awards: `TRUST ELEMENT: Award or recognition badge visible in the upper portion — academic or industry recognition mark`,
        patient_count: `TRUST ELEMENT: Patient/customer count indicator — '10,000+ satisfied patients' or '50,000+ happy customers' displayed prominently`,
        partnership_logos: `TRUST ELEMENT: Partner or affiliation logos visible — certification or partnership marks in a small horizontal strip`,
      };
      const trustPos = trustPosMap[trustFormat] ?? `TRUST ELEMENT: Credential or badge visible in the upper corner`;
      layers.push(trustPos);
    }

    // Layer 4: Process/Timeline steps
    const timelineFormat = adStructure.timelineSection.value;
    if (timelineFormat !== "absent" && timelineFormat !== "unknown") {
      const stepContent = {
        dental:      "Step 1: Free Consultation  →  Step 2: Custom Plan  →  Step 3: Painless Procedure",
        healthcare:  "Step 1: Book Appointment  →  Step 2: Expert Diagnosis  →  Step 3: Treatment",
        finance:     "Step 1: Set Your Goal  →  Step 2: Choose SIP Amount  →  Step 3: Start Growing",
      }[industryKey ?? ""] ?? "Step 1: Enquire  →  Step 2: Consult  →  Step 3: Begin";
      layers.push(`PROCESS STEPS (mid-lower zone): Three numbered process indicators with connecting arrows: ${stepContent}. Numbered circles (①②③) with short descriptive labels. Premium, clear visual treatment`);
    }

    // Layer 5: Social proof
    const proofFormat = adStructure.socialProofSection.value;
    if (proofFormat !== "absent" && proofFormat !== "unknown") {
      if (proofFormat === "before_after_pair") {
        layers.push(`SOCIAL PROOF: Before/after transformation pair — compact visual evidence of results`);
      } else if (proofFormat === "quote_with_photo") {
        layers.push(`SOCIAL PROOF ELEMENT: Small patient/customer photo with a short testimonial quote — e.g. "Life-changing experience — Dr. Mehta's team made me feel at ease throughout." — positioned in a corner or lower area, visually subordinate to the hero`);
      } else if (proofFormat === "outcome_statistic") {
        layers.push(`SOCIAL PROOF: Key outcome statistic prominently styled — e.g. '10,000+ Successful Treatments' or '₹1L grew to ₹3.2L in 5 years'`);
      }
    }

    // Layer 6: CTA zone
    const ctaFormat = adStructure.ctaSection.value as string;
    if (ctaFormat !== "absent" && ctaFormat !== "unknown") {
      const ctaDesc = ctaFormat === "phone_plus_button"
        ? `CTA ZONE (bottom): Strong CTA button (e.g. 'Book Free Consultation') PLUS a phone number displayed prominently beside it. High-contrast button design, phone number in large readable type`
        : ctaFormat === "single_button"
        ? `CTA ZONE (bottom): Single strong CTA button with clear action text (e.g. 'Get Started', 'Invest Now', 'Book Today'). High-contrast against the background`
        : `CTA ZONE (bottom): Action-oriented CTA element with clear next step`;
      layers.push(ctaDesc);
    }

    // Final narrative assembly
    if (layers.length === 0) return unknownPsf("advertisementLayers");

    const archName = archetype !== "unknown" ? `[${archetype.replace(/_/g, " ").toUpperCase()} ADVERTISEMENT]` : "[ADVERTISEMENT]";
    const narrative = `${archName} — ${campaignGoal !== "unknown" ? `${campaignGoal.replace(/_/g, " ")} campaign` : "marketing creative"}. Complete visual zone structure:\n\n${layers.join("\n\n")}`;

    return psf(narrative, "high",
      `Advertisement layers built from AdvertisementStructure (${layers.length} zones: ${[(benefitFormat as string) !== "absent" ? "benefits" : "", trustFormat !== "absent" ? "trust" : "", (timelineFormat as string) !== "absent" ? "timeline" : "", (proofFormat as string) !== "absent" ? "proof" : "", ctaFormat !== "absent" ? "cta" : ""].filter(Boolean).join(", ")})`);
  })();

  return {
    supportingSubjects,
    relationships,
    ...(subjectRelationships ? { subjectRelationships } : {}),
    ...(relativeScale        ? { relativeScale }        : {}),
    requiredObjects,
    optionalObjects,
    decorativeElements,
    ...(trustObjects         ? { trustObjects }         : {}),
    ...(educationalObjects   ? { educationalObjects }   : {}),
    ...(brandObjects         ? { brandObjects }         : {}),
    ...(iconElements         ? { iconElements }         : {}),
    ...(infographicElements  ? { infographicElements }  : {}),
    ...(featuresSection      ? { featuresSection }      : {}),
    ...(statisticsSection    ? { statisticsSection }    : {}),
    ...(offerSection         ? { offerSection }         : {}),
    advertisementLayers,
  };
}
