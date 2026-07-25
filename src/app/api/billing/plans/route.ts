import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api-response";
import { isPaymentCheckoutAvailable } from "@/lib/providers/payment";

// GET /api/billing/plans — everything an admin has made purchasable, read
// straight from PricingPlan/CreditPackage. No hardcoded pricing anywhere in
// the client or server: changing a price is a DB write from the admin panel,
// never a deploy.
//
// `paymentsAvailable` (2026-07-23) — lets the billing UI show a clear
// "payments temporarily unavailable" state and disable Buy/Subscribe
// proactively, before the user ever clicks, instead of only reacting to a
// checkout call failing. Mirrors exactly what getPaymentProvider() will do
// (lib/providers/payment/index.ts's isPaymentCheckoutAvailable()) so the two
// can never disagree.
export async function GET() {
  const [plans, packages, paymentsAvailable] = await Promise.all([
    prisma.pricingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.creditPackage.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    isPaymentCheckoutAvailable(),
  ]);

  return apiSuccess({ plans, packages, paymentsAvailable });
}
