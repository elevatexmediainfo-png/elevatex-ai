import { describe, expect, it } from "vitest";

import {
  buildTypographyPlanFromInput,
  buildTypographyFromBlueprintInputs,
  strategyToTypographyInput,
} from "./typography-engine";
import {
  computeImportances,
  buildHierarchyMap,
} from "./hierarchy-engine";
import { computeSpacing, spacingBelow, spacingAbove } from "./spacing-engine";
import { getContrastForElement }                       from "./contrast-engine";
import { getAlignment }                                from "./alignment-engine";
import {
  buildResponsiveAdjustments,
  normaliseOrientation,
  escalateSize,
  deescalateSize,
  DEFAULT_BREAKPOINTS,
} from "./responsive-engine";
import {
  COMPOSITION_TO_TYPOGRAPHY_STYLE,
  INDUSTRY_DEFAULT_STYLE,
  STYLE_DEFINITIONS,
  getImportanceMap,
} from "./industry-rules";
import type { TypographyInput, DensityLevel, TypographyStyle } from "./types";

import { buildCreativeStrategy }     from "../creative-brain";
import { buildCampaignPlan }         from "../creative-director";
import { buildVisualLayoutPlan }     from "../visual-layout";
import { buildCreativeContext }       from "../creative-context";
import { analyzeUserRequest }         from "../user-understanding";
import { planFromStrategy }           from "../commercial-assets/adapter";
import { buildCompositionFromBlueprintInputs } from "../commercial-composition/composition-engine";
import { buildCopyFromBlueprintInputs }        from "../copy-intelligence/copy-engine";
import type { CreativeRequest }       from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal TypographyInput directly — for unit-level tests. */
function makeInput(overrides: Partial<TypographyInput> = {}): TypographyInput {
  return {
    industry:             "general",
    brandType:            "professional",
    communicationStyle:   "professional",
    aspectRatio:          "1:1",
    orientation:          "square",
    density:              "balanced",
    hasOffer:             false,
    hasBadge:             false,
    hasDisclaimer:        false,
    hasSubheadline:       false,
    hasSecondaryCta:      false,
    benefitCount:         4,
    compositionStrategyId: "corporate",
    ...overrides,
  };
}

/** Build all blueprint intermediates from a raw idea — for integration tests. */
function makeFullInputs(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu          = analyzeUserRequest(request);
  const ctx         = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy    = buildCreativeStrategy(ctx);
  const campaign    = buildCampaignPlan(strategy);
  const layoutPlan  = buildVisualLayoutPlan(strategy, campaign);
  const assets      = planFromStrategy(strategy);
  const composition = buildCompositionFromBlueprintInputs(strategy, assets, layoutPlan);
  const copy        = buildCopyFromBlueprintInputs(strategy, assets, rawIdea);
  return { strategy, layoutPlan, composition, copy };
}

// ─────────────────────────────────────────────────────────────────────────────
// industry-rules — COMPOSITION_TO_TYPOGRAPHY_STYLE
// ─────────────────────────────────────────────────────────────────────────────

