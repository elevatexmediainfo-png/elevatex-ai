// Phase 10.3C/10.3D — Scene Builder + Dynamic Visual Variety Engine
//
// Transforms GPTCampaignDirection into a SceneBlueprint that adds the missing
// cinematic layer: industry-specific physical context, meaningful background
// activity, and a dynamically-selected composition variant.
//
// Phase 10.3D rules:
//   1. Same industry ≠ same composition — variation through Blueprint signals.
//   2. Variation signals: Campaign Goal, Buyer Stage, Story Flow, Hero Type,
//      Luxury, Photography Style, Commercial Style, Emotion.
//   3. 6 layout families per hero type — 36 total composition variants.
//   4. Background activity chosen from an expanded pool (6–9 per industry).
//   5. Layout and background selections are INDEPENDENT (different hash seeds).
//   6. Same input → same output (deterministic). Only Blueprint signals drive variation.
//   7. Background is NEVER "blurred background" — always a meaningful visual activity.

import type { GPTCampaignDirection } from "../creative-director/gpt-types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SceneIndustry =
  | "restaurant" | "dental"   | "salon"     | "jewellery" | "hospital"
  | "interior"   | "real-estate" | "furniture" | "school"    | "retail"
  | "generic";

export type SceneHeroType =
  | "moment" | "authority" | "product" | "transformation" | "environment" | "emotion";

export type LayoutFamily =
  | "editorial" | "lifestyle" | "magazine-cover" | "luxury-poster" | "event-coverage"
  | "product-focus" | "environmental" | "documentary" | "minimal" | "cinematic";

interface CompositionVariant {
  layoutFamily:    LayoutFamily;
  /** Brief format/style note appended to the SCENE block (1 short sentence). */
  sceneModifier:   string;
  /** Full composition directive inserted into the CAMERA block. */
  promptDirective: string;
}

export interface SceneBlueprint {
  industry:           SceneIndustry;
  heroType:           SceneHeroType;
  /** Selected layout family — changes per variation key. */
  layoutFamily:       LayoutFamily;
  /** Deterministic hash of the variation signals — useful for debugging/testing. */
  variationKey:       number;
  /** "SCENE" block — industry template + composition format hint. */
  sceneContext:       string;
  /** "BACKGROUND ACTIVITY" block — meaningful mid/background visual from an expanded pool. */
  backgroundActivity: string;
  /** "CAMERA" block composition directive — specific to the selected variant. */
  framingHint:        string;
}

// ─── Composition variant library ─────────────────────────────────────────────
// 6 variants per hero type (6 × 6 = 36 total).
// Variation key % 6 selects which one — deterministically.
// Each variant uses a different layout family: no two in the same type share one.

