import { describe, expect, it } from "vitest";

import { calculateLogoPlacement } from "./composite-logo";

describe("calculateLogoPlacement", () => {
  const opts = { position: "bottom-right" as const, scalePercent: 14, marginPercent: 4 };

  it("scales the logo width to the requested percentage of canvas width", () => {
    const placement = calculateLogoPlacement(1000, 1000, 400, 200, opts);
    expect(placement.width).toBe(140);
  });

  it("preserves the logo's own aspect ratio (never stretches it)", () => {
    const placement = calculateLogoPlacement(1000, 1000, 400, 200, opts);
    expect(placement.height).toBe(70); // 400:200 is 2:1, so height = width / 2
  });

  it("positions bottom-right with the requested margin from both edges", () => {
    const placement = calculateLogoPlacement(1000, 800, 400, 200, opts);
    expect(placement.left).toBe(1000 - placement.width - 40); // 4% of 1000
    expect(placement.top).toBe(800 - placement.height - 32); // 4% of 800
  });

  it("positions top-left with the requested margin from both edges", () => {
    const placement = calculateLogoPlacement(1000, 800, 400, 200, { ...opts, position: "top-left" });
    expect(placement.left).toBe(40);
    expect(placement.top).toBe(32);
  });

  it("centers horizontally for bottom-center", () => {
    const placement = calculateLogoPlacement(1000, 800, 400, 200, { ...opts, position: "bottom-center" });
    expect(placement.left).toBe(Math.round((1000 - placement.width) / 2));
  });

  it("never returns a negative top/left even for an oversized logo", () => {
    const placement = calculateLogoPlacement(200, 200, 400, 400, { ...opts, scalePercent: 90, marginPercent: 20 });
    expect(placement.top).toBeGreaterThanOrEqual(0);
    expect(placement.left).toBeGreaterThanOrEqual(0);
  });
});
