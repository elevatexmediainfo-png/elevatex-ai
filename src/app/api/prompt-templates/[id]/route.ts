import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { deletePromptTemplate, InvalidStateError } from "@/lib/prompts/service";

// DELETE /api/prompt-templates/[id] — remove a saved prompt template.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    await deletePromptTemplate(session.user.id, id);
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/prompt-templates/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong deleting that template.", 500);
  }

  return apiSuccess({ deleted: true });
}
