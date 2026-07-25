import type {
  CancelSubscriptionInput,
  CreateOrderInput,
  CreateOrderResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookEvent,
} from "./types";

// Default provider (PROVIDER_PAYMENT=mock) — no real checkout widget exists
// for this provider; the client instead calls POST /api/billing/mock/confirm
// (an authenticated route, not a public webhook) to instantly settle a
// pending order/subscription. Fulfillment still goes through the exact same
// business-logic function (lib/billing/fulfillment.ts) a real Razorpay
// webhook would call — only how the event gets there differs.
export class MockPaymentProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return {
      orderId: `mock_order_${input.receipt}`,
      amountPaise: input.amountPaise,
      currency: input.currency,
      checkoutConfig: { provider: "mock" },
    };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    return {
      subscriptionId: `mock_sub_${input.planRef}_${Date.now()}`,
      checkoutConfig: { provider: "mock" },
    };
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
    void input; // nothing vendor-side to cancel in mock mode
  }

  verifyAndParseWebhook(): WebhookEvent {
    throw new Error(
      "MockPaymentProvider has no real webhook — use POST /api/billing/mock/confirm instead."
    );
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      providerRefundId: `mock_refund_${input.providerPaymentId}_${Date.now()}`,
      status: "PROCESSED",
    };
  }
}
