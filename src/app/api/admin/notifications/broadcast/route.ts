import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { broadcastNotification } from "@/lib/notifications/engine";
import { writeAuditLog } from "@/lib/admin/audit-log";

const broadcastSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  link: z.string().max(500).optional(),
  email: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = broadcastSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid broadcast.", 400, { issues: parsed.error.issues });
  }

  const result = await broadcastNotification(parsed.data);
  await writeAuditLog({
    userId: session.user.id,
    resource: "notification",
    action: "broadcast",
    detail: { title: parsed.data.title, notifiedCount: result.notifiedCount, email: !!parsed.data.email },
  });

  return apiSuccess(result, 201);
}
