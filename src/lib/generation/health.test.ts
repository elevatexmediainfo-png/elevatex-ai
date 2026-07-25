import { describe, expect, it } from "vitest";

import { computeNextHealthState, isAvailableNow, type HealthState } from "./health";

const INITIAL: HealthState = { status: "HEALTHY", consecutiveFailures: 0, downUntil: null };
const THRESHOLD = 3;
const COOLDOWN_MS = 60_000;
const NOW = 1_700_000_000_000;

describe("computeNextHealthState", () => {
  it("resets to HEALTHY on success regardless of prior failures", () => {
    const current: HealthState = { status: "DEGRADED", consecutiveFailures: 2, downUntil: null };
    const next = computeNextHealthState(current, "success", THRESHOLD, COOLDOWN_MS, NOW);
    expect(next).toEqual({ status: "HEALTHY", consecutiveFailures: 0, downUntil: null });
  });

  it("moves to DEGRADED on a failure below the threshold", () => {
    const next = computeNextHealthState(INITIAL, "failure", THRESHOLD, COOLDOWN_MS, NOW);
    expect(next.status).toBe("DEGRADED");
    expect(next.consecutiveFailures).toBe(1);
    expect(next.downUntil).toBeNull();
  });

  it("trips to DOWN once consecutive failures reach the threshold", () => {
    let state = INITIAL;
    for (let i = 0; i < THRESHOLD; i++) {
      state = computeNextHealthState(state, "failure", THRESHOLD, COOLDOWN_MS, NOW);
    }
    expect(state.status).toBe("DOWN");
    expect(state.consecutiveFailures).toBe(THRESHOLD);
    expect(state.downUntil?.getTime()).toBe(NOW + COOLDOWN_MS);
  });

  it("a single failure right after DOWN's cooldown re-trips it immediately (failures aren't reset by time passing)", () => {
    const down: HealthState = { status: "DOWN", consecutiveFailures: THRESHOLD, downUntil: new Date(NOW) };
    const next = computeNextHealthState(down, "failure", THRESHOLD, COOLDOWN_MS, NOW + 1);
    expect(next.status).toBe("DOWN");
    expect(next.consecutiveFailures).toBe(THRESHOLD + 1);
  });
});

describe("isAvailableNow", () => {
  it("is available when HEALTHY or DEGRADED", () => {
    expect(isAvailableNow({ status: "HEALTHY", downUntil: null }, NOW)).toBe(true);
    expect(isAvailableNow({ status: "DEGRADED", downUntil: null }, NOW)).toBe(true);
  });

  it("is unavailable while DOWN and before downUntil", () => {
    expect(isAvailableNow({ status: "DOWN", downUntil: new Date(NOW + 1000) }, NOW)).toBe(false);
  });

  it("is available again once downUntil has passed", () => {
    expect(isAvailableNow({ status: "DOWN", downUntil: new Date(NOW - 1) }, NOW)).toBe(true);
  });
});
