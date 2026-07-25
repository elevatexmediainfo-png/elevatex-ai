import { describe, expect, it } from "vitest";

import { bucketRevenueByDay, computeMRR } from "./revenue";

describe("bucketRevenueByDay", () => {
  it("groups intents into the same bucket when they fall on the same day", () => {
    const buckets = bucketRevenueByDay([
      { amountPaise: 1000, createdAt: new Date("2026-06-01T08:00:00.000Z") },
      { amountPaise: 2000, createdAt: new Date("2026-06-01T20:00:00.000Z") },
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].revenuePaise).toBe(3000);
    expect(buckets[0].count).toBe(2);
  });

  it("separates intents on different days and sorts ascending", () => {
    const buckets = bucketRevenueByDay([
      { amountPaise: 1000, createdAt: new Date("2026-06-02T08:00:00.000Z") },
      { amountPaise: 2000, createdAt: new Date("2026-06-01T08:00:00.000Z") },
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].dayStart < buckets[1].dayStart).toBe(true);
    expect(buckets[0].revenuePaise).toBe(2000);
    expect(buckets[1].revenuePaise).toBe(1000);
  });

  it("returns an empty array for no intents", () => {
    expect(bucketRevenueByDay([])).toEqual([]);
  });
});

describe("computeMRR", () => {
  it("sums MONTHLY plans at their full price", () => {
    const mrr = computeMRR([{ priceInPaise: 49_900, billingInterval: "MONTHLY" }]);
    expect(mrr).toBe(49_900);
  });

  it("normalizes a YEARLY plan to 1/12th of its price", () => {
    const mrr = computeMRR([{ priceInPaise: 1_20_000, billingInterval: "YEARLY" }]);
    expect(mrr).toBe(10_000);
  });

  it("normalizes QUARTERLY and HALF_YEARLY correctly", () => {
    expect(computeMRR([{ priceInPaise: 3_000, billingInterval: "QUARTERLY" }])).toBe(1_000);
    expect(computeMRR([{ priceInPaise: 6_000, billingInterval: "HALF_YEARLY" }])).toBe(1_000);
  });

  it("treats a null interval as MONTHLY (defensive default)", () => {
    const mrr = computeMRR([{ priceInPaise: 500, billingInterval: null }]);
    expect(mrr).toBe(500);
  });

  it("sums across multiple subscriptions with mixed intervals", () => {
    const mrr = computeMRR([
      { priceInPaise: 49_900, billingInterval: "MONTHLY" },
      { priceInPaise: 1_20_000, billingInterval: "YEARLY" },
    ]);
    expect(mrr).toBe(49_900 + 10_000);
  });
});