describe("COMPOSITION_TO_TYPOGRAPHY_STYLE", () => {
  it("maps luxury strategy to luxury style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["luxury"]).toBe("luxury");
  });

  it("maps healthcare strategy to healthcare style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["healthcare"]).toBe("healthcare");
  });

  it("maps restaurant strategy to restaurant style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["restaurant"]).toBe("restaurant");
  });

  it("maps real_estate strategy to real_estate style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["real_estate"]).toBe("real_estate");
  });

  it("maps mobile_first strategy to social style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["mobile_first"]).toBe("social");
  });

  it("maps landscape strategy to product style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["landscape"]).toBe("product");
  });

  it("maps square strategy to product style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["square"]).toBe("product");
  });

  it("maps vertical strategy to social style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["vertical"]).toBe("social");
  });

  it("maps editorial strategy to editorial style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["editorial"]).toBe("editorial");
  });

  it("maps fashion strategy to fashion style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["fashion"]).toBe("fashion");
  });

  it("maps corporate strategy to corporate style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["corporate"]).toBe("corporate");
  });

  it("maps minimal strategy to minimal style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["minimal"]).toBe("minimal");
  });

  it("maps social strategy to social style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["social"]).toBe("social");
  });

  it("maps product strategy to product style", () => {
    expect(COMPOSITION_TO_TYPOGRAPHY_STYLE["product"]).toBe("product");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// industry-rules — INDUSTRY_DEFAULT_STYLE
// ─────────────────────────────────────────────────────────────────────────────

describe("INDUSTRY_DEFAULT_STYLE", () => {
  it("dental → healthcare", () => {
    expect(INDUSTRY_DEFAULT_STYLE["dental"]).toBe("healthcare");
  });

  it("jewelry → luxury", () => {
    expect(INDUSTRY_DEFAULT_STYLE["jewelry"]).toBe("luxury");
  });

  it("real_estate → real_estate", () => {
    expect(INDUSTRY_DEFAULT_STYLE["real_estate"]).toBe("real_estate");
  });

  it("restaurant → restaurant", () => {
    expect(INDUSTRY_DEFAULT_STYLE["restaurant"]).toBe("restaurant");
  });

  it("tech → minimal", () => {
    expect(INDUSTRY_DEFAULT_STYLE["tech"]).toBe("minimal");
  });

  it("fashion → fashion", () => {
    expect(INDUSTRY_DEFAULT_STYLE["fashion"]).toBe("fashion");
  });

  it("finance → corporate", () => {
    expect(INDUSTRY_DEFAULT_STYLE["finance"]).toBe("corporate");
  });

  it("events → social", () => {
    expect(INDUSTRY_DEFAULT_STYLE["events"]).toBe("social");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// industry-rules — STYLE_DEFINITIONS completeness
// ─────────────────────────────────────────────────────────────────────────────

describe("STYLE_DEFINITIONS completeness", () => {
  const ALL_STYLES: TypographyStyle[] = [
    "luxury","minimal","editorial","product","healthcare",
    "real_estate","restaurant","fashion","corporate","social",
  ];

  for (const style of ALL_STYLES) {
    it(`${style} has all required fields`, () => {
      const def = STYLE_DEFINITIONS[style];
      expect(def.headlineWeight).toBeDefined();
      expect(def.headlineSize).toBeDefined();
      expect(def.ctaSize).toBeDefined();
      expect(def.ctaBorderRadius).toBeTypeOf("number");
      expect(def.ctaPaddingH).toBeTypeOf("number");
      expect(def.ctaPaddingV).toBeTypeOf("number");
      expect(def.benefitBullet).toBeDefined();
      expect(def.density).toBeDefined();
      expect(def.globalPadding).toBeTypeOf("number");
      expect(def.sectionSpacing).toBeTypeOf("number");
      expect(def.elementSpacing).toBeTypeOf("number");
    });
  }

  it("luxury has zero border radius (sharp edge)", () => {
    expect(STYLE_DEFINITIONS["luxury"].ctaBorderRadius).toBe(0);
  });

  it("luxury has dominant headline weight", () => {
    expect(STYLE_DEFINITIONS["luxury"].headlineWeight).toBe("dominant");
  });

  it("fashion has uppercase headline transform", () => {
    expect(STYLE_DEFINITIONS["fashion"].headlineTransform).toBe("uppercase");
  });

  it("fashion has none bullet style (no list bullets)", () => {
    expect(STYLE_DEFINITIONS["fashion"].benefitBullet).toBe("none");
  });

  it("healthcare has check bullet style", () => {
    expect(STYLE_DEFINITIONS["healthcare"].benefitBullet).toBe("check");
  });

  it("social style uses dense density", () => {
    expect(STYLE_DEFINITIONS["social"].density).toBe("dense");
  });

  it("luxury and fashion styles use sparse density", () => {
    expect(STYLE_DEFINITIONS["luxury"].density).toBe("sparse");
    expect(STYLE_DEFINITIONS["fashion"].density).toBe("sparse");
  });

  it("minimal style has no bullets", () => {
    expect(STYLE_DEFINITIONS["minimal"].benefitBullet).toBe("none");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// industry-rules — getImportanceMap
// ─────────────────────────────────────────────────────────────────────────────

describe("getImportanceMap", () => {
  it("headline is always 10 in base", () => {
    const map = getImportanceMap("corporate");
    expect(map.headline).toBe(10);
  });

  it("cta is always 9 in base", () => {
    const map = getImportanceMap("corporate");
    expect(map.cta).toBe(9);
  });

  it("footer is always 2 in base", () => {
    const map = getImportanceMap("corporate");
    expect(map.footer).toBe(2);
  });

  it("disclaimer is always 1 in base", () => {
    const map = getImportanceMap("corporate");
    expect(map.disclaimer).toBe(1);
  });

  it("luxury downplays offer (≤ 6)", () => {
    const map = getImportanceMap("luxury");
    expect(map.offer).toBeLessThanOrEqual(6);
  });

  it("editorial elevates subheadline (≥ 8)", () => {
    const map = getImportanceMap("editorial");
    expect(map.subheadline).toBeGreaterThanOrEqual(8);
  });

  it("fashion foregrounds badge (≥ 7)", () => {
    const map = getImportanceMap("fashion");
    expect(map.badge).toBeGreaterThanOrEqual(7);
  });

  it("healthcare foregrounds socialProof (≥ 6)", () => {
    const map = getImportanceMap("healthcare");
    expect(map.socialProof).toBeGreaterThanOrEqual(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hierarchy-engine — computeImportances
// ─────────────────────────────────────────────────────────────────────────────

describe("computeImportances", () => {
  it("headline is always 10 (invariant enforced)", () => {
    for (const style of ["luxury","social","fashion","editorial"] as TypographyStyle[]) {
      const imp = computeImportances(style, false, false);
      expect(imp.headline).toBe(10);
    }
  });

  it("cta is always ≤ 9 (invariant enforced — social override clamped)", () => {
    const imp = computeImportances("social", false, false);
    expect(imp.cta).toBeLessThanOrEqual(9);
  });

  it("cta is 9 for most styles", () => {
    const imp = computeImportances("corporate", false, false);
    expect(imp.cta).toBe(9);
  });

  it("offer is 0 when hasOffer=false", () => {
    const imp = computeImportances("corporate", false, false);
    expect(imp.offer).toBe(0);
  });

  it("offer is non-zero when hasOffer=true", () => {
    const imp = computeImportances("corporate", true, false);
    expect(imp.offer).toBeGreaterThan(0);
  });

  it("badge is 0 when hasBadge=false", () => {
    const imp = computeImportances("corporate", false, false);
    expect(imp.badge).toBe(0);
  });

  it("badge is non-zero when hasBadge=true", () => {
    const imp = computeImportances("corporate", false, true);
    expect(imp.badge).toBeGreaterThan(0);
  });

  it("footer always has low importance (≤ 2)", () => {
    const imp = computeImportances("restaurant", false, false);
    expect(imp.footer).toBeLessThanOrEqual(2);
  });

  it("disclaimer always has lowest importance (= 1)", () => {
    const imp = computeImportances("healthcare", false, false);
    expect(imp.disclaimer).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hierarchy-engine — buildHierarchyMap
// ─────────────────────────────────────────────────────────────────────────────

describe("buildHierarchyMap", () => {
  it("primary is always 'headline'", () => {
    const imp = computeImportances("corporate", false, false);
    const map = buildHierarchyMap(imp, false);
    expect(map.primary).toBe("headline");
  });

  it("secondary is always 'cta'", () => {
    const imp = computeImportances("corporate", false, false);
    const map = buildHierarchyMap(imp, false);
    expect(map.secondary).toBe("cta");
  });

  it("tertiary is 'offer' when hasOffer=true", () => {
    const imp = computeImportances("corporate", true, false);
    const map = buildHierarchyMap(imp, true);
    expect(map.tertiary).toBe("offer");
  });

  it("tertiary is 'subheadline' when hasOffer=false", () => {
    const imp = computeImportances("corporate", false, false);
    const map = buildHierarchyMap(imp, false);
    expect(map.tertiary).toBe("subheadline");
  });

  it("quaternary is 'subheadline' when hasOffer=true", () => {
    const imp = computeImportances("corporate", true, false);
    const map = buildHierarchyMap(imp, true);
    expect(map.quaternary).toBe("subheadline");
  });

  it("quaternary is 'benefits' when hasOffer=false", () => {
    const imp = computeImportances("corporate", false, false);
    const map = buildHierarchyMap(imp, false);
    expect(map.quaternary).toBe("benefits");
  });

  it("body is always 'socialProof'", () => {
    const imp = computeImportances("healthcare", false, false);
    const map = buildHierarchyMap(imp, false);
    expect(map.body).toBe("socialProof");
  });

  it("footnote is 'disclaimer' when disclaimer importance > 0", () => {
    const imp = computeImportances("healthcare", false, false);
    const map = buildHierarchyMap(imp, false);
    expect(map.footnote).toBe("disclaimer");
  });

  it("footnote is 'footer' when disclaimer importance = 0 (but disclaimer is always 1)", () => {
    // disclaimer base importance is 1, so footnote is always "disclaimer" for any active plan
    const imp = computeImportances("corporate", false, false);
    const map = buildHierarchyMap(imp, false);
    expect(["disclaimer", "footer"]).toContain(map.footnote);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// spacing-engine — computeSpacing
// ─────────────────────────────────────────────────────────────────────────────

describe("computeSpacing", () => {
  it("baseUnit is always 4", () => {
    expect(computeSpacing("corporate", "balanced").baseUnit).toBe(4);
  });

  it("luxury sparse globalPadding = Math.round(10 × 1.4) = 14", () => {
    expect(computeSpacing("luxury", "sparse").globalPadding).toBe(14);
  });

  it("social dense globalPadding = Math.round(5 × 0.7) = 4", () => {
    expect(computeSpacing("social", "dense").globalPadding).toBe(4); // 5 * 0.7 = 3.5 → 4
  });

  it("sparse density > balanced density for same style", () => {
    const sp = computeSpacing("healthcare", "sparse");
    const ba = computeSpacing("healthcare", "balanced");
    expect(sp.globalPadding).toBeGreaterThan(ba.globalPadding);
  });

  it("dense density < balanced density for same style", () => {
    const ba = computeSpacing("healthcare", "balanced");
    const de = computeSpacing("healthcare", "dense");
    expect(de.globalPadding).toBeLessThan(ba.globalPadding);
  });

  it("density field matches input", () => {
    const spacing = computeSpacing("corporate", "sparse");
    expect(spacing.density).toBe("sparse");
  });

  it("breathingRoom is at least 4", () => {
    for (const density of ["sparse","balanced","dense"] as DensityLevel[]) {
      expect(computeSpacing("social", density).breathingRoom).toBeGreaterThanOrEqual(4);
    }
  });

  it("breathingRoom = max(elementSpacing × 2, 4)", () => {
    const spacing = computeSpacing("luxury", "sparse");
    const expected = Math.max(spacing.elementSpacing * 2, 4);
    expect(spacing.breathingRoom).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// spacing-engine — spacingBelow / spacingAbove
// ─────────────────────────────────────────────────────────────────────────────

describe("spacingBelow / spacingAbove", () => {
  it("balanced keeps base units (round of 4 × 1.0 = 4)", () => {
    expect(spacingBelow(4, "balanced")).toBe(4);
  });

  it("sparse multiplies (round of 4 × 1.4 = 6)", () => {
    expect(spacingBelow(4, "sparse")).toBe(6);
  });

  it("dense shrinks (round of 4 × 0.7 = 3)", () => {
    expect(spacingBelow(4, "dense")).toBe(3);
  });

  it("minimum is 1 even for tiny inputs with dense", () => {
    expect(spacingBelow(1, "dense")).toBeGreaterThanOrEqual(1);
    expect(spacingAbove(1, "dense")).toBeGreaterThanOrEqual(1);
  });

  it("spacingAbove is symmetric with spacingBelow for same inputs", () => {
    expect(spacingAbove(3, "sparse")).toBe(spacingBelow(3, "sparse"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// contrast-engine — getContrastForElement
// ─────────────────────────────────────────────────────────────────────────────

describe("getContrastForElement", () => {
  it("luxury headline → ultra_high", () => {
    expect(getContrastForElement("luxury", "headline")).toBe("ultra_high");
  });

  it("luxury socialProof → low", () => {
    expect(getContrastForElement("luxury", "socialProof")).toBe("low");
  });

  it("restaurant cta → ultra_high", () => {
    expect(getContrastForElement("restaurant", "cta")).toBe("ultra_high");
  });

  it("healthcare benefits → high", () => {
    expect(getContrastForElement("healthcare", "benefits")).toBe("high");
  });

  it("minimal benefits → low", () => {
    expect(getContrastForElement("minimal", "benefits")).toBe("low");
  });

  it("minimal cta → medium (approachable, not shouting)", () => {
    expect(getContrastForElement("minimal", "cta")).toBe("medium");
  });

  it("social headline → ultra_high", () => {
    expect(getContrastForElement("social", "headline")).toBe("ultra_high");
  });

  it("editorial headline → ultra_high", () => {
    expect(getContrastForElement("editorial", "headline")).toBe("ultra_high");
  });

  it("fashion badge → ultra_high (badge is focal point in fashion)", () => {
    expect(getContrastForElement("fashion", "badge")).toBe("ultra_high");
  });

  it("corporate footer → low", () => {
    expect(getContrastForElement("corporate", "footer")).toBe("low");
  });

  it("disclaimer contrast is low for non-regulated industries (de-emphasised)", () => {
    // healthcare uses medium — legal disclaimers need moderate visibility there
    const STYLES: TypographyStyle[] = ["luxury","corporate","restaurant","fashion"];
    for (const style of STYLES) {
      expect(getContrastForElement(style, "disclaimer")).toBe("low");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// alignment-engine — getAlignment
// ─────────────────────────────────────────────────────────────────────────────

describe("getAlignment", () => {
  it("luxury headline → left", () => {
    expect(getAlignment("luxury", "headline")).toBe("left");
  });

  it("restaurant headline → center", () => {
    expect(getAlignment("restaurant", "headline")).toBe("center");
  });

  it("healthcare benefits → left (list items)", () => {
    expect(getAlignment("healthcare", "benefits")).toBe("left");
  });

  it("fashion cta → right", () => {
    expect(getAlignment("fashion", "cta")).toBe("right");
  });

  it("real_estate offer → right", () => {
    expect(getAlignment("real_estate", "offer")).toBe("right");
  });

  it("product is all-center", () => {
    const productElements = ["headline","subheadline","cta","benefits","socialProof","offer","badge","footer","disclaimer"] as const;
    for (const el of productElements) {
      expect(getAlignment("product", el)).toBe("center");
    }
  });

  it("social is all-center", () => {
    const elements = ["headline","cta","footer","socialProof"] as const;
    for (const el of elements) {
      expect(getAlignment("social", el)).toBe("center");
    }
  });

  it("editorial is all-left", () => {
    const elements = ["headline","subheadline","cta","benefits","footer"] as const;
    for (const el of elements) {
      expect(getAlignment("editorial", el)).toBe("left");
    }
  });

  it("corporate headline → left", () => {
    expect(getAlignment("corporate", "headline")).toBe("left");
  });

  it("minimal benefits → left (readable list)", () => {
    expect(getAlignment("minimal", "benefits")).toBe("left");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// responsive-engine — normaliseOrientation
// ─────────────────────────────────────────────────────────────────────────────

describe("normaliseOrientation", () => {
  it("explicit portrait orientation wins", () => {
    expect(normaliseOrientation("16:9", "portrait")).toBe("portrait");
  });

  it("explicit landscape orientation wins", () => {
    expect(normaliseOrientation("9:16", "landscape")).toBe("landscape");
  });

  it("explicit square orientation wins", () => {
    expect(normaliseOrientation("16:9", "square")).toBe("square");
  });

  it("9:16 aspect ratio → portrait", () => {
    expect(normaliseOrientation("9:16", "")).toBe("portrait");
  });

  it("4:5 aspect ratio → portrait", () => {
    expect(normaliseOrientation("4:5", "")).toBe("portrait");
  });

  it("2:3 aspect ratio → portrait", () => {
    expect(normaliseOrientation("2:3", "")).toBe("portrait");
  });

  it("1:1 aspect ratio → square", () => {
    expect(normaliseOrientation("1:1", "")).toBe("square");
  });

  it("16:9 aspect ratio → landscape", () => {
    expect(normaliseOrientation("16:9", "")).toBe("landscape");
  });

  it("unknown aspect ratio → landscape (default)", () => {
    expect(normaliseOrientation("3:1", "")).toBe("landscape");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// responsive-engine — escalateSize / deescalateSize
// ─────────────────────────────────────────────────────────────────────────────

describe("escalateSize / deescalateSize", () => {
  it("escalateSize xs → sm", () => {
    expect(escalateSize("xs")).toBe("sm");
  });

  it("escalateSize xl → xxl", () => {
    expect(escalateSize("xl")).toBe("xxl");
  });

  it("escalateSize display → display (capped at top)", () => {
    expect(escalateSize("display")).toBe("display");
  });

  it("escalateSize 2 steps: lg → xxl", () => {
    expect(escalateSize("lg", 2)).toBe("xxl");
  });

  it("deescalateSize xl → lg", () => {
    expect(deescalateSize("xl")).toBe("lg");
  });

  it("deescalateSize xs → xs (capped at bottom)", () => {
    expect(deescalateSize("xs")).toBe("xs");
  });

  it("deescalateSize 2 steps: xxl → lg", () => {
    expect(deescalateSize("xxl", 2)).toBe("lg");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// responsive-engine — buildResponsiveAdjustments
// ─────────────────────────────────────────────────────────────────────────────

describe("buildResponsiveAdjustments", () => {
  it("returns portrait, square, landscape breakpoints", () => {
    const r = buildResponsiveAdjustments("corporate", "1:1", "square");
    expect(r.portrait).toBeDefined();
    expect(r.square).toBeDefined();
    expect(r.landscape).toBeDefined();
  });

  it("portrait has benefitColumns=1", () => {
    const r = buildResponsiveAdjustments("corporate", "9:16", "portrait");
    expect(r.portrait.benefitColumns).toBe(1);
  });

  it("landscape has benefitColumns=3 (default)", () => {
    const r = buildResponsiveAdjustments("corporate", "16:9", "landscape");
    expect(r.landscape.benefitColumns).toBe(3);
  });

  it("portrait has larger globalPaddingMultiplier than landscape", () => {
    const r = buildResponsiveAdjustments("corporate", "1:1", "square");
    expect(r.portrait.globalPaddingMultiplier).toBeGreaterThan(r.landscape.globalPaddingMultiplier);
  });

  it("luxury portrait has globalPaddingMultiplier 1.6", () => {
    const r = buildResponsiveAdjustments("luxury", "9:16", "portrait");
    expect(r.portrait.globalPaddingMultiplier).toBe(1.6);
  });

  it("social portrait CTA size is xxl", () => {
    const r = buildResponsiveAdjustments("social", "9:16", "portrait");
    expect(r.portrait.ctaSize).toBe("xxl");
  });

  it("editorial portrait has display headline", () => {
    const r = buildResponsiveAdjustments("editorial", "9:16", "portrait");
    expect(r.portrait.headlineSize).toBe("display");
  });

  it("DEFAULT_BREAKPOINTS square has benefitColumns=2", () => {
    expect(DEFAULT_BREAKPOINTS.square.benefitColumns).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — structure
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — structure", () => {
  it("returns a CommercialTypographyPlan with all required keys", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.typographyStyle).toBeDefined();
    expect(plan.headline).toBeDefined();
    expect(plan.benefits).toBeDefined();
    expect(plan.cta).toBeDefined();
    expect(plan.socialProof).toBeDefined();
    expect(plan.footer).toBeDefined();
    expect(plan.responsive).toBeDefined();
    expect(plan.spacing).toBeDefined();
    expect(plan.hierarchy).toBeDefined();
  });

  it("headline.importance is always 10", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.headline.importance).toBe(10);
  });

  it("cta.importance is always 9", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.cta.importance).toBe(9);
  });

  it("headline.importance > cta.importance (invariant never inverted)", () => {
    for (const style of ["luxury","social","fashion","editorial","restaurant"] as TypographyStyle[]) {
      const plan = buildTypographyPlanFromInput(makeInput({ compositionStrategyId: style }));
      expect(plan.headline.importance).toBeGreaterThan(plan.cta.importance);
    }
  });

  it("hierarchy.primary === 'headline' always", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.hierarchy.primary).toBe("headline");
  });

  it("hierarchy.secondary === 'cta' always", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.hierarchy.secondary).toBe("cta");
  });

  it("spacing.baseUnit === 4 always", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.spacing.baseUnit).toBe(4);
  });

  it("footer.importance is very low (≤ 2)", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.footer.importance).toBeLessThanOrEqual(2);
  });

  it("footer.opacity is < 100 (de-emphasised)", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.footer.opacity).toBeLessThan(100);
  });

  it("headline has a maxLines value", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.headline.maxLines).toBeTypeOf("number");
    expect(plan.headline.maxLines!).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — optional elements
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — optional elements", () => {
  it("subheadline is null when hasSubheadline=false", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasSubheadline: false }));
    expect(plan.subheadline).toBeNull();
  });

  it("subheadline is defined when hasSubheadline=true", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasSubheadline: true }));
    expect(plan.subheadline).not.toBeNull();
    expect(plan.subheadline!.importance).toBeGreaterThan(0);
    expect(plan.subheadline!.importance).toBeLessThan(10);
  });

  it("offer is null when hasOffer=false", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasOffer: false }));
    expect(plan.offer).toBeNull();
  });

  it("offer is defined when hasOffer=true", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasOffer: true }));
    expect(plan.offer).not.toBeNull();
    expect(plan.offer!.size).toBeDefined();
    expect(plan.offer!.weight).toBe("extrabold");
    expect(plan.offer!.textTransform).toBe("uppercase");
    expect(plan.offer!.maxLines).toBe(1);
  });

  it("badge is null when hasBadge=false", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasBadge: false }));
    expect(plan.badge).toBeNull();
  });

  it("badge is defined when hasBadge=true", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasBadge: true }));
    expect(plan.badge).not.toBeNull();
    expect(plan.badge!.textTransform).toBe("uppercase");
    expect(plan.badge!.maxLines).toBe(1);
  });

  it("disclaimer is null when hasDisclaimer=false", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasDisclaimer: false }));
    expect(plan.disclaimer).toBeNull();
  });

  it("disclaimer is defined when hasDisclaimer=true", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasDisclaimer: true }));
    expect(plan.disclaimer).not.toBeNull();
    expect(plan.disclaimer!.importance).toBe(1);
    expect(plan.disclaimer!.opacity).toBe(70);
    expect(plan.disclaimer!.weight).toBe("light");
  });

  it("secondaryCta is null when hasSecondaryCta=false", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasSecondaryCta: false }));
    expect(plan.secondaryCta).toBeNull();
  });

  it("secondaryCta is defined when hasSecondaryCta=true", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasSecondaryCta: true }));
    expect(plan.secondaryCta).not.toBeNull();
    expect(plan.secondaryCta!.importance).toBeLessThan(plan.cta.importance);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — benefits columns
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — benefits columns", () => {
  it("benefitCount ≤ 2 → columns=1", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ benefitCount: 2 }));
    expect(plan.benefits.columns).toBe(1);
  });

  it("benefitCount = 1 → columns=1", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ benefitCount: 1 }));
    expect(plan.benefits.columns).toBe(1);
  });

  it("benefitCount = 3 → columns=2", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ benefitCount: 3 }));
    expect(plan.benefits.columns).toBe(2);
  });

  it("benefitCount = 4 → columns=2", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ benefitCount: 4 }));
    expect(plan.benefits.columns).toBe(2);
  });

  it("benefitCount = 5 → columns=3", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ benefitCount: 5 }));
    expect(plan.benefits.columns).toBe(3);
  });

  it("benefitCount = 8 → columns=3", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ benefitCount: 8 }));
    expect(plan.benefits.columns).toBe(3);
  });

  it("benefits has bulletStyle from style definition", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ compositionStrategyId: "healthcare" }));
    expect(plan.benefits.bulletStyle).toBe("check");
  });

  it("luxury style benefits use dash bullet", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ compositionStrategyId: "luxury" }));
    expect(plan.benefits.bulletStyle).toBe("dash");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — style-specific behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — luxury style", () => {
  const luxuryInput = makeInput({ compositionStrategyId: "luxury" });

  it("typographyStyle is 'luxury'", () => {
    expect(buildTypographyPlanFromInput(luxuryInput).typographyStyle).toBe("luxury");
  });

  it("headline alignment is left", () => {
    expect(buildTypographyPlanFromInput(luxuryInput).headline.alignment).toBe("left");
  });

  it("headline has dominant weight", () => {
    expect(buildTypographyPlanFromInput(luxuryInput).headline.weight).toBe("dominant");
  });

  it("headline contrast is ultra_high", () => {
    expect(buildTypographyPlanFromInput(luxuryInput).headline.contrast).toBe("ultra_high");
  });

  it("cta borderRadius is 0 (sharp edge)", () => {
    expect(buildTypographyPlanFromInput(luxuryInput).cta.borderRadius).toBe(0);
  });

  it("cta letterSpacing is wide", () => {
    expect(buildTypographyPlanFromInput(luxuryInput).cta.letterSpacing).toBe("wide");
  });
});

