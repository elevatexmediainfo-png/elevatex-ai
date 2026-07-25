import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPaymentIntentDetail } from "@/lib/admin/payments";

// GET /api/admin/payments/[id] — one PaymentIntent with its user, invoice,
// refunds, and disputes — everything the admin detail view needs in one call.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  const intent = await getPaymentIntentDetail(id);
  if (!intent) return apiError("ERR_NOT_FOUND", "Payment intent not found.", 404);

  return apiSuccess({ intent });
}
