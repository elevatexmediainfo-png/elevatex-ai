import { describe, expect, it } from "vitest";

import { resolveKindAndPreset } from "./resolve-kind";

describe("resolveKindAndPreset", () => {
  describe("recommendedKind trusted when valid", () => {
    it("accepts a valid AI_IMAGE recommendation", () => {
      expect(resolveKindAndPreset({ recommendedKind: "AI_IMAGE" }).kind).toBe("AI_IMAGE");
    });

    it("accepts a valid SOCIAL_MEDIA recommendation", () => {
      expect(resolveKindAndPreset({ recommendedKind: "SOCIAL_MEDIA" }).kind).toBe("SOCIAL_MEDIA");
    });

    it("accepts a valid MARKETING_CREATIVE recommendation", () => {
      expect(resolveKindAndPreset({ recommendedKind: "MARKETING_CREATIVE" }).kind).toBe("MARKETING_CREATIVE");
    });

    it("is case-insensitive", () => {
      expect(resolveKindAndPreset({ recommendedKind: "social_media" }).kind).toBe("SOCIAL_MEDIA");
    });
  });

  describe("hallucinated/invalid recommendedKind falls back safely", () => {
    it("falls back to AI_IMAGE for a made-up kind with no other signal", () => {
      expect(resolveKindAndPreset({ recommendedKind: "VIDEO_AD" }).kind).toBe("AI_IMAGE");
    });

    it("falls back to AI_IMAGE when recommendedKind is missing entirely", () => {
      expect(resolveKindAndPreset({}).kind).toBe("AI_IMAGE");
    });

    it("never returns a kind outside the real enum even with adversarial input", () => {
      const result = resolveKindAndPreset({ recommendedKind: "'; DROP TABLE creative_projects; --" });
      expect(["AI_IMAGE", "SOCIAL_MEDIA", "MARKETING_CREATIVE"]).toContain(result.kind);
    });
  });

  describe("keyword fallback from creative_type/platform when recommendedKind is absent", () => {
    it("infers SOCIAL_MEDIA from creative_type mentioning Instagram", () => {
      expect(resolveKindAndPreset({ creativeType: "an Instagram post" }).kind).toBe("SOCIAL_MEDIA");
    });

    it("infers SOCIAL_MEDIA from platform mentioning Facebook", () => {
      expect(resolveKindAndPreset({ platform: "Facebook feed graphic" }).kind).toBe("SOCIAL_MEDIA");
    });

    it("infers MARKETING_CREATIVE from creative_type mentioning poster", () => {
      expect(resolveKindAndPreset({ creativeType: "a promotional poster" }).kind).toBe("MARKETING_CREATIVE");
    });

    it("infers MARKETING_CREATIVE from creative_type mentioning advertisement", () => {
      expect(resolveKindAndPreset({ creativeType: "a mutual fund advertisement" }).kind).toBe("MARKETING_CREATIVE");
    });

    it("defaults to AI_IMAGE when neither creative_type nor platform mention a platform or print format", () => {
      expect(resolveKindAndPreset({ creativeType: "a golden retriever puppy in a sunlit garden" }).kind).toBe("AI_IMAGE");
    });
  });

  describe("recommendedPresetKey trusted when it belongs to the resolved kind", () => {
    it("accepts a preset key that exists in the resolved kind's catalog", () => {
      const result = resolveKindAndPreset({ recommendedKind: "SOCIAL_MEDIA", recommendedPresetKey: "instagram_story" });
      expect(result.presetKey).toBe("instagram_story");
    });

    it("rejects a preset key that belongs to a different kind's catalog", () => {
      // "poster" is a MARKETING_CREATIVE preset, not a valid SOCIAL_MEDIA one.
      const result = resolveKindAndPreset({ recommendedKind: "SOCIAL_MEDIA", recommendedPresetKey: "poster" });
      expect(result.presetKey).not.toBe("poster");
    });

    it("never resolves to a 'custom' preset (auto mode never collects custom width/height)", () => {
      const result = resolveKindAndPreset({ recommendedKind: "AI_IMAGE", recommendedPresetKey: "custom" });
      expect(result.presetKey).not.toBe("custom");
    });
  });

  describe("invalid/missing recommendedPresetKey falls back safely", () => {
    it("falls back to the per-kind default when recommendedPresetKey is missing", () => {
      expect(resolveKindAndPreset({ recommendedKind: "AI_IMAGE" }).presetKey).toBe("square");
      expect(resolveKindAndPreset({ recommendedKind: "SOCIAL_MEDIA" }).presetKey).toBe("instagram_post");
      expect(resolveKindAndPreset({ recommendedKind: "MARKETING_CREATIVE" }).presetKey).toBe("poster");
    });

    it("falls back to a platform-label match when recommendedPresetKey is invalid but platform names a real preset", () => {
      const result = resolveKindAndPreset({
        recommendedKind: "SOCIAL_MEDIA",
        recommendedPresetKey: "not_a_real_key",
        platform: "Pinterest Pin",
      });
      expect(result.presetKey).toBe("pinterest_pin");
    });

    it("falls back to the per-kind default for a completely hallucinated preset key with no platform hint", () => {
      const result = resolveKindAndPreset({ recommendedKind: "MARKETING_CREATIVE", recommendedPresetKey: "totally_made_up" });
      expect(result.presetKey).toBe("poster");
    });
  });

  describe("real-world idea phrasings (from the Phase 2 brief's own examples)", () => {
    it("'Create a Mutual Fund advertisement' -> MARKETING_CREATIVE", () => {
      expect(resolveKindAndPreset({ creativeType: "Mutual Fund advertisement" }).kind).toBe("MARKETING_CREATIVE");
    });

    it("'Generate a luxury villa campaign' -> MARKETING_CREATIVE", () => {
      expect(resolveKindAndPreset({ creativeType: "luxury villa campaign" }).kind).toBe("MARKETING_CREATIVE");
    });

    it("'Jewellery promotion' -> MARKETING_CREATIVE", () => {
      expect(resolveKindAndPreset({ creativeType: "jewellery promotion" }).kind).toBe("MARKETING_CREATIVE");
    });

    it("'Restaurant offer' -> MARKETING_CREATIVE", () => {
      expect(resolveKindAndPreset({ creativeType: "restaurant offer" }).kind).toBe("MARKETING_CREATIVE");
    });
  });

  describe("falls back to keyword-matching the raw idea text (robustness against a weak/mock LLM)", () => {
    it("infers MARKETING_CREATIVE from the idea alone when creative_type is generic/unhelpful", () => {
      // A Mock LLM provider (no real credential configured) returns a
      // generic creative_type that carries no real signal — the raw idea
      // text must still be enough to resolve correctly.
      const result = resolveKindAndPreset({ creativeType: "AI_IMAGE", idea: "Create a Mutual Fund advertisement" });
      expect(result.kind).toBe("MARKETING_CREATIVE");
    });

    it("infers SOCIAL_MEDIA from the idea alone when creative_type is generic/unhelpful", () => {
      const result = resolveKindAndPreset({ creativeType: "AI_IMAGE", idea: "Modern restaurant Instagram post" });
      expect(result.kind).toBe("SOCIAL_MEDIA");
    });

    it("recommendedKind still wins over the idea text when both are present and valid", () => {
      const result = resolveKindAndPreset({ recommendedKind: "AI_IMAGE", idea: "Restaurant offer poster" });
      expect(result.kind).toBe("AI_IMAGE");
    });
  });
});

