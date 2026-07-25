import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getBillingHistory } from "@/lib/billing/history";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const history = await getBillingHistory(session.user.id);
  return apiSuccess({ history });
}
