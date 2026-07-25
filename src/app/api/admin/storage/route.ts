import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getStorageUsageSummary } from "@/lib/admin/storage-monitor";

// GET /api/admin/storage — Asset-table usage breakdown by kind/source plus
// the configured Storage Provider's live reachability check. Backs the
// admin Storage panel (Milestone 12 Phase A).
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const summary = await getStorageUsageSummary();
  return apiSuccess({ summary });
}
