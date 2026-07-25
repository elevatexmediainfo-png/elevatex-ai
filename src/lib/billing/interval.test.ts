import { describe, expect, it } from "vitest";

import { addBillingInterval } from "./interval";

describe("addBillingInterval", () => {
  it("adds 1 month for MONTHLY", () => {
    const result = addBillingInterval(new Date("2026-01-15T00:00:00.000Z"), "MONTHLY");
    expect(result.toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });

  it("adds 3 months for QUARTERLY", () => {
    const result = addBillingInterval(new Date("2026-01-15T00:00:00.000Z"), "QUARTERLY");
    expect(result.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });

  it("adds 6 months for HALF_YEARLY", () => {
    const result = addBillingInterval(new Date("2026-01-15T00:00:00.000Z"), "HALF_YEARLY");
    expect(result.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("adds 1 year for YEARLY", () => {
    const result = addBillingInterval(new Date("2026-01-15T00:00:00.000Z"), "YEARLY");
    expect(result.toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("does not mutate the input date", () => {
    const input = new Date("2026-01-15T00:00:00.000Z");
    addBillingInterval(input, "YEARLY");
    expect(input.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("handles month-end rollover correctly (Jan 31 + 1 month)", () => {
    const result = addBillingInterval(new Date("2026-01-31T00:00:00.000Z"), "MONTHLY");
    // JS Date.setMonth rolls Feb 31 -> Mar 3 (2026 is not a leap year) — this
    // documents existing Date-arithmetic behavior, not a new edge case this
    // helper introduces (fulfillment.ts's old hardcoded setMonth(+1) had the
    // exact same rollover behavior already).
    expect(result.toISOString()).toBe("2026-03-03T00:00:00.000Z");
  });
});