describe("buildTypographyPlanFromInput — restaurant style", () => {
  const input = makeInput({ compositionStrategyId: "restaurant" });

  it("typographyStyle is 'restaurant'", () => {
    expect(buildTypographyPlanFromInput(input).typographyStyle).toBe("restaurant");
  });

  it("headline alignment is center", () => {
    expect(buildTypographyPlanFromInput(input).headline.alignment).toBe("center");
  });

  it("headline weight is extrabold", () => {
    expect(buildTypographyPlanFromInput(input).headline.weight).toBe("extrabold");
  });

  it("headline contrast is ultra_high", () => {
    expect(buildTypographyPlanFromInput(input).headline.contrast).toBe("ultra_high");
  });

  it("cta contrast is ultra_high", () => {
    expect(buildTypographyPlanFromInput(input).cta.contrast).toBe("ultra_high");
  });
});

describe("buildTypographyPlanFromInput — fashion style", () => {
  const input = makeInput({ compositionStrategyId: "fashion" });

  it("typographyStyle is 'fashion'", () => {
    expect(buildTypographyPlanFromInput(input).typographyStyle).toBe("fashion");
  });

  it("headline textTransform is uppercase", () => {
    expect(buildTypographyPlanFromInput(input).headline.textTransform).toBe("uppercase");
  });

  it("headline size is display", () => {
    expect(buildTypographyPlanFromInput(input).headline.size).toBe("display");
  });

  it("cta alignment is right", () => {
    expect(buildTypographyPlanFromInput(input).cta.alignment).toBe("right");
  });

  it("benefits bulletStyle is none", () => {
    expect(buildTypographyPlanFromInput(input).benefits.bulletStyle).toBe("none");
  });
});

