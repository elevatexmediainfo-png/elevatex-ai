import type { UserUnderstanding, AssetIntelligence, FieldConfidence } from "../types";
import type {
  ExperienceProfile,
  LuxuryProfile,
  CreativeMatrixResult,
  SemanticWeights,
  HeroDecision,
  HeroType,
} from "./types";
import type { getKnowledge } from "./knowledge";
import { resolveHeroGraphMeta } from "./hero-knowledge-graph";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Hero Decision Engine
// Final arbitration of the visual hero subject.
// Replaces the old industry × intent 2-key lookup with 5-signal selection:
//   Campaign + Experience + Intent + Audience + Industry
// Pure function — no I/O, deterministic.
// ─────────────────────────────────────────────────────────────────────────────

// Hero subject descriptions indexed by heroType → industryKey
// _default is the fallback when no industry-specific entry exists
const HERO_SUBJECTS: Record<HeroType, Record<string, string>> = {
  authority: {
    dental:            "Experienced dentist in full consultation — warm clinical authority in a spotless modern clinic",
    dental_clinic:     "Experienced dental specialist mid-explanation in a premium clinic — trust readable in posture and environment",
    healthcare:        "Senior physician in a clean consultation room — professional yet approachable, competence without intimidation",
    health_clinic:     "Healthcare professional in a clean clinical setting — confident, caring, and reassuring",
    general_hospital:  "Specialist doctor in a well-lit consultation space — authoritative, never cold",
    finance:           "Financial adviser at a clean, minimal desk — composed focus, quiet confidence, never aggressive",
    wealth_management: "Senior wealth manager in an understated premium environment — expertise and discretion in equal measure",
    mutual_fund:       "Composed financial professional reviewing a portfolio — confidence from knowledge, not theatrics",
    banking:           "Bank officer or relationship manager in a modern branch — helpful, professional, reliable",
    insurance:         "Insurance adviser with a warm, steady presence — protection made personal, never fear-led",
    education:         "Engaged educator actively teaching — students visibly interested, the classroom alive with ideas",
    school:            "Teacher mid-lesson with genuine energy — knowledge being actively shared, not performed",
    college_university:"Professor addressing a focused lecture room — authority of expertise, never of hierarchy",
    coaching_institute:"Expert instructor with students genuinely engaged — the transformation already underway",
    legal:             "Lawyer at a clean desk with steady, focused demeanor — authority and discretion, never theatrical",
    real_estate:       "Property consultant presenting a premium space with practiced confidence — poised, knowledgeable",
    luxury_property:   "Luxury real estate specialist in an architecturally striking space — effortless authority",
    _default:          "Authoritative professional in their natural environment — competence legible at a glance",
  },

  person: {
    restaurant:       "Genuine dining moment — friends or family mid-conversation at a beautifully set table, food as warm backdrop",
    cafe:             "Friends over artisan drinks in a warm, considered space — casual joy, no performance",
    food_beverage:    "Group sharing a meal — warmth, appetite, and easy togetherness in one frame",
    hospitality:      "Guest at peak relaxation in the property — effortless, not posed, the space doing half the work",
    hotel_resort:     "Couple or family in a resort setting at peak ease — aspirational escape made believable",
    fitness:          "Client at genuine peak effort — sweat real, form clean, energy authentic, no performance",
    retail:           "Shopper discovering something they genuinely love — joy of the find, not the transaction",
    fashion:          "Confident person in the featured look, styled for real life — editorial but not untouchable",
    beauty_wellness:  "Client in a moment of visible confidence after the service — natural and genuine, not theatrical",
    hair_salon:       "Satisfied client catching their own reflection — the quiet confidence of a result that speaks for itself",
    school:           "Students in genuine collaboration — leaning in, engaged, the energy of real learning visible",
    education:        "Young adult in a learning environment that signals opportunity and a clear next step",
    spa_wellness:     "Person in genuine relaxation — the weight visibly lifted, present, unhurried",
    skincare:         "Person with clearly healthy skin in natural light — the kind of glow that reads as earned",
    _default:         "Genuine human moment — warmth and authenticity prioritised over aesthetics",
  },

  product: {
    jewellery_luxury: "Hero jewellery piece isolated — macro lens on gemstone clarity and metal luminance, every facet a deliberate compositional decision",
    fine_jewellery:   "Signature piece lit cinematically — light dancing off the gemstone, metal glowing against controlled negative space",
    jewellery:        "Featured piece close-up on a minimal background — warmth and character without over-production",
    luxury_goods:     "Flagship product in a controlled premium environment — material quality readable in a single glance",
    automotive:       "Vehicle at a three-quarter dynamic angle — paint texture and design language readable at a glance, never a flat lot shot",
    automobile:       "Car at the angle that communicates motion and presence — cinematic light, not dealer-lot fluorescence",
    car_dealership:   "Featured vehicle with dramatic angle and lighting — the car feeling earned and aspirational",
    technology:       "Product in precise use or on a precision surface — clarity, minimalism, craft visible in every line",
    food_beverage:    "Hero dish or drink shot at serving temperature — steam if present, natural colour, texture that triggers appetite",
    restaurant:       "Signature dish close-up — food photography as art, specific and memorable",
    cafe:             "Artisan coffee or signature drink in the moment — steam, texture, the ritual made visible",
    fashion:          "Featured piece on form or styled flat — fabric quality, shape, and colour story all clear",
    retail:           "Featured product styled in its natural habitat — never white-box, shown in context",
    skincare:         "Product bottle or packshot in a clean, premium environment — quality readable through design alone",
    _default:         "Hero product shot with clear intent — quality and purpose readable without explanation",
  },

  environment: {
    real_estate:     "Wide-angle shot of the property exterior at golden hour — architectural scale, material quality, aspirational sky",
    luxury_property: "Villa or penthouse interior or exterior at peak natural light — materials, space, and light communicating lifestyle",
    residential:     "The defining space or view inside the property — quality and proportion readable without being catalogue-like",
    commercial:      "Property exterior framing its urban environment — scale, position, and investment quality communicating confidence",
    hotel_resort:    "Property exterior or signature interior at atmospheric hour — aspirational, specific, travel-worthy",
    hospitality:     "The defining space: lobby, pool, or panoramic view — unmistakably premium, effortlessly inviting",
    restaurant:      "Dining room at service hour — warm light on set tables, the space alive but not chaotic, atmosphere as invitation",
    cafe:            "The cafe interior at morning peak — warm, inviting, designed to make you want to stay",
    spa_wellness:    "Treatment room or garden space — natural light, premium materials, a composition that says slow down",
    _default:        "Environment that communicates the brand's quality and character through space, light, and material",
  },

  transformation: {
    dental:          "Split-frame smile comparison — left: pre-treatment, self-conscious; right: open, natural, confident post-result",
    dental_clinic:   "Before-and-after dental result: a realistic, believable difference — not theatrical, just genuinely better",
    beauty_wellness: "Hair or skin transformation split under matched lighting — before: flat or dull; after: vibrant, alive, and cared for",
    hair_salon:      "Split-frame hair transformation under studio lighting — same model, same angle, the difference entirely in the quality of the result",
    spa_wellness:    "Wellness arc: before — visibly stressed and guarded; after — relaxed, present, at ease with themselves",
    fitness:         "Physical transformation comparison: neutral posture before, peak form after — same angle, honest and earned",
    skincare:        "Skin result comparison with clinical clarity: before — visible concern; after — healthy, even, calm",
    healthcare:      "Patient wellbeing journey: concerned expression before, relieved and back to normal life after",
    _default:        "Clear visual comparison showing the meaningful difference the product or service makes — honest, specific, believable",
  },

  data: {
    finance:           "Compound growth curve rendered in tasteful design — clean axes, professional palette, no cliché coins or stacks",
    mutual_fund:       "SIP investment journey visualization — a timeline with milestones, readable in 3 seconds, inspiring over 10",
    banking:           "Clean financial process illustration or outcome chart — modern, clear, no jargon",
    insurance:         "Simple protection metaphor — family or asset under a clearly defined visual boundary — warmth, not fear",
    healthcare:        "Medical process or clinical outcome visualization — clean, educational, never alarming",
    health_clinic:     "Treatment outcome diagram or patient journey flow — clinical clarity, educational tone, approachable",
    education:         "Outcome data visualization — placement rates, skill growth, career paths made vivid — numbers tell the story",
    coaching_institute:"Results visualization: exam scores, ranks, and career outcomes before and after — proof over promise",
    technology:        "Product feature or comparison diagram — clean, modern, persuasive through clarity",
    _default:          "Information visualization that makes the key message readable, credible, and immediately understandable",
  },

  lifestyle: {
    automotive:       "Driver in a landscape or urban moment — open road, city skyline, or mountain pass — freedom and arrival as one feeling",
    travel_agency:    "Traveller at the exact destination moment — the specific view or instant that made the journey worth it",
    jewellery_luxury: "Featured piece worn in an aspirational social setting — the jewellery as the quiet mark of belonging",
    fashion:          "The look worn in a real-world context — confident, editorial, but recognizably lived-in",
    fitness:          "Person living their best active life — natural light, movement at its peak, energy that's earned not performed",
    hospitality:      "Guest living the lifestyle the property enables — tennis, pool, or a terrace dinner — specific and desirable",
    real_estate:      "The life the property enables — a morning on the terrace, a family in the garden, a view at dusk",
    luxury_property:  "Aspirational resident living the lifestyle — understated, never performed, the space as effortless backdrop",
    _default:         "Person living the aspirational lifestyle the brand enables — specific, desirable, and believable",
  },

  moment: {
    restaurant:    "The moment the signature dish arrives — steam, light, the instant expression of anticipation and pleasure",
    cafe:          "The first sip of morning coffee — ritual, warmth, the calm before the day",
    hospitality:   "The hotel arrival moment or the sunset from the room — emotionally specific, the kind of memory you pay to make",
    hotel_resort:  "Resort arrival: the welcome, the reveal of the space, the instant you know it was worth it",
    education:     "Graduation or achievement moment — specific, genuine joy, not a staged representation",
    food_beverage: "A shared meal at the exact moment of connection — the food as catalyst for the human scene",
    celebration:   "The genuine peak of the occasion — emotion unfiltered, the kind of moment worth capturing",
    _default:      "A specific, emotionally immediate moment that captures the best version of what the brand delivers",
  },
};

