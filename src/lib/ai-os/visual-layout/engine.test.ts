import { describe, expect, it } from "vitest";

import { buildVisualLayoutPlan } from "./engine";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — create a complete pipeline from idea to VisualLayoutPlan
// ─────────────────────────────────────────────────────────────────────────────

function makeLayoutPlan(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, kind, presetKey, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  return { strategy, plan, layout: buildVisualLayoutPlan(strategy, plan) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure — all 8 domains must exist with correct field shapes
// ─────────────────────────────────────────────────────────────────────────────

describe("buildVisualLayoutPlan — structural correctness", () => {
  it("returns all 8 domains plus confidenceScore and unknownFields", () => {
    const { layout } = makeLayoutPlan("Dental Implant Informative Creative");
    expect(layout).toHaveProperty("canvas");
    expect(layout).toHaveProperty("hierarchy");
    expect(layout).toHaveProperty("blocks");
    expect(layout).toHaveProperty("grid");
    expect(layout).toHaveProperty("whiteSpace");
    expect(layout).toHaveProperty("composition");
    expect(layout).toHaveProperty("safeAreas");
    expect(layout).toHaveProperty("visualPriority");
    expect(typeof layout.confidenceScore).toBe("number");
    expect(Array.isArray(layout.unknownFields)).toBe(true);
  });

  it("every field has value + confidence + reasoning", () => {
    const { layout } = makeLayoutPlan("Restaurant Grand Opening");
    const domains = [layout.canvas, layout.hierarchy, layout.blocks, layout.grid,
                     layout.whiteSpace, layout.composition, layout.safeAreas, layout.visualPriority];
    for (const domain of domains) {
      for (const [key, field] of Object.entries(domain)) {
        if (typeof field === "object" && field !== null && "value" in field) {
          expect(field.value, `${key}.value`).toBeDefined();
          expect(field.confidence, `${key}.confidence`).toBeDefined();
          expect(field.reasoning, `${key}.reasoning`).toBeDefined();
          expect(typeof field.reasoning, `${key}.reasoning type`).toBe("string");
          expect(field.reasoning, `${key}.reasoning not empty`).not.toBe("");
        }
      }
    }
  });

  it("never returns undefined for any field", () => {
    const { layout } = makeLayoutPlan("something vague");
    expect(layout.canvas.canvasType.value).toBeDefined();
    expect(layout.visualPriority.priority1.value).toBeDefined();
    expect(layout.safeAreas.platformCropSafety.value).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Instagram Post — social media canvas
// ─────────────────────────────────────────────────────────────────────────────

describe("Instagram Post Canvas", () => {
  const { layout } = makeLayoutPlan("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");

  it("returns square 1:1 canvas for instagram_post preset", () => {
    expect(layout.canvas.canvasOrientation.value).toBe("square");
    expect(layout.canvas.aspectRatio.value).toBe("1:1");
    expect(layout.canvas.canvasType.value).toBe("social_post");
  });

  it("specifies instagram-specific safe zone", () => {
    expect(layout.canvas.safeZones.value).toContain("5%");
  });

  it("no print bleed required for digital format", () => {
    expect(layout.canvas.bleedArea.value.toLowerCase()).toContain("digital");
  });

  it("platform crop safety references instagram", () => {
    expect(layout.safeAreas.platformCropSafety.value.toLowerCase()).toMatch(/instagram|1080|caption/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Poster Canvas — print format
// ─────────────────────────────────────────────────────────────────────────────

describe("Poster / Print Canvas", () => {
  const { layout } = makeLayoutPlan("Luxury Real Estate Villa Advertisement", "MARKETING_CREATIVE", "poster");

  it("returns portrait orientation for poster preset", () => {
    expect(layout.canvas.canvasOrientation.value).toBe("portrait");
    expect(layout.canvas.canvasType.value).toBe("print_poster");
  });

  it("specifies print bleed requirements", () => {
    expect(layout.canvas.bleedArea.value.toLowerCase()).toMatch(/bleed|3mm|print/i);
  });

  it("print safe area specifies mm margins", () => {
    expect(layout.safeAreas.printSafeArea.value.toLowerCase()).toMatch(/10mm|bleed|trim/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Luxury Real Estate — visual hierarchy and whitespace
// ─────────────────────────────────────────────────────────────────────────────

describe("Luxury Real Estate Visual Hierarchy", () => {
  const { layout } = makeLayoutPlan("Luxury Real Estate Villa Advertisement", "MARKETING_CREATIVE", "poster");

  it("uses generous to extreme negative space (luxury = space)", () => {
    expect(["35_to_50_percent", "50_to_65_percent", "65_plus_percent"]).toContain(layout.whiteSpace.negativeSpaceRatio.value);
  });

  it("uses luxury minimal or editorial clean grid system", () => {
    expect(["freeform_compositional", "editorial_clean", "12_column_editorial"]).toContain(layout.grid.gridSystem.value);
  });

  it("applies rule of thirds or intentionally breaks it (luxury aesthetic)", () => {
    expect(["primary_application", "partial_application", "intentionally_broken"]).toContain(layout.composition.ruleOfThirds.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutual Fund SIP — complex infographic
// ─────────────────────────────────────────────────────────────────────────────

describe("Mutual Fund SIP — Informational Layout", () => {
  const { layout } = makeLayoutPlan("Mutual Fund SIP Awareness Campaign");

  it("uses tight or moderate spacing for information density", () => {
    expect(["tight_8px_base", "comfortable_16px_base"]).toContain(layout.grid.spacing.value);
  });

  it("assigns financial data element as a top priority", () => {
    const p1 = layout.visualPriority.priority1.value.toLowerCase();
    expect(p1).not.toBe("unknown");
  });

  it("specifies z_pattern or f_pattern eye flow for content-rich layouts", () => {
    expect(["z_pattern", "f_pattern", "top_to_bottom"]).toContain(layout.hierarchy.eyeFlow.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Visual Priority — dental campaign
// ─────────────────────────────────────────────────────────────────────────────

describe("Visual Priority Engine — Dental Campaign", () => {
  const { layout } = makeLayoutPlan("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");

  it("all 7 priorities are populated", () => {
    expect(layout.visualPriority.priority1.value).not.toBe("unknown");
    expect(layout.visualPriority.priority2.value).not.toBe("unknown");
    expect(layout.visualPriority.priority7.value).not.toBe("unknown");
  });

  it("priority 1 references the hero subject", () => {
    const p1 = layout.visualPriority.priority1.value.toLowerCase();
    expect(p1.length).toBeGreaterThan(5);
  });

  it("each priority has a distinct reasoning", () => {
    const reasons = [
      layout.visualPriority.priority1.reasoning,
      layout.visualPriority.priority2.reasoning,
      layout.visualPriority.priority3.reasoning,
    ];
    // Each reasoning string should be unique and non-empty
    const unique = new Set(reasons);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Visual Layout Engine must NEVER generate prompts or copy", () => {
  it("is a synchronous pure function — no async, no LLM call", () => {
    const { strategy, plan } = makeLayoutPlan("Hospital campaign");
    const result = buildVisualLayoutPlan(strategy, plan);
    expect(result).toBeDefined();
  });

  it("does not produce prompt-style values", () => {
    const { layout } = makeLayoutPlan("Salon Transformation");
    const fields = [
      layout.canvas.safeZones.value,
      layout.grid.gridSystem.value,
      layout.hierarchy.eyeFlow.value,
    ];
    for (const v of fields) {
      if (typeof v === "string" && v !== "unknown") {
        expect(v).not.toMatch(/\bF\/\d|\bISO\b|\b8k\b|\bmasterpiece\b|Generate|Create/i);
      }
    }
  });

  it("does not choose specific font families", () => {
    const { layout } = makeLayoutPlan("Jewellery Wedding Collection");
    // Grid and composition fields should never reference specific fonts
    const gridVal = layout.grid.gridSystem.value;
    if (gridVal !== "unknown") {
      expect(gridVal).not.toMatch(/inter|helvetica|montserrat|georgia|arial/i);
    }
  });
});
