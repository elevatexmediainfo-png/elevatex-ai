import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { retryDeadLetterJob } from "@/lib/render/analytics";
import { writeAuditLog } from "@/lib/admin/audit-log";

// POST /api/admin/render/dead-letter/[jobId]/retry — resets a permanently-
// FAILED job to PENDING with a fresh attempt budget. Reuses the exact same
// claim mechanics every other PENDING job goes through; not a new pathway.
export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { jobId } = await params;
  const job = await retryDeadLetterJob(jobId);
  if (!job) return apiError("ERR_NOT_FOUND", "Job not found or not in a FAILED state.", 404);

  await writeAuditLog({ userId: session.user.id, resource: "render_job", action: "manual_retry", detail: { jobId } });

  return apiSuccess({ job });
}
