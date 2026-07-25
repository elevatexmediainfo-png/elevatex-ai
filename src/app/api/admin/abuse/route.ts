import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { getAbuseReport } from "@/lib/admin/abuse-detection";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const flags = await getAbuseReport();
  return apiSuccess({ flags });
}
