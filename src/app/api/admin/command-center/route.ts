import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getOrSetCache } from "@/lib/cache/cache";
import { getCommandCenterReport } from "@/lib/admin/command-center";

// Short TTL like every other admin aggregation route — this composes the
// health/abuse/cost/storage checks too, so caching matters here as much as
// anywhere else in the panel.
const CACHE_TTL_SECONDS = 30;

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const report = await getOrSetCache("command-center", CACHE_TTL_SECONDS, () => getCommandCenterReport());

  return apiSuccess({ report });
}
