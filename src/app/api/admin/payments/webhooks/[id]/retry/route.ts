import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { retryWebhookEvent, WebhookEventNotFoundError } from "@/lib/billing/webhook-log";

// POST /api/admin/payments/webhooks/[id]/retry — re-runs the exact same
// dispatch logic the live webhook route uses, against the stored payload.
// Copies render/analytics.ts's dead-letter-retry template (find by id,
// re-run, audit log).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  try {
    const event = await retryWebhookEvent(id, session.user.id);
    return apiSuccess({ event });
  } catch (err) {
    if (err instanceof WebhookEventNotFoundError) {
      return apiError("ERR_NOT_FOUND", "Webhook event not found.", 404);
    }
    return apiError(
      "ERR_INTERNAL",
      err instanceof Error ? err.message : "Retry failed.",
      500
    );
  }
}
