// Phase 10.4M — Universal concept knowledge bank.
//
// 22 core concepts, each with 6–8 universal visual primitives.
// These apply to any industry when no industry-specific override exists.
//
// Rules:
//   ✗ No abstract language — every value must be photographable
//   ✗ No comma-separated keyword lists — every value is a complete sentence
//   ✓ Full natural sentences describing a real visual moment
//   ✓ Tags are lowercase, underscore-joined, never duplicated within a concept

import type { UniversalConceptMap } from "../types";

export const UNIVERSAL_CONCEPTS: UniversalConceptMap = {

  // ── Trust ───────────────────────────────────────────────────────────────────
  trust: [
    {
      type: "person",
      value: "A professional holds steady, open eye contact with a client during face-to-face conversation, projecting unhurried calm competence.",
      weight: 0.95,
      tags: ["human", "eye_contact", "connection", "professional"],
    },
    {
      type: "object",
      value: "Framed professional certificates, accreditations, or academic degrees hang clearly visible on the wall directly behind the service provider.",
      weight: 0.85,
      tags: ["credential", "object", "wall", "authority"],
    },
    {
      type: "action",
      value: "The professional turns a document, screen, or record to face the client, making information visible and shared rather than withheld.",
      weight: 0.88,
      tags: ["transparency", "action", "document", "sharing"],
    },
    {
      type: "person",
      value: "A client's body language shifts from tense, crossed-arm guardedness to a relaxed, open posture during the interaction.",
      weight: 0.82,
      tags: ["human", "emotion", "relief", "transformation"],
    },
    {
      type: "spatial",
      value: "Professional and client sit at the same eye level, neither physically elevated above the other, communicating mutual respect.",
      weight: 0.75,
      tags: ["spatial", "equality", "eye_level"],
    },
    {
      type: "material",
      value: "Clean, well-organised surroundings with no visible clutter signal that care and attention extend to every detail of the environment.",
      weight: 0.70,
      tags: ["environment", "order", "professionalism"],
    },
    {
      type: "action",
      value: "A professional gives the client their undivided attention with no phone in hand and no screen between them during consultation.",
      weight: 0.80,
      tags: ["listening", "presence", "human"],
    },
  ],

  // ── Care ────────────────────────────────────────────────────────────────────
  care: [
    {
      type: "person",
      value: "A professional leans slightly forward toward the client, narrowing the physical distance to convey genuine personal interest.",
      weight: 0.92,
      tags: ["human", "proximity", "connection", "warmth"],
    },
    {
      type: "action",
      value: "A professional pauses their task to address an unscheduled question, demonstrating that the person matters more than the process.",
      weight: 0.88,
      tags: ["attention", "priority", "human"],
    },
    {
      type: "person",
      value: "The client's expression shows they feel heard — a softening forehead, unclenched jaw, and comfortable direct eye contact.",
      weight: 0.90,
      tags: ["human", "emotion", "expression", "heard"],
    },
    {
      type: "action",
      value: "A service provider uses both hands when handing something to a client, a gesture of considered respect and attention.",
      weight: 0.78,
      tags: ["gesture", "respect", "hands"],
    },
    {
      type: "object",
      value: "Small comfort details — a glass of water, tissues, or reading material — signal that the client's physical ease has been anticipated.",
      weight: 0.72,
      tags: ["comfort_object", "hospitality", "object"],
    },
    {
      type: "spatial",
      value: "The service area is arranged to give the client a clear sightline to what is happening, removing the anxiety of the unknown.",
      weight: 0.68,
      tags: ["transparency", "spatial", "visibility"],
    },
  ],

  // ── Warmth ──────────────────────────────────────────────────────────────────
  warmth: [
    {
      type: "lighting",
      value: "Warm amber light fills the environment at 2700–3200 K, producing an immediate sense of comfort and invitation without clinical harshness.",
      weight: 0.90,
      tags: ["lighting", "warm", "amber", "indoor"],
    },
    {
      type: "person",
      value: "A genuine, unposed smile reaches the eyes of the service provider — crow's feet appear, cheeks lift, and the warmth is felt rather than performed.",
      weight: 0.95,
      tags: ["human", "smile", "authentic", "expression"],
    },
    {
      type: "material",
      value: "Natural wood surfaces, woven textiles, or warm-toned stone replace cold clinical materials with organic tactile warmth.",
      weight: 0.82,
      tags: ["material", "natural", "texture", "warm"],
    },
    {
      type: "color",
      value: "A palette of warm neutrals — cream, honey, terracotta, or blush — dominates the space, with cool blues used only as deliberate accents.",
      weight: 0.78,
      tags: ["color", "warm_palette", "neutral"],
    },
    {
      type: "action",
      value: "A staff member acknowledges a client's arrival with eye contact and a nod within seconds, before any formal greeting protocol begins.",
      weight: 0.85,
      tags: ["recognition", "action", "welcome"],
    },
    {
      type: "spatial",
      value: "The entry or waiting area is open and unobstructed, with a direct sightline from the door to the service team.",
      weight: 0.72,
      tags: ["entry", "spatial", "welcome", "open"],
    },
  ],

  // ── Comfort ─────────────────────────────────────────────────────────────────
  comfort: [
    {
      type: "object",
      value: "Seating is visibly cushioned, ergonomic, and positioned so the client's body does not have to work to maintain posture.",
      weight: 0.88,
      tags: ["seating", "object", "ergonomic"],
    },
    {
      type: "lighting",
      value: "Soft, indirect lighting eliminates harsh shadows and glare, with no visible light sources in the client's direct sightline.",
      weight: 0.85,
      tags: ["lighting", "soft", "indirect"],
    },
    {
      type: "person",
      value: "The client is shown in a reclined or naturally comfortable position, with tension released from their shoulders and neck.",
      weight: 0.90,
      tags: ["human", "posture", "relaxation"],
    },
    {
      type: "material",
      value: "Soft textiles — linen, brushed cotton, or velvet — are used for any surface a client will contact, replacing hard clinical materials.",
      weight: 0.80,
      tags: ["material", "textile", "soft", "tactile"],
    },
    {
      type: "spatial",
      value: "Generous breathing room between furniture pieces prevents the claustrophobic feeling of dense commercial layouts.",
      weight: 0.75,
      tags: ["spatial", "open", "breathing_room"],
    },
    {
      type: "color",
      value: "Soft sage green, warm white, or dusty blue tones establish a visually quiet environment that does not stimulate or agitate.",
      weight: 0.72,
      tags: ["color", "quiet", "soothing"],
    },
  ],

  // ── Confidence ──────────────────────────────────────────────────────────────
  confidence: [
    {
      type: "person",
      value: "A professional stands with weight evenly distributed, shoulders back, and hands visible — no crossed arms, no device-checking, no self-touching.",
      weight: 0.92,
      tags: ["human", "posture", "professional", "presence"],
    },
    {
      type: "composition",
      value: "The subject is framed with generous negative space around them, reinforcing that they own the space rather than being compressed by it.",
      weight: 0.85,
      tags: ["framing", "negative_space", "composition"],
    },
    {
      type: "person",
      value: "Eye contact is initiated and held by the professional rather than the client — the professional leads the visual exchange without aggression.",
      weight: 0.88,
      tags: ["human", "eye_contact", "leadership"],
    },
    {
      type: "action",
      value: "A deliberate, unhurried gesture — measured placement of an instrument, a considered explanation — conveys certainty through pacing.",
      weight: 0.82,
      tags: ["action", "pace", "deliberate"],
    },
    {
      type: "lighting",
      value: "A key light positioned slightly above and in front of the subject creates a command presence, with the face clearly illuminated.",
      weight: 0.78,
      tags: ["lighting", "key_light", "command"],
    },
    {
      type: "spatial",
      value: "The professional occupies a central or slightly elevated position in the frame, reinforcing authority without overt hierarchy.",
      weight: 0.75,
      tags: ["spatial", "framing", "authority"],
    },
  ],

  // ── Desire ──────────────────────────────────────────────────────────────────
  desire: [
    {
      type: "object",
      value: "The product or experience is shown at its absolute peak state — best moment, perfect condition, ideal light — not the everyday version.",
      weight: 0.95,
      tags: ["product", "peak", "presentation"],
    },
    {
      type: "lighting",
      value: "Warm backlight catches steam, gloss, liquid, or fine surface detail in a way that makes the subject appear to glow from within.",
      weight: 0.88,
      tags: ["lighting", "backlight", "rim_light", "gloss"],
    },
    {
      type: "person",
      value: "A person who represents the viewer's ideal future self engages naturally with the product or experience, not posing for the camera.",
      weight: 0.90,
      tags: ["human", "aspiration", "ideal", "natural"],
    },
    {
      type: "action",
      value: "A hand reaches toward or makes first contact with the subject, suggesting the transaction is already emotionally completed.",
      weight: 0.85,
      tags: ["action", "reach", "touch", "proximity"],
    },
    {
      type: "composition",
      value: "The subject fills a large portion of the frame and sits slightly below eye level, placing the viewer in a position of ownership.",
      weight: 0.82,
      tags: ["framing", "composition", "scale", "intimacy"],
    },
    {
      type: "color",
      value: "Rich, saturated accent tones — deep amber, burgundy, emerald, or sapphire — appear against a clean neutral ground to create visual appetite.",
      weight: 0.80,
      tags: ["color", "saturated", "rich", "appetite"],
    },
    {
      type: "object",
      value: "Visible steam, condensation, liquid flow, or freshly cut surfaces make sensory qualities physically felt through the image.",
      weight: 0.88,
      tags: ["texture", "sensory", "tactile"],
    },
  ],

  // ── Premium ─────────────────────────────────────────────────────────────────
  premium: [
    {
      type: "material",
      value: "Natural marble, solid timber, brushed metal, or high-grade leather surfaces appear in the environment, communicating material investment.",
      weight: 0.90,
      tags: ["material", "natural", "quality", "surface"],
    },
    {
      type: "composition",
      value: "A single hero subject occupies the frame with extensive breathing space around it — the visual equivalent of a premium price tag.",
      weight: 0.88,
      tags: ["composition", "negative_space", "editorial"],
    },
    {
      type: "lighting",
      value: "Soft indirect lighting, free of harsh shadows, gives every surface a smooth, continuous quality that communicates crafted value.",
      weight: 0.85,
      tags: ["lighting", "soft", "indirect", "quality"],
    },
    {
      type: "object",
      value: "Product packaging, tools, or service materials are premium in their own right — no plastic trays, generic packaging, or budget equipment visible.",
      weight: 0.82,
      tags: ["object", "packaging", "quality"],
    },
    {
      type: "color",
      value: "A restrained palette of two or three tones — typically a neutral ground and a single rich accent — signals editorial premium positioning.",
      weight: 0.78,
      tags: ["color", "restrained", "neutral"],
    },
    {
      type: "spatial",
      value: "The space is uncluttered and each element is placed with visible intention — nothing is there by accident or without purpose.",
      weight: 0.80,
      tags: ["spatial", "intentional", "clean"],
    },
    {
      type: "person",
      value: "Where a person appears, their attire is minimal and precise — clothing that signals considered investment rather than fashion-forward statement.",
      weight: 0.75,
      tags: ["human", "attire", "minimal"],
    },
  ],

  // ── Luxury ──────────────────────────────────────────────────────────────────
  luxury: [
    {
      type: "material",
      value: "Handstitched leather, Italian marble, cashmere, or raw silk appear as tactile proof of the investment required to be in this space.",
      weight: 0.92,
      tags: ["material", "handmade", "heritage", "texture"],
    },
    {
      type: "lighting",
      value: "A single, precisely positioned shaft of natural light crosses a surface, revealing fine grain or texture that mass-production cannot replicate.",
      weight: 0.90,
      tags: ["lighting", "natural", "reveal", "texture"],
    },
    {
      type: "composition",
      value: "Extreme negative space surrounds the hero subject — the empty space itself is a luxury item, communicating that nothing here is crowded.",
      weight: 0.88,
      tags: ["composition", "negative_space", "editorial"],
    },
    {
      type: "action",
      value: "A single handcrafted element of the product is handled slowly and deliberately, the motion communicating irreversibility and care.",
      weight: 0.85,
      tags: ["action", "handcraft", "deliberate", "slow"],
    },
    {
      type: "object",
      value: "Provenance or heritage indicators — hallmarks, handwritten certificates, date stamps, artisan signatures — are visible on or beside the product.",
      weight: 0.80,
      tags: ["object", "provenance", "heritage", "authentication"],
    },
    {
      type: "color",
      value: "Near-neutral tones — warm off-white, cool stone, deep navy, or blackened bronze — establish a palette that does not compete with the subject.",
      weight: 0.82,
      tags: ["color", "neutral", "muted"],
    },
    {
      type: "spatial",
      value: "The environment communicates controlled scarcity — this is not available to everyone, and the space itself enforces that boundary.",
      weight: 0.78,
      tags: ["spatial", "exclusivity", "scarcity"],
    },
  ],

  // ── Elegance ────────────────────────────────────────────────────────────────
  elegance: [
    {
      type: "composition",
      value: "One element dominates the frame in complete isolation — there is a single visual subject and nothing else competes for attention.",
      weight: 0.92,
      tags: ["composition", "isolation", "single_subject"],
    },
    {
      type: "lighting",
      value: "Light is used to reveal form rather than illuminate — the subject emerges from shadow, not from floods of brightness.",
      weight: 0.88,
      tags: ["lighting", "chiaroscuro", "form", "reveal"],
    },
    {
      type: "color",
      value: "A monochromatic or near-monochromatic palette in one refined tone family, with all contrast achieved through material rather than color.",
      weight: 0.85,
      tags: ["color", "monochromatic", "refined"],
    },
    {
      type: "material",
      value: "Surfaces have consistent, resolved finishes — a matte leather, a satin metal, a smooth stone — never a mixture of incompatible material tones.",
      weight: 0.82,
      tags: ["material", "finish", "resolved", "consistent"],
    },
    {
      type: "spatial",
      value: "Every visible element in the frame was placed deliberately — there is no accident, no noise, no clutter in any layer of the composition.",
      weight: 0.90,
      tags: ["spatial", "deliberate", "intentional", "clean"],
    },
    {
      type: "action",
      value: "Any motion captured is at the point of maximum stillness — a hand just placed, a head just turned — not mid-gesture chaos.",
      weight: 0.80,
      tags: ["action", "stillness", "decisive_moment"],
    },
  ],

  // ── Craftsmanship ───────────────────────────────────────────────────────────
  craftsmanship: [
    {
      type: "action",
      value: "Expert hands are shown at the exact moment of maximum precision — steadying a tool, applying a finishing detail, or examining a result under a loupe.",
      weight: 0.95,
      tags: ["action", "hands", "precision", "craft"],
    },
    {
      type: "object",
      value: "Specialist tools — tweezers, a burnisher, chalk — are visible and clearly mastered rather than decorative.",
      weight: 0.90,
      tags: ["object", "tools", "specialist", "mastery"],
    },
    {
      type: "material",
      value: "A close-up reveals the surface texture of the finished work at a scale that makes quality undeniable — the grain of a cut, the sheen of a glaze.",
      weight: 0.88,
      tags: ["material", "texture", "closeup", "quality"],
    },
    {
      type: "lighting",
      value: "Raking light hits the work surface at a low angle, throwing every texture into precise relief — the proof that this was made by hand.",
      weight: 0.85,
      tags: ["lighting", "raking", "texture", "reveal"],
    },
    {
      type: "action",
      value: "The work-in-progress state is shown — a dish half-plated, a piece half-finished — making the act of creation as valuable as the result.",
      weight: 0.82,
      tags: ["action", "process", "creation", "in_progress"],
    },
    {
      type: "spatial",
      value: "The workspace shows evidence of active use — traces of work, organised materials, the visible weight of a practised environment.",
      weight: 0.78,
      tags: ["spatial", "workspace", "process", "authentic"],
    },
  ],

  // ── Precision ───────────────────────────────────────────────────────────────
  precision: [
    {
      type: "action",
      value: "A measurement is being taken — a calibrated instrument, a ruler, a gauge — communicating that nothing here is approximate.",
      weight: 0.92,
      tags: ["action", "measurement", "calibration", "exactness"],
    },
    {
      type: "lighting",
      value: "Hard directional light creates crisp, defined shadows that emphasise the sharp edges and exact geometry of the subject.",
      weight: 0.88,
      tags: ["lighting", "hard", "directional", "sharp"],
    },
    {
      type: "spatial",
      value: "All elements in the frame are perfectly aligned — the visual equivalent of a tolerance specification communicated without words.",
      weight: 0.90,
      tags: ["spatial", "alignment", "geometry", "order"],
    },
    {
      type: "composition",
      value: "A grid-based or perfectly centred composition demonstrates that the visual itself is held to the same standard as the work it depicts.",
      weight: 0.82,
      tags: ["composition", "grid", "centred", "geometric"],
    },
    {
      type: "object",
      value: "Calibrated instruments or precision tools are visibly at hand — the kind of equipment that exists because tolerances matter.",
      weight: 0.85,
      tags: ["object", "instrument", "calibration"],
    },
    {
      type: "material",
      value: "Surfaces have machined, finished quality — no rough edges, no visible join lines, no ambiguity about where one element ends and another begins.",
      weight: 0.80,
      tags: ["material", "machined", "finish"],
    },
  ],

  // ── Cleanliness ─────────────────────────────────────────────────────────────
  cleanliness: [
    {
      type: "material",
      value: "Surfaces are shown at the moment after cleaning — not sterile-clinical, but genuinely, reassuringly clean with natural light revealing the result.",
      weight: 0.92,
      tags: ["material", "clean", "surface", "hygiene"],
    },
    {
      type: "lighting",
      value: "Bright, even diffused light eliminates shadows where contamination could hide, communicating openness and hygiene.",
      weight: 0.88,
      tags: ["lighting", "bright", "even", "hygiene"],
    },
    {
      type: "object",
      value: "Tools, equipment, and working surfaces are visibly sterilised, sealed, or freshly unwrapped — the moment of clinical readiness made visible.",
      weight: 0.90,
      tags: ["object", "sterilisation", "hygiene"],
    },
    {
      type: "spatial",
      value: "The entire visible environment has no stray objects, no mess, no previous-interaction traces — the space resets between every client.",
      weight: 0.85,
      tags: ["spatial", "reset", "clean", "order"],
    },
    {
      type: "color",
      value: "White, light grey, or soft sage tones dominate, with any accent applied deliberately to support rather than obscure the cleanliness message.",
      weight: 0.80,
      tags: ["color", "white", "light", "clean"],
    },
    {
      type: "action",
      value: "A professional is shown putting on fresh gloves, applying hand sanitiser, or opening a sealed sterile package — the moment of readiness.",
      weight: 0.82,
      tags: ["action", "hygiene", "protocol"],
    },
  ],

  // ── Authority ───────────────────────────────────────────────────────────────
  authority: [
    {
      type: "person",
      value: "A professional is shown speaking or presenting while others listen — the natural centre of the room without needing to claim it.",
      weight: 0.92,
      tags: ["human", "speaking", "leadership", "attention"],
    },
    {
      type: "object",
      value: "Professional awards, trophies, industry certifications, or published works are visible within the environment — earned symbols, never decorative.",
      weight: 0.88,
      tags: ["object", "award", "credential", "recognition"],
    },
    {
      type: "composition",
      value: "The subject is positioned lower in the frame, so the camera looks slightly up at them — a compositional signal of scale and command.",
      weight: 0.85,
      tags: ["composition", "low_angle", "command"],
    },
    {
      type: "person",
      value: "The professional's attire is formal relative to those around them — the visual hierarchy of the room reinforces their role without explanation.",
      weight: 0.82,
      tags: ["human", "attire", "formal", "hierarchy"],
    },
    {
      type: "object",
      value: "Conference photographs, published media coverage, or event appearances from recognised venues are displayed prominently.",
      weight: 0.80,
      tags: ["object", "media", "recognition", "social_proof"],
    },
    {
      type: "spatial",
      value: "The professional occupies the naturally dominant spatial position — at the head of a table, the front of a room, or behind a commanding desk.",
      weight: 0.78,
      tags: ["spatial", "dominant", "position"],
    },
  ],

  // ── Expertise ───────────────────────────────────────────────────────────────
  expertise: [
    {
      type: "action",
      value: "A professional performs a highly specific, industry-native action — the kind that only someone with years of training could execute naturally.",
      weight: 0.95,
      tags: ["action", "specialist", "training", "mastery"],
    },
    {
      type: "object",
      value: "Specialist equipment or instruments specific to the field are used with fluency — not held cautiously, not explained, simply in use.",
      weight: 0.90,
      tags: ["object", "specialist", "instrument", "mastery"],
    },
    {
      type: "person",
      value: "The professional's attention is fully on the work, not the camera — a visible sign that the task demands and receives complete focus.",
      weight: 0.88,
      tags: ["human", "focus", "attention", "professional"],
    },
    {
      type: "action",
      value: "The professional explains a technical detail to a colleague or trainee, with both knowledge and teaching visible in the exchange.",
      weight: 0.85,
      tags: ["action", "teaching", "knowledge", "mentoring"],
    },
    {
      type: "object",
      value: "The tools of the profession show signs of skilled use — the patina of a worn handle, the precision wear of specialist equipment.",
      weight: 0.82,
      tags: ["object", "tools", "wear", "authentic"],
    },
    {
      type: "spatial",
      value: "The workspace is clearly organised for efficiency — everything at arm's reach, in the position placed by someone who does this every day.",
      weight: 0.80,
      tags: ["spatial", "efficiency", "mastery", "workspace"],
    },
  ],

  // ── Reliability ─────────────────────────────────────────────────────────────
  reliability: [
    {
      type: "object",
      value: "A written record, appointment book, or systematic documentation is visible — evidence that nothing is left to chance or memory.",
      weight: 0.88,
      tags: ["object", "documentation", "systematic", "record"],
    },
    {
      type: "action",
      value: "A checklist is consulted or completed in front of the client — the act of verification performed transparently, not hidden.",
      weight: 0.85,
      tags: ["action", "verification", "checklist", "transparent"],
    },
    {
      type: "object",
      value: "Service history, maintenance records, or before-and-after documentation is organised and visible — a physical record of consistent performance.",
      weight: 0.82,
      tags: ["object", "history", "record", "consistency"],
    },
    {
      type: "person",
      value: "The professional arrives or begins on time — a clock is subtly visible, and their body language communicates punctuality rather than rush.",
      weight: 0.80,
      tags: ["human", "time", "punctuality", "professional"],
    },
    {
      type: "material",
      value: "Equipment appears in excellent working condition — no visible wear beyond normal, no jury-rigged repairs, no compromised tools.",
      weight: 0.78,
      tags: ["material", "condition", "maintenance", "quality"],
    },
    {
      type: "action",
      value: "A follow-up call or check-in is shown in progress — the service relationship does not end when the client walks out.",
      weight: 0.75,
      tags: ["action", "follow_up", "relationship"],
    },
  ],

  // ── Innovation ──────────────────────────────────────────────────────────────
  innovation: [
    {
      type: "object",
      value: "A novel technique, unexpected material combination, or unfamiliar tool is shown in use — something the viewer has not seen used this way before.",
      weight: 0.92,
      tags: ["object", "novel", "technique", "unexpected"],
    },
    {
      type: "action",
      value: "A problem is being approached from an unexpected angle — the professional's posture and tool position communicate a non-standard approach.",
      weight: 0.88,
      tags: ["action", "problem_solving", "approach", "novel"],
    },
    {
      type: "material",
      value: "Advanced or next-generation materials are visibly present — a surface finish, a product texture, or a tool construction that is not yet common.",
      weight: 0.85,
      tags: ["material", "advanced", "new", "technology"],
    },
    {
      type: "lighting",
      value: "Crisp, modern lighting with clean shadows communicates a forward-facing aesthetic — this does not look like the past.",
      weight: 0.80,
      tags: ["lighting", "modern", "crisp", "forward"],
    },
    {
      type: "object",
      value: "Patents, research publications, or prototype elements are visible — the language of original invention rather than borrowed practice.",
      weight: 0.82,
      tags: ["object", "research", "patent", "original"],
    },
    {
      type: "spatial",
      value: "The workspace has been redesigned from conventional layouts — everything about the environment communicates intentional departure from standard.",
      weight: 0.78,
      tags: ["spatial", "unconventional", "redesigned", "modern"],
    },
  ],

  // ── Transformation ──────────────────────────────────────────────────────────
  transformation: [
    {
      type: "action",
      value: "The moment of first seeing the result is captured — the subject's face in the first second of encountering what has changed.",
      weight: 0.95,
      tags: ["action", "reaction", "reveal", "discovery"],
    },
    {
      type: "composition",
      value: "A split-frame composition shows the before and after states within one image — the journey compressed into a single moment of comparison.",
      weight: 0.90,
      tags: ["composition", "split_frame", "before_after"],
    },
    {
      type: "person",
      value: "The subject stands taller, holds eye contact for longer, and occupies more physical space than they did at the start — transformation visible in posture.",
      weight: 0.88,
      tags: ["human", "posture", "change", "before_after"],
    },
    {
      type: "object",
      value: "A mirror showing a transformed reflection is visible — the subject seeing their changed state, not performing for the camera.",
      weight: 0.85,
      tags: ["object", "mirror", "reflection", "self_discovery"],
    },
    {
      type: "lighting",
      value: "The after state uses warmer, more flattering light than the implied before — the world itself looks better once the transformation is complete.",
      weight: 0.82,
      tags: ["lighting", "warm", "after_state", "improvement"],
    },
    {
      type: "person",
      value: "The professional observes the result with visible quiet pride — not claiming credit, but clearly satisfied the outcome met the standard they set.",
      weight: 0.80,
      tags: ["human", "pride", "satisfaction", "professional"],
    },
  ],

  // ── Freshness ───────────────────────────────────────────────────────────────
  freshness: [
    {
      type: "object",
      value: "Ingredients, materials, or inputs are shown in their most raw, recently arrived state — the moment before processing or handling begins.",
      weight: 0.92,
      tags: ["object", "raw", "ingredients", "peak"],
    },
    {
      type: "lighting",
      value: "Early morning or late afternoon natural light — raking and golden — gives every surface a quality that artificial lighting cannot recreate.",
      weight: 0.90,
      tags: ["lighting", "natural", "morning", "golden"],
    },
    {
      type: "material",
      value: "Visible moisture — water droplets on a leaf, condensation on glass, juice at a cut surface — makes freshness tangible and felt.",
      weight: 0.88,
      tags: ["material", "moisture", "droplet", "fresh"],
    },
    {
      type: "action",
      value: "The act of cutting, slicing, or revealing the interior of the subject is shown — the freshness of the cross-section visible as it is exposed.",
      weight: 0.88,
      tags: ["action", "cut", "reveal", "cross_section"],
    },
    {
      type: "color",
      value: "Vivid greens, clean whites, and bright primary tones appear naturally from the subject itself — no artificial color enhancement needed.",
      weight: 0.85,
      tags: ["color", "vivid", "natural", "bright"],
    },
    {
      type: "spatial",
      value: "An open-air or naturally ventilated environment communicates that the subject has not been confined or stored — it arrived recently, it is of today.",
      weight: 0.78,
      tags: ["spatial", "open_air", "ventilated"],
    },
  ],

  // ── Achievement ─────────────────────────────────────────────────────────────
  achievement: [
    {
      type: "person",
      value: "The subject holds a tangible marker of what they achieved — a certificate, a finished product, a transformed result — with genuine, unperformed pride.",
      weight: 0.92,
      tags: ["human", "pride", "certificate", "result"],
    },
    {
      type: "action",
      value: "The moment of completion is shown — the final brush stroke, the last piece placed, the closing of a finished document — not the process.",
      weight: 0.90,
      tags: ["action", "completion", "final_moment"],
    },
    {
      type: "person",
      value: "A second person witnesses the achievement — a mentor, peer, or family member — their reaction giving the achievement social weight.",
      weight: 0.88,
      tags: ["human", "witness", "social", "recognition"],
    },
    {
      type: "lighting",
      value: "A hero light singles out the subject at the moment of achievement, separating them from the background by quality of illumination.",
      weight: 0.85,
      tags: ["lighting", "hero_light", "spotlight"],
    },
    {
      type: "object",
      value: "Milestone objects — trophies, published works, certified documents — are shown as physical evidence of the journey completed.",
      weight: 0.85,
      tags: ["object", "trophy", "milestone", "evidence"],
    },
    {
      type: "composition",
      value: "The subject is positioned at the vertical centre or slightly above, with the achieved result physically elevated in the compositional hierarchy.",
      weight: 0.82,
      tags: ["composition", "elevated", "centre"],
    },
  ],

  // ── Community ───────────────────────────────────────────────────────────────
  community: [
    {
      type: "person",
      value: "Multiple people are shown in genuinely shared attention — all facing the same direction, listening to the same speaker, or engaged in the same activity.",
      weight: 0.92,
      tags: ["human", "group", "shared_attention", "togetherness"],
    },
    {
      type: "spatial",
      value: "A shared table, communal workspace, or circle of chairs communicates that this space was designed for gathering rather than individual use.",
      weight: 0.88,
      tags: ["spatial", "shared", "communal", "gathering"],
    },
    {
      type: "action",
      value: "Spontaneous, unscripted laughter or conversation is captured — the kind of interaction that cannot be manufactured or directed.",
      weight: 0.90,
      tags: ["action", "laughter", "spontaneous", "authentic"],
    },
    {
      type: "person",
      value: "A range of backgrounds, ages, or perspectives are visible and interact naturally — the community is defined by what it shares, not what it excludes.",
      weight: 0.85,
      tags: ["human", "diversity", "inclusion", "natural"],
    },
    {
      type: "object",
      value: "A shared resource — a meal in progress, a project under development — makes the community visible as a tangible, physical thing.",
      weight: 0.82,
      tags: ["object", "shared", "resource", "collaboration"],
    },
    {
      type: "lighting",
      value: "Warm, slightly elevated ambient light falls across a group equally — no one is more illuminated than another, reinforcing collective importance.",
      weight: 0.80,
      tags: ["lighting", "warm", "group", "equal"],
    },
  ],

  // ── Urgency ─────────────────────────────────────────────────────────────────
  urgency: [
    {
      type: "action",
      value: "A decision or action is shown at the precise moment of execution — the hand about to sign, the call about to be made, the click about to be confirmed.",
      weight: 0.90,
      tags: ["action", "decision", "moment", "execution"],
    },
    {
      type: "object",
      value: "A clock, countdown, or timer is subtly but clearly visible — a physical presence of time as a limited resource.",
      weight: 0.88,
      tags: ["object", "clock", "time", "limited"],
    },
    {
      type: "person",
      value: "A professional moves with purpose and visible efficiency — not rushed or stressed, but clearly operating at capacity with no unused time.",
      weight: 0.85,
      tags: ["human", "movement", "efficiency", "capacity"],
    },
    {
      type: "composition",
      value: "The frame is tightly cropped, leaving almost no negative space — the compressed composition reinforces the compression of available time.",
      weight: 0.82,
      tags: ["composition", "tight", "compressed"],
    },
    {
      type: "color",
      value: "A warm, high-energy accent — deep red, burnt orange, or vivid yellow — appears against a controlled background to signal activation.",
      weight: 0.80,
      tags: ["color", "warm", "high_energy", "action"],
    },
    {
      type: "lighting",
      value: "Slightly brighter-than-realistic lighting removes the comfort of contemplation — this is the moment of decision, not rest.",
      weight: 0.78,
      tags: ["lighting", "bright", "decision"],
    },
  ],

  // ── Safety ──────────────────────────────────────────────────────────────────
  safety: [
    {
      type: "object",
      value: "Appropriate protective equipment — gloves, masks, safety screens — is in correct use, communicating that protocols exist and are followed.",
      weight: 0.92,
      tags: ["object", "protective_equipment", "protocol"],
    },
    {
      type: "action",
      value: "A safety check or verification step is shown in progress — the act of confirming before proceeding, not proceeding without checking.",
      weight: 0.90,
      tags: ["action", "verification", "check", "protocol"],
    },
    {
      type: "person",
      value: "A professional oversees a process with full attention — their role is visible supervision rather than active task execution.",
      weight: 0.88,
      tags: ["human", "oversight", "supervision", "attentive"],
    },
    {
      type: "spatial",
      value: "Clear, unobstructed pathways and well-maintained equipment communicate that the space itself was designed with safety as a priority.",
      weight: 0.85,
      tags: ["spatial", "clear", "maintained"],
    },
    {
      type: "material",
      value: "Visible safety indicators — colour-coded equipment, warning labels in correct positions — are part of the environment naturally.",
      weight: 0.80,
      tags: ["material", "indicator", "colour_coded"],
    },
    {
      type: "lighting",
      value: "Even, bright lighting with no dark corners communicates that everything in the space is visible and nothing is hidden.",
      weight: 0.82,
      tags: ["lighting", "even", "bright", "transparent"],
    },
  ],
};

