import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { RazorpayProvider } from "./razorpay.provider";

const WEBHOOK_SECRET = "test_webhook_secret";

function sign(body: string) {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

// Milestone 10 — RazorpayProvider now receives its credentials via
// constructor injection (resolved upstream by lib/providers/credentials.ts)
// instead of reading process.env itself, which is what makes it
// unit-testable without any env var mutation.
function makeProvider(options: { withWebhookSecret?: boolean } = {}) {
  const { withWebhookSecret = true } = options;
  return new RazorpayProvider({
    apiKey: "rzp_test_key",
    apiSecret: "test_key_secret",
    extraSecret: withWebhookSecret ? WEBHOOK_SECRET : undefined,
  });
}

describe("RazorpayProvider.verifyAndParseWebhook", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_123", order_id: "order_123" } } },
  });

  it("parses a correctly signed payload", () => {
    const provider = makeProvider();
    const event = provider.verifyAndParseWebhook(body, sign(body));
    expect(event.type).toBe("payment.captured");
    expect(event.paymentId).toBe("pay_123");
    expect(event.orderId).toBe("order_123");
  });

  it("rejects a signature with valid-hex-prefix garbage appended (truncation bypass)", () => {
    // Buffer.from(str, "hex") silently stops at the first invalid hex pair,
    // so naively comparing decoded bytes would treat this as a match for
    // the correct signature. The length check added alongside this feature
    // is what closes that gap.
    const provider = makeProvider();
    const tampered = `${sign(body)}not-hex`;
    expect(() => provider.verifyAndParseWebhook(body, tampered)).toThrow(
      "Invalid Razorpay webhook signature."
    );
  });

  it("rejects a completely wrong signature", () => {
    const provider = makeProvider();
    const wrong = sign("a different body entirely");
    expect(() => provider.verifyAndParseWebhook(body, wrong)).toThrow(
      "Invalid Razorpay webhook signature."
    );
  });

  it("rejects a missing signature header", () => {
    const provider = makeProvider();
    expect(() => provider.verifyAndParseWebhook(body, null)).toThrow(
      "Missing X-Razorpay-Signature header."
    );
  });

  it("throws if the webhook secret isn't configured", () => {
    const provider = makeProvider({ withWebhookSecret: false });
    expect(() => provider.verifyAndParseWebhook(body, sign(body))).toThrow(
      "razorpay webhook secret is not configured"
    );
  });
});
