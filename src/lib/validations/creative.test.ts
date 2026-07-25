import { describe, expect, it } from "vitest";

import {
  AI_IMAGE_PRESETS,
  SOCIAL_MEDIA_PRESETS,
  MARKETING_CREATIVE_PRESETS,
  PRESETS_BY_KIND,
  PRESET_PROMPT_PREFIX,
  createCreativeProjectSchema,
  nearestAspectRatioBucket,
} from "./creative";

describe("PRESETS_BY_KIND", () => {
  it("every preset across every kind has a PRESET_PROMPT_PREFIX entry, except the shared Custom entry", () => {
    const allPresets = [...AI_IMAGE_PRESETS, ...SOCIAL_MEDIA_PRESETS, ...MARKETING_CREATIVE_PRESETS];
    for (const preset of allPresets) {
      if (preset.isCustom) continue;
      expect(PRESET_PROMPT_PREFIX[preset.key]).toBeTruthy();
    }
  });

  it("has no duplicate preset keys within a single kind's list (presetKey lookups are unambiguous per-kind)", () => {
    for (const presets of [AI_IMAGE_PRESETS, SOCIAL_MEDIA_PRESETS, MARKETING_CREATIVE_PRESETS]) {
      const keys = presets.map((p) => p.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("maps every kind to its matching preset list", () => {
    expect(PRESETS_BY_KIND.AI_IMAGE).toBe(AI_IMAGE_PRESETS);
    expect(PRESETS_BY_KIND.SOCIAL_MEDIA).toBe(SOCIAL_MEDIA_PRESETS);
    expect(PRESETS_BY_KIND.MARKETING_CREATIVE).toBe(MARKETING_CREATIVE_PRESETS);
  });
});

describe("nearestAspectRatioBucket", () => {
  it("picks RATIO_1_1 for a square image", () => {
    expect(nearestAspectRatioBucket(1080, 1080)).toBe("RATIO_1_1");
  });

  it("picks RATIO_9_16 for a tall Instagram Story", () => {
    expect(nearestAspectRatioBucket(1080, 1920)).toBe("RATIO_9_16");
  });

  it("picks RATIO_16_9 for a YouTube thumbnail", () => {
    expect(nearestAspectRatioBucket(1280, 720)).toBe("RATIO_16_9");
  });

  it("picks RATIO_16_9 for a very wide website banner", () => {
    expect(nearestAspectRatioBucket(1600, 400)).toBe("RATIO_16_9");
  });

  it("picks RATIO_9_16 for a tall Pinterest pin", () => {
    expect(nearestAspectRatioBucket(1000, 1500)).toBe("RATIO_9_16");
  });

  it("is symmetric for portrait/landscape mirror dimensions", () => {
    expect(nearestAspectRatioBucket(1920, 1080)).toBe("RATIO_16_9");
    expect(nearestAspectRatioBucket(1080, 1920)).toBe("RATIO_9_16");
  });
});

describe("createCreativeProjectSchema", () => {
  const base = {
    title: "Diwali Sale Poster",
    prompt: "A festive Diwali sale banner",
    contentLanguage: "EN" as const,
  };

  it("accepts a preset that belongs to the given kind", () => {
    const result = createCreativeProjectSchema.safeParse({ ...base, kind: "AI_IMAGE", presetKey: "square" });
    expect(result.success).toBe(true);
  });

  it("rejects a preset that belongs to a different kind", () => {
    const result = createCreativeProjectSchema.safeParse({ ...base, kind: "AI_IMAGE", presetKey: "poster" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    const result = createCreativeProjectSchema.safeParse({ ...base, kind: "VIDEO", presetKey: "square" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty prompt", () => {
    const result = createCreativeProjectSchema.safeParse({ ...base, kind: "AI_IMAGE", presetKey: "square", prompt: "" });
    expect(result.success).toBe(false);
  });

  it("rejects the Custom preset without targetWidth/targetHeight", () => {
    const result = createCreativeProjectSchema.safeParse({ ...base, kind: "AI_IMAGE", presetKey: "custom" });
    expect(result.success).toBe(false);
  });

  it("accepts the Custom preset with targetWidth and targetHeight", () => {
    const result = createCreativeProjectSchema.safeParse({
      ...base,
      kind: "AI_IMAGE",
      presetKey: "custom",
      targetWidth: 900,
      targetHeight: 600,
    });
    expect(result.success).toBe(true);
  });
});
