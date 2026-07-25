import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getCreditBalance, listCreditTransactions } from "@/lib/credits/engine";

// GET /api/credits — balance + recent ledger entries for the credits page.
// `subscription` was added alongside subscription cancellation (additive —
// existing consumers that don't read this field are unaffected).
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const [balance, transactions, subscription] = await Promise.all([
    getCreditBalance(session.user.id),
    listCreditTransactions(session.user.id, 50),
    prisma.subscription.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { plan: { select: { name: true } } },
    }),
  ]);

  return apiSuccess({ balance, transactions, subscription });
}
