"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { openCheckout, pollPaymentIntentStatus, type CheckoutConfig } from "@/lib/payments/checkout-client";

interface CreditPackage {
  id: string;
  name: string;
  creditAmount: number;
  priceInPaise: number;
}

interface PricingPlan {
  id: string;
  name: string;
  billingModel: "PAY_PER_DOWNLOAD" | "SUBSCRIPTION";
  priceInPaise: number;
  monthlyCredits: number;
  maxDownloadsPerMonth: number | null;
}

interface ActiveSubscription {
  id: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  plan: { name: string };
}

function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

// Pay Per Download (credit packages) and Monthly Subscription, side by side —
// both monetization models the business rules require support for. Checkout
// itself goes through whichever Payment Provider is configured: in mock mode
// (the default, no vendor credentials needed) confirming is instant; a real
// vendor would open its checkout widget here using `checkoutConfig` instead.
export function BillingActions() {
  const router = useRouter();
  const [packages, setPackages] = React.useState<CreditPackage[]>([]);
  const [plans, setPlans] = React.useState<PricingPlan[]>([]);
  // Defaults to true so buttons aren't disabled for the one render before
  // /api/billing/plans resolves — the real gate is server-side (see
  // getPaymentProvider()), this only avoids a misleading proactive banner
  // flashing on every load.
  const [paymentsAvailable, setPaymentsAvailable] = React.useState(true);
  const [subscription, setSubscription] = React.useState<ActiveSubscription | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [couponCode, setCouponCode] = React.useState("");
  const [redeeming, setRedeeming] = React.useState(false);

  const refreshSubscription = React.useCallback(() => {
    fetch("/api/credits")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setSubscription(json.data.subscription);
      });
  }, []);

  React.useEffect(() => {
    fetch("/api/billing/plans")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setPackages(json.data.packages);
          setPlans(json.data.plans.filter((p: PricingPlan) => p.billingModel === "SUBSCRIPTION"));
          setPaymentsAvailable(json.data.paymentsAvailable !== false);
        }
      });
    refreshSubscription();
  }, [refreshSubscription]);

  // Mock mode confirms instantly via /api/billing/mock/confirm. A real
  // provider opens its checkout widget; the widget's own success callback
  // only tells us the user finished entering payment details — actual
  // fulfilment still only ever happens via the signature-verified webhook,
  // so we poll the PaymentIntent until it leaves PENDING.
  async function settle(paymentIntentId: string, checkoutConfig: CheckoutConfig) {
    if (checkoutConfig.provider === "mock") {
      const res = await fetch("/api/billing/mock/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't complete the purchase.");
        return;
      }
      toast.success("Purchase complete.");
      router.refresh();
      refreshSubscription();
      return;
    }

    try {
      await openCheckout({
        checkoutConfig,
        onSuccess: async () => {
          const toastId = toast.loading("Confirming your payment…");
          const status = await pollPaymentIntentStatus(paymentIntentId);
          toast.dismiss(toastId);
          if (status === "PAID") {
            toast.success("Purchase complete.");
            router.refresh();
            refreshSubscription();
          } else if (status === "FAILED" || status === "CANCELLED") {
            toast.error("Payment didn't go through. Please try again.");
          } else {
            toast.info("Still confirming your payment — this page will update shortly.");
          }
        },
        onDismiss: () => toast.info("Checkout cancelled."),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open checkout.");
    }
  }

  async function cancelSubscription() {
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/subscriptions/cancel", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't cancel your subscription.");
        return;
      }
      toast.success("Your subscription will end after the current billing period.");
      refreshSubscription();
    } finally {
      setCancelling(false);
    }
  }

  async function buyPackage(pkg: CreditPackage) {
    setPendingId(pkg.id);
    try {
      const res = await fetch(`/api/billing/credit-packages/${pkg.id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't start checkout.");
        return;
      }
      await settle(json.data.paymentIntentId, json.data.checkoutConfig);
    } finally {
      setPendingId(null);
    }
  }

  // Milestone 12 — CREDITS-type coupons grant instantly; PERCENT/FIXED
  // coupons are applied at checkout via the couponCode field above instead.
  async function redeemCoupon() {
    if (!couponCode.trim()) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't redeem this coupon.");
        return;
      }
      toast.success(`+${json.data.creditsGranted} credits added.`);
      setCouponCode("");
      router.refresh();
    } finally {
      setRedeeming(false);
    }
  }

  async function subscribe(plan: PricingPlan) {
    setPendingId(plan.id);
    try {
      const res = await fetch(`/api/billing/plans/${plan.id}/subscribe`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't start checkout.");
        return;
      }
      await settle(json.data.paymentIntentId, json.data.checkoutConfig);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!paymentsAvailable && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-light px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-body-sm text-dash-ink/80">
            Payments are temporarily unavailable — buying credits and subscribing are disabled until this is
            resolved. Please check back shortly.
          </p>
        </div>
      )}
      <div className="rounded-lg border border-edge-card bg-glass-card px-4 py-3 backdrop-blur-xl">
        <p className="text-label-md text-dash-ink/80">Have a coupon?</p>
        <div className="mt-2 flex gap-2">
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="h-9 flex-1 rounded-lg border border-edge-input bg-glass-subtle px-3 text-body-sm text-dash-ink placeholder:text-dash-ink/30"
          />
          <Button variant="outline" size="sm" onClick={redeemCoupon} disabled={redeeming || !couponCode.trim()}>
            {redeeming ? <Loader2 className="size-4 animate-spin" /> : "Redeem"}
          </Button>
        </div>
        <p className="mt-1.5 text-label-sm text-dash-ink/55">
          Direct credit coupons redeem instantly here — a percent/fixed-discount coupon applies automatically when
          you buy a credit package below.
        </p>
      </div>

      <div>
        <h2 className="text-label-lg text-dash-ink">Buy credits (Pay Per Download)</h2>
        <div className="mt-2 flex flex-col gap-2">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-edge-card bg-glass-card px-4 py-3"
            >
              <div>
                <p className="text-label-md text-dash-ink">{pkg.name}</p>
                <p className="text-body-sm text-dash-ink/55">{pkg.creditAmount} credits</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => buyPackage(pkg)}
                disabled={pendingId === pkg.id || !paymentsAvailable}
              >
                {pendingId === pkg.id ? <Loader2 className="size-4 animate-spin" /> : rupees(pkg.priceInPaise)}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-dash-ink">Monthly subscription</h2>
        {subscription && (
          <div className="mt-2 flex items-center justify-between gap-4 rounded-lg border border-edge-card bg-glass-subtle px-4 py-3">
            <div>
              <p className="text-label-md text-dash-ink">{subscription.plan.name}</p>
              <p className="text-body-sm text-dash-ink/55">
                {subscription.cancelAtPeriodEnd
                  ? `Cancels on ${formatDate(new Date(subscription.currentPeriodEnd))}`
                  : `Renews on ${formatDate(new Date(subscription.currentPeriodEnd))}`}
              </p>
            </div>
            {!subscription.cancelAtPeriodEnd && (
              <Button variant="secondary" size="sm" onClick={cancelSubscription} disabled={cancelling}>
                {cancelling ? <Loader2 className="size-4 animate-spin" /> : "Cancel"}
              </Button>
            )}
          </div>
        )}
        <div className="mt-2 flex flex-col gap-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-edge-card bg-glass-card px-4 py-3"
            >
              <div>
                <p className="text-label-md text-dash-ink">{plan.name}</p>
                <p className="text-body-sm text-dash-ink/55">
                  {plan.monthlyCredits} credits/month ·{" "}
                  {plan.maxDownloadsPerMonth ? `${plan.maxDownloadsPerMonth} downloads/month` : "unlimited downloads"}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => subscribe(plan)}
                disabled={pendingId === plan.id || !paymentsAvailable}
              >
                {pendingId === plan.id ? <Loader2 className="size-4 animate-spin" /> : `${rupees(plan.priceInPaise)}/mo`}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
