import { describe, expect, it } from "vitest";

import { evaluateBudget } from "./budget";

const NO_USAGE = { dailySpendUsd: 0, monthlySpendUsd: 0, recentRequestCount: 0 };

describe("evaluateBudget", () => {
  it("is ok when no limits are configured, regardless of usage", () => {
    expect(evaluateBudget({ dailySpendUsd: 999, monthlySpendUsd: 999, recentRequestCount: 999 }, {})).toEqual({
      ok: true,
    });
  });

  it("is ok when usage is below every configured limit", () => {
    const result = evaluateBudget(
      { dailySpendUsd: 4, monthlySpendUsd: 40, recentRequestCount: 5 },
      { dailyBudgetUsd: 5, monthlyBudgetUsd: 50, rateLimitPerMinute: 10 }
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects once daily spend reaches the daily budget", () => {
    const result = evaluateBudget({ ...NO_USAGE, dailySpendUsd: 5 }, { dailyBudgetUsd: 5 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/daily budget/);
  });

  it("rejects once monthly spend reaches the monthly budget", () => {
    const result = evaluateBudget({ ...NO_USAGE, monthlySpendUsd: 100 }, { monthlyBudgetUsd: 100 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/monthly budget/);
  });

  it("rejects once the recent request count reaches the per-minute rate limit", () => {
    const result = evaluateBudget({ ...NO_USAGE, recentRequestCount: 10 }, { rateLimitPerMinute: 10 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/rate limit/);
  });

  it("checks daily budget before monthly budget before rate limit", () => {
    const result = evaluateBudget(
      { dailySpendUsd: 5, monthlySpendUsd: 100, recentRequestCount: 10 },
      { dailyBudgetUsd: 5, monthlyBudgetUsd: 100, rateLimitPerMinute: 10 }
    );
    expect(result.reason).toMatch(/daily budget/);
  });
});
