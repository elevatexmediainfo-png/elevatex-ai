import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { updateReferenceSchema } from "@/lib/validations/reference-library";
import { updateIndustryReference, deleteIndustryReference } from "@/lib/admin/reference-library";

// PATCH /api/admin/reference-library/[id] — toggle isActive or edit the
// label. DELETE removes the row (see reference-library.ts's
// deleteIndustryReference() comment: storage object is left orphaned,
// StorageProvider has no delete() method anywhere in this codebase).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const data = updateReferenceSchema.parse(body);
    const reference = await updateIndustryReference(id, data);
    return apiSuccess({ reference });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the update fields and try again.", 400, { issues: err.issues });
    }
    console.error("PATCH /api/admin/reference-library/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  await deleteIndustryReference(id);
  return apiSuccess({ deleted: true });
}