/** Canonical concept alias map: alternative terms resolve to the primary concept key. */
export const CONCEPT_ALIASES: Record<string, string> = {
  // trust
  trustworthy: "trust",
  credible: "trust",
  believable: "trust",
  authentic: "trust",
  honest: "trust",
  transparent: "trust",
  // care
  caring: "care",
  compassionate: "care",
  attentive: "care",
  gentle: "care",
  nurturing: "care",
  empathetic: "care",
  // warmth
  welcoming: "warmth",
  friendly: "warmth",
  approachable: "warmth",
  inviting: "warmth",
  hospitable: "warmth",
  personable: "warmth",
  // comfort
  comfortable: "comfort",
  relaxing: "comfort",
  cosy: "comfort",
  soothing: "comfort",
  restful: "comfort",
  // confidence
  confident: "confidence",
  assured: "confidence",
  poised: "confidence",
  bold: "confidence",
  // desire
  desirable: "desire",
  aspirational: "desire",
  craving: "desire",
  longing: "desire",
  fomo: "desire",
  // premium
  "high-end": "premium",
  "high end": "premium",
  upscale: "premium",
  superior: "premium",
  "top tier": "premium",
  // luxury
  bespoke: "luxury",
  exclusive: "luxury",
  "ultra premium": "luxury",
  prestige: "luxury",
  // elegance
  elegant: "elegance",
  sophisticated: "elegance",
  refined: "elegance",
  tasteful: "elegance",
  // craftsmanship
  crafted: "craftsmanship",
  handmade: "craftsmanship",
  artisanal: "craftsmanship",
  "hand crafted": "craftsmanship",
  // precision
  precise: "precision",
  exact: "precision",
  meticulous: "precision",
  detailed: "precision",
  // cleanliness
  clean: "cleanliness",
  hygienic: "cleanliness",
  sterile: "cleanliness",
  spotless: "cleanliness",
  // authority
  authoritative: "authority",
  commanding: "authority",
  leadership: "authority",
  leading: "authority",
  // expertise
  expert: "expertise",
  mastery: "expertise",
  skilled: "expertise",
  proficient: "expertise",
  // reliability
  reliable: "reliability",
  dependable: "reliability",
  consistent: "reliability",
  trustable: "reliability",
  // innovation
  innovative: "innovation",
  modern: "innovation",
  cutting_edge: "innovation",
  advanced: "innovation",
  // transformation
  transformative: "transformation",
  change: "transformation",
  "before after": "transformation",
  // freshness
  fresh: "freshness",
  natural: "freshness",
  organic: "freshness",
  // achievement
  success: "achievement",
  accomplishment: "achievement",
  result: "achievement",
  // community
  togetherness: "community",
  belonging: "community",
  inclusive: "community",
  // urgency
  urgent: "urgency",
  "limited time": "urgency",
  scarce: "urgency",
  // safety
  safe: "safety",
  protected: "safety",
  secure: "safety",
};