// Phase 10.4F — modern pipeline kind resolution.
// When PROVIDER_PROMPT_ENABLED=true, the modern path skips the two legacy LLM
// calls (no universalPrompt → no recommendedKind/recommendedPresetKey).
// Kind is resolved from only the raw idea via keyword matching — the same
// signal resolveKindAndPreset already uses as its last fallback before AI_IMAGE.
describe("resolveKindAndPreset — modern-path (idea-only, no universalPrompt fields)", () => {
  it("resolves SOCIAL_MEDIA from an Instagram idea with no LLM fields", () => {
    const result = resolveKindAndPreset({ idea: "Create an Instagram post for a dental clinic" });
    expect(result.kind).toBe("SOCIAL_MEDIA");
  });

  it("resolves MARKETING_CREATIVE from a poster idea with no LLM fields", () => {
    const result = resolveKindAndPreset({ idea: "A promotional poster for a jewellery launch" });
    expect(result.kind).toBe("MARKETING_CREATIVE");
  });

  it("falls back to AI_IMAGE when the idea has no platform or format signal", () => {
    const result = resolveKindAndPreset({ idea: "A warm close-up of a dentist at work" });
    expect(result.kind).toBe("AI_IMAGE");
  });

  it("returns the per-kind default preset when only idea is provided", () => {
    const social = resolveKindAndPreset({ idea: "Facebook ad for a restaurant promotion" });
    expect(social.presetKey).toBe("instagram_post");

    const ai = resolveKindAndPreset({ idea: "A warm close-up of a dentist at work" });
    expect(ai.presetKey).toBe("square");
  });
});
