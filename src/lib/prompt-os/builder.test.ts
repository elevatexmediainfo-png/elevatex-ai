import { describe, expect, it, vi } from "vitest";

import { cleanEnhancedPrompt } from "./builder";

// buildUniversalPromptFromIdea's only external dependency is the LLM call —
// mocking it here keeps these tests focused on the Phase 2.3 merge logic
// (objects fallback, referenceAnalysis passthrough) without needing a real
// provider or database.
vi.mock("@/lib/generation/llm", () => ({
  generateScript: vi.fn(),
}));

describe("cleanEnhancedPrompt", () => {
  it("trims surrounding whitespace", () => {
    expect(cleanEnhancedPrompt("  a cinematic shot of a villa  ")).toBe("a cinematic shot of a villa");
  });

  it("strips wrapping double quotes", () => {
    expect(cleanEnhancedPrompt('"a cinematic shot of a villa"')).toBe("a cinematic shot of a villa");
  });

  it("strips wrapping single quotes", () => {
    expect(cleanEnhancedPrompt("'a cinematic shot of a villa'")).toBe("a cinematic shot of a villa");
  });

  it("strips a leading Prompt: label", () => {
    expect(cleanEnhancedPrompt("Prompt: a cinematic shot of a villa")).toBe("a cinematic shot of a villa");
  });

  it("strips a leading Enhanced prompt: label", () => {
    expect(cleanEnhancedPrompt("Enhanced prompt: a cinematic shot of a villa")).toBe("a cinematic shot of a villa");
  });

  it("strips markdown code fences", () => {
    expect(cleanEnhancedPrompt("```\na cinematic shot of a villa\n```")).toBe("a cinematic shot of a villa");
  });

  it("collapses newlines and repeated whitespace into single spaces", () => {
    expect(cleanEnhancedPrompt("a cinematic shot\nof a villa,   golden hour")).toBe(
      "a cinematic shot of a villa, golden hour"
    );
  });

  it("caps output length at 6000 characters (raised from 4000 — Creative Director 2.0 confirmed live that richer campaign briefs routinely exceeded the old cap and lost the negative_constraints clause entirely)", () => {
    const long = "a".repeat(7000);
    expect(cleanEnhancedPrompt(long)).toHaveLength(6000);
  });

  it("leaves an already-clean prompt unchanged", () => {
    const clean = "A luxurious modern villa during golden hour, cinematic lighting, 8k, highly detailed.";
    expect(cleanEnhancedPrompt(clean)).toBe(clean);
  });
});

describe("buildUniversalPromptFromIdea (Phase 2.3 — Universal Prompt Intelligence merge logic)", () => {
  it("echoes the supplied referenceAnalysis into the final Universal JSON", async () => {
    const { generateScript } = await import("@/lib/generation/llm");
    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({ intent: "a restaurant poster", style: { mood: "warm" } }),
    });

    const { buildUniversalPromptFromIdea } = await import("./builder");
    const referenceAnalysis = {
      industry: "hospitality",
      objects: ["plated dish", "wine glass"],
      colorPalette: [],
    };
    const result = await buildUniversalPromptFromIdea(
      { idea: "Restaurant offer", kind: "MARKETING_CREATIVE", referenceAnalysis },
      "test-user"
    );

    expect(result.referenceAnalysis).toEqual(referenceAnalysis);
  });

  it("prefers the model's own objects, falling back to the reference's analyzed objects only when the model named none", async () => {
    const { generateScript } = await import("@/lib/generation/llm");
    const { buildUniversalPromptFromIdea } = await import("./builder");

    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({ intent: "a dessert ad", objects: ["chocolate cake"] }),
    });
    const withModelObjects = await buildUniversalPromptFromIdea(
      { idea: "A dessert ad", kind: "AI_IMAGE", referenceAnalysis: { objects: ["fallback object"], colorPalette: [] } },
      "test-user"
    );
    expect(withModelObjects.objects).toEqual(["chocolate cake"]);

    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({ intent: "a dessert ad" }),
    });
    const fallbackOnly = await buildUniversalPromptFromIdea(
      { idea: "A dessert ad", kind: "AI_IMAGE", referenceAnalysis: { objects: ["fallback object"], colorPalette: [] } },
      "test-user"
    );
    expect(fallbackOnly.objects).toEqual(["fallback object"]);
  });

  it("leaves objects empty and referenceAnalysis undefined when no reference was supplied and the model named none", async () => {
    const { generateScript } = await import("@/lib/generation/llm");
    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({ intent: "a simple prompt" }),
    });

    const { buildUniversalPromptFromIdea } = await import("./builder");
    const result = await buildUniversalPromptFromIdea({ idea: "A golden retriever puppy", kind: "AI_IMAGE" }, "test-user");

    expect(result.objects).toEqual([]);
    expect(result.referenceAnalysis).toBeUndefined();
  });

  it("echoes the supplied Creative Brief into the final Universal JSON (Phase 2.4 — AI Creative Director)", async () => {
    const { generateScript } = await import("@/lib/generation/llm");
    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({ intent: "a jewellery launch ad", style: { mood: "elegant" } }),
    });

    const { buildUniversalPromptFromIdea } = await import("./builder");
    const creativeBrief = {
      marketingObjective: "Drive pre-launch waitlist signups",
      targetAudience: "Affluent women 28-45",
      visualStrategy: { visualDirection: "macro product shots with soft jewel-toned light" },
      messagingStrategy: {},
      compositionStrategy: {},
      informationArchitecture: {},
      advertisementComposition: {},
      designSystem: {},
      copywriting: {},
    };
    const result = await buildUniversalPromptFromIdea(
      { idea: "Jewellery launch", kind: "MARKETING_CREATIVE", creativeBrief },
      "test-user"
    );

    expect(result.creativeBrief).toEqual(creativeBrief);
  });

  it("leaves creativeBrief undefined when none was supplied", async () => {
    const { generateScript } = await import("@/lib/generation/llm");
    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({ intent: "a simple prompt" }),
    });

    const { buildUniversalPromptFromIdea } = await import("./builder");
    const result = await buildUniversalPromptFromIdea({ idea: "A golden retriever puppy", kind: "AI_IMAGE" }, "test-user");

    expect(result.creativeBrief).toBeUndefined();
  });
});
