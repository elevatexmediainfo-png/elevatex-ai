import type { IndustryEntry } from "../../types";

export const salonIndustry: IndustryEntry = {
  key: "salon",
  aliases: [
    "salon", "hair salon", "beauty salon", "nail salon", "barber",
    "hair stylist", "hairdresser", "blow dry bar", "beauty parlour",
    "lash salon", "brow bar", "spa", "wellness salon",
  ],
  concepts: {

    trust: [
      {
        type: "action",
        value: "The stylist shows colour swatches, example photographs, and discusses the client's hair history before touching a single tool.",
        weight: 0.94,
        tags: ["action", "consultation", "swatches", "salon"],
      },
      {
        type: "object",
        value: "A portfolio of before-and-after photographs from real clients is displayed near the mirror — not stock imagery, not aspirational models, but actual outcomes.",
        weight: 0.90,
        tags: ["object", "portfolio", "before_after", "salon"],
      },
      {
        type: "action",
        value: "The stylist holds a mirror behind the client's head at the end of the service, giving the full 360-degree view before the client rises from the chair.",
        weight: 0.88,
        tags: ["action", "mirror", "reveal", "salon"],
      },
    ],

    transformation: [
      {
        type: "composition",
        value: "A split-frame shows the client's hair texture and colour before the appointment on the left and the finished result on the right at the same angle.",
        weight: 0.96,
        tags: ["composition", "split_frame", "before_after", "salon"],
      },
      {
        type: "action",
        value: "The stylist removes the final foil or blow-dries the last section and the client sees the complete result for the first time — the reveal moment.",
        weight: 0.94,
        tags: ["action", "reveal", "reaction", "salon"],
      },
      {
        type: "person",
        value: "The client runs their own fingers through freshly styled hair, the sensation of the result connecting them to the transformation.",
        weight: 0.90,
        tags: ["human", "touch", "self_discovery", "salon"],
      },
    ],

    craftsmanship: [
      {
        type: "action",
        value: "The stylist balayages a section of hair with a paddle brush, the stroke angle and pressure communicating a technique learned over thousands of applications.",
        weight: 0.94,
        tags: ["action", "balayage", "technique", "salon"],
      },
      {
        type: "action",
        value: "Scissors move through a section with deliberate precision — each snip placed, not mechanical — the haircut as an act of considered judgment.",
        weight: 0.92,
        tags: ["action", "cutting", "precision", "salon"],
      },
      {
        type: "action",
        value: "A nail technician applies gel in a single, even stroke — the brush angle, the speed, and the finish all evidence of practised mastery.",
        weight: 0.88,
        tags: ["action", "nail", "application", "salon"],
      },
    ],

    premium: [
      {
        type: "object",
        value: "Premium hair care products — Oribe, Kerastase, Sisley — are displayed on the station, communicating that the investment extends to every product used.",
        weight: 0.90,
        tags: ["object", "products", "premium_brand", "salon"],
      },
      {
        type: "material",
        value: "The salon chair is upholstered in genuine leather, the mirror surround is brushed brass, and the floor is polished concrete — no disposable plastic anywhere.",
        weight: 0.88,
        tags: ["material", "leather", "brass", "salon"],
      },
      {
        type: "lighting",
        value: "Salon lighting is balanced at 4000 K daylight temperature — accurate colour reproduction ensures the client sees their result as it will appear outdoors.",
        weight: 0.85,
        tags: ["lighting", "daylight", "colour_accurate", "salon"],
      },
    ],

    care: [
      {
        type: "action",
        value: "A shampoo bowl service is shown with the stylist's fingers working through the scalp with complete attention — the sensory experience of being properly cared for.",
        weight: 0.92,
        tags: ["action", "shampoo", "scalp", "care", "salon"],
      },
      {
        type: "person",
        value: "The stylist maintains the conversation at eye level in the mirror throughout the service, checking not just the hair but the client's experience.",
        weight: 0.88,
        tags: ["human", "eye_contact", "mirror", "salon"],
      },
    ],

    freshness: [
      {
        type: "material",
        value: "Freshly laundered capes hang from their hooks, folded towels are stacked in pristine order, and the station is reset after every client.",
        weight: 0.90,
        tags: ["material", "fresh", "reset", "salon"],
      },
      {
        type: "lighting",
        value: "Natural light through large salon windows makes newly coloured hair appear to have depth and dimension that artificial light cannot reveal.",
        weight: 0.88,
        tags: ["lighting", "natural", "daylight", "salon"],
      },
    ],

    confidence: [
      {
        type: "person",
        value: "The client catches their own reflection mid-style and visibly sits up straighter — the body responding to what the eyes are beginning to see.",
        weight: 0.94,
        tags: ["human", "reflection", "posture", "salon"],
      },
      {
        type: "person",
        value: "The client walks toward the exit with a different gait than they arrived — the unhurried confidence of someone who knows they look exactly as they intended.",
        weight: 0.90,
        tags: ["human", "walk", "posture", "salon"],
      },
    ],

    desire: [
      {
        type: "material",
        value: "A close-up of freshly styled hair catches the light from multiple angles — the depth, shine, and movement making the texture physically felt.",
        weight: 0.94,
        tags: ["material", "hair", "shine", "texture", "salon"],
      },
      {
        type: "object",
        value: "A freshly manicured hand is shot in close focus — the surface of the nail catching specular light that communicates the result's perfection.",
        weight: 0.90,
        tags: ["object", "nail", "manicure", "closeup", "salon"],
      },
    ],

    luxury: [
      {
        type: "spatial",
        value: "Each station is separated by frosted glass panels or full partitions — the salon offers private treatment pods rather than an open floor.",
        weight: 0.90,
        tags: ["spatial", "private", "pod", "luxury_salon"],
      },
      {
        type: "object",
        value: "A welcome beverage — champagne, herbal tea, or still water with botanicals — is placed at the station before the client is seated.",
        weight: 0.88,
        tags: ["object", "beverage", "welcome", "luxury_salon"],
      },
    ],

    expertise: [
      {
        type: "object",
        value: "A colour wheel and developer ratio card are in use at the colourist station — the evidence of a formula being applied, not guessed.",
        weight: 0.90,
        tags: ["object", "colour_formula", "professional", "salon"],
      },
      {
        type: "action",
        value: "The stylist uses a sectioning clip system that communicates methodical working — each part isolated, processed in sequence, not improvised.",
        weight: 0.88,
        tags: ["action", "sectioning", "method", "salon"],
      },
    ],

    reliability: [
      {
        type: "object",
        value: "A client record card or digital profile is visible at the station — the colour formula, service history, and next appointment all documented.",
        weight: 0.90,
        tags: ["object", "record", "formula", "salon"],
      },
      {
        type: "action",
        value: "The stylist photographs the finished result and the formula used before the client leaves — the documentation that ensures consistency on the next visit.",
        weight: 0.88,
        tags: ["action", "photograph", "documentation", "salon"],
      },
    ],
  },
};
