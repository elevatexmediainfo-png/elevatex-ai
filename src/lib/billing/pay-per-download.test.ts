import { describe, expect, it } from "vitest";

import { assertPurchasablePrice, PayPerDownloadNotConfiguredError } from "./pay-per-download";

describe("assertPurchasablePrice", () => {
  it("accepts a positive price", () => {
    expect(() => assertPurchasablePrice(50000)).not.toThrow();
  });

  it("rejects a zero price (admin hasn't configured the plan yet)", () => {
    expect(() => assertPurchasablePrice(0)).toThrow(PayPerDownloadNotConfiguredError);
  });

  it("rejects a negative price", () => {
    expect(() => assertPurchasablePrice(-1)).toThrow(PayPerDownloadNotConfiguredError);
  });
});