const COMPOSITION_VARIANTS: Record<SceneHeroType, CompositionVariant[]> = {
  moment: [
    {
      layoutFamily:    "cinematic",
      sceneModifier:   "Cinematic 2.39:1.",
      promptDirective: "Cinematic 2.39:1. Action at centre-left, environment breathing right. Eye-level on the decisive moment. Filmic depth of field.",
    },
    {
      layoutFamily:    "documentary",
      sceneModifier:   "Documentary, 3:2 reportage.",
      promptDirective: "Documentary 3:2. Subject caught mid-action. Candid framing, natural available light. Nothing posed.",
    },
    {
      layoutFamily:    "editorial",
      sceneModifier:   "Editorial, 3:2 landscape.",
      promptDirective: "Editorial 3:2. Subject at left rule-of-thirds. Eye-level, controlled lighting. Right third open for headline.",
    },
    {
      layoutFamily:    "product-focus",
      sceneModifier:   "Product focus, 1:1 overhead.",
      promptDirective: "Product focus 1:1. 45° overhead. Hands and object dominate the frame. Surface texture and detail prominent.",
    },
    {
      layoutFamily:    "luxury-poster",
      sceneModifier:   "Luxury poster, 4:5 portrait.",
      promptDirective: "Luxury poster 4:5. Slight low angle lifts the hero. Dark rich tones, edge-lit action. Drama in every shadow.",
    },
    {
      layoutFamily:    "lifestyle",
      sceneModifier:   "Lifestyle, 4:5 ambient.",
      promptDirective: "Lifestyle 4:5. Natural, warm, candid. Hero integrated in environment. Ambient light, human-first composition.",
    },
  ],

  authority: [
    {
      layoutFamily:    "magazine-cover",
      sceneModifier:   "Magazine cover, 2:3 portrait.",
      promptDirective: "Magazine cover 2:3. Subject centred, direct eye contact. Confident, clean, bold typography space at top.",
    },
    {
      layoutFamily:    "editorial",
      sceneModifier:   "Editorial, 3:2 landscape.",
      promptDirective: "Editorial 3:2. Subject at left third, 3/4 turn. Professional environment visible right. Natural authority.",
    },
    {
      layoutFamily:    "environmental",
      sceneModifier:   "Environmental portrait, 16:9.",
      promptDirective: "Environmental 16:9. Subject at left third, professional setting tells the right two-thirds. Establishing authority.",
    },
    {
      layoutFamily:    "documentary",
      sceneModifier:   "Documentary, candid 3:2.",
      promptDirective: "Documentary 3:2. Caught mid-work. Unposed authenticity. Available light. Professional in their element.",
    },
    {
      layoutFamily:    "luxury-poster",
      sceneModifier:   "Luxury poster, 4:5 commanding.",
      promptDirective: "Luxury poster 4:5. Slightly low camera, commanding presence. Dark luxury aesthetic, controlled single source.",
    },
    {
      layoutFamily:    "minimal",
      sceneModifier:   "Minimal, generous negative space.",
      promptDirective: "Minimal 4:5. Subject with significant breathing room. Clean ground. Confident, precise, nothing competing.",
    },
  ],

  product: [
    {
      layoutFamily:    "product-focus",
      sceneModifier:   "Product focus, 1:1 studio.",
      promptDirective: "Product focus 1:1. Product fills 70% of frame. Flat-on controlled studio light. Surface texture reads clearly.",
    },
    {
      layoutFamily:    "luxury-poster",
      sceneModifier:   "Luxury poster, 4:5 dark.",
      promptDirective: "Luxury poster 4:5. Product on dark surface. 45° elevated camera. Edge-lit, dramatic shadow depth.",
    },
    {
      layoutFamily:    "lifestyle",
      sceneModifier:   "Lifestyle, 4:5 context.",
      promptDirective: "Lifestyle 4:5. Product as hero, warm lifestyle context at frame edges. Ambient, aspirational, desirable.",
    },
    {
      layoutFamily:    "editorial",
      sceneModifier:   "Editorial, 3:2 thirds.",
      promptDirective: "Editorial 3:2. Product at left rule-of-thirds. Controlled light. Right third typography-open.",
    },
    {
      layoutFamily:    "minimal",
      sceneModifier:   "Minimal, 1:1 clean.",
      promptDirective: "Minimal 1:1. Product isolated with maximum breathing room. High-key or dark minimal treatment. Nothing distracts.",
    },
    {
      layoutFamily:    "cinematic",
      sceneModifier:   "Cinematic 2.39:1, heroic.",
      promptDirective: "Cinematic 2.39:1. Product in heroic foreground. Scene context and depth behind. Filmic colour grade.",
    },
  ],

  environment: [
    {
      layoutFamily:    "environmental",
      sceneModifier:   "Environmental, 16:9 wide.",
      promptDirective: "Environmental 16:9. Full space in frame. Human occupies left third if present. Room is the protagonist.",
    },
    {
      layoutFamily:    "cinematic",
      sceneModifier:   "Cinematic 2.39:1, depth layers.",
      promptDirective: "Cinematic 2.39:1. Anamorphic low wide. Three depth layers active: foreground detail, mid activity, background vista.",
    },
    {
      layoutFamily:    "editorial",
      sceneModifier:   "Editorial, 3:2 perspective.",
      promptDirective: "Editorial 3:2. Architectural perspective, leading lines draw the eye deep into the space. Controlled ambient.",
    },
    {
      layoutFamily:    "lifestyle",
      sceneModifier:   "Lifestyle, 4:5 corner view.",
      promptDirective: "Lifestyle 4:5. Corner composition — two walls create depth. Natural light, aspirational warmth throughout.",
    },
    {
      layoutFamily:    "minimal",
      sceneModifier:   "Minimal, 1:1 space portrait.",
      promptDirective: "Minimal 1:1. Space is the only subject. Clean lines, flat composition. Nothing competes.",
    },
    {
      layoutFamily:    "documentary",
      sceneModifier:   "Documentary, 3:2 elevated view.",
      promptDirective: "Documentary 3:2. Elevated perspective over the space. Human activity at scale below. Available light only.",
    },
  ],

  transformation: [
    {
      layoutFamily:    "editorial",
      sceneModifier:   "Editorial split, 3:2.",
      promptDirective: "Editorial 3:2 split. Before state left, after state right. Equal weight, clear visual contrast between states.",
    },
    {
      layoutFamily:    "magazine-cover",
      sceneModifier:   "Magazine cover, 2:3 after-state.",
      promptDirective: "Magazine cover 2:3. After-state only, triumphant. Transformation fully implied by confidence and presence.",
    },
    {
      layoutFamily:    "cinematic",
      sceneModifier:   "Cinematic 2.39:1, diagonal arc.",
      promptDirective: "Cinematic 2.39:1. Diagonal journey: before state lower-left, after state upper-right. Filmic narrative arc.",
    },
    {
      layoutFamily:    "documentary",
      sceneModifier:   "Documentary, 3:2 inflection.",
      promptDirective: "Documentary 3:2. Subject at the exact inflection point of change. Face or body tells both states at once.",
    },
    {
      layoutFamily:    "lifestyle",
      sceneModifier:   "Lifestyle, 4:5 after-state.",
      promptDirective: "Lifestyle 4:5. Fully in the after state. Warm, aspirational. The viewer imagines themselves there.",
    },
    {
      layoutFamily:    "minimal",
      sceneModifier:   "Minimal, 1:1 single detail.",
      promptDirective: "Minimal 1:1. A single detail that contains the entire transformation story. Before and after in one frame.",
    },
  ],

  emotion: [
    {
      layoutFamily:    "lifestyle",
      sceneModifier:   "Lifestyle, 4:5 portrait.",
      promptDirective: "Lifestyle 4:5. Face and expression dominant. Emotion must read at a glance. Warm, human, deeply intimate.",
    },
    {
      layoutFamily:    "environmental",
      sceneModifier:   "Environmental, 16:9 figure-scale.",
      promptDirective: "Environmental 16:9. Small human figure in large environment. Scale creates emotional weight and resonance.",
    },
    {
      layoutFamily:    "documentary",
      sceneModifier:   "Documentary, 3:2 unguarded.",
      promptDirective: "Documentary 3:2. Unguarded, authentic. Emotion caught in the moment, never staged, never performed.",
    },
    {
      layoutFamily:    "magazine-cover",
      sceneModifier:   "Magazine cover, 2:3 emotion.",
      promptDirective: "Magazine cover 2:3. Direct gaze. Emotion is the entire message. Nothing competes with the feeling.",
    },
    {
      layoutFamily:    "editorial",
      sceneModifier:   "Editorial, 3:2 in-context.",
      promptDirective: "Editorial 3:2. Subject at left third, emotional context fills right two-thirds. Controlled, purposeful.",
    },
    {
      layoutFamily:    "minimal",
      sceneModifier:   "Minimal, 1:1 quiet emotion.",
      promptDirective: "Minimal 1:1. Subject and space. Quiet, considered emotion. Generous breathing room around feeling.",
    },
  ],
};

