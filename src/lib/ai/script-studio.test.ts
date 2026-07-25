import { describe, expect, it } from "vitest";

import { buildTransformPrompt, buildVariantsPrompt, parseNumberedVariants } from "./script-studio";

describe("buildTransformPrompt", () => {
  it("includes the tone and original text for rewrite", () => {
    const prompt = buildTransformPrompt("rewrite", "Original script.", { tone: "BOLD" });
    expect(prompt).toContain("bold tone");
    expect(prompt).toContain("Original:\nOriginal script.");
  });

  it("omits the tone clause when no tone is given", () => {
    const prompt = buildTransformPrompt("rewrite", "Original script.");
    expect(prompt).not.toContain("tone");
  });

  it("builds an expand prompt", () => {
    expect(buildTransformPrompt("expand", "Text.")).toContain("Expand the following video script");
  });

  it("builds a shorten prompt", () => {
    expect(buildTransformPrompt("shorten", "Text.")).toContain("Shorten the following video script");
  });

  it("translates into the named language", () => {
    const prompt = buildTransformPrompt("translate", "Text.", { targetLanguage: "HI" });
    expect(prompt).toContain("into Hindi");
  });

  it("defaults translation target to English when unspecified", () => {
    expect(buildTransformPrompt("translate", "Text.")).toContain("into English");
  });
});

describe("buildVariantsPrompt", () => {
  it("asks for hook lines", () => {
    const prompt = buildVariantsPrompt("hook", "Script body.", 3);
    expect(prompt).toContain("3 alternative opening hook lines");
    expect(prompt).toContain("Script:\nScript body.");
  });

  it("asks for cta lines", () => {
    expect(buildVariantsPrompt("cta", "Script body.", 5)).toContain("5 alternative closing call-to-action lines");
  });
});

describe("parseNumberedVariants", () => {
  it("parses a numbered list", () => {
    const text = "1. First option\n2. Second option\n3. Third option";
    expect(parseNumberedVariants(text, 3)).toEqual(["First option", "Second option", "Third option"]);
  });

  it("tolerates parenthesis-style numbering", () => {
    const text = "1) First\n2) Second";
    expect(parseNumberedVariants(text, 2)).toEqual(["First", "Second"]);
  });

  it("falls back to one variant per non-empty line when unnumbered", () => {
    const text = "First\n\nSecond";
    expect(parseNumberedVariants(text, 2)).toEqual(["First", "Second"]);
  });

  it("caps the result at count even if more lines are present", () => {
    const text = "1. A\n2. B\n3. C";
    expect(parseNumberedVariants(text, 2)).toEqual(["A", "B"]);
  });
});
