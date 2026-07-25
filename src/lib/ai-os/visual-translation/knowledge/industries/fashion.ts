import type { IndustryEntry } from "../../types";

export const fashionIndustry: IndustryEntry = {
  key: "fashion",
  aliases: [
    "fashion", "clothing", "apparel", "designer", "boutique", "garment",
    "textile", "tailor", "couture", "ready to wear", "streetwear", "luxury fashion",
    "brand", "collection", "seasonal collection", "fashion label",
  ],
  concepts: {

    trust: [
      {
        type: "object",
        value: "An authenticity certificate, a brand seal, or a care label with origin information is photographed beside the garment — the paper record of where and how the piece was made.",
        weight: 0.92,
        tags: ["object", "certificate", "origin", "fashion"],
      },
      {
        type: "action",
        value: "A sales consultant explains the construction details of a garment to a customer — the story of the material, the cut, and the maker told as part of the purchase.",
        weight: 0.90,
        tags: ["action", "explanation", "construction", "fashion"],
      },
      {
        type: "person",
        value: "A customer returns to the same boutique for a second fitting — the repeat visit that signals that the first experience earned enough trust to come back.",
        weight: 0.88,
        tags: ["human", "return_visit", "relationship", "fashion"],
      },
    ],

    luxury: [
      {
        type: "action",
        value: "A tailor marks a basted garment on the client's body — chalk on cashmere, the pinning of something that will be remade until it is exactly right.",
        weight: 0.96,
        tags: ["action", "tailor", "bespoke", "fashion"],
      },
      {
        type: "material",
        value: "The interior of a jacket is shown — the hand-sewn canvas, the custom lining, the hand-stitched lapel roll — the craftsmanship only the wearer will know is there.",
        weight: 0.94,
        tags: ["material", "interior", "canvas", "handmade", "fashion"],
      },
      {
        type: "lighting",
        value: "A single shaft of natural light crosses a folded piece of fabric, revealing the depth and texture of the weave at a scale that communicates the cost of the material.",
        weight: 0.92,
        tags: ["lighting", "natural", "texture", "fabric", "fashion"],
      },
    ],

    elegance: [
      {
        type: "composition",
        value: "A single garment occupies a white space with generous margin — the editorial fashion treatment where the absence of everything else communicates the piece's completeness.",
        weight: 0.94,
        tags: ["composition", "white_space", "single_garment", "fashion"],
      },
      {
        type: "person",
        value: "A model is photographed in profile against a plain ground, the silhouette of the garment making the design legible without requiring a frontal view.",
        weight: 0.92,
        tags: ["human", "profile", "silhouette", "fashion"],
      },
      {
        type: "action",
        value: "A sleeve edge, a collar fold, or a hem break is photographed at extreme close range — the point of resolution where the garment's quality is either proven or lost.",
        weight: 0.90,
        tags: ["action", "closeup", "detail", "fashion"],
      },
    ],

    craftsmanship: [
      {
        type: "action",
        value: "A master tailor hand-stitches a buttonhole using a curved needle and waxed thread — an operation that takes twenty minutes and cannot be improved by automation.",
        weight: 0.96,
        tags: ["action", "buttonhole", "handstitch", "fashion"],
      },
      {
        type: "object",
        value: "A pattern room shows tissue paper patterns hanging from a rail beside their corresponding cut garment — the translation from flat geometry to three-dimensional form.",
        weight: 0.90,
        tags: ["object", "pattern", "cutting_room", "fashion"],
      },
      {
        type: "action",
        value: "Fabric is cut on a long table using shears that require both hands — the commitment of the first cut, the irreversibility of the decision.",
        weight: 0.88,
        tags: ["action", "cutting", "shears", "fashion"],
      },
    ],

    transformation: [
      {
        type: "person",
        value: "A customer looks into a tailor's mirror for the first time in the completed fitted garment — the posture visibly different when the clothes fit exactly.",
        weight: 0.94,
        tags: ["human", "fitting", "mirror", "transformation", "fashion"],
      },
      {
        type: "composition",
        value: "Before the fitting on the left — the same person in ordinary clothes; after on the right — in the finished piece, the difference communicating the transformative power of fit.",
        weight: 0.90,
        tags: ["composition", "before_after", "fitting", "fashion"],
      },
    ],

    desire: [
      {
        type: "material",
        value: "A hand runs across a length of fabric — the visual texture of cashmere, raw silk, or washed linen making the tactile quality felt through the image.",
        weight: 0.95,
        tags: ["material", "fabric", "touch", "texture", "fashion"],
      },
      {
        type: "person",
        value: "A garment in motion — a coat turning, a skirt lifting in wind — communicates the quality of the drape and the life of the material as it moves.",
        weight: 0.92,
        tags: ["human", "movement", "drape", "fashion"],
      },
    ],

    premium: [
      {
        type: "object",
        value: "Packaging that matches the quality of the product inside — a rigid box with magnetic closure, tissue wrapping, a branded tag — extends the purchase experience.",
        weight: 0.90,
        tags: ["object", "packaging", "unboxing", "fashion"],
      },
      {
        type: "spatial",
        value: "A boutique interior with ample floor space between garment displays communicates that shopping here is a curated experience, not a transaction.",
        weight: 0.88,
        tags: ["spatial", "boutique", "space", "fashion"],
      },
    ],

    confidence: [
      {
        type: "person",
        value: "A person is shown walking toward the camera in the garment — the gait communicating that the clothes are not wearing the person, the person is wearing the clothes.",
        weight: 0.94,
        tags: ["human", "walking", "gait", "fashion"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "A designer drapes fabric directly on a dress form, creating form through material rather than calculation — the knowledge in the hands, not the sketchbook.",
        weight: 0.94,
        tags: ["action", "draping", "dress_form", "fashion"],
      },
    ],

    innovation: [
      {
        type: "material",
        value: "A new-generation material — recycled ocean plastic, lab-grown silk, bio-based yarn — is held to the light, its origin and its quality visible simultaneously.",
        weight: 0.90,
        tags: ["material", "sustainable", "new_material", "fashion"],
      },
    ],
  },
};
