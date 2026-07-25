import { afterEach, describe, expect, it, vi } from "vitest";

import { openCheckout, pollPaymentIntentStatus } from "./checkout-client";

describe("openCheckout", () => {
  it("rejects providers with no implemented widget instead of silently doing nothing", async () => {
    await expect(
      openCheckout({
        checkoutConfig: { provider: "mock" },
        onSuccess: () => {},
      })
    ).rejects.toThrow('No checkout widget implemented for provider "mock".');
  });
});

describe("pollPaymentIntentStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns immediately once the intent leaves PENDING", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { paymentIntent: { status: "PAID" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const status = await pollPaymentIntentStatus("intent_1", { intervalMs: 0, maxAttempts: 5 });
    expect(status).toBe("PAID");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts and reports PENDING", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { paymentIntent: { status: "PENDING" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const status = await pollPaymentIntentStatus("intent_1", { intervalMs: 0, maxAttempts: 3 });
    expect(status).toBe("PENDING");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
