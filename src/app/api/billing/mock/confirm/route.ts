import { NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { fulfillPaymentIntent } from "@/lib/billing/fulfillment";

const confirmSchema = z.object({ paymentIntentId: z.string().min(1) });

// POST /api/billing/mock/confirm — MockPaymentProvider has no real checkout
// widget or webhook, so the client calls this authenticated route instead to
// instantly settle its own pending order/subscription in dev/demo. Routes
// through the exact same fulfillPaymentIntent() a real Razorpay webhook
// would call.
//
// SECURITY (2026-07-23) — this route used to be gated ONLY by "is a real
// provider currently enabled," which left it wide open on a real production
// deployment that simply hadn't configured Razorpay yet: any signed-in user
// could create a PaymentIntent then confirm it themselves here, for free
// real credits/subscription. Hard-blocked in real production FIRST,
// unconditionally, regardless of PAYMENT's DB state — this route must never
// grant real money's worth of credits outside local dev/demo, full stop.
// The original DB-driven check below is kept as defense-in-depth for
// non-production environments (a disabled-but-present real-provider row
// must still count as "nothing enabled, so it's Mock," not "a real
// provider is active" — the bug that check itself was written to fix).
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return apiError("ERR_FORBIDDEN", "Mock payment confirmation is disabled in production.", 403);
  }

  const [provider] = await listEnabledProviderConfigs("PAYMENT");
  if (provider && provider !== "mock") {
    return apiError("ERR_FORBIDDEN", "Mock confirmation is disabled — a real payment provider is active.", 403);
  }

  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "paymentIntentId is required.", 400);
  }

  const intent = await prisma.paymentIntent.findUnique({ where: { id: parsed.data.paymentIntentId } });
  if (!intent || intent.userId !== session.user.id) {
    return apiError("ERR_NOT_FOUND", "Payment intent not found.", 404);
  }
  if (intent.status !== "PENDING") {
    return apiError("ERR_INVALID_STATE", `This payment is already ${intent.status.toLowerCase()}.`, 409);
  }

  const fulfilled = await fulfillPaymentIntent(intent.id, `mock_payment_${intent.id}`);
  return apiSuccess({ paymentIntent: fulfilled });
}
