import { describe, expect, it } from "vitest";

import { buildOptimizationPrompt, parseOptimizationResponse } from "./optimizer";

describe("buildOptimizationPrompt", () => {
  it("asks for a negative-prompt suggestion for IMAGE prompts", () => {
    const prompt = buildOptimizationPrompt("IMAGE", "a cake on a table");
    expect(prompt).toContain("NEGATIVE:");
    expect(prompt).toContain("Original:\na cake on a table");
  });

  it("asks for a negative-prompt suggestion for VIDEO prompts", () => {
    expect(buildOptimizationPrompt("VIDEO", "text")).toContain("NEGATIVE:");
  });

  it("omits the negative-prompt section for SCRIPT prompts", () => {
    expect(buildOptimizationPrompt("SCRIPT", "text")).not.toContain("NEGATIVE:");
  });

  it("omits the negative-prompt section for NEGATIVE prompts (no nested suggestion)", () => {
    expect(buildOptimizationPrompt("NEGATIVE", "blurry, low quality")).not.toContain("NEGATIVE:\n<a short");
  });

  it("includes business context when given", () => {
    const prompt = buildOptimizationPrompt("SCRIPT", "text", "A bakery in Pune");
    expect(prompt).toContain("Business context: A bakery in Pune");
  });
});

describe("parseOptimizationResponse", () => {
  it("parses both sections when present", () => {
    const result = parseOptimizationResponse(
      "OPTIMIZED:\nA warm, golden-lit cake on a rustic wooden table.\nNEGATIVE:\nblurry, low quality, watermark"
    );
    expect(result.optimizedText).toBe("A warm, golden-lit cake on a rustic wooden table.");
    expect(result.negativePromptSuggestion).toBe("blurry, low quality, watermark");
  });

  it("parses just the optimized section when no negative section is present", () => {
    const result = parseOptimizationResponse("OPTIMIZED:\nA better script opening.");
    expect(result.optimizedText).toBe("A better script opening.");
    expect(result.negativePromptSuggestion).toBeUndefined();
  });

  it("falls back to the raw text when the model doesn't follow the format", () => {
    const result = parseOptimizationResponse("Here's a better version of your prompt.");
    expect(result.optimizedText).toBe("Here's a better version of your prompt.");
    expect(result.negativePromptSuggestion).toBeUndefined();
  });
});
