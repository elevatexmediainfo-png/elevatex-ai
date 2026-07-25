import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { suspendUser, UserNotFoundError } from "@/lib/admin/abuse-detection";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  try {
    await suspendUser(id, session.user.id);
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      return apiError("ERR_NOT_FOUND", "User not found.", 404);
    }
    throw err;
  }
  return apiSuccess({ ok: true });
}
