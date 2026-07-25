import type { IndustryEntry } from "../../types";

export const realEstateIndustry: IndustryEntry = {
  key: "real_estate",
  aliases: [
    "real estate", "property", "real estate agent", "property developer",
    "apartments", "villa", "housing", "home", "mortgage", "interiors",
    "interior design", "architecture", "building", "construction", "land",
    "plot", "commercial property", "office space",
  ],
  concepts: {

    trust: [
      {
        type: "action",
        value: "An agent walks a buyer through a property with a floor plan in hand, pointing to structural elements and confirming what was on paper against what is in the room.",
        weight: 0.92,
        tags: ["action", "walkthrough", "floorplan", "real_estate"],
      },
      {
        type: "object",
        value: "A stack of completed transaction records or a wall of sold property plaques communicates a long track record of completed deals.",
        weight: 0.88,
        tags: ["object", "record", "sold", "real_estate"],
      },
      {
        type: "person",
        value: "An agent and buyer shake hands outside a property at golden hour — the handshake of a completed transaction between two people who both feel the outcome was right.",
        weight: 0.85,
        tags: ["human", "handshake", "agreement", "real_estate"],
      },
    ],

    authority: [
      {
        type: "object",
        value: "A branded board bearing the agent's name and completed sale record stands outside a sold property — the public ledger of a strong close rate.",
        weight: 0.90,
        tags: ["object", "sold_board", "record", "real_estate"],
      },
      {
        type: "person",
        value: "The agent presents to a room of investors or buyers from a standing position, the projector screen behind them showing market data.",
        weight: 0.88,
        tags: ["human", "presentation", "authority", "real_estate"],
      },
    ],

    premium: [
      {
        type: "lighting",
        value: "A property interior is photographed at golden hour, with the last warm light of the day reaching through floor-to-ceiling windows and landing across a polished stone floor.",
        weight: 0.94,
        tags: ["lighting", "golden_hour", "interior", "real_estate"],
      },
      {
        type: "material",
        value: "Brushed limestone flooring, custom joinery with inset brass handles, and a full-height marble island communicate that this property was finished with considered specificity.",
        weight: 0.92,
        tags: ["material", "limestone", "marble", "joinery", "real_estate"],
      },
      {
        type: "spatial",
        value: "A wide-angle lens shows the full depth of an open-plan living area — the visual scale communicating that living here is about generous, uncompromised space.",
        weight: 0.90,
        tags: ["spatial", "wide_angle", "scale", "real_estate"],
      },
    ],

    luxury: [
      {
        type: "lighting",
        value: "An infinity-edge pool at dusk reflects the last of the sky, the warm interior light of the villa behind it communicating that arriving here is the destination.",
        weight: 0.96,
        tags: ["lighting", "pool", "dusk", "villa", "real_estate"],
      },
      {
        type: "material",
        value: "A bespoke wine cellar, home cinema, or private gym space is shown in detail — the amenities that exist not because they are expected, but because the owner chose to invest in them.",
        weight: 0.92,
        tags: ["material", "bespoke", "amenity", "luxury_real_estate"],
      },
      {
        type: "spatial",
        value: "The property's private outdoor terrace or garden is photographed with the horizon visible — the sense that this space has no visible boundary.",
        weight: 0.90,
        tags: ["spatial", "outdoor", "horizon", "luxury_real_estate"],
      },
    ],

    transformation: [
      {
        type: "composition",
        value: "A before-and-after pair shows the unrenovated space and the completed result from exactly the same camera position — the transformation measured in light and material.",
        weight: 0.94,
        tags: ["composition", "renovation", "before_after", "real_estate"],
      },
      {
        type: "action",
        value: "New owners stand in the doorway of their completed property for the first time — the moment of threshold, the pause before entering what is now theirs.",
        weight: 0.90,
        tags: ["action", "first_entry", "ownership", "real_estate"],
      },
    ],

    desire: [
      {
        type: "lighting",
        value: "A living room is shown in the last light of a summer evening — the golden warmth of the interior light mixing with the cool blue of the sky outside the windows.",
        weight: 0.94,
        tags: ["lighting", "golden_hour", "interior_exterior", "real_estate"],
      },
      {
        type: "person",
        value: "A couple stands on the balcony or terrace looking out at the view, their body language communicating that this is already home before the papers are signed.",
        weight: 0.92,
        tags: ["human", "couple", "view", "aspiration", "real_estate"],
      },
    ],

    freshness: [
      {
        type: "lighting",
        value: "A newly completed property is photographed in bright morning light — every surface new, no wear, no history yet — the zero hour of a fresh start.",
        weight: 0.92,
        tags: ["lighting", "morning", "new", "fresh", "real_estate"],
      },
    ],

    confidence: [
      {
        type: "person",
        value: "An agent hands over a set of keys with eye contact and a composed expression — the transfer of ownership made into a visual moment of confidence in the outcome.",
        weight: 0.90,
        tags: ["human", "keys", "handover", "confidence", "real_estate"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "An agent reviews a detailed market comparison analysis on a laptop at the table, the data informing a pricing recommendation given with clear conviction.",
        weight: 0.90,
        tags: ["action", "analysis", "data", "real_estate"],
      },
    ],

    reliability: [
      {
        type: "object",
        value: "A timeline board in the agent's office tracks every active listing from listing to sold — the entire pipeline visible, nothing lost or forgotten.",
        weight: 0.88,
        tags: ["object", "timeline", "pipeline", "real_estate"],
      },
    ],

    community: [
      {
        type: "spatial",
        value: "A residential development is shown at an active time of day — residents walking, children outside, the texture of lived community visible at human scale.",
        weight: 0.90,
        tags: ["spatial", "residents", "community", "real_estate"],
      },
    ],
  },
};
