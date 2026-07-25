import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { grantCreditsToUsers } from "@/lib/admin/credit-grants";

const grantSchema = z.object({
  userIds: z.array(z.string().min(1)).optional(),
  emails: z.array(z.string().email()).optional(),
  phones: z.array(z.string().min(1)).optional(),
  amount: z.number().int().min(1),
  description: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid grant request.", 400, { issues: parsed.error.issues });
  }
  if (!parsed.data.userIds?.length && !parsed.data.emails?.length && !parsed.data.phones?.length) {
    return apiError("ERR_VALIDATION", "Provide at least one user id, email, or phone.", 400);
  }

  const result = await grantCreditsToUsers(
    { userIds: parsed.data.userIds, emails: parsed.data.emails, phones: parsed.data.phones },
    parsed.data.amount,
    parsed.data.description ?? "",
    session.user.id
  );

  return apiSuccess({ result });
}
