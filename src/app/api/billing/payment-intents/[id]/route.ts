import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";

// GET /api/billing/payment-intents/[id] — lets the client poll a checkout's
// status after a real vendor widget reports success client-side. Fulfilment
// itself only ever happens via the signature-verified webhook (or the mock
// confirm endpoint) — this route is read-only and never settles anything.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const intent = await prisma.paymentIntent.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!intent) {
    return apiError("ERR_NOT_FOUND", "Payment intent not found.", 404);
  }

  return apiSuccess({ paymentIntent: intent });
}
