export interface CreateOrderInput {
  amountPaise: number;
  currency: "INR";
  receipt: string; // our own reference id (PaymentIntent.id), for reconciliation
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  /** Provider-specific public key/config the client checkout widget needs. */
  checkoutConfig: Record<string, unknown>;
}

export interface CreateSubscriptionInput {
  planRef: string; // the provider-side plan id (PricingPlan.providerPlanRef, if synced)
  totalCount: number; // number of billing cycles, e.g. 12 for a 1-year commitment cap
  notes?: Record<string, string>;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  checkoutConfig: Record<string, unknown>;
}

export interface CancelSubscriptionInput {
  /** The vendor's own subscription id — Subscription.providerRef, not our row's id. */
  subscriptionId: string;
  /** true = let the current billing period run out before stopping; false = stop immediately. */
  cancelAtPeriodEnd: boolean;
}

export interface WebhookEvent {
  type: "payment.captured" | "payment.failed" | "subscription.activated" | "subscription.cancelled";
  orderId?: string;
  subscriptionId?: string;
  paymentId?: string;
  raw: unknown;
}

export interface RefundInput {
  /** The vendor's own payment id — PaymentIntent.providerPaymentId, not our row's id. */
  providerPaymentId: string;
  amountPaise: number;
  reason?: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: "PENDING" | "PROCESSED" | "FAILED";
}

export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  /** Cancels a previously-created subscription vendor-side. No-op for providers with nothing to cancel. */
  cancelSubscription(input: CancelSubscriptionInput): Promise<void>;
  /** Verifies the webhook signature and parses it into a normalized event. Throws if invalid. */
  verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): WebhookEvent;
  /** Milestone 13 — issues a refund vendor-side for an already-captured payment. */
  refund(input: RefundInput): Promise<RefundResult>;
}