// Final safety fallbacks by hero type
const HERO_TYPE_FALLBACKS: Record<HeroType, string> = {
  authority:      "Professional in their area of expertise — trust and competence at a glance",
  person:         "Genuine human connection — warmth and authenticity over aesthetics",
  product:        "Hero product shot — quality and purpose clear at a glance",
  environment:    "Space communicating the brand's quality and character through light and material",
  transformation: "Visual comparison showing the meaningful difference this brand delivers",
  data:           "Clear information visualization that builds credibility through facts",
  lifestyle:      "Aspirational lifestyle scene that makes the viewer want to be in it",
  moment:         "Emotionally specific moment that captures the brand at its best",
};

function lookupHeroSubject(heroType: HeroType, industryKey: string): string {
  const table = HERO_SUBJECTS[heroType];
  return table[industryKey] ?? table["_default"] ?? HERO_TYPE_FALLBACKS[heroType];
}

export function resolveHeroDecision(
  uu:         UserUnderstanding,
  ai:         AssetIntelligence,
  kb:         ReturnType<typeof getKnowledge>,
  experience: ExperienceProfile,
  luxury:     LuxuryProfile,
  matrix:     CreativeMatrixResult,
  weights:    SemanticWeights,
): HeroDecision {
  void kb; // reserved for future KB-based subject enrichment

  const industryKey = uu.subIndustry.value !== "unknown"
    ? uu.subIndustry.value
    : uu.industry.value !== "unknown"
    ? uu.industry.value
    : "";

  const campaignGoal = uu.campaignGoal?.value ?? "";

  // ── Priority 1: Reference image hero subject (asset signal dominates) ──────
  if (weights.dominantSignal === "asset") {
    const refHero = (ai.reference as Record<string, unknown> | undefined)
      ?.heroSubject as { value?: string; confidence?: FieldConfidence } | undefined;
    if (refHero?.value && refHero.value !== "unknown") {
      const resolvedType = matrix.heroType;
      return {
        subject:        refHero.value,
        heroType:       resolvedType,
        primarySignals: ["reference_image"],
        confidence:     refHero.confidence ?? "high",
        reasoning:      `Reference image defines the visual hero — asset dominance (weight=${weights.assetWeight.toFixed(2)})`,
        heroGraph:      resolveHeroGraphMeta(resolvedType, industryKey, campaignGoal),
      };
    }
  }

  // ── Priority 2: Intent-based override (always-on) ─────────────────────────
  const intent = uu.intent.value;

  if (intent === "before_after") {
    const subject = lookupHeroSubject("transformation", industryKey);
    return {
      subject,
      heroType:       "transformation",
      primarySignals: ["intent=before_after"],
      confidence:     "high",
      reasoning:      `before_after intent always selects a transformation visual regardless of industry`,
      heroGraph:      resolveHeroGraphMeta("transformation", industryKey, campaignGoal),
    };
  }

  if (uu.contentType.value === "infographic") {
    const subject = lookupHeroSubject("data", industryKey);
    return {
      subject,
      heroType:       "data",
      primarySignals: ["contentType=infographic"],
      confidence:     "high",
      reasoning:      `infographic content type always selects a data/information visual`,
      heroGraph:      resolveHeroGraphMeta("data", industryKey, campaignGoal),
    };
  }

  // ── Priority 3: Creative matrix recommendation ────────────────────────────
  const heroType = matrix.heroType;
  const subject  = lookupHeroSubject(heroType, industryKey);

  // Determine whether we got a specific industry match or fell back to _default
  const typeTable    = HERO_SUBJECTS[heroType];
  const isSpecific   = industryKey !== "" && industryKey in typeTable;
  const confidence: FieldConfidence = isSpecific ? "high" : (experience.confidence === "high" ? "medium" : "low");

  const primarySignals: string[] = [];
  if (experience.primary) primarySignals.push(`experience=${experience.primary}`);
  if (industryKey) primarySignals.push(`industry=${industryKey}`);
  if (luxury.level !== "none" && luxury.level !== "low") primarySignals.push(`luxury=${luxury.level}`);
  primarySignals.push(`heroType=${heroType}`);

  const reasoning = `Hero type "${heroType}" via [experience="${experience.primary}" × cluster="${matrix.industryCluster}" × luxury="${luxury.level}"] → industry "${industryKey}" subject${isSpecific ? " (specific)" : " (generic fallback)"}`;

  return {
    subject,
    heroType,
    primarySignals,
    confidence,
    reasoning,
    heroGraph: resolveHeroGraphMeta(heroType, industryKey, campaignGoal),
  };
}
