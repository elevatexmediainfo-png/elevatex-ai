import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { cancelSubscriptionImmediately, SubscriptionAdminError } from "@/lib/admin/subscriptions";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;

  try {
    const subscription = await cancelSubscriptionImmediately(id, session.user.id);
    return apiSuccess({ subscription });
  } catch (err) {
    if (err instanceof SubscriptionAdminError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    return apiError("ERR_INTERNAL", err instanceof Error ? err.message : "Cancellation failed.", 500);
  }
}
