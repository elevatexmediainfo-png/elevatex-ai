import { describe, expect, it } from "vitest";

import { computeCost } from "./cost";

describe("computeCost", () => {
  it("returns 0 when no rate is configured", () => {
    expect(computeCost(undefined, { tokens: 1000 })).toBe(0);
  });

  it("returns 0 when the configured rate is 0 (e.g. mock providers)", () => {
    expect(computeCost({ unit: "PER_CALL", rate: 0 }, undefined)).toBe(0);
  });

  it("PER_CALL ignores usage entirely", () => {
    expect(computeCost({ unit: "PER_CALL", rate: 0.02 }, { tokens: 99999 })).toBeCloseTo(0.02);
  });

  it("PER_1K_TOKENS scales with token count", () => {
    expect(computeCost({ unit: "PER_1K_TOKENS", rate: 0.15 }, { tokens: 2000 })).toBeCloseTo(0.3);
  });

  it("PER_1K_CHARS scales with character count", () => {
    expect(computeCost({ unit: "PER_1K_CHARS", rate: 0.18 }, { characters: 500 })).toBeCloseTo(0.09);
  });

  it("PER_SECOND scales with duration", () => {
    expect(computeCost({ unit: "PER_SECOND", rate: 0.05 }, { seconds: 30 })).toBeCloseTo(1.5);
  });

  it("PER_IMAGE defaults usage to 1 image when not specified", () => {
    expect(computeCost({ unit: "PER_IMAGE", rate: 0.04 }, undefined)).toBeCloseTo(0.04);
  });

  it("PER_1K_TOKENS with no usage data costs 0, not NaN", () => {
    expect(computeCost({ unit: "PER_1K_TOKENS", rate: 0.15 }, undefined)).toBe(0);
  });
});
