import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listNotifications, getUnreadCount } from "@/lib/notifications/engine";

// GET /api/notifications — the bell icon's dropdown feed, newest first, plus
// the unread count badge in the same response so the client never needs two
// round trips.
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(session.user.id),
    getUnreadCount(session.user.id),
  ]);

  return apiSuccess({ notifications, unreadCount });
}
