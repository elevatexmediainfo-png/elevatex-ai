import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { markAllNotificationsRead } from "@/lib/notifications/engine";

export async function POST() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  await markAllNotificationsRead(session.user.id);
  return apiSuccess({ ok: true });
}