// ─── Background activity pools ────────────────────────────────────────────────
// Flat arrays — variety key selects deterministically (independently of layout).
// Rule: NEVER "blurred background" or "bokeh only". Always specific, meaningful
// visual activity that would be photographically visible.
// Each pool has 6-9 entries to ensure variety within the same industry.

const BACKGROUND_ACTIVITY_POOLS: Record<SceneIndustry, string[]> = {
  restaurant: [
    "Guests at adjacent candlelit tables in warm conversation; a server moving gracefully between them.",
    "Sommelier presenting a wine selection at a nearby table; muted service choreography throughout the dining room.",
    "Open kitchen visible through the pass — guests glimpse chef teamwork and fire at the main counter.",
    "Window seats with city view; silhouetted diners against golden evening light outside.",
    "Private dining room through a low-lit archway; intimate candlelight and occasion energy beyond.",
    "A server carrying a platter overhead through the dining room — white gloves, candlelight, precise motion.",
    "Tables being dressed for the evening service; guests begin arriving at the entrance.",
    "Guests at the bar as a bartender crafts cocktails at the dramatic backlit station.",
    "Guests arriving at the maître d' station — coats taken, menus presented, evening energy building.",
  ],

  dental: [
    "Reception desk with a welcoming coordinator visible through the doorway; plants and natural light.",
    "Dental assistant preparing instruments at the adjacent station; clinical overhead light.",
    "Patients relaxed in the waiting area; natural light, warm textures, unhurried pace.",
    "A tray of instruments arranged with precision; sterile order communicating expertise and care.",
    "Dental nurse greeting a patient at the consultation bay entrance; professional and warm.",
    "X-ray lightbox glowing in the background — clinical authority subtly present.",
  ],

  salon: [
    "Stylists at adjacent stations with focused precision; mirrors creating layered warm reflections.",
    "Colour application in progress at a nearby station; foils catching the warm overhead light.",
    "Assistants washing hair at basins in the background; gentle, attentive care visible.",
    "A client relaxing under the dryer with a magazine; warm lamp light in the mid-ground.",
    "Colour-mixing station in background — bowls, brushes, professional preparation in motion.",
    "Mirror reflections multiplying the busy salon floor; vibrant, expert energy throughout.",
  ],

  jewellery: [
    "Illuminated display cases casting prismatic light across velvet trays; gem reflections multiply.",
    "A consultant presenting a piece with white-gloved precision at an adjacent velvet display.",
    "Seated couple being served at a velvet counter; intimacy and trust in the mid-ground.",
    "Velvet trays arranged with deliberate luxury; light pooling on metal and stone.",
    "An assistant preparing a gift box at the velvet display counter — ritual, occasion, care.",
    "The entire boutique floor as quiet theatre — cases, light, reflection, and desire.",
  ],

  hospital: [
    "Medical staff moving purposefully in the corridor behind; organised equipment, confident light.",
    "A nurse at a modern workstation; clinical bay arranged with order and precision.",
    "A reception team at a modern check-in counter — calm, professional, welcoming.",
    "Doctors' workstation with screens and case files — organised, expert, accountable.",
    "Paramedical team preparing an adjacent room — precision and calm professionalism.",
    "Clean clinical corridor with focused staff and overhead lighting communicating excellence.",
  ],

  interior: [
    "Natural light streaming through floor-to-ceiling windows; plants adding life and texture.",
    "A curated bookshelf creating depth and personality in the background.",
    "Soft curtain movement from an open window; life, air, and inhabitation suggested.",
    "A reading nook visible beyond — soft lamp, comfortable chair, considered objects.",
    "Open-plan space leading to another room; layers of thoughtfully designed environment.",
    "Lifestyle vignette at the periphery — books, a plant, a lamp, warmth throughout.",
  ],

  "real-estate": [
    "Open balcony with city skyline; morning sunlight tracing across polished open-plan floors.",
    "Floor-to-ceiling windows framing the city; life and possibility through the glass.",
    "Family life glimpsed through the floor-to-ceiling windows — books, a bicycle, city below.",
    "Morning light flooding the open-plan floor; city view through the windows, coffee brewing.",
    "Second bedroom glimpsed through a doorway framing the city skyline beyond the window.",
    "Rooftop terrace visible through sliding balcony doors; city sunlight, outdoor aspiration.",
  ],

  furniture: [
    "Complementary pieces at the frame periphery; texture and material variety in a layered still life.",
    "Lifestyle vignette completing the scene — books, plant, lamp on a side table.",
    "A styled corner beyond — floor lamp, rug, cushions in a complementary palette.",
    "Material samples visible at edges — fabric swatches, wood grains, considered choices.",
    "The full room beyond the hero piece; a coherent, considered design story.",
    "Soft natural light grazing furniture grain; lifestyle objects adding warmth and scale.",
  ],

  school: [
    "Students in engaged discussion at adjacent desks; colourful project work displayed on walls.",
    "A group activity at a background table — collaboration, focus, energy.",
    "Students presenting at the whiteboard; class attentive, hands ready to contribute.",
    "A science experiment in progress at the back — curiosity, discovery, wonder.",
    "Library shelves and student work visible — knowledge, aspiration, community.",
    "Small group coaching at a side table; organised materials and bright natural light.",
  ],

  retail: [
    "Curated product display creating visual rhythm behind; brand identity confident in the background.",
    "A styled mannequin wearing the complementary collection in the background.",
    "Engaged shoppers at adjacent displays; store lighting spotlighting product stories.",
    "Window display visible behind — aspirational, light-filled, inviting.",
    "Team members at point-of-sale in background — efficient, brand-consistent.",
    "Stock shelves as backdrop — organisation and abundance communicating brand strength.",
  ],

  generic: [
    "Colleagues or team activity in the background — purposeful, professional, trust-building.",
    "Brand environment visible behind — considered design, confident identity.",
    "Professional activity communicating competence and care in the background.",
  ],
};

