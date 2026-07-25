import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getDeadLetterJobs } from "@/lib/render/analytics";

// GET /api/admin/render/dead-letter — permanently-FAILED RenderJobs (retries
// exhausted). This status IS the queue's dead-letter state already; this
// route just surfaces it for the admin Dead Letter panel.
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const jobs = await getDeadLetterJobs(50);
  return apiSuccess({ jobs });
}
