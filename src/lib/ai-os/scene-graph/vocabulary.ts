import type { SceneIndustry } from "../prompt-spec/scene-builder";
import type { MaterialTier } from "../prompt-spec/material-engine";

// Phase 10.6B — Combinatorial vocabulary banks.
//
// Every array below holds short, independent PHRASE FRAGMENTS (1-4 words) —
// never a complete pre-written sentence. No single entry is ever emitted
// alone: every builder always combines an entry from here with entries from
// at least two or three OTHER independent axes (see seed.ts's axisSeed) plus
// live campaign data before producing a sentence. This is the structural
// difference from prompt-spec/material-engine.ts and prompt-spec/scene-builder.ts,
// which each select ONE pre-written full sentence per (industry × tier) or
// (heroType × variationKey) cell — a lookup table, however large. The
// combinatorial product of the axes below (verbs × objects × spatial targets
// × finishes × materials × ...) is several orders of magnitude larger than
// any single-axis lookup table this pipeline has built so far, and grows
// combinatorially with each additional axis rather than requiring a new cell
// to be hand-written for every new combination.

// ─────────────────────────────────────────────────────────────────────────────
// OBJECT CONTACT — verbs, by the audit's exact nine-term vocabulary
// ─────────────────────────────────────────────────────────────────────────────

export type ContactVerb = "holding" | "touching" | "picking" | "pouring" | "writing" | "opening" | "closing" | "serving" | "operating";

export const CONTACT_VERB_SYNONYMS: Record<ContactVerb, readonly string[]> = {
  holding:  ["steadies", "cradles", "holds", "grips", "supports"],
  touching: ["brushes against", "rests a hand on", "traces a finger along", "makes contact with"],
  picking:  ["lifts", "picks up", "raises", "selects"],
  pouring:  ["pours", "tips", "decants", "streams"],
  writing:  ["marks", "notes on", "signs", "records on"],
  opening:  ["opens", "parts", "draws back", "unlatches"],
  closing:  ["closes", "seals", "draws shut", "latches"],
  serving:  ["presents", "offers", "sets down", "delivers"],
  operating:["adjusts", "guides", "operates", "controls", "positions"],
};

export const HAND_SIDES = ["left hand", "right hand"] as const;

export const SPATIAL_TARGETS = [
  "toward the surface", "over the counter", "above the table", "toward the camera",
  "across the frame", "into the light", "against the edge", "over the workspace",
] as const;

// Fallback contact-object nouns when the scene plan carries no concrete object text.
export const CONTACT_OBJECT_FALLBACK: Record<SceneIndustry, readonly string[]> = {
  restaurant:    ["ceramic plate", "wine glass", "tweezers", "serving tray", "chef's knife", "linen napkin"],
  dental:        ["dental instrument", "patient chart", "intraoral scanner", "ceramic model", "consultation tablet"],
  salon:         ["styling brush", "colour bowl", "mirror handle", "scissors", "hairdryer"],
  jewellery:     ["velvet tray", "loupe", "polishing cloth", "display case lid", "gemstone tweezers"],
  hospital:      ["clipboard", "stethoscope", "instrument tray", "patient file", "monitor screen"],
  interior:      ["fabric swatch", "paint sample", "throw cushion", "drawer handle", "lamp switch"],
  "real-estate": ["door handle", "window latch", "key set", "floor plan", "balcony rail"],
  furniture:     ["upholstery sample", "wood sample", "drawer handle", "cushion", "assembly tool"],
  school:        ["notebook", "whiteboard marker", "tablet", "project model", "pencil"],
  retail:        ["garment", "price tag", "shopping bag", "product box", "hanger"],
  generic:       ["document", "tool", "product sample", "device"],
};

// ─────────────────────────────────────────────────────────────────────────────
// BODY — natural-language rendering per enum value (selection stays in the builder)
// ─────────────────────────────────────────────────────────────────────────────

export const HEAD_DIRECTION_PHRASE: Record<string, string> = {
  toward_camera:       "head turned toward the camera",
  toward_companion:    "head turned toward the person beside them",
  toward_object:       "head angled down toward what the hands hold",
  down:                "head tilted down",
  away_from_camera:    "head turned away from the camera",
  three_quarter_turn:  "head at a three-quarter turn",
};

