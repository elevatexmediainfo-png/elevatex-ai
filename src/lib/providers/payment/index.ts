import { listEnabledProviderConfigs, resolveProviderCredentials } from "../credentials";
import { MockPaymentProvider } from "./mock.provider";
import { RazorpayProvider } from "./razorpay.provider";
import type { PaymentProvider } from "./types";

export * from "./types";

export class PaymentProviderUnavailableError extends Error {
  constructor() {
    super("Payments are temporarily unavailable — no payment provider is configured. Please try again shortly.");
    this.name = "PaymentProviderUnavailableError";
  }
}

// SECURITY (2026-07-23) — getPaymentProvider() used to silently fall back to
// MockPaymentProvider (a real, no-money instant-success stand-in meant only
// for local dev/demo) whenever no real provider was enabled — including a
// real production deployment that simply hadn't configured Razorpay yet.
// Combined with the billing UI's own "mock mode confirms instantly" branch
// and POST /api/billing/mock/confirm's fallback-shaped guard, this was a
// live, real free-credits/free-subscription exploit: any signed-in user
// could buy credits or subscribe for ₹0. This single function is the one
// place both getPaymentProvider() and the UI-facing availability check
// (billing/plans/route.ts) agree on what "available" means, so the
// production/dev distinction is expressed exactly once.
export async function isPaymentCheckoutAvailable(): Promise<boolean> {
  const [selection] = await listEnabledProviderConfigs("PAYMENT");
  if (selection === "razorpay") return true;
  // Mock remains a legitimate stand-in outside real production (local dev,
  // demo) — it must never be reachable once NODE_ENV is actually "production".
  return process.env.NODE_ENV !== "production";
}

// PAYMENT has no failover concept — whichever provider id is first (the
// single active driver, per lib/providers/credentials.ts) is used. Throws
// PaymentProviderUnavailableError instead of silently returning Mock once
// isPaymentCheckoutAvailable() says no — every caller (all 3 order/
// subscription-creation routes) must catch this and surface a clear
// "payments unavailable" response, never create an order/PaymentIntent that
// can never actually be paid for.
export async function getPaymentProvider(): Promise<PaymentProvider> {
  const [selection] = await listEnabledProviderConfigs("PAYMENT");
  if (selection === "razorpay") {
    return new RazorpayProvider(await resolveProviderCredentials("PAYMENT", "razorpay"));
  }
  if (!(await isPaymentCheckoutAvailable())) {
    throw new PaymentProviderUnavailableError();
  }
  return new MockPaymentProvider();
}
