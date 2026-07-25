import { describe, it, expect } from "vitest";
import { resolveProviderForTranslation } from "./resolve-provider";

describe("resolveProviderForTranslation", () => {
  // ── Known mappings ──────────────────────────────────────────────────────────
  it("maps openai_images → openai", () => {
    expect(resolveProviderForTranslation("openai_images")).toBe("openai");
  });

  it("maps flux → flux", () => {
    expect(resolveProviderForTranslation("flux")).toBe("flux");
  });

  it("maps ideogram → ideogram", () => {
    expect(resolveProviderForTranslation("ideogram")).toBe("ideogram");
  });

  it("maps gemini → gemini", () => {
    expect(resolveProviderForTranslation("gemini")).toBe("gemini");
  });

  it("maps stable_diffusion → stable_diffusion", () => {
    expect(resolveProviderForTranslation("stable_diffusion")).toBe("stable_diffusion");
  });

  // ── Safe fallback ───────────────────────────────────────────────────────────
  it("falls back to openai for an unknown provider ID", () => {
    expect(resolveProviderForTranslation("unknown_provider")).toBe("openai");
  });

  it("falls back to openai for the mock provider used in tests", () => {
    expect(resolveProviderForTranslation("mock")).toBe("openai");
  });

  it("falls back to openai for null", () => {
    expect(resolveProviderForTranslation(null)).toBe("openai");
  });

  it("falls back to openai for undefined", () => {
    expect(resolveProviderForTranslation(undefined)).toBe("openai");
  });

  it("falls back to openai for an empty string", () => {
    expect(resolveProviderForTranslation("")).toBe("openai");
  });

  // ── Result is always a valid SupportedProvider string ──────────────────────
  it("never returns a string that Phase 13 would reject", () => {
    const SUPPORTED = ["openai", "gemini", "flux", "ideogram", "stable_diffusion", "veo", "runway", "kling"];
    const inputs = ["openai_images", "flux", "ideogram", "gemini", "stable_diffusion", "mock", null, undefined, ""];
    for (const input of inputs) {
      const result = resolveProviderForTranslation(input as string | null | undefined);
      expect(SUPPORTED).toContain(result);
    }
  });
});