// ─── Industry detection ───────────────────────────────────────────────────────

const INDUSTRY_KEYWORDS: Record<Exclude<SceneIndustry, "generic">, string[]> = {
  restaurant:    ["restaurant", "dining", "chef", "culinary", "kitchen", "cuisine", "bistro", "cafe", "food", "menu", "waiter", "sommelier", "reservation", "dish", "plate", "gastro"],
  dental:        ["dental", "dentist", "teeth", "oral", "consultation", "implant", "orthodon", "hygien", "smile care", "jaw"],
  salon:         ["salon", "hair salon", "beauty salon", "stylist", "hairdress", "barber", "colour treatment", "blowdry", "hair colour", "hair care"],
  jewellery:     ["jewellery", "jewelry", "jewel", "ring", "necklace", "diamond", "gemstone", "boutique", "bracelet", "earring", "pendant", "platinum"],
  hospital:      ["hospital", "medical facility", "surgeon", "surgery", "ward", "physician", "specialist", "healthcare facility", "nursing", "medical centre"],
  interior:      ["interior design", "home decor", "living space", "renovation", "home design", "interior architect", "home staging", "space design", "interiors studio"],
  "real-estate": ["real estate", "property", "apartment", "villa", "condo", "residential", "home buying", "sqft", "developer", "realty", "property listing"],
  furniture:     ["furniture", "sofa", "settee", "wardrobe", "home furnishing", "modular kitchen", "dining set", "bedroom set", "upholstery"],
  school:        ["school", "education", "classroom", "student", "teacher", "learning", "university", "college", "academy", "tuition", "institute"],
  retail:        ["retail", "fashion store", "clothing", "apparel", "merchandise", "shopping mall", "brand store", "fashion brand", "garment"],
};