export const EYE_DIRECTION_PHRASE: Record<string, string> = {
  direct_gaze:            "eyes meeting the camera directly",
  toward_companion:       "eyes on the person beside them",
  toward_object_in_hand:  "eyes fixed on the object in hand",
  downcast:               "eyes lowered",
  toward_middle_distance: "eyes settled on the middle distance",
};

export const SHOULDER_ANGLE_PHRASE: Record<string, string> = {
  square_to_camera:      "shoulders square to the camera",
  three_quarter_rotation:"shoulders turned three-quarters",
  profile_turn:          "shoulders turned to profile",
  relaxed_asymmetric:    "shoulders relaxed and uneven",
};

export const TORSO_ROTATION_PHRASE: Record<string, string> = {
  facing_forward:       "torso facing forward",
  twisted_toward_action: "torso twisted toward the action",
  leaning_forward:      "torso leaning forward",
  leaning_back:         "torso leaning back",
};

export const FOOT_PLACEMENT_PHRASE: Record<string, string> = {
  weight_forward:      "weight carried onto the forward foot",
  weight_back:         "weight settled onto the back foot",
  even_stance:         "feet set in an even stance",
  mid_stride:          "caught mid-stride",
  not_visible_in_frame:"feet outside the frame",
};

export const WEIGHT_DISTRIBUTION_PHRASE: Record<string, string> = {
  forward_engaged:  "weight forward and engaged",
  back_relaxed:     "weight back and relaxed",
  even_balanced:    "weight evenly balanced",
  shifted_to_one_side: "weight shifted to one side",
};

// ─────────────────────────────────────────────────────────────────────────────
// MICRO MOTION — environment-tagged elements + phrase templates
// ─────────────────────────────────────────────────────────────────────────────

export type MicroMotionElement =
  | "steam" | "hair_movement" | "fabric_folds" | "water_splash" | "smoke"
  | "dust" | "glass_reflection" | "wind" | "leaves" | "rain" | "particles";

/** Which environment tags make an element physically plausible — checked against knowledge-bridge tags/environment type. */
export const MICRO_MOTION_CONTEXT: Record<MicroMotionElement, readonly string[]> = {
  steam:            ["kitchen", "restaurant", "hot", "coffee", "spa", "clinical", "cooking"],
  hair_movement:    ["salon", "outdoor", "wind", "portrait", "person"],
  fabric_folds:     ["fashion", "retail", "interior", "furniture", "salon", "person"],
  water_splash:     ["kitchen", "spa", "salon", "outdoor", "pool"],
  smoke:            ["bbq", "restaurant", "grill", "industrial", "candle"],
  dust:             ["construction", "vintage", "industrial", "workshop", "rustic"],
  glass_reflection: ["jewellery", "retail", "interior", "real-estate", "dental", "hospital", "salon"],
  wind:             ["outdoor", "terrace", "rooftop", "landscape", "street"],
  leaves:           ["outdoor", "garden", "landscape", "terrace"],
  rain:             ["outdoor", "street", "window", "moody"],
  particles:        ["bakery", "workshop", "construction", "market", "flour"],
};

export const MICRO_MOTION_PHRASE: Record<MicroMotionElement, readonly string[]> = {
  steam:            ["a thread of steam rising", "steam curling upward", "visible steam drifting off the surface"],
  hair_movement:    ["a strand of hair lifted mid-motion", "hair caught mid-movement", "loose hair shifting with the motion"],
  fabric_folds:     ["fabric folding with the movement", "a fold catching the light as it settles", "cloth still settling from the motion"],
  water_splash:     ["a small splash frozen mid-air", "droplets caught in the air", "water breaking the surface"],
  smoke:            ["a wisp of smoke drifting", "smoke curling into the light", "a thin smoke trail rising"],
  dust:             ["dust motes suspended in the light", "fine dust catching a shaft of light", "particles drifting through the beam"],
  glass_reflection: ["a reflection sliding across the glass", "light fracturing across a glass edge", "a faint double-reflection in the surface"],
  wind:             ["a gust moving through the frame", "wind pressing against the fabric", "air moving visibly through the scene"],
  leaves:           ["a leaf caught mid-fall", "leaves stirring at the frame edge", "foliage trembling in the air"],
  rain:             ["a scatter of raindrops catching the light", "rain streaking through the frame", "droplets suspended mid-fall"],
  particles:        ["fine particles drifting through a shaft of light", "airborne specks catching the light", "a fine dust of particles settling"],
};