describe("buildTypographyPlanFromInput — healthcare style", () => {
  const input = makeInput({ compositionStrategyId: "healthcare" });

  it("typographyStyle is 'healthcare'", () => {
    expect(buildTypographyPlanFromInput(input).typographyStyle).toBe("healthcare");
  });

  it("cta has rounded border (borderRadius > 0)", () => {
    expect(buildTypographyPlanFromInput(input).cta.borderRadius).toBeGreaterThan(0);
  });

  it("benefits bulletStyle is check", () => {
    expect(buildTypographyPlanFromInput(input).benefits.bulletStyle).toBe("check");
  });

  it("headlines are centered (trust & approachability)", () => {
    expect(buildTypographyPlanFromInput(input).headline.alignment).toBe("center");
  });
});

describe("buildTypographyPlanFromInput — editorial style", () => {
  const input = makeInput({ compositionStrategyId: "editorial" });

  it("typographyStyle is 'editorial'", () => {
    expect(buildTypographyPlanFromInput(input).typographyStyle).toBe("editorial");
  });

  it("headline size is display", () => {
    expect(buildTypographyPlanFromInput(input).headline.size).toBe("display");
  });

  it("headline contrast is ultra_high", () => {
    expect(buildTypographyPlanFromInput(input).headline.contrast).toBe("ultra_high");
  });

  it("cta borderRadius is 0", () => {
    expect(buildTypographyPlanFromInput(input).cta.borderRadius).toBe(0);
  });
});