function detectIndustry(dir: GPTCampaignDirection): SceneIndustry {
  const probe = [
    dir.environment,
    dir.commercialStyle,
    dir.marketingObjective,
    dir.campaignConcept,
    dir.heroSubject,
    dir.sceneDescription,
  ].filter(Boolean).join(" ").toLowerCase();

  let best: Exclude<SceneIndustry, "generic"> | null = null;
  let bestScore = 0;

  for (const [ind, keywords] of Object.entries(INDUSTRY_KEYWORDS) as [Exclude<SceneIndustry, "generic">, string[]][]) {
    const score = keywords.reduce((n, kw) => n + (probe.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = ind; }
  }

  return best ?? "generic";
}

// ─── Hero type detection ──────────────────────────────────────────────────────

const MOMENT_VERBS    = new Set(["places", "pours", "cuts", "lifts", "arranges", "applies", "completes", "threads", "finishes", "sculpts", "garnishes", "hands", "passes", "seals", "ties", "fastens", "presents", "sets", "lays", "wraps"]);
const SPACE_NOUNS     = new Set(["room", "apartment", "villa", "home", "space", "interior", "lobby", "corridor", "hall", "garden", "terrace", "balcony", "suite", "studio", "lounge"]);
const PRODUCT_SIGNALS = new Set(["dish", "ring", "necklace", "bracelet", "gemstone", "sofa", "chair", "table", "piece", "bottle", "product", "item", "object", "jewel"]);
const PERSON_TITLES   = /\b(chef|dentist|doctor|nurse|surgeon|stylist|teacher|architect|designer|consultant|advisor|trainer|professional|manager|director|couple|family|woman|man|person|coach|instructor)\b/i;
const EMOTION_SIGNALS = /\b(feeling|emotion|relief|joy|happiness|love|confidence|pride|warmth|wonder|gratitude)\b/i;

function detectHeroType(dir: GPTCampaignDirection): SceneHeroType {
  const hero     = (dir.heroSubject         ?? "").toLowerCase();
  const moment   = (dir.visualStory?.moment ?? "").toLowerCase();
  const combined = `${hero} ${moment}`;

  // TRANSFORMATION — hero subject shows explicit before/after contrast
  // Standalone "before"/"after"/"result" are too generic — require a compound signal.
  if (/\b(before\s+and\s+after|transform(?:ed|ation)?|comparison|whitening|makeover|reveal)\b/.test(hero)) {
    return "transformation";
  }

  // ENVIRONMENT — the hero IS a space
  const heroTokens = hero.replace(/[^a-z ]/g, " ").split(/\s+/).filter(w => w.length > 2);
  if (heroTokens.some(w => SPACE_NOUNS.has(w))) return "environment";

  // EMOTION — hero is an abstract emotional concept (no person, no product, no action)
  if (
    !PERSON_TITLES.test(hero) &&
    !heroTokens.some(w => PRODUCT_SIGNALS.has(w)) &&
    EMOTION_SIGNALS.test(hero)
  ) {
    return "emotion";
  }

  // PRODUCT — hero is an object, no person present
  if (!PERSON_TITLES.test(hero) && Array.from(PRODUCT_SIGNALS).some(w => hero.includes(w))) {
    return "product";
  }

  // MOMENT — decisive action verb in the hero description or visual moment
  if (Array.from(MOMENT_VERBS).some(v => new RegExp(`\\b${v}\\b`, "i").test(combined))) {
    return "moment";
  }

  // Default → AUTHORITY (professional person in a context of expertise)
  return "authority";
}

// ─── Scene context templates ──────────────────────────────────────────────────

const SCENE_TEMPLATES: Record<SceneIndustry, string> = {
  restaurant:    "Fine-dining restaurant interior, warm ambient lighting. Active evening service.",
  dental:        "Contemporary dental consultation room, calm and private. Morning patient appointment.",
  salon:         "Professional hair and beauty salon. Active styling floor, warm station lighting.",
  jewellery:     "Luxury jewellery boutique, illuminated display cases. Private client consultation.",
  hospital:      "Modern medical facility, clean and purposeful. Active clinical care environment.",
  interior:      "Contemporary residential living space, natural light. Aspirational home lifestyle.",
  "real-estate": "Aspirational residential property, open-plan living. Property viewing setting.",
  furniture:     "Furniture showroom, curated lifestyle arrangement. Warm directional lighting.",
  school:        "Modern learning environment, bright natural light. Active student session.",
  retail:        "Branded retail space, curated product display. Active shopping floor.",
  generic:       "Professional commercial setting. Premium brand environment.",
};

// ─── Hash function + variation key ───────────────────────────────────────────
// djb2-xor: fast, well-distributed 32-bit deterministic hash.
// Using bit-shift form (h << 5 + h = h * 33) to avoid Math.imul dependency.

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  }
  return h < 0 ? -h : h;
}