// ─────────────────────────────────────────────────────────────────────────────
// WHERE — small per-industry noun banks (fragments, not full descriptions)
// ─────────────────────────────────────────────────────────────────────────────

export const ARCHITECTURE_NOUNS: Record<SceneIndustry, readonly string[]> = {
  restaurant:    ["a vaulted brick archway", "a stone column", "an open kitchen pass", "a wine wall", "a low beamed ceiling"],
  dental:        ["a frosted glass partition", "a curved reception counter", "a skylight above the bay", "a corridor of consultation rooms"],
  salon:         ["a row of styling mirrors", "a floating reception desk", "a backlit product wall", "a curved partition wall"],
  jewellery:     ["an illuminated display alcove", "a vaulted showroom ceiling", "a mirrored back wall", "a marble entry threshold"],
  hospital:      ["a wide clinical corridor", "a nurses' station counter", "a bank of consultation doors", "a skylight atrium"],
  interior:      ["a floor-to-ceiling window wall", "an open-plan archway", "an exposed structural beam", "a curved staircase"],
  "real-estate": ["a floor-to-ceiling glass facade", "a cantilevered balcony", "a double-height entry hall", "a rooftop parapet"],
  furniture:     ["a showroom loft ceiling", "an exposed brick backdrop", "a large factory window", "a mezzanine rail"],
  school:        ["a bank of tall classroom windows", "a covered breezeway", "an open atrium", "a mural-lined corridor"],
  retail:        ["a storefront glass facade", "a vaulted ceiling display", "a mirrored fitting corridor", "a mezzanine rail"],
  generic:       ["a glass facade", "a structural column", "a wide corridor", "a skylight"],
};

export const ROOM_NOUNS: Record<SceneIndustry, readonly string[]> = {
  restaurant:    ["the main dining room", "a private dining alcove", "the bar area", "the chef's pass"],
  dental:        ["the consultation room", "the treatment bay", "the reception area", "the sterilisation room"],
  salon:         ["the styling floor", "a private treatment room", "the colour bar", "the reception lounge"],
  jewellery:     ["the main showroom floor", "a private viewing room", "the consultation alcove"],
  hospital:      ["the consultation room", "the ward corridor", "the waiting area", "the diagnostic suite"],
  interior:      ["the living room", "the open-plan kitchen", "the reading nook", "the primary bedroom"],
  "real-estate": ["the open-plan living area", "the primary bedroom", "the kitchen island area", "the balcony"],
  furniture:     ["the showroom floor", "a styled living vignette", "the workshop area"],
  school:        ["the classroom", "the library", "the science lab", "the corridor"],
  retail:        ["the shop floor", "the fitting area", "the checkout counter", "the window display bay"],
  generic:       ["the main room", "the reception area", "the workspace"],
};

export const FURNITURE_NOUNS: Record<SceneIndustry, readonly string[]> = {
  restaurant:    ["a walnut counter", "a marble-top table", "a leather banquette", "a wine rack"],
  dental:        ["an ergonomic treatment chair", "a laminate cabinet run", "a waiting-room bench"],
  salon:         ["a styling chair", "a basin unit", "a product display shelf"],
  jewellery:     ["a velvet-lined display counter", "a glass display cabinet", "a consultation table"],
  hospital:      ["a wheeled equipment cart", "a consultation desk", "a waiting-room chair row"],
  interior:      ["a low sofa", "a reading chair", "a console table", "a bookshelf"],
  "real-estate": ["a kitchen island", "a built-in wardrobe", "a dining table", "a balcony bench"],
  furniture:     ["the hero sofa piece", "a side table", "a floor lamp", "a rug"],
  school:        ["a row of desks", "a bookshelf", "a lab bench"],
  retail:        ["a clothing rail", "a display plinth", "a checkout counter", "a mannequin stand"],
  generic:       ["a work desk", "a display counter", "a seating area"],
};

