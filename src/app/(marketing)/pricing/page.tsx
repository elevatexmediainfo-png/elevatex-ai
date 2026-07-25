import Link from "next/link";
import { Check } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Pricing — Elevatex AI",
  description: "Live subscription plans and credit packages for Elevatex AI's AI video generation platform.",
};

function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

// Live DB data — the exact same source as GET /api/billing/plans, so this
// page can never drift from what checkout actually charges. The landing
// page's own pricing section stays on its hand-written marketing copy
// (lib/constants.ts's PLANS) by design; this page is the source of truth.
export default async function PricingPage() {
  const [plans, packages] = await Promise.all([
    prisma.pricingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.creditPackage.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const subscriptionPlans = plans.filter((p) => p.billingModel === "SUBSCRIPTION");

  return (
    <Container className="flex max-w-5xl flex-col gap-16 py-16 lg:py-24">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple, credit-based pricing"
        description="Pay for credit packages as you go, or subscribe for a monthly credit allowance. No hidden fees."
      />

      {subscriptionPlans.length > 0 && (
        <div>
          <h2 className="text-heading-2 text-neutral-900">Monthly subscriptions</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {subscriptionPlans.map((plan) => (
              <div key={plan.id} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="text-heading-3 text-neutral-900">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-display-2 text-neutral-900">{rupees(plan.priceInPaise)}</span>
                  <span className="text-body-sm text-neutral-500">/mo</span>
                </div>
                <ul className="flex flex-col gap-2">
                  <li className="flex items-start gap-2 text-body-sm text-neutral-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {plan.monthlyCredits} credits every month
                  </li>
                  <li className="flex items-start gap-2 text-body-sm text-neutral-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {plan.maxDownloadsPerMonth ? `${plan.maxDownloadsPerMonth} downloads/month` : "Unlimited downloads"}
                  </li>
                </ul>
                <Button variant="primary" className="mt-auto w-full" asChild>
                  <Link href="/login">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {packages.length > 0 && (
        <div>
          <h2 className="text-heading-2 text-neutral-900">Credit packages (pay as you go)</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="text-heading-3 text-neutral-900">{pkg.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-display-2 text-neutral-900">{rupees(pkg.priceInPaise)}</span>
                </div>
                <p className="text-body-sm text-neutral-500">{pkg.creditAmount} credits, never expire from purchase</p>
                <Button variant="outline" className="mt-auto w-full" asChild>
                  <Link href="/login">Buy credits</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-body-sm text-neutral-500">
        Every new account also starts with a free signup credit bonus — no card required.
      </p>
    </Container>
  );
}
