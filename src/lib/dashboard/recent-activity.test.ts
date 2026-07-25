import { describe, expect, it } from "vitest";

import { bucketDailyActivity } from "./recent-activity";

const NOW = new Date("2026-06-30T12:00:00.000Z");

describe("bucketDailyActivity", () => {
  it("returns one zero-filled entry per day when there are no timestamps", () => {
    const result = bucketDailyActivity([], 7, NOW);
    expect(result).toHaveLength(7);
    expect(result.every((r) => r.count === 0)).toBe(true);
    expect(result[result.length - 1].date).toBe("2026-06-30");
    expect(result[0].date).toBe("2026-06-24");
  });

  it("counts multiple timestamps on the same day together", () => {
    const result = bucketDailyActivity(
      [new Date("2026-06-30T01:00:00.000Z"), new Date("2026-06-30T23:00:00.000Z"), new Date("2026-06-29T10:00:00.000Z")],
      7,
      NOW
    );
    const byDate = Object.fromEntries(result.map((r) => [r.date, r.count]));
    expect(byDate["2026-06-30"]).toBe(2);
    expect(byDate["2026-06-29"]).toBe(1);
  });

  it("drops timestamps outside the requested window", () => {
    const result = bucketDailyActivity([new Date("2026-06-01T00:00:00.000Z")], 7, NOW);
    expect(result.reduce((sum, r) => sum + r.count, 0)).toBe(0);
  });

  it("respects a custom day count", () => {
    const result = bucketDailyActivity([], 3, NOW);
    expect(result.map((r) => r.date)).toEqual(["2026-06-28", "2026-06-29", "2026-06-30"]);
  });
});
