import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "../schema";
import { buildNegativeConstraints } from "./negative";

function promptWith(fields: Record<string, unknown>) {
  return universalPromptSchema.parse(fields);
}

describe("buildNegativeConstraints", () => {
  it("preserves the model's own negative_constraints and adds the curated avoid-bank", () => {
    const prompt = promptWith({ negative_constraints: ["distorted text"] });
    const result = buildNegativeConstraints(prompt);
    expect(result).toContain("distorted text");
    expect(result).toContain("watermarks");
    expect(result).toContain("stock photo appearance");
  });

  it("de-duplicates case-insensitively", () => {
    const prompt = promptWith({ negative_constraints: ["Watermarks", "blurry output"] });
    const result = buildNegativeConstraints(prompt);
    expect(result.filter((c) => c.toLowerCase() === "watermarks")).toHaveLength(1);
    expect(result.filter((c) => c.toLowerCase() === "blurry output")).toHaveLength(1);
  });

  it("returns the full curated bank even when the model supplied none", () => {
    const prompt = promptWith({});
    const result = buildNegativeConstraints(prompt);
    expect(result.length).toBeGreaterThanOrEqual(13);
  });
});
