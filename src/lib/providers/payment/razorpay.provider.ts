import { createHmac, timingSafeEqual } from "crypto";
import Razorpay from "razorpay";

import { getConfig } from "@/lib/admin/config";
import type { ProviderRuntimeConfig } from "../credentials";
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

// Real adapter — the only file in the codebase allowed to import the
// `razorpay` SDK or know its payload shapes. Selected when the PAYMENT
// category's active ProviderConfig row has providerId "razorpay"; key
// id/secret/webhook secret are resolved by lib/providers/credentials.ts
// (Admin AI Providers panel, falling back to RAZORPAY_KEY_ID/
// RAZORPAY_KEY_SECRET/RAZORPAY_WEBHOOK_SECRET) and injected here.
export class RazorpayProvider implements PaymentProvider {
  private client: Razorpay;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    const keyId = config.apiKey;
    const keySecret = config.apiSecret;
    if (!keyId || !keySecret) {
      throw new Error(
        "razorpay is enabled but key id/secret are not configured (Admin → AI Providers, or RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)."
      );
    }
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const order = await this.client.orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    });

    return {
      orderId: order.id,
      amountPaise: input.amountPaise,
      currency: input.currency,
      checkoutConfig: {
        provider: "razorpay",
        keyId: this.config.apiKey,
        orderId: order.id,
        amount: input.amountPaise,
        currency: input.currency,
        // Milestone 13 — PAYMENT_METHODS_ENABLED (admin-configurable). Every
        // method defaults to enabled so this object is always explicit
        // rather than relying on Razorpay's own checkout defaults.
        method: await getEnabledMethodFlags(),
      },
    };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const subscription = await this.client.subscriptions.create({
      plan_id: input.planRef,
      total_count: input.totalCount,
      customer_notify: 1,
      notes: input.notes,
    });

    return {
      subscriptionId: subscription.id,
      checkoutConfig: {
        provider: "razorpay",
        keyId: this.config.apiKey,
        subscriptionId: subscription.id,
      },
    };
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
    await this.client.subscriptions.cancel(input.subscriptionId, input.cancelAtPeriodEnd);
  }

  verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): WebhookEvent {
    const secret = this.config.extraSecret;
    if (!secret) {
      throw new Error(
        "razorpay webhook secret is not configured (Admin → AI Providers, or RAZORPAY_WEBHOOK_SECRET)."
      );
    }
    if (!signatureHeader) {
      throw new Error("Missing X-Razorpay-Signature header.");
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    // Buffer.from(str, "hex") silently truncates at the first invalid hex
    // pair instead of throwing, so a header with garbage appended to a
    // correct prefix could otherwise decode to the same bytes as `expected`.
    // Reject anything that isn't exactly the canonical hex length first.
    if (signatureHeader.length !== expected.length) {
      throw new Error("Invalid Razorpay webhook signature.");
    }
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHeader, "hex");
    if (!timingSafeEqual(a, b)) {
      throw new Error("Invalid Razorpay webhook signature.");
    }

    const payload = JSON.parse(rawBody);
    const eventType: string = payload.event;
    const entity = payload.payload?.payment?.entity ?? payload.payload?.subscription?.entity;

    const typeMap: Record<string, WebhookEvent["type"]> = {
      "payment.captured": "payment.captured",
      "payment.failed": "payment.failed",
      "subscription.activated": "subscription.activated",
      "subscription.cancelled": "subscription.cancelled",
    };
    const type = typeMap[eventType];
    if (!type) {
      throw new Error(`Unhandled Razorpay webhook event type: ${eventType}`);
    }

    return {
      type,
      orderId: entity?.order_id,
      subscriptionId: payload.payload?.subscription?.entity?.id,
      paymentId: entity?.id,
      raw: payload,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await this.client.payments.refund(input.providerPaymentId, {
      amount: input.amountPaise,
      notes: input.reason ? { reason: input.reason } : undefined,
    });

    const statusMap: Record<string, RefundResult["status"]> = {
      pending: "PENDING",
      processed: "PROCESSED",
      failed: "FAILED",
    };

    return {
      providerRefundId: refund.id,
      status: statusMap[refund.status] ?? "PENDING",
    };
  }
}

// Maps the admin-configurable PAYMENT_METHODS_ENABLED allow-list onto
// Razorpay Checkout's own `method.<name>: boolean` flags — every method
// explicit (not omitted) so this never silently depends on Razorpay's own
// checkout defaults changing.
async function getEnabledMethodFlags(): Promise<Record<string, boolean>> {
  const enabled = await getConfig("PAYMENT_METHODS_ENABLED");
  const all = ["card", "upi", "netbanking", "wallet", "emi"] as const;
  return Object.fromEntries(all.map((method) => [method, enabled.includes(method)]));
}
