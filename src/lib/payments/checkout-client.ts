// Client-side checkout helpers — the one place in the codebase allowed to
// know about a specific Payment Provider's widget (mirrors
// lib/providers/payment/razorpay.provider.ts being the only file allowed to
// import the `razorpay` SDK server-side). Every caller still branches on
// `checkoutConfig.provider` first, exactly like the existing Mock-mode path
// already did — this only adds the real-vendor branch.

export interface CheckoutConfig {
  provider: string;
  [key: string]: unknown;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: () => void): void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayScriptPromise = null; // allow retrying on a later call
      reject(new Error("Couldn't load the Razorpay checkout script."));
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

interface OpenCheckoutInput {
  checkoutConfig: CheckoutConfig;
  /** Called when the widget reports success. Fulfilment is async (webhook) — the caller should poll, not assume it's settled yet. */
  onSuccess: () => void;
  onDismiss?: () => void;
}

/** Opens whichever vendor's checkout widget `checkoutConfig.provider` names. Throws for "mock" — callers must handle that branch themselves via /api/billing/mock/confirm. */
export async function openCheckout({ checkoutConfig, onSuccess, onDismiss }: OpenCheckoutInput): Promise<void> {
  if (checkoutConfig.provider !== "razorpay") {
    throw new Error(`No checkout widget implemented for provider "${checkoutConfig.provider}".`);
  }

  await loadRazorpayScript();
  if (!window.Razorpay) {
    throw new Error("Razorpay checkout script loaded but window.Razorpay is unavailable.");
  }

  const rzp = new window.Razorpay({
    key: checkoutConfig.keyId,
    amount: checkoutConfig.amount,
    currency: checkoutConfig.currency,
    order_id: checkoutConfig.orderId,
    subscription_id: checkoutConfig.subscriptionId,
    handler: onSuccess,
    modal: { ondismiss: onDismiss },
  });
  rzp.on("payment.failed", () => onDismiss?.());
  rzp.open();
}

interface PollPaymentIntentOptions {
  intervalMs?: number;
  maxAttempts?: number;
}

/** Polls GET /api/billing/payment-intents/[id] until status leaves PENDING or attempts run out. Read-only — never settles anything itself. */
export async function pollPaymentIntentStatus(
  paymentIntentId: string,
  { intervalMs = 1500, maxAttempts = 20 }: PollPaymentIntentOptions = {}
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`/api/billing/payment-intents/${paymentIntentId}`);
    const json = await res.json();
    const status = json?.data?.paymentIntent?.status;
    if (status && status !== "PENDING") return status;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return "PENDING";
}
