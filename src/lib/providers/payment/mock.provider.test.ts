import { describe, expect, it } from "vitest";

import { MockPaymentProvider } from "./mock.provider";

describe("MockPaymentProvider.cancelSubscription", () => {
  it("resolves without contacting any vendor (mock mode has nothing to cancel)", async () => {
    const provider = new MockPaymentProvider();
    await expect(
      provider.cancelSubscription({ subscriptionId: "mock_sub_123", cancelAtPeriodEnd: true })
    ).resolves.toBeUndefined();
  });
});

describe("MockPaymentProvider.refund", () => {
  it("always succeeds instantly with a deterministic-prefix refund id", async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.refund({ providerPaymentId: "mock_payment_123", amountPaise: 9900 });
    expect(result.status).toBe("PROCESSED");
    expect(result.providerRefundId).toMatch(/^mock_refund_mock_payment_123_/);
  });
});
