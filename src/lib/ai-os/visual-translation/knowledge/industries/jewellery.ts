import type { IndustryEntry } from "../../types";

export const jewelleryIndustry: IndustryEntry = {
  key: "jewellery",
  aliases: [
    "jewellery", "jewelry", "jeweler", "jeweller", "diamond", "gold",
    "ring", "necklace", "watch", "luxury jewellery", "fine jewellery",
    "engagement ring", "gemstone", "platinum", "silver", "bangle",
  ],
  concepts: {

    trust: [
      {
        type: "object",
        value: "A GIA or IGI diamond certificate is placed beside the stone — the independent third-party grading report that removes the seller from the chain of verification.",
        weight: 0.96,
        tags: ["object", "certificate", "GIA", "jewellery"],
      },
      {
        type: "action",
        value: "A jeweller examines a stone through a loupe, then places it beside its certificate, allowing the client to confirm that what is described is what is present.",
        weight: 0.92,
        tags: ["action", "loupe", "verification", "jewellery"],
      },
      {
        type: "object",
        value: "A hallmark is shown in close focus on the inner surface of a gold piece — the assay mark, the maker's mark, the weight stamp — the permanent record of authenticity.",
        weight: 0.90,
        tags: ["object", "hallmark", "authentication", "jewellery"],
      },
    ],

    luxury: [
      {
        type: "lighting",
        value: "A single diamond facet is lit with a focused fibre optic source that ignites the internal reflections — the fire of a cut stone made visible as a spectrum of colour.",
        weight: 0.98,
        tags: ["lighting", "diamond", "fire", "facet", "jewellery"],
      },
      {
        type: "material",
        value: "The piece rests on natural slate, raw marble, or a custom velvet form — a surface chosen to frame the jewellery without competing with it.",
        weight: 0.94,
        tags: ["material", "surface", "velvet", "frame", "jewellery"],
      },
      {
        type: "composition",
        value: "A single ring or pendant occupies the entire frame with extreme macro focus — every facet, every setting, every grain of metal visible at a scale that makes craftsmanship undeniable.",
        weight: 0.96,
        tags: ["composition", "macro", "single_subject", "jewellery"],
      },
      {
        type: "action",
        value: "A craftsman places a setting stone with a setter's tool, the motion performed with the care of someone who understands that this piece will be worn for generations.",
        weight: 0.92,
        tags: ["action", "setting", "craftsman", "jewellery"],
      },
    ],

    craftsmanship: [
      {
        type: "action",
        value: "Hands polish a piece with a chamois under a directed bench light — the final stage of making, the surface quality made through physical contact rather than machine.",
        weight: 0.95,
        tags: ["action", "polishing", "hands", "jewellery"],
      },
      {
        type: "action",
        value: "A goldsmith works at a bench with a gas torch and solder, the piece held in a clamp — the heat-based moment of joining two metals permanently.",
        weight: 0.92,
        tags: ["action", "goldsmith", "torch", "soldering", "jewellery"],
      },
      {
        type: "lighting",
        value: "Raking light across a finished piece reveals the precise grain of a hand-engraved surface — the proof that no two pieces are exactly identical.",
        weight: 0.90,
        tags: ["lighting", "raking", "engraving", "jewellery"],
      },
    ],

    precision: [
      {
        type: "object",
        value: "A millimetre gauge measures a ring size with precision — the instrument confirming that the fit will be exact, not approximate.",
        weight: 0.94,
        tags: ["object", "gauge", "measurement", "jewellery"],
      },
      {
        type: "action",
        value: "A jeweller uses CAD software to rotate a 3D model of a commission piece, verifying proportions before a single gram of metal is committed.",
        weight: 0.90,
        tags: ["action", "CAD", "design", "precision", "jewellery"],
      },
    ],

    elegance: [
      {
        type: "composition",
        value: "A necklace is shown against a bare throat in profile — no background, no competing elements, only the piece and the skin it was made to rest against.",
        weight: 0.96,
        tags: ["composition", "profile", "skin", "jewellery"],
      },
      {
        type: "person",
        value: "A hand is held still against a dark background, a ring catching the only light — the jewellery given the stage without the person competing for it.",
        weight: 0.94,
        tags: ["human", "hand", "dark_background", "jewellery"],
      },
    ],

    desire: [
      {
        type: "lighting",
        value: "Light enters a diamond from one angle and exits from twenty — the prismatic scatter of a perfectly cut stone photographed in the moment of maximum fire.",
        weight: 0.98,
        tags: ["lighting", "prismatic", "diamond", "fire", "jewellery"],
      },
      {
        type: "action",
        value: "A hand reaches into frame and lifts a piece — the beginning of possession, the gesture that closes the emotional distance between viewer and object.",
        weight: 0.92,
        tags: ["action", "reach", "possession", "jewellery"],
      },
    ],

    transformation: [
      {
        type: "action",
        value: "A ring is slid onto a finger for the first time — the moment of fit, of belonging, of a piece finding the person it was made for.",
        weight: 0.96,
        tags: ["action", "ring", "finger", "wearing", "jewellery"],
      },
      {
        type: "person",
        value: "The recipient's expression in the first moment of seeing a piece presented in a box — the involuntary emotional response that no copy can describe.",
        weight: 0.94,
        tags: ["human", "reaction", "gift", "emotion", "jewellery"],
      },
    ],

    premium: [
      {
        type: "object",
        value: "Premium branded packaging — a signature box, a silk pouch, a wax seal — is shown closed and then opened, the ritual of unboxing as part of the product.",
        weight: 0.92,
        tags: ["object", "packaging", "unboxing", "jewellery"],
      },
      {
        type: "material",
        value: "A velvet-lined display tray holds a collection of finished pieces — the contrast of the deep pile against the brilliant metal communicating value through material quality.",
        weight: 0.90,
        tags: ["material", "velvet", "display", "jewellery"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "A gemologist inspects a loose stone through a ten-times loupe, the examination performed with the systematic focus of someone reading a language others cannot see.",
        weight: 0.94,
        tags: ["action", "gemologist", "loupe", "inspection", "jewellery"],
      },
    ],
  },
};
