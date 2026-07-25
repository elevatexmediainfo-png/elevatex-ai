import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { upsertGuidanceNoteSchema } from "@/lib/validations/reference-library";
import { listGuidanceNotes, upsertGuidanceNote } from "@/lib/admin/reference-library";

// GET /api/admin/reference-library/guidance-notes — all 12 industries, each
// with its note (empty string if none saved yet). Per-INDUSTRY, not
// per-image — see IndustryGuidanceNote's schema comment.
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const notes = await listGuidanceNotes();
  return apiSuccess({ notes });
}

// PATCH /api/admin/reference-library/guidance-notes — upserts one
// industry's note.
export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  try {
    const body = await req.json().catch(() => ({}));
    const data = upsertGuidanceNoteSchema.parse(body);
    const note = await upsertGuidanceNote(data.industry, data.notes);
    return apiSuccess({ note });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the note and try again.", 400, { issues: err.issues });
    }
    console.error("PATCH /api/admin/reference-library/guidance-notes failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
