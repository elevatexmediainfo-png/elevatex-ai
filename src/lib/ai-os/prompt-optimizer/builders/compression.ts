import type { PromptSpecification } from "../../prompt-spec/types";
import { compress } from "./shared";

// Builder 2 — Semantic Compression
// Removes verbosity while preserving meaning. Returns a compressed copy of
// the PromptSpecification and the count of fields that were shortened.
//
// Phase 10.4K.4 — Importance-weighted compression budgets.
// Budget tiers reflect semantic value, not arbitrary character limits:
//   STORY  500–600  Complete zone/layer structures — must not be truncated heavily
//   XL     300–400  Primary visual directives — hero description, executive brief
//   L      200–250  Key narrative fields — marketing message, trust, conversion
//   M      100–200  Supporting narrative — context, relationships, details
//   S       60–100  Focused descriptors — composition principle, camera specs
//   ENUM    40–60   Enum-constrained values — already short by design

const SECTION_BUDGETS: Record<string, Record<string, number>> = {
  mission: {
    whatToGenerate:         300,  // XL:  executive brief — full generation directive
    whyItMatters:           150,  // M:   marketing purpose in one clear reason
    primarySuccessCriteria: 200,  // L:   three measurable success criteria
    nonNegotiableElement:   120,  // M:   single must-be-right element
    campaignTheme:          150,  // M:   creative theme tying campaign together
    storyNarrative:         200,  // L:   decisive narrative moment
  },
  hero: {
    heroSubject:            350,  // XL:  identity, pose, action, expression — most important field
    heroImportance:          40,  // ENUM: absolute_mandatory / primary_anchor / strong_supporting
    heroPosition:            60,  // S:   frame position
    heroScale:               50,  // S:   frame dominance
    heroDetails:            200,  // L:   pose, expression, texture, micro-details (was 100)
  },
  supporting: {
    supportingSubjects:     200,  // L:   full supporting cast description
    relationships:          150,  // M:   spatial + narrative relationships (was 80 — too tight)
    subjectRelationships:   150,  // M:   how subjects relate to the hero
    relativeScale:           80,  // S:   supporting vs hero visual weight
    requiredObjects:        200,  // L:   must-appear physical objects
    optionalObjects:        100,  // M:   enrichment objects
    decorativeElements:      80,  // S:   visual quality elements
    trustObjects:           200,  // L:   credentials, certifications — high semantic value
    educationalObjects:     150,  // M:   explanatory objects
    brandObjects:           150,  // M:   brand identity objects
    iconElements:            80,  // S:   icon elements if applicable
    infographicElements:    150,  // M:   data visualisation elements
    featuresSection:        200,  // L:   product/service feature display
    statisticsSection:      150,  // M:   key statistics to show visually
    offerSection:           150,  // M:   promotional offer treatment
    advertisementLayers:    600,  // STORY: complete zone architecture — was default 200 (70% lost, Phase 10.4K.4)
  },
  composition: {
    primaryComposition:      80,  // S:   governing compositional principle
    secondaryComposition:    80,  // S:   secondary compositional device
    visualBalance:           80,  // S:   mass distribution across frame
    symmetry:                60,  // S:   symmetry or deliberate asymmetry treatment
    negativeSpace:           80,  // S:   role of empty space
    eyeFlow:                 80,  // S:   intended eye movement direction
    foreground:             100,  // M:   near depth plane
    midground:              100,  // M:   mid depth plane (usually the hero)
    background:             100,  // M:   far depth plane
    depthTreatment:         100,  // M:   depth of field across layers
  },
  camera: {
    cameraPosition:          80,  // S:   position in space relative to subject
    cameraHeight:            40,  // ENUM: vertical height
    viewingAngle:            40,  // ENUM: angle from which subject is viewed
    lensIntent:              80,  // S:   lens character and optical treatment
    distance:                40,  // ENUM: conceptual camera–subject distance
    perspectiveIntent:      150,  // M:   what the perspective communicates
  },
  lighting: {
    primaryLighting:        200,  // L:   key light — direction, quality, emotion (was 150)
    secondaryLighting:      150,  // M:   fill / accent light
    moodLighting:            80,  // S:   overall lighting mood (was 40 — too tight)
    shadowStyle:             60,  // S:   shadow character
    reflectionStyle:         80,  // S:   surface reflection treatment
    cameraMood:             100,  // M:   photographic mood and camera feel
  },
  environment: {
    environmentType:         60,  // S:   physical environment type
    storyContext:           200,  // L:   what environment communicates before text
    premiumDetails:         200,  // L:   quality and brand credibility details
  },
  marketing: {
    campaignGoal:            80,  // S:   marketing objective
    emotionalGoal:          100,  // M:   primary emotion to create
    marketingGoal:          250,  // L:   specific marketing message (was 150)
    targetAudience:         120,  // M:   primary target audience
    trustStrategy:          150,  // M:   how to build credibility
    conversionIntent:       150,  // M:   compelled action (was 100)
    experienceEmotionalCore:    150,  // M:   exact emotion directive — preserve verbatim
    experienceVisualImplication:200,  // L:   visual evocation — first-class directive
    experienceType:          80,  // S:   experience category
    coreMessage:            150,  // M:   single most important campaign message
    customerPromise:        150,  // M:   brand promise to the customer
    valueProposition:       200,  // L:   why choose this over alternatives
    urgencySignal:           80,  // S:   time pressure / call-to-action urgency
    visualTone:             100,  // M:   communication register
    audiencePainPoints:     150,  // M:   audience frustrations to address emotionally
    audienceDesires:        150,  // M:   desire state the image should activate
    uniqueSellingPoint:     150,  // M:   unique selling proposition
    attentionStrategy:      150,  // M:   scroll-stop attention mechanism
    supportingMessages:     200,  // L:   secondary messages reinforcing primary story
    emotionalDriver:        150,  // M:   core psychological purchase driver
  },
  typography: {
    reservedHeadlineArea:   120,  // M:   headline zone placement and size
    reservedBodyArea:       100,  // M:   body copy zone
    reservedCtaArea:        100,  // M:   CTA zone
    reservedLogoArea:        80,  // S:   logo exclusion zone
    reservedDisclaimerArea:  80,  // S:   disclaimer zone
    platformTextSafetyNote: 120,  // M:   platform-specific placement note
  },
  brandRules: {
    brandSafety:            100,  // M:   safety level required
    industryRestrictions:   200,  // L:   legal and ethical restrictions
    mandatoryElements:      200,  // L:   must-appear elements
    forbiddenElements:      200,  // L:   must-never-appear elements
  },
  negativeConstraints: {
    forbiddenSceneElements: 200,  // L:   scene elements to exclude
    forbiddenAiArtifacts:   200,  // L:   AI generation artifacts to prevent
    qualityAntiPatterns:    150,  // M:   technical quality failures (was 100)
    brandAntiPatterns:      150,  // M:   brand-undermining elements (was 100)
  },
  rendering: {
    photorealismLevel:       40,  // ENUM: hyperrealistic / photorealistic / etc.
    commercialQuality:       50,  // ENUM: regional_commercial / national_commercial / etc.
    editorialQuality:        50,  // ENUM: trade_editorial / consumer_magazine / etc.
    luxuryLevel:             40,  // ENUM: utility_functional / premium_polished / etc.
    realismTarget:           50,  // ENUM: premium_stock_photo / commercial_campaign / etc.
    artifactPrevention:     250,  // L:   specific AI artifacts to actively prevent (was 150)
    overallDesignStyle:     150,  // M:   editorial / commercial / minimal / premium
    visualArchetype:        100,  // M:   visual archetype pattern
  },
};