/** Deterministic variation key derived from the campaign's allowed-to-vary signals. */
function computeVariationKey(dir: GPTCampaignDirection): number {
  const probe = [
    dir.viewerEmotion       ?? "",
    dir.marketingObjective  ?? "",
    dir.commercialStyle     ?? "",
    dir.visualStory?.moment ?? "",
    dir.psychologicalGoal   ?? "",
    dir.campaignConcept     ?? "",
  ].join("||").toLowerCase();
  return djb2(probe);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Derive the cinematic scene blueprint from a GPTCampaignDirection.
 *  Pure, synchronous, deterministic — same input always produces same output. */
export function buildSceneBlueprint(dir: GPTCampaignDirection): SceneBlueprint {
  const industry = detectIndustry(dir);
  const heroType = detectHeroType(dir);
  const varKey   = computeVariationKey(dir);

  // Layout/composition variant — selected by variation key
  const variants = COMPOSITION_VARIANTS[heroType];
  const variant  = variants[varKey % variants.length] ?? variants[0]!;

  // Background activity — independent selection from expanded pool
  const bgPool     = BACKGROUND_ACTIVITY_POOLS[industry];
  const bgKey      = djb2(String(varKey));
  const bgActivity = bgPool[bgKey % bgPool.length] ?? bgPool[0]!;

  return {
    industry,
    heroType,
    layoutFamily:       variant.layoutFamily,
    variationKey:       varKey,
    sceneContext:       `${SCENE_TEMPLATES[industry]} ${variant.sceneModifier}`.trimEnd(),
    backgroundActivity: bgActivity,
    framingHint:        variant.promptDirective,
  };
}
