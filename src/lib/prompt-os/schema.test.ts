import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "./schema";

describe("universalPromptSchema", () => {
  it("accepts a minimal/empty object, filling in safe defaults", () => {
    const parsed = universalPromptSchema.parse({});
    expect(parsed.intent).toBe("generate_image");
    expect(parsed.negative_constraints).toEqual([]);
    expect(parsed.objects).toEqual([]);
    expect(parsed.referenceAnalysis).toBeUndefined();
    expect(parsed.style).toEqual({});
    expect(parsed.layout).toEqual({});
    expect(parsed.output).toEqual({});
  });

  it("accepts objects and referenceAnalysis (Phase 2.3 — Universal Prompt Intelligence)", () => {
    const parsed = universalPromptSchema.parse({
      objects: ["champagne glass", "marble countertop"],
      referenceAnalysis: { industry: "hospitality", colorPalette: ["gold", "cream"] },
    });
    expect(parsed.objects).toEqual(["champagne glass", "marble countertop"]);
    expect(parsed.referenceAnalysis).toEqual({ industry: "hospitality", colorPalette: ["gold", "cream"] });
  });

  it("accepts creativeBrief (Phase 2.4 — AI Creative Director)", () => {
    const parsed = universalPromptSchema.parse({
      creativeBrief: { marketingObjective: "Drive qualified leads", targetAudience: "First-time homebuyers" },
    });
    expect(parsed.creativeBrief).toEqual({
      marketingObjective: "Drive qualified leads",
      targetAudience: "First-time homebuyers",
    });
  });

  it("accepts a fully-populated object", () => {
    const parsed = universalPromptSchema.parse({
      intent: "generate a luxury villa ad",
      industry: "real estate",
      platform: "instagram",
      creative_type: "SOCIAL_MEDIA",
      style: { mood: "aspirational", luxuryLevel: "high" },
      layout: { composition: "rule-of-thirds", headlinePosition: "top" },
      typography: { treatment: "serif" },
      lighting: { direction: "golden hour" },
      camera: { angle: "low angle", lens: "24mm" },
      composition: { framing: "wide shot" },
      branding: { brandColors: ["#0a0a0a"] },
      colors: { palette: ["gold", "cream"] },
      marketing: { goal: "lead generation", psychologyHooks: ["scarcity"] },
      negative_constraints: ["cartoon look", "blurry"],
      quality: { keywords: ["8k", "photorealistic"] },
      output: { aspectRatio: "RATIO_16_9", targetWidth: 1920, targetHeight: 1080 },
    });
    expect(parsed.industry).toBe("real estate");
    expect(parsed.colors.palette).toEqual(["gold", "cream"]);
    expect(parsed.negative_constraints).toEqual(["cartoon look", "blurry"]);
  });

  it("tolerates unknown fields inside a known section via catchall (extensibility)", () => {
    const parsed = universalPromptSchema.parse({
      style: { mood: "bold", futureField: "some video-phase concept" },
    });
    expect(parsed.style.mood).toBe("bold");
    expect((parsed.style as Record<string, unknown>).futureField).toBe("some video-phase concept");
  });

  it("rejects a non-object top-level value", () => {
    expect(() => universalPromptSchema.parse("not an object")).toThrow();
  });

  it("rejects negative_constraints that isn't a string or array of strings", () => {
    expect(() => universalPromptSchema.parse({ negative_constraints: 42 })).toThrow();
  });

  // A real LLM (confirmed live with gpt-4o-mini) sometimes collapses a
  // single-item array-of-strings field into a bare string, or returns
  // `quality` as a bare array instead of `{ keywords: [...] }` — previously
  // both threw the entire Universal JSON out via ZodError, discarding an
  // otherwise correct, on-topic response.
  it("coerces a bare string into a single-element array for negative_constraints", () => {
    const parsed = universalPromptSchema.parse({ negative_constraints: "blurry" });
    expect(parsed.negative_constraints).toEqual(["blurry"]);
  });

  it("coerces a bare string into a single-element array for marketing.psychologyHooks, colors.palette, branding.brandColors, and objects", () => {
    const parsed = universalPromptSchema.parse({
      marketing: { psychologyHooks: "scarcity" },
      colors: { palette: "gold" },
      branding: { brandColors: "#1a3c6e" },
      objects: "champagne glass",
    });
    expect(parsed.marketing.psychologyHooks).toEqual(["scarcity"]);
    expect(parsed.colors.palette).toEqual(["gold"]);
    expect(parsed.branding.brandColors).toEqual(["#1a3c6e"]);
    expect(parsed.objects).toEqual(["champagne glass"]);
  });

  it("normalizes a bare array into { keywords: [...] } for quality", () => {
    const parsed = universalPromptSchema.parse({
      quality: ["photorealistic", "8k", "cinematic lighting"],
    });
    expect(parsed.quality.keywords).toEqual(["photorealistic", "8k", "cinematic lighting"]);
  });

  it("still accepts quality in its documented { keywords: [...] } object shape", () => {
    const parsed = universalPromptSchema.parse({
      quality: { keywords: ["8k"], realism: "high" },
    });
    expect(parsed.quality.keywords).toEqual(["8k"]);
    expect(parsed.quality.realism).toBe("high");
  });

  it("coerces a bare string keywords value inside an explicit quality object too", () => {
    const parsed = universalPromptSchema.parse({
      quality: { keywords: "8k" },
    });
    expect(parsed.quality.keywords).toEqual(["8k"]);
  });

  // Confirmed live with gpt-4o-mini (Creative Director 2.0 verification):
  // branding.brandColors was returned as a plain object (e.g.
  // { primary: "#...", secondary: "#..." }) instead of an array.
  it("recovers a plain object into an array of values for branding.brandColors", () => {
    const parsed = universalPromptSchema.parse({
      branding: { brandColors: { primary: "#1a3c6e", secondary: "#f97316" } },
    });
    expect(parsed.branding.brandColors).toEqual(["#1a3c6e", "#f97316"]);
  });

  // Confirmed live with gpt-4o-mini: layout.hierarchy was returned as an
  // array (an ordered element list) instead of one descriptive string.
  it("joins an array into one string for layout.hierarchy", () => {
    const parsed = universalPromptSchema.parse({
      layout: { hierarchy: ["Headline", "Hero Subject", "CTA"] },
    });
    expect(parsed.layout.hierarchy).toBe("Headline, Hero Subject, CTA");
  });

  it("still accepts layout.hierarchy as a plain string", () => {
    const parsed = universalPromptSchema.parse({
      layout: { hierarchy: "single clear focal point" },
    });
    expect(parsed.layout.hierarchy).toBe("single clear focal point");
  });
});
