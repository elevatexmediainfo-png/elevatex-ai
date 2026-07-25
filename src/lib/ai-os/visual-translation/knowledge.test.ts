import { describe, it, expect } from "vitest";
import {
  UNIVERSAL_CONCEPTS,
  CONCEPT_ALIASES,
  ALL_INDUSTRIES,
  INDUSTRY_REGISTRY,
  INDUSTRY_ALIASES,
} from "./knowledge/index";

const REQUIRED_CONCEPTS = [
  "trust", "care", "warmth", "comfort", "confidence", "desire",
  "premium", "luxury", "elegance", "craftsmanship", "precision",
  "cleanliness", "authority", "expertise", "reliability", "innovation",
  "transformation", "freshness", "achievement", "community", "urgency", "safety",
];

const INDUSTRY_KEYS = [
  "restaurant", "dental", "salon", "real_estate", "healthcare",
  "jewellery", "fashion", "fitness", "education", "automobile",
  "technology", "generic",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Universal concepts coverage
// ─────────────────────────────────────────────────────────────────────────────

describe("UNIVERSAL_CONCEPTS", () => {
  it.each(REQUIRED_CONCEPTS)("defines '%s' concept", (concept) => {
    expect(UNIVERSAL_CONCEPTS[concept]).toBeDefined();
    expect(UNIVERSAL_CONCEPTS[concept].length).toBeGreaterThan(0);
  });

  it("every concept has at least 4 primitives", () => {
    for (const [concept, primitives] of Object.entries(UNIVERSAL_CONCEPTS)) {
      expect(primitives.length, `${concept} has fewer than 4 primitives`).toBeGreaterThanOrEqual(4);
    }
  });

  it("every primitive value is a complete sentence (not a keyword list)", () => {
    for (const [concept, primitives] of Object.entries(UNIVERSAL_CONCEPTS)) {
      for (const primitive of primitives) {
        expect(
          primitive.value.length,
          `${concept} primitive is too short: "${primitive.value}"`,
        ).toBeGreaterThan(30);
        // Complete sentences contain spaces (not comma-only keyword lists)
        expect(
          primitive.value.includes(" "),
          `${concept} primitive looks like a keyword list: "${primitive.value}"`,
        ).toBe(true);
        // Must not be a comma-separated keyword list (≤4 commas relative to length is ok)
        const commaCount = (primitive.value.match(/,/g) ?? []).length;
        const wordCount = primitive.value.split(" ").length;
        expect(
          wordCount,
          `${concept} primitive has too few words: "${primitive.value}"`,
        ).toBeGreaterThan(8);
      }
    }
  });

  it("every primitive has a weight between 0.0 and 1.0", () => {
    for (const [concept, primitives] of Object.entries(UNIVERSAL_CONCEPTS)) {
      for (const primitive of primitives) {
        expect(primitive.weight, `${concept}`).toBeGreaterThanOrEqual(0.0);
        expect(primitive.weight, `${concept}`).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it("every primitive has at least 2 tags", () => {
    for (const [concept, primitives] of Object.entries(UNIVERSAL_CONCEPTS)) {
      for (const primitive of primitives) {
        expect(
          primitive.tags.length,
          `${concept} primitive has fewer than 2 tags`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("every primitive has a valid type", () => {
    const validTypes = ["object", "action", "person", "material", "lighting", "spatial", "composition", "color"];
    for (const [concept, primitives] of Object.entries(UNIVERSAL_CONCEPTS)) {
      for (const primitive of primitives) {
        expect(
          validTypes,
          `${concept} has invalid primitive type: "${primitive.type}"`,
        ).toContain(primitive.type);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Concept aliases
// ─────────────────────────────────────────────────────────────────────────────

describe("CONCEPT_ALIASES", () => {
  it("has at least 50 aliases", () => {
    expect(Object.keys(CONCEPT_ALIASES).length).toBeGreaterThanOrEqual(50);
  });

  it("every alias target is a known concept key", () => {
    for (const [alias, target] of Object.entries(CONCEPT_ALIASES)) {
      expect(
        UNIVERSAL_CONCEPTS[target],
        `Alias "${alias}" → "${target}" does not exist in UNIVERSAL_CONCEPTS`,
      ).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Industry registry coverage
// ─────────────────────────────────────────────────────────────────────────────

describe("INDUSTRY_REGISTRY", () => {
  it.each(INDUSTRY_KEYS)("contains '%s' industry", (key) => {
    expect(INDUSTRY_REGISTRY[key]).toBeDefined();
    expect(INDUSTRY_REGISTRY[key].key).toBe(key);
  });

  it.each(INDUSTRY_KEYS)("%s has at least 3 aliases", (key) => {
    expect(INDUSTRY_REGISTRY[key].aliases.length).toBeGreaterThanOrEqual(3);
  });

  it.each(INDUSTRY_KEYS)("%s has at least 5 concept overrides", (key) => {
    expect(
      Object.keys(INDUSTRY_REGISTRY[key].concepts).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it.each(INDUSTRY_KEYS)("%s has 'trust' concept defined", (key) => {
    // Trust is the most universal concept — every industry should define it
    expect(INDUSTRY_REGISTRY[key].concepts["trust"]).toBeDefined();
    expect(INDUSTRY_REGISTRY[key].concepts["trust"]!.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Industry concept primitive quality
// ─────────────────────────────────────────────────────────────────────────────

describe("Industry concept primitives quality", () => {
  it("every industry primitive value is a complete sentence", () => {
    for (const industry of ALL_INDUSTRIES) {
      for (const [concept, primitives] of Object.entries(industry.concepts)) {
        for (const primitive of primitives ?? []) {
          expect(
            primitive.value.length,
            `${industry.key}.${concept} primitive too short: "${primitive.value}"`,
          ).toBeGreaterThan(30);
          expect(
            primitive.value.split(" ").length,
            `${industry.key}.${concept} primitive looks like keyword list: "${primitive.value}"`,
          ).toBeGreaterThan(8);
        }
      }
    }
  });

  it("no industry concept array is empty", () => {
    for (const industry of ALL_INDUSTRIES) {
      for (const [concept, primitives] of Object.entries(industry.concepts)) {
        expect(
          (primitives ?? []).length,
          `${industry.key}.${concept} has an empty primitives array`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("all industry concept targets exist in UNIVERSAL_CONCEPTS", () => {
    for (const industry of ALL_INDUSTRIES) {
      for (const concept of Object.keys(industry.concepts)) {
        expect(
          UNIVERSAL_CONCEPTS[concept],
          `${industry.key} references concept "${concept}" not in UNIVERSAL_CONCEPTS`,
        ).toBeDefined();
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Industry alias index
// ─────────────────────────────────────────────────────────────────────────────

describe("INDUSTRY_ALIASES", () => {
  it("resolves 'dental' to dental", () => {
    expect(INDUSTRY_ALIASES["dental"]).toBe("dental");
  });

  it("resolves 'gym' to fitness", () => {
    expect(INDUSTRY_ALIASES["gym"]).toBe("fitness");
  });

  it("resolves 'fine dining' to restaurant", () => {
    expect(INDUSTRY_ALIASES["fine dining"]).toBe("restaurant");
  });

  it("resolves 'car dealership' to automobile", () => {
    expect(INDUSTRY_ALIASES["car dealership"]).toBe("automobile");
  });

  it("resolves 'saas' to technology", () => {
    expect(INDUSTRY_ALIASES["saas"]).toBe("technology");
  });

  it("has at least 100 entries (comprehensive alias coverage)", () => {
    expect(Object.keys(INDUSTRY_ALIASES).length).toBeGreaterThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ALL_INDUSTRIES completeness
// ─────────────────────────────────────────────────────────────────────────────

describe("ALL_INDUSTRIES", () => {
  it("contains exactly 12 industries", () => {
    expect(ALL_INDUSTRIES.length).toBe(12);
  });

  it("every industry key is unique", () => {
    const keys = ALL_INDUSTRIES.map((i) => i.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("every industry key matches its entry key", () => {
    for (const industry of ALL_INDUSTRIES) {
      expect(INDUSTRY_REGISTRY[industry.key]).toBe(industry);
    }
  });
});
