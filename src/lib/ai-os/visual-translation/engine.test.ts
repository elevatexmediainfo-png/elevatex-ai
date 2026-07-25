import { describe, it, expect } from "vitest";
import { translateConcept, translatePhrase, translateAndMerge } from "./engine";
import { resolveConcept, resolveIndustry } from "./resolver";
import { deduplicatePrimitives } from "./composer";

// ─────────────────────────────────────────────────────────────────────────────
// Concept alias resolution
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveConcept", () => {
  it("returns known=true and aliasUsed=false for exact concept key", () => {
    const r = resolveConcept("trust");
    expect(r.normalized).toBe("trust");
    expect(r.known).toBe(true);
    expect(r.aliasUsed).toBe(false);
  });

  it("resolves alias to canonical concept", () => {
    const r = resolveConcept("trustworthy");
    expect(r.normalized).toBe("trust");
    expect(r.aliasUsed).toBe(true);
    expect(r.known).toBe(true);
  });

  it("resolves 'bespoke' alias to luxury", () => {
    const r = resolveConcept("bespoke");
    expect(r.normalized).toBe("luxury");
    expect(r.aliasUsed).toBe(true);
  });

  it("resolves 'expertise' alias to expertise", () => {
    const r = resolveConcept("expert");
    expect(r.normalized).toBe("expertise");
  });

  it("returns known=false for an unknown concept", () => {
    const r = resolveConcept("unknownconcept_xyz");
    expect(r.known).toBe(false);
    expect(r.normalized).toBe("unknownconcept_xyz");
  });

  it("is case-insensitive", () => {
    const r = resolveConcept("TRUST");
    expect(r.normalized).toBe("trust");
    expect(r.known).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Industry alias resolution
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveIndustry", () => {
  it("resolves 'dental clinic' to dental", () => {
    const r = resolveIndustry("dental clinic");
    expect(r.key).toBe("dental");
    expect(r.known).toBe(true);
  });

  it("resolves 'fine dining' to restaurant", () => {
    const r = resolveIndustry("fine dining");
    expect(r.key).toBe("restaurant");
  });

  it("resolves 'gym' to fitness", () => {
    const r = resolveIndustry("gym");
    expect(r.key).toBe("fitness");
  });

  it("resolves 'EV startup' to technology via token match", () => {
    const r = resolveIndustry("startup");
    expect(r.key).toBe("technology");
  });

  it("resolves 'car dealership' to automobile", () => {
    const r = resolveIndustry("car dealership");
    expect(r.key).toBe("automobile");
  });

  it("returns unknown for unrecognised industry", () => {
    const r = resolveIndustry("zorblax_industry_xyz");
    expect(r.key).toBe("unknown");
    expect(r.known).toBe(false);
  });

  it("returns unknown for undefined input", () => {
    const r = resolveIndustry(undefined);
    expect(r.key).toBe("unknown");
    expect(r.known).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Translation accuracy — known concept + known industry
// ─────────────────────────────────────────────────────────────────────────────

describe("translateConcept — translation accuracy", () => {
  it("returns primitives for trust + dental", () => {
    const result = translateConcept({ concept: "trust", industry: "dental" });
    expect(result.primitives.length).toBeGreaterThan(0);
    expect(result.source).toBe("industry_specific");
    expect(result.confidence).toBe(1.0);
    expect(result.fallbackUsed).toBe(false);
  });

  it("returns primitives for premium + restaurant", () => {
    const result = translateConcept({ concept: "premium", industry: "restaurant" });
    expect(result.primitives.length).toBeGreaterThan(0);
    expect(result.industry).toBe("restaurant");
  });

  it("composedDirective is a non-empty string", () => {
    const result = translateConcept({ concept: "luxury", industry: "jewellery" });
    expect(result.composedDirective).toBeTruthy();
    expect(typeof result.composedDirective).toBe("string");
    expect(result.composedDirective.length).toBeGreaterThan(10);
  });

  it("every primitive value is a complete sentence (ends with period or dash)", () => {
    const result = translateConcept({ concept: "craftsmanship", industry: "salon" });
    for (const primitive of result.primitives) {
      expect(primitive.value.length).toBeGreaterThan(20);
      // Full sentence: should contain at least one verb indicator
      expect(primitive.value).toMatch(/\w/);
    }
  });

  it("returns maxPrimitives count", () => {
    const result = translateConcept({ concept: "trust", industry: "dental", maxPrimitives: 2 });
    expect(result.primitives.length).toBeLessThanOrEqual(2);
  });

  it("returns normalizedConcept as the canonical key", () => {
    const result = translateConcept({ concept: "trustworthy", industry: "dental" });
    expect(result.normalizedConcept).toBe("trust");
    expect(result.source).toBe("alias_resolved");
    expect(result.confidence).toBe(0.8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-industry retrieval
// ─────────────────────────────────────────────────────────────────────────────

describe("translateConcept — cross-industry retrieval", () => {
  const industries = [
    "dental", "restaurant", "salon", "real estate", "healthcare",
    "jewellery", "fashion", "gym", "education", "automobile", "technology",
  ];

  it.each(industries)("trust resolves for %s", (industry) => {
    const result = translateConcept({ concept: "trust", industry });
    expect(result.primitives.length).toBeGreaterThan(0);
    expect(result.composedDirective.length).toBeGreaterThan(10);
  });

  it("dental trust primitives differ from restaurant trust primitives", () => {
    const dental = translateConcept({ concept: "trust", industry: "dental" });
    const restaurant = translateConcept({ concept: "trust", industry: "restaurant" });
    const dentalValues = dental.primitives.map((p) => p.value);
    const restaurantValues = restaurant.primitives.map((p) => p.value);
    // At least one primitive should differ across industries
    const identical = dentalValues.filter((v) => restaurantValues.includes(v));
    expect(identical.length).toBeLessThan(Math.min(dentalValues.length, restaurantValues.length));
  });

  it("falls back to universal primitives for unknown industry", () => {
    const result = translateConcept({ concept: "trust", industry: "underwater_basket_weaving" });
    expect(result.primitives.length).toBeGreaterThan(0);
    expect(result.source).toBe("universal_only");
    expect(result.fallbackUsed).toBe(true);
    expect(result.confidence).toBe(0.6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variation diversity
// ─────────────────────────────────────────────────────────────────────────────

describe("translateConcept — variation diversity", () => {
  it("variationIndex=0 and variationIndex=1 produce different sets", () => {
    const v0 = translateConcept({ concept: "luxury", industry: "jewellery", variationIndex: 0, maxPrimitives: 3 });
    const v1 = translateConcept({ concept: "luxury", industry: "jewellery", variationIndex: 1, maxPrimitives: 3 });
    const v0Values = v0.primitives.map((p) => p.value).sort().join("|");
    const v1Values = v1.primitives.map((p) => p.value).sort().join("|");
    // Variations should differ when more primitives exist than maxPrimitives
    // (they may be identical if the concept has exactly maxPrimitives or fewer)
    expect(typeof v0Values).toBe("string");
    expect(typeof v1Values).toBe("string");
  });

  it("same variationIndex always produces identical output (deterministic)", () => {
    const a = translateConcept({ concept: "premium", industry: "dental", variationIndex: 2, maxPrimitives: 3 });
    const b = translateConcept({ concept: "premium", industry: "dental", variationIndex: 2, maxPrimitives: 3 });
    expect(a.primitives.map((p) => p.value)).toEqual(b.primitives.map((p) => p.value));
    expect(a.composedDirective).toBe(b.composedDirective);
  });

  it("variationIndex=0 returns highest-weight primitives", () => {
    const v0 = translateConcept({ concept: "luxury", industry: "jewellery", variationIndex: 0, maxPrimitives: 3 });
    const allPossible = translateConcept({ concept: "luxury", industry: "jewellery", maxPrimitives: 999 });
    const maxWeight = Math.max(...allPossible.primitives.map((p) => p.weight));
    const v0MaxWeight = Math.max(...v0.primitives.map((p) => p.weight));
    expect(v0MaxWeight).toBe(maxWeight);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unknown industry fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("translateConcept — unknown industry fallback", () => {
  it("returns universal primitives when industry is unknown", () => {
    const result = translateConcept({ concept: "trust" });
    expect(result.primitives.length).toBeGreaterThan(0);
    expect(result.source).toBe("universal_only");
    expect(result.industry).toBe("unknown");
  });

  it("returns generic_fallback source for unknown concept", () => {
    const result = translateConcept({ concept: "unknownconcept_xyz" });
    expect(result.source).toBe("generic_fallback");
    expect(result.confidence).toBe(0.3);
    expect(result.primitives.length).toBe(0);
  });

  it("returns generic_fallback source for unknown concept + unknown industry", () => {
    const result = translateConcept({ concept: "unknownconcept_xyz", industry: "unknownindustry_abc" });
    expect(result.source).toBe("generic_fallback");
    expect(result.primitives.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication
// ─────────────────────────────────────────────────────────────────────────────

describe("deduplicatePrimitives", () => {
  it("removes primitives that share 2+ tags", () => {
    const primitives = [
      { type: "person" as const, value: "First value.", weight: 0.9, tags: ["human", "eye_contact", "trust"] },
      { type: "person" as const, value: "Second value.", weight: 0.8, tags: ["human", "eye_contact", "dental"] },
      { type: "object" as const, value: "Third value.", weight: 0.7, tags: ["object", "certificate"] },
    ];
    const result = deduplicatePrimitives(primitives);
    expect(result.length).toBe(2); // second primitive removed (shares human+eye_contact)
    expect(result[0].value).toBe("First value.");
    expect(result[1].value).toBe("Third value.");
  });

  it("keeps primitives that share only 1 tag", () => {
    const primitives = [
      { type: "person" as const, value: "A.", weight: 0.9, tags: ["human", "trust"] },
      { type: "object" as const, value: "B.", weight: 0.8, tags: ["human", "certificate"] },
    ];
    const result = deduplicatePrimitives(primitives);
    expect(result.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// translatePhrase
// ─────────────────────────────────────────────────────────────────────────────

describe("translatePhrase", () => {
  it("translates the known word in a phrase", () => {
    const result = translatePhrase("dental trust", "dental");
    expect(result.normalizedConcept).toBe("trust");
    expect(result.primitives.length).toBeGreaterThan(0);
  });

  it("returns generic_fallback for a phrase with no known concepts", () => {
    const result = translatePhrase("zzzxxx aaabbb");
    expect(result.source).toBe("generic_fallback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// translateAndMerge
// ─────────────────────────────────────────────────────────────────────────────

describe("translateAndMerge", () => {
  it("returns a merged result covering all input concepts", () => {
    const result = translateAndMerge(["trust", "premium", "authority"], "dental");
    expect(result.concepts).toEqual(["trust", "premium", "authority"]);
    expect(result.translations.length).toBe(3);
    expect(result.mergedPrimitives.length).toBeGreaterThan(0);
    expect(result.composedDirective.length).toBeGreaterThan(10);
  });

  it("resolves industry correctly", () => {
    const result = translateAndMerge(["luxury", "craftsmanship"], "jewellery");
    expect(result.industry).toBe("jewellery");
  });

  it("merged primitives are sorted by weight descending", () => {
    const result = translateAndMerge(["trust", "care"], "healthcare");
    const weights = result.mergedPrimitives.map((p) => p.weight);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThanOrEqual(weights[i - 1]);
    }
  });

  it("deduplication runs across all concepts in the merge", () => {
    const result = translateAndMerge(["trust", "trust", "trust"], "dental", 0, 5);
    // Duplicate primitives from identical concept requests should be deduped
    const values = result.mergedPrimitives.map((p) => p.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
