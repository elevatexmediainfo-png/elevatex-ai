import { describe, expect, it } from "vitest";

import { bucketBySubscription } from "./cost-management";

describe("bucketBySubscription", () => {
  it("groups rows by plan name and sums requests/cost", () => {
    const planNameByUserId = new Map([
      ["u1", "Pro"],
      ["u2", "Pro"],
    ]);
    const result = bucketBySubscription(
      [
        { userId: "u1", requests: 5, costUsd: 1 },
        { userId: "u2", requests: 3, costUsd: 2 },
      ],
      planNameByUserId
    );
    expect(result).toEqual([{ planName: "Pro", requests: 8, costUsd: 3 }]);
  });

  it("buckets users with no active subscription under 'No active subscription'", () => {
    const result = bucketBySubscription([{ userId: "u1", requests: 1, costUsd: 0.5 }], new Map());
    expect(result).toEqual([{ planName: "No active subscription", requests: 1, costUsd: 0.5 }]);
  });

  it("sorts buckets by cost descending", () => {
    const planNameByUserId = new Map([
      ["u1", "Starter"],
      ["u2", "Pro"],
    ]);
    const result = bucketBySubscription(
      [
        { userId: "u1", requests: 1, costUsd: 1 },
        { userId: "u2", requests: 1, costUsd: 10 },
      ],
      planNameByUserId
    );
    expect(result.map((r) => r.planName)).toEqual(["Pro", "Starter"]);
  });
});
