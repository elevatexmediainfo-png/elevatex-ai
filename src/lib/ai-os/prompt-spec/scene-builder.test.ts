import { describe, expect, it } from "vitest";
import { buildSceneBlueprint } from "./scene-builder";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { LayoutFamily } from "./scene-builder";

// ─── Fixture helper ───────────────────────────────────────────────────────────

const dir = (p: Partial<GPTCampaignDirection>): GPTCampaignDirection =>
  p as GPTCampaignDirection;

// ─── Industry fixtures ────────────────────────────────────────────────────────

const RESTAURANT = dir({
  environment:        "Premium Indian fine-dining restaurant with dark walnut walls.",
  heroSubject:        "An Indian head chef places the final microgreen garnish on a beautifully plated signature dish.",
  commercialStyle:    "Fine-dining restaurant brand, culinary theatre positioning.",
  marketingObjective: "Drive reservation bookings from aspirational diners.",
});

const DENTAL = dir({
  environment:        "Modern dental clinic, consultation room with natural light.",
  heroSubject:        "A calm dentist explains the dental treatment process to a patient.",
  commercialStyle:    "Premium dental clinic, warm and professional.",
  marketingObjective: "Drive consultation bookings from hesitant first-time patients.",
});

const SALON = dir({
  environment:        "Professional hair salon with warm styling stations and mirrors.",
  heroSubject:        "A senior hair stylist applies colour treatment to a client's hair.",
  commercialStyle:    "Premium hair salon brand, expert colour specialists.",
  marketingObjective: "Attract clients for high-end colour and blowdry services.",
});

const JEWELLERY = dir({
  environment:        "Luxury jewellery boutique with illuminated display cases.",
  heroSubject:        "A diamond engagement ring presented on a velvet cushion.",
  commercialStyle:    "Luxury jewellery brand — diamonds, platinum, and gemstones.",
  marketingObjective: "Drive boutique visits from engagement ring shoppers.",
});

const HOSPITAL = dir({
  environment:        "Modern hospital medical facility with clinical precision.",
  heroSubject:        "A specialist surgeon consults with a patient before the procedure.",
  commercialStyle:    "Premium private hospital, surgical excellence and patient care.",
  marketingObjective: "Build trust and drive enquiries for specialist surgical consultations.",
});

const INTERIOR = dir({
  environment:        "Contemporary interior design studio showroom.",
  heroSubject:        "A curated living room design with custom furniture and natural light.",
  commercialStyle:    "Boutique interior design firm, home staging and space planning.",
  marketingObjective: "Generate leads for interior design consultations and home renovations.",
});

const REAL_ESTATE = dir({
  environment:        "Luxury residential real estate property with city views.",
  heroSubject:        "A modern open-plan apartment with floor-to-ceiling windows and city skyline.",
  commercialStyle:    "Premium real estate developer, residential property listings.",
  marketingObjective: "Drive enquiries from apartment buyers and property investors.",
});

const FURNITURE = dir({
  environment:        "Premium furniture showroom with curated home furnishing displays.",
  heroSubject:        "A modular sectional sofa in a warmly lit living room display.",
  commercialStyle:    "Luxury furniture brand, modular home furnishing and upholstery.",
  marketingObjective: "Drive showroom visits and online furniture orders.",
});

const SCHOOL = dir({
  environment:        "Modern school campus with bright, well-equipped classrooms.",
  heroSubject:        "A passionate teacher guides a group of engaged students in a classroom.",
  commercialStyle:    "Premium private school, innovative education and holistic development.",
  marketingObjective: "Drive school admissions and parent engagement at open days.",
});