export const STREET_NOUNS = [
  "a tree-lined street", "a cobbled lane", "a busy pavement", "a quiet side street", "a paved plaza",
] as const;

export const LANDSCAPE_NOUNS = [
  "a rolling green landscape", "a coastal horizon", "an open field", "a mountain backdrop", "a garden treeline",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA — leading lines / occlusion fragments
// ─────────────────────────────────────────────────────────────────────────────

export const LEADING_LINE_SOURCES = [
  "the counter edge", "the corridor walls", "a row of windows", "the table's edge",
  "an overhead beam line", "the display cabinet's edge", "the staircase rail",
] as const;

export const OCCLUSION_PHRASES = [
  "a foreground object partially crosses the frame",
  "a soft-focus element passes in front of the subject",
  "the near edge of the counter blocks the lower frame",
  "a passing figure partially obscures the background",
  "steam softens the edge of the foreground",
  "nothing blocks the frame — an unobstructed view",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MATERIALS — independent noun / finish / light-interaction axes
// ─────────────────────────────────────────────────────────────────────────────

export type MaterialCategory = "architecture" | "surface" | "object" | "fabric";

export const MATERIAL_NOUNS: Record<MaterialCategory, Record<MaterialTier, readonly string[]>> = {
  architecture: {
    luxury: ["marble", "natural stone", "brushed brass", "book-matched veneer"],
    mid:    ["engineered stone", "painted plaster", "powder-coated steel", "oak veneer"],
    mass:   ["laminate panel", "painted drywall", "vinyl cladding"],
  },
  surface: {
    luxury: ["walnut", "honed marble", "hand-finished oak", "brushed brass"],
    mid:    ["engineered hardwood", "quartz composite", "powder-coated metal"],
    mass:   ["laminate", "melamine", "tempered glass"],
  },
  object: {
    luxury: ["hand-glazed ceramic", "cut crystal", "polished sterling", "full-grain leather"],
    mid:    ["glazed porcelain", "pressed glass", "brushed stainless steel"],
    mass:   ["moulded ceramic", "tempered glass", "coated stainless steel"],
  },
  fabric: {
    luxury: ["raw silk", "combed linen", "cashmere blend", "hand-woven wool"],
    mid:    ["cotton blend", "brushed cotton", "poly-cotton weave"],
    mass:   ["polyester blend", "woven synthetic", "basic cotton"],
  },
};

export const FINISH_DESCRIPTORS: Record<MaterialTier, readonly string[]> = {
  luxury: ["hand-finished", "polished", "honed", "brushed", "hand-rubbed"],
  mid:    ["clean-finished", "smooth", "even-toned", "consistently finished"],
  mass:   ["standard-finished", "uniform", "factory-finished"],
};

export const LIGHT_INTERACTION_PHRASES = [
  "catching the light along its edge",
  "reflecting the room's ambient glow",
  "with visible natural grain",
  "holding a soft specular highlight",
  "with a faint reflection of the space around it",
] as const;

export const TEXTURE_DETAIL_PHRASES: Record<SceneIndustry, readonly string[]> = {
  restaurant:    ["glistening food texture catching the key light", "visible steam-softened surface sheen on the dish"],
  salon:         ["visible hair sheen under the station light", "skin texture reading naturally under soft fill"],
  dental:        ["natural skin and enamel texture rendered accurately", "clean matte surface texture on clinical tools"],
  jewellery:     ["skin texture visible against the polished metal", "fine facet texture catching directional light"],
  hospital:      ["natural skin texture rendered accurately under clinical light", "clean matte texture on sterile surfaces"],
  interior:      ["natural material micro-texture visible under raking light", "fabric weave texture visible under ambient light"],
  "real-estate": ["natural stone and wood grain visible under daylight", "polished floor surface holding a soft reflection"],
  furniture:     ["visible upholstery weave under directional light", "natural wood grain texture catching a raking light"],
  school:        ["natural skin texture rendered accurately under classroom light", "desk-surface grain visible under overhead light"],
  retail:        ["fabric weave visible under accent lighting", "skin and garment texture reading naturally under key light"],
  generic:       ["natural surface micro-texture visible under the key light"],
};
