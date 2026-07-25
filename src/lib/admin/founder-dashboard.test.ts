import { describe, expect, it } from "vitest";

import { bucketSignupsByDay } from "./founder-dashboard";

describe("bucketSignupsByDay", () => {
  it("groups timestamps on the same UTC day into one bucket", () => {
    const buckets = bucketSignupsByDay([
      { createdAt: new Date("2026-01-01T01:00:00.000Z") },
      { createdAt: new Date("2026-01-01T23:00:00.000Z") },
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(2);
    expect(buckets[0].dayStart).toBe("2026-01-01T00:00:00.000Z");
  });

  it("separates different UTC days and sorts ascending", () => {
    const buckets = bucketSignupsByDay([
      { createdAt: new Date("2026-01-02T00:00:00.000Z") },
      { createdAt: new Date("2026-01-01T00:00:00.000Z") },
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].dayStart).toBe("2026-01-01T00:00:00.000Z");
    expect(buckets[1].dayStart).toBe("2026-01-02T00:00:00.000Z");
  });

  it("returns an empty array for no signups", () => {
    expect(bucketSignupsByDay([])).toEqual([]);
  });
});