const RETAIL = dir({
  environment:        "Branded fashion retail store with curated clothing merchandise.",
  heroSubject:        "A brand representative presents the new fashion clothing collection.",
  commercialStyle:    "Premium fashion retail brand, seasonal apparel and accessories.",
  marketingObjective: "Drive store visits and fashion apparel purchases.",
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.3C — Scene Builder: industry detection regression
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3C — Scene Builder: industry detection", () => {
  it("detects restaurant", () => {
    expect(buildSceneBlueprint(RESTAURANT).industry).toBe("restaurant");
  });
  it("detects dental", () => {
    expect(buildSceneBlueprint(DENTAL).industry).toBe("dental");
  });
  it("detects salon", () => {
    expect(buildSceneBlueprint(SALON).industry).toBe("salon");
  });
  it("detects jewellery", () => {
    expect(buildSceneBlueprint(JEWELLERY).industry).toBe("jewellery");
  });
  it("detects hospital", () => {
    expect(buildSceneBlueprint(HOSPITAL).industry).toBe("hospital");
  });
  it("detects interior", () => {
    expect(buildSceneBlueprint(INTERIOR).industry).toBe("interior");
  });
  it("detects real-estate", () => {
    expect(buildSceneBlueprint(REAL_ESTATE).industry).toBe("real-estate");
  });
  it("detects furniture", () => {
    expect(buildSceneBlueprint(FURNITURE).industry).toBe("furniture");
  });
  it("detects school", () => {
    expect(buildSceneBlueprint(SCHOOL).industry).toBe("school");
  });
  it("detects retail", () => {
    expect(buildSceneBlueprint(RETAIL).industry).toBe("retail");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.3C — Scene Builder: hero type detection
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3C — Scene Builder: hero type detection", () => {
  it("chef PLACES → moment hero", () => {
    expect(buildSceneBlueprint(RESTAURANT).heroType).toBe("moment");
  });

  it("dentist authority (explains) → authority hero", () => {
    expect(buildSceneBlueprint(DENTAL).heroType).toBe("authority");
  });

  it("ring on cushion (no person) → product hero", () => {
    expect(buildSceneBlueprint(JEWELLERY).heroType).toBe("product");
  });

  it("apartment with floor-to-ceiling windows (space noun) → environment hero", () => {
    expect(buildSceneBlueprint(REAL_ESTATE).heroType).toBe("environment");
  });

  it("transformation signal in hero → transformation hero", () => {
    const bp = buildSceneBlueprint(dir({
      environment: "Dental clinic.",
      heroSubject: "Before and after dental whitening treatment — stained teeth transformed to gleaming white.",
    }));
    expect(bp.heroType).toBe("transformation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.3C — Scene Builder: background activity rules
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3C — Scene Builder: background activity rules", () => {
  const ALL_FIXTURES = [
    RESTAURANT, DENTAL, SALON, JEWELLERY, HOSPITAL,
    INTERIOR, REAL_ESTATE, FURNITURE, SCHOOL, RETAIL,
  ];

  it("no industry ever produces 'blurred background' as background activity", () => {
    for (const fixture of ALL_FIXTURES) {
      const bp = buildSceneBlueprint(fixture);
      expect(bp.backgroundActivity.toLowerCase()).not.toContain("blurred background");
      expect(bp.backgroundActivity.toLowerCase()).not.toContain("bokeh only");
    }
  });

  it("background activity is non-empty for all 10 industries", () => {
    for (const fixture of ALL_FIXTURES) {
      expect(buildSceneBlueprint(fixture).backgroundActivity.length).toBeGreaterThan(10);
    }
  });

  it("all 10 industries produce unique background activities", () => {
    const activities = ALL_FIXTURES.map(f => buildSceneBlueprint(f).backgroundActivity);
    const unique = new Set(activities);
    expect(unique.size).toBe(10);
  });

  it("restaurant background has dining activity", () => {
    const bp = buildSceneBlueprint(RESTAURANT);
    const activity = bp.backgroundActivity.toLowerCase();
    expect(
      activity.includes("guest") || activity.includes("diner") ||
      activity.includes("server") || activity.includes("candl") ||
      activity.includes("sommelier") || activity.includes("dining")
    ).toBe(true);
  });

  it("jewellery background has display/boutique activity", () => {
    const bp = buildSceneBlueprint(JEWELLERY);
    const activity = bp.backgroundActivity.toLowerCase();
    expect(
      activity.includes("display") || activity.includes("case") ||
      activity.includes("velvet") || activity.includes("reflection") ||
      activity.includes("boutique")
    ).toBe(true);
  });

  it("real-estate background has city/space activity", () => {
    const bp = buildSceneBlueprint(REAL_ESTATE);
    const activity = bp.backgroundActivity.toLowerCase();
    expect(
      activity.includes("city") || activity.includes("skyline") ||
      activity.includes("window") || activity.includes("balcony") ||
      activity.includes("sunlight") || activity.includes("floor")
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.3C — Scene Builder: scene context
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3C — Scene Builder: scene context", () => {
  it("scene context is non-empty for all 10 industries", () => {
    const fixtures = [RESTAURANT, DENTAL, SALON, JEWELLERY, HOSPITAL,
                      INTERIOR, REAL_ESTATE, FURNITURE, SCHOOL, RETAIL];
    for (const fixture of fixtures) {
      expect(buildSceneBlueprint(fixture).sceneContext.length).toBeGreaterThan(10);
    }
  });

  it("all 10 industries produce unique scene contexts", () => {
    const contexts = [RESTAURANT, DENTAL, SALON, JEWELLERY, HOSPITAL,
                      INTERIOR, REAL_ESTATE, FURNITURE, SCHOOL, RETAIL]
      .map(f => buildSceneBlueprint(f).sceneContext);
    expect(new Set(contexts).size).toBe(10);
  });

  it("restaurant scene mentions restaurant setting", () => {
    const { sceneContext } = buildSceneBlueprint(RESTAURANT);
    expect(sceneContext.toLowerCase()).toContain("restaurant");
  });

  it("dental scene mentions consultation or dental", () => {
    const { sceneContext } = buildSceneBlueprint(DENTAL);
    const ctx = sceneContext.toLowerCase();
    expect(ctx.includes("dental") || ctx.includes("consultation")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.3C/10.3D — Scene Builder: framing hints (updated for variety engine)
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3C — Scene Builder: framing hints", () => {
  // Crop ratio regex — matches 1:1, 3:2, 4:5, 2:3, 16:9, 2.39:1 etc.
  const CROP_RE = /\d+(?:\.\d+)?:\d+/;

  it("moment hero framing directive contains a crop ratio", () => {
    const { framingHint, layoutFamily } = buildSceneBlueprint(RESTAURANT);
    expect(framingHint.length).toBeGreaterThan(30);
    expect(CROP_RE.test(framingHint)).toBe(true);
    const momentLayouts: LayoutFamily[] = ["cinematic", "documentary", "editorial", "product-focus", "luxury-poster", "lifestyle"];
    expect(momentLayouts).toContain(layoutFamily);
  });

  it("authority hero framing directive contains a crop ratio", () => {
    const { framingHint, layoutFamily } = buildSceneBlueprint(DENTAL);
    expect(framingHint.length).toBeGreaterThan(30);
    expect(CROP_RE.test(framingHint)).toBe(true);
    const authorityLayouts: LayoutFamily[] = ["magazine-cover", "editorial", "environmental", "documentary", "luxury-poster", "minimal"];
    expect(authorityLayouts).toContain(layoutFamily);
  });

  it("product hero framing directive contains a crop ratio", () => {
    const { framingHint, layoutFamily } = buildSceneBlueprint(JEWELLERY);
    expect(framingHint.length).toBeGreaterThan(30);
    expect(CROP_RE.test(framingHint)).toBe(true);
    const productLayouts: LayoutFamily[] = ["product-focus", "luxury-poster", "lifestyle", "editorial", "minimal", "cinematic"];
    expect(productLayouts).toContain(layoutFamily);
  });

  it("environment hero framing directive contains a crop ratio", () => {
    const { framingHint, layoutFamily } = buildSceneBlueprint(REAL_ESTATE);
    expect(framingHint.length).toBeGreaterThan(30);
    expect(CROP_RE.test(framingHint)).toBe(true);
    const environmentLayouts: LayoutFamily[] = ["environmental", "cinematic", "editorial", "lifestyle", "minimal", "documentary"];
    expect(environmentLayouts).toContain(layoutFamily);
  });

  it("framing hint is non-empty for all 10 industries", () => {
    const fixtures = [RESTAURANT, DENTAL, SALON, JEWELLERY, HOSPITAL,
                      INTERIOR, REAL_ESTATE, FURNITURE, SCHOOL, RETAIL];
    for (const fixture of fixtures) {
      expect(buildSceneBlueprint(fixture).framingHint.length).toBeGreaterThan(10);
    }
  });

  it("deterministic — same fixture produces same blueprint every call", () => {
    const bp1 = buildSceneBlueprint(RESTAURANT);
    const bp2 = buildSceneBlueprint(RESTAURANT);
    expect(bp1).toEqual(bp2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.3D — Dynamic Visual Variety Engine
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3D — Visual Variety Engine: hero type", () => {
  it("abstract emotional hero subject → emotion hero type", () => {
    const bp = buildSceneBlueprint(dir({
      environment: "Dental clinic.",
      heroSubject: "The feeling of pure relief — confidence returning after years of hiding your smile.",
    }));
    expect(bp.heroType).toBe("emotion");
  });

  it("emotion hero framing directive contains a crop ratio", () => {
    const bp = buildSceneBlueprint(dir({
      heroSubject: "The feeling of pure relief — confidence returning after years of hiding your smile.",
    }));
    const emotionLayouts: LayoutFamily[] = ["lifestyle", "environmental", "documentary", "magazine-cover", "editorial", "minimal"];
    expect(emotionLayouts).toContain(bp.layoutFamily);
    expect(/\d+(?:\.\d+)?:\d+/.test(bp.framingHint)).toBe(true);
  });
});

describe("Phase 10.3D — Visual Variety Engine: blueprint fields", () => {
  it("blueprint includes layoutFamily and variationKey fields", () => {
    const bp = buildSceneBlueprint(RESTAURANT);
    expect(bp.layoutFamily).toBeTruthy();
    expect(typeof bp.variationKey).toBe("number");
    expect(Number.isFinite(bp.variationKey)).toBe(true);
  });

  it("different variation signals produce different variation keys", () => {
    const a = buildSceneBlueprint(dir({ heroSubject: "Chef places garnish.", commercialStyle: "Luxury brand A." }));
    const b = buildSceneBlueprint(dir({ heroSubject: "Chef places garnish.", commercialStyle: "Modern brand B." }));
    const c = buildSceneBlueprint(dir({ heroSubject: "Chef places garnish.", viewerEmotion: "Desire." }));
    const keys = [a.variationKey, b.variationKey, c.variationKey];
    expect(new Set(keys).size).toBe(3);
  });

  it("sceneContext includes the composition format modifier", () => {
    const bp = buildSceneBlueprint(RESTAURANT);
    // sceneContext = base template + variant sceneModifier
    // Base = "Fine-dining restaurant interior, warm ambient lighting. Active evening service."
    // Modifier is a brief format hint (e.g., "Cinematic 2.39:1." or "Editorial, 3:2 landscape." etc.)
    const ctx = bp.sceneContext.toLowerCase();
    expect(ctx).toContain("restaurant");
    // Modifier appended — sceneContext longer than the base template alone
    expect(bp.sceneContext.length).toBeGreaterThan("Fine-dining restaurant interior, warm ambient lighting. Active evening service.".length);
  });
});

describe("Phase 10.3D — Visual Variety Engine: composition variety", () => {
  it("same hero type with different campaign signals produces 3+ distinct layout families", () => {
    // 12 moment campaigns with different commercial styles — should span multiple layout families
    const chefLayouts = Array.from({ length: 12 }, (_, i) =>
      buildSceneBlueprint(dir({
        heroSubject:     "Chef places the final microgreen garnish.",
        commercialStyle: `Signal variant ${i + 1}: ${["luxury dining", "modern bistro", "celebrity chef", "farm-to-table", "fusion restaurant", "heritage kitchen", "midnight supper", "vegan gourmet", "corporate dining", "romantic occasion", "family trattoria", "street food elevated"][i]}.`,
      })).layoutFamily
    );
    expect(new Set(chefLayouts).size).toBeGreaterThanOrEqual(3);
  });

  it("background activity varies independently from layout family", () => {
    const blueprints = Array.from({ length: 12 }, (_, i) =>
      buildSceneBlueprint(dir({
        heroSubject:     "Chef places the final microgreen garnish.",
        commercialStyle: `Restaurant campaign signal ${i + 1}: distinct positioning ${i * 11 + 7}.`,
      }))
    );
    const layouts    = blueprints.map(b => b.layoutFamily);
    const activities = blueprints.map(b => b.backgroundActivity.slice(0, 40));
    // Both layout and background must show some variety independently
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(2);
    expect(new Set(activities).size).toBeGreaterThanOrEqual(2);
  });
});

describe("Phase 10.3D — Visual Variety Engine: restaurant regression", () => {
  // 10 restaurant campaigns — same hero, same emotion, same objective, different story flow.
  // Rule: same industry + same hero ≠ same composition.
  // Determinism preserved: same input always produces same output.

  const restaurantCampaign = (cs: string, mo: string) => dir({
    heroSubject:        "An Indian head chef places the final microgreen garnish on the signature dish.",
    viewerEmotion:      "Desire and exclusivity.",
    marketingObjective: "Drive dinner reservations.",
    commercialStyle:    cs,
    visualStory:        { before: "", moment: mo, after: "" },
  });

  const CAMPAIGNS = [
    restaurantCampaign("Luxury fine dining, chef's table experience.", "Chef completes the signature creation at the pass."),
    restaurantCampaign("Modern Indian cuisine, contemporary positioning.", "Chef applies the final microgreen with surgical care."),
    restaurantCampaign("Celebrity chef brand, Michelin-starred kitchen.", "Chef presents his artistic plating as complete."),
    restaurantCampaign("Farm-to-table, seasonal tasting menu.", "Chef adds the last seasonal forage element."),
    restaurantCampaign("Street food elevated, bold flavour profile.", "Chef finishes the street-inspired signature plate."),
    restaurantCampaign("Heritage cuisine, grandmother recipes modernised.", "Chef completes a dish rooted in family tradition."),
    restaurantCampaign("Late-night dining, after-theatre crowd.", "Chef plates the midnight tasting special."),
    restaurantCampaign("Vegetarian gourmet, plant-forward innovation.", "Chef finishes the vegetarian centrepiece."),
    restaurantCampaign("Corporate dining, power lunch destination.", "Chef presents the business lunch signature."),
    restaurantCampaign("Romantic dinner, proposal-worthy experience.", "Chef delivers the couples sharing platter."),
  ];

  it("10 restaurant campaigns → minimum 7 visually unique compositions", () => {
    const blueprints = CAMPAIGNS.map(c => buildSceneBlueprint(c));
    // Compound key: layout family + first 30 chars of background activity
    const compoundKeys = blueprints.map(b => `${b.layoutFamily}::${b.backgroundActivity.slice(0, 30)}`);
    const uniqueCompositions = new Set(compoundKeys).size;
    expect(uniqueCompositions).toBeGreaterThanOrEqual(7);
  });

  it("10 restaurant campaigns produce at least 4 unique layout families", () => {
    const layouts = CAMPAIGNS.map(c => buildSceneBlueprint(c).layoutFamily);
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(4);
  });

  it("10 restaurant campaigns produce at least 4 unique background activities", () => {
    const activities = CAMPAIGNS.map(c => buildSceneBlueprint(c).backgroundActivity.slice(0, 40));
    expect(new Set(activities).size).toBeGreaterThanOrEqual(4);
  });

  it("same campaign always produces identical blueprint (determinism preserved)", () => {
    const c = CAMPAIGNS[0]!;
    expect(buildSceneBlueprint(c)).toEqual(buildSceneBlueprint(c));
  });

  it("all 10 campaigns have different variation keys", () => {
    const keys = CAMPAIGNS.map(c => buildSceneBlueprint(c).variationKey);
    expect(new Set(keys).size).toBe(10);
  });

  it("no campaign produces 'blurred background'", () => {
    for (const c of CAMPAIGNS) {
      expect(buildSceneBlueprint(c).backgroundActivity.toLowerCase()).not.toContain("blurred background");
    }
  });
});
