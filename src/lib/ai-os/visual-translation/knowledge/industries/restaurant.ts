import type { IndustryEntry } from "../../types";

export const restaurantIndustry: IndustryEntry = {
  key: "restaurant",
  aliases: [
    "restaurant", "fine dining", "food", "cafe", "bistro", "eatery",
    "food and beverage", "f&b", "indian restaurant", "cuisine", "chef",
    "culinary", "bakery", "bar", "pub", "diner", "brasserie", "catering",
  ],
  concepts: {

    trust: [
      {
        type: "action",
        value: "The head chef walks the floor and speaks directly with seated guests, the front-of-house ritual that signals nothing is hidden in the kitchen.",
        weight: 0.90,
        tags: ["action", "chef", "connection", "restaurant"],
      },
      {
        type: "object",
        value: "Fresh ingredients are displayed on a central station before service begins — whole vegetables, unbroken spice jars — the visual proof of unprocessed sourcing.",
        weight: 0.88,
        tags: ["object", "ingredients", "sourcing", "restaurant"],
      },
      {
        type: "spatial",
        value: "An open kitchen window or pass allows diners a direct sightline into the working kitchen — nothing is hidden, and the cleanliness is visible.",
        weight: 0.92,
        tags: ["spatial", "open_kitchen", "transparency", "restaurant"],
      },
    ],

    authority: [
      {
        type: "object",
        value: "Culinary awards, Michelin recognition plaques, or international certification certificates are displayed prominently near the entrance.",
        weight: 0.92,
        tags: ["object", "award", "recognition", "restaurant"],
      },
      {
        type: "person",
        value: "The head chef stands at the pass with full attention, tasting, adjusting, and directing — every dish passes through their judgment before service.",
        weight: 0.90,
        tags: ["human", "chef", "authority", "restaurant"],
      },
      {
        type: "object",
        value: "Cookbook publications or media features visible behind the bar or host stand position the chef as a published voice in their cuisine.",
        weight: 0.85,
        tags: ["object", "publication", "media", "restaurant"],
      },
    ],

    craftsmanship: [
      {
        type: "action",
        value: "The chef uses fine tweezers to place the final microgreen garnish, each element positioned with the deliberate care of someone who is never satisfied with almost.",
        weight: 0.96,
        tags: ["action", "plating", "tweezers", "restaurant"],
      },
      {
        type: "action",
        value: "A chef brushes sauce onto a plate with a single confident stroke, the motion too practised to be anything other than the result of repetition measured in years.",
        weight: 0.92,
        tags: ["action", "sauce", "plating", "restaurant"],
      },
      {
        type: "lighting",
        value: "Raking light catches the moment a blade completes a clean knife cut, the cross-section of the ingredient revealing uniform texture that speaks to sourcing quality.",
        weight: 0.90,
        tags: ["lighting", "raking", "knife", "restaurant"],
      },
      {
        type: "action",
        value: "A butcher or prep cook breaks down a whole joint with blade economy — no wasted motion, no hesitation, only the fluency of mastered technique.",
        weight: 0.88,
        tags: ["action", "butchery", "knife", "restaurant"],
      },
    ],

    premium: [
      {
        type: "material",
        value: "White linen tablecloths are pressed flat with no creases, the silverware is laid in perfect parallel, and the water glass is spotless at table.",
        weight: 0.92,
        tags: ["material", "linen", "silverware", "restaurant"],
      },
      {
        type: "object",
        value: "A hand-lettered menu card in a premium leather holder sits at each cover — printed menus signal permanence, handwritten ones signal the kitchen is thinking today.",
        weight: 0.88,
        tags: ["object", "menu", "premium", "restaurant"],
      },
      {
        type: "lighting",
        value: "Individual candles or low pendant lights over each table create intimate pools of warm light, each table its own private world.",
        weight: 0.90,
        tags: ["lighting", "candle", "pendant", "intimate", "restaurant"],
      },
    ],

    desire: [
      {
        type: "object",
        value: "The hero dish is photographed from directly overhead with warm backlight catching steam rising from the surface, making the dish appear to radiate appetite.",
        weight: 0.96,
        tags: ["object", "dish", "steam", "overhead", "restaurant"],
      },
      {
        type: "lighting",
        value: "Warm amber backlight at 3200 K catches the steam from the dish and the gloss on the sauce, making the food appear to glow from within.",
        weight: 0.94,
        tags: ["lighting", "backlight", "steam", "gloss", "restaurant"],
      },
      {
        type: "action",
        value: "A spoon breaks the surface of a sauce, a fork lifts the first portion, or a knife reveals the interior of the centrepiece — the food at its most intimate.",
        weight: 0.92,
        tags: ["action", "reveal", "first_cut", "restaurant"],
      },
      {
        type: "material",
        value: "Visible steam, a glossed sauce, or glistening oil on a surface makes the flavour physically felt through the image.",
        weight: 0.90,
        tags: ["material", "steam", "gloss", "tactile", "restaurant"],
      },
    ],

    freshness: [
      {
        type: "object",
        value: "A morning produce delivery is shown at its moment of arrival — crates of whole vegetables, herbs still with dirt on the roots, fish on ice.",
        weight: 0.94,
        tags: ["object", "produce", "delivery", "morning", "restaurant"],
      },
      {
        type: "action",
        value: "A chef slices through a ripe tomato or citrus fruit, the cross-section revealing perfect interior colour and the faint spray of juice.",
        weight: 0.92,
        tags: ["action", "cut", "cross_section", "fresh", "restaurant"],
      },
      {
        type: "material",
        value: "Water droplets are visible on herb leaves or salad greens — recently washed, recently arrived, clearly of today.",
        weight: 0.90,
        tags: ["material", "droplet", "herb", "fresh", "restaurant"],
      },
    ],

    transformation: [
      {
        type: "composition",
        value: "A split frame shows the raw ingredient on the left and the finished plated dish on the right — the chef's transformation of form and value visible in one frame.",
        weight: 0.92,
        tags: ["composition", "split_frame", "raw_to_finished", "restaurant"],
      },
      {
        type: "action",
        value: "The exact moment a dish transitions from kitchen to table — lifted from the pass, carried through the dining room, placed before the diner.",
        weight: 0.88,
        tags: ["action", "service", "journey", "restaurant"],
      },
    ],

    luxury: [
      {
        type: "object",
        value: "A Champagne flute is filled tableside with a visible pour — the arc of liquid, the rising bubbles, the immediate condensation on cold glass.",
        weight: 0.92,
        tags: ["object", "champagne", "service", "luxury_restaurant"],
      },
      {
        type: "material",
        value: "Dark walnut wall panels, aged copper bar fittings, and leather banquette seating communicate that every material decision was deliberate and expensive.",
        weight: 0.90,
        tags: ["material", "walnut", "copper", "leather", "luxury_restaurant"],
      },
      {
        type: "action",
        value: "A sommelier decants a red wine with full attention — the slow pour, the tilt of the bottle, the inspection of the shoulder — a service ritual.",
        weight: 0.88,
        tags: ["action", "sommelier", "decanting", "luxury_restaurant"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "The chef tastes from a small spoon mid-preparation and immediately adjusts seasoning — the unconscious reflex of someone who knows what perfect tastes like.",
        weight: 0.94,
        tags: ["action", "tasting", "adjustment", "restaurant"],
      },
      {
        type: "object",
        value: "The chef's knife collection, stored in a roll or magnetic strip, is visible — the tools carried by someone who understands that equipment is not interchangeable.",
        weight: 0.88,
        tags: ["object", "knife", "collection", "restaurant"],
      },
    ],

    community: [
      {
        type: "spatial",
        value: "A large shared table occupies the centre of the dining room — designed for group gatherings, with the kind of scale that makes strangers comfortable alongside each other.",
        weight: 0.90,
        tags: ["spatial", "shared_table", "gathering", "restaurant"],
      },
      {
        type: "action",
        value: "A large dish is placed at the centre of a table and guests serve each other — the ritual of communal eating, not individual plating.",
        weight: 0.88,
        tags: ["action", "sharing", "communal", "restaurant"],
      },
    ],

    warmth: [
      {
        type: "lighting",
        value: "Warm chandeliers at 2700 K create a dining room environment that makes every table feel like the best table — no cold overhead lighting visible.",
        weight: 0.92,
        tags: ["lighting", "chandelier", "warm", "restaurant"],
      },
      {
        type: "person",
        value: "Front-of-house staff greet guests by name at the door — the recognition that transforms a transaction into a relationship.",
        weight: 0.90,
        tags: ["human", "recognition", "greeting", "restaurant"],
      },
    ],
  },
};