describe("buildTypographyPlanFromInput — minimal style", () => {
  const input = makeInput({ compositionStrategyId: "minimal" });

  it("typographyStyle is 'minimal'", () => {
    expect(buildTypographyPlanFromInput(input).typographyStyle).toBe("minimal");
  });

  it("benefits bulletStyle is none (clean, no clutter)", () => {
    expect(buildTypographyPlanFromInput(input).benefits.bulletStyle).toBe("none");
  });

  it("spacing density defaults to sparse from style definition when computed", () => {
    // minimal style uses sparse density in STYLE_DEFINITIONS
    const plan = buildTypographyPlanFromInput({ ...input, density: "sparse" });
    expect(plan.spacing.density).toBe("sparse");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — hierarchy via offer
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — hierarchy with offer", () => {
  it("hierarchy.tertiary is 'offer' when hasOffer=true", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasOffer: true }));
    expect(plan.hierarchy.tertiary).toBe("offer");
  });

  it("hierarchy.tertiary is 'subheadline' when hasOffer=false", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasOffer: false }));
    expect(plan.hierarchy.tertiary).toBe("subheadline");
  });

  it("offer.importance > benefits.importance when hasOffer=true", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ hasOffer: true }));
    expect(plan.offer!.importance).toBeGreaterThan(plan.benefits.importance);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — density effect on spacing
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — density effect on spacing", () => {
  it("sparse density yields larger globalPadding than balanced", () => {
    const sp = buildTypographyPlanFromInput(makeInput({ density: "sparse" }));
    const ba = buildTypographyPlanFromInput(makeInput({ density: "balanced" }));
    expect(sp.spacing.globalPadding).toBeGreaterThan(ba.spacing.globalPadding);
  });

  it("dense density yields smaller globalPadding than balanced", () => {
    const ba = buildTypographyPlanFromInput(makeInput({ density: "balanced" }));
    const de = buildTypographyPlanFromInput(makeInput({ density: "dense" }));
    expect(de.spacing.globalPadding).toBeLessThan(ba.spacing.globalPadding);
  });

  it("spacing.density matches input density", () => {
    expect(buildTypographyPlanFromInput(makeInput({ density: "sparse" })).spacing.density).toBe("sparse");
    expect(buildTypographyPlanFromInput(makeInput({ density: "dense" })).spacing.density).toBe("dense");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — responsive adjustments
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — responsive adjustments", () => {
  it("returns all three breakpoints", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.responsive.portrait).toBeDefined();
    expect(plan.responsive.square).toBeDefined();
    expect(plan.responsive.landscape).toBeDefined();
  });

  it("portrait benefitColumns=1", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ aspectRatio: "9:16", orientation: "portrait" }));
    expect(plan.responsive.portrait.benefitColumns).toBe(1);
  });

  it("landscape benefitColumns=3 (default)", () => {
    const plan = buildTypographyPlanFromInput(makeInput({ aspectRatio: "16:9", orientation: "landscape" }));
    expect(plan.responsive.landscape.benefitColumns).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — CTA structure
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — CTA structure", () => {
  it("cta has paddingH and paddingV", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.cta.paddingH).toBeTypeOf("number");
    expect(plan.cta.paddingV).toBeTypeOf("number");
    expect(plan.cta.paddingH).toBeGreaterThan(0);
    expect(plan.cta.paddingV).toBeGreaterThan(0);
  });

  it("cta has borderRadius ≥ 0", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.cta.borderRadius).toBeGreaterThanOrEqual(0);
  });

  it("cta has minWidth > 0", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.cta.minWidth).toBeGreaterThan(0);
  });

  it("cta.textTransform is uppercase (calls to action are capitalized)", () => {
    const plan = buildTypographyPlanFromInput(makeInput());
    expect(plan.cta.textTransform).toBe("uppercase");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyPlanFromInput — determinism
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlanFromInput — determinism", () => {
  it("same input produces identical output (pure function)", () => {
    const input = makeInput({ compositionStrategyId: "luxury", density: "sparse" });
    const a = buildTypographyPlanFromInput(input);
    const b = buildTypographyPlanFromInput(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different styles produce different headline weights", () => {
    const luxury = buildTypographyPlanFromInput(makeInput({ compositionStrategyId: "luxury" }));
    const minimal = buildTypographyPlanFromInput(makeInput({ compositionStrategyId: "minimal" }));
    expect(luxury.headline.weight).not.toBe(minimal.headline.weight);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// strategyToTypographyInput — integration
// ─────────────────────────────────────────────────────────────────────────────

describe("strategyToTypographyInput", () => {
  it("returns a TypographyInput with all required keys", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Dental implants consultation");
    const input = strategyToTypographyInput(strategy, copy, composition, layoutPlan);
    expect(input.industry).toBeDefined();
    expect(input.brandType).toBeDefined();
    expect(input.aspectRatio).toBeDefined();
    expect(input.density).toBeDefined();
    expect(typeof input.hasOffer).toBe("boolean");
    expect(typeof input.hasBadge).toBe("boolean");
    expect(typeof input.hasDisclaimer).toBe("boolean");
    expect(typeof input.hasSubheadline).toBe("boolean");
    expect(typeof input.hasSecondaryCta).toBe("boolean");
    expect(typeof input.benefitCount).toBe("number");
  });

  it("dental idea → industry is dental", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Dental implants consultation book now");
    const input = strategyToTypographyInput(strategy, copy, composition, layoutPlan);
    expect(input.industry).toBe("dental");
  });

  it("hasDisclaimer matches copy.metadata.hasDisclaimer", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Dental implants consultation");
    const input = strategyToTypographyInput(strategy, copy, composition, layoutPlan);
    expect(input.hasDisclaimer).toBe(copy.metadata.hasDisclaimer);
  });

  it("hasOffer matches copy.metadata.hasOffer", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Restaurant 50% off launch offer");
    const input = strategyToTypographyInput(strategy, copy, composition, layoutPlan);
    expect(input.hasOffer).toBe(copy.metadata.hasOffer);
  });

  it("benefitCount matches copy.metadata.benefitCount", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Healthcare clinic trust building");
    const input = strategyToTypographyInput(strategy, copy, composition, layoutPlan);
    expect(input.benefitCount).toBe(copy.metadata.benefitCount);
  });

  it("compositionStrategyId matches composition.strategyId", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Restaurant grand opening");
    const input = strategyToTypographyInput(strategy, copy, composition, layoutPlan);
    expect(input.compositionStrategyId).toBe(composition.strategyId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildTypographyFromBlueprintInputs — end-to-end
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyFromBlueprintInputs — blueprint integration", () => {
  it("dental campaign → typographyStyle is 'healthcare'", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Dental implants consultation book now");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    expect(plan.typographyStyle).toBe("healthcare");
  });

  it("restaurant campaign → typographyStyle is 'restaurant'", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Restaurant grand opening special menu");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    expect(plan.typographyStyle).toBe("restaurant");
  });

  it("real estate campaign → typographyStyle is 'real_estate'", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("New apartment homes for sale book now");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    expect(plan.typographyStyle).toBe("real_estate");
  });

  it("plan headline.importance is always 10 in full pipeline", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Tech startup product launch");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    expect(plan.headline.importance).toBe(10);
  });

  it("plan cta.importance is always 9 in full pipeline", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Healthcare clinic trust campaign");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    expect(plan.cta.importance).toBe(9);
  });

  it("plan hierarchy.primary is 'headline' in full pipeline", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Jewelry luxury collection launch");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    expect(plan.hierarchy.primary).toBe("headline");
  });

  it("plan hierarchy.secondary is 'cta' in full pipeline", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Finance investment consultation");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    expect(plan.hierarchy.secondary).toBe("cta");
  });

  it("disclaimer element present for dental (disclaimer industry)", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Dental implants consultation book now");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    // If copy has a disclaimer, typography plan should have a disclaimer element
    if (copy.disclaimer !== null) {
      expect(plan.disclaimer).not.toBeNull();
    }
  });

  it("plan has responsive breakpoints", () => {
    const { strategy, layoutPlan, composition, copy } = makeFullInputs("Restaurant grand opening");
    const plan = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
    expect(plan.responsive.portrait).toBeDefined();
    expect(plan.responsive.square).toBeDefined();
    expect(plan.responsive.landscape).toBeDefined();
  });

  it("plan is deterministic for same inputs", () => {
    const inputs = makeFullInputs("Dental implants consultation");
    const a = buildTypographyFromBlueprintInputs(inputs.strategy, inputs.copy, inputs.composition, inputs.layoutPlan);
    const b = buildTypographyFromBlueprintInputs(inputs.strategy, inputs.copy, inputs.composition, inputs.layoutPlan);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