export function buildCompressedSpec(spec: PromptSpecification): { compressed: PromptSpecification; fieldsCompressed: number } {
  let fieldsCompressed = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function compressSection(section: any, sectionKey: string): any {
    const budgets = SECTION_BUDGETS[sectionKey] ?? {};
    const result = { ...section };
    for (const [key, field] of Object.entries(result)) {
      if (field && typeof field === "object" && "value" in field && typeof (field as Record<string,unknown>).value === "string" && (field as Record<string,unknown>).value !== "unknown") {
        const budget = budgets[key] ?? 200;
        const currentValue = (field as { value: string }).value;
        const compressedValue = compress(currentValue, budget);
        if (compressedValue !== currentValue) {
          fieldsCompressed++;
          result[key] = { ...field, value: compressedValue };
        }
      }
    }
    return result;
  }

  const compressed: PromptSpecification = {
    meta:                spec.meta,
    mission:             compressSection(spec.mission,             "mission"),
    hero:                compressSection(spec.hero,                "hero"),
    supporting:          compressSection(spec.supporting,          "supporting"),
    composition:         compressSection(spec.composition,         "composition"),
    camera:              compressSection(spec.camera,              "camera"),
    lighting:            compressSection(spec.lighting,            "lighting"),
    environment:         compressSection(spec.environment,         "environment"),
    marketing:           compressSection(spec.marketing,           "marketing"),
    typography:          compressSection(spec.typography,          "typography"),
    brandRules:          compressSection(spec.brandRules,          "brandRules"),
    negativeConstraints: compressSection(spec.negativeConstraints, "negativeConstraints"),
    rendering:           compressSection(spec.rendering,           "rendering"),
    unknownFields:       spec.unknownFields,
    // Phase 5.1 — GPT narrative is not a StrategyField structure; pass through as-is.
    gptNarrative:        spec.gptNarrative,
    // Phase 10.4J — Advertisement narrative is plain strings, not StrategyFields; pass through as-is.
    advertisementNarrative: spec.advertisementNarrative,
  };

  return { compressed, fieldsCompressed };
}
