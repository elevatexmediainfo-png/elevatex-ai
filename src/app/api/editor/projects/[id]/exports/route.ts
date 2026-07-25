import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createEditorExportSchema } from "@/lib/validations/video-editor";
import { createExport, listExports } from "@/lib/video-editor/exports";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/exports — queues a new export (Part B: the
// EditorExport row is created with status QUEUED, picked up by the
// separate export queue worker — see lib/video-editor/export-queue-worker.ts
// — so this returns immediately without blocking on the actual render).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = createEditorExportSchema.parse(await req.json());
    const exportRow = await createExport({ projectId: id, userId: session.user.id, ...body });
    return apiSuccess({ export: exportRow }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the export settings and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/editor/projects/[id]/exports failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// GET /api/editor/projects/[id]/exports — Part C: export history (settings
// used, status, progress, timestamps — a real error reason is included
// per-row for FAILED exports, not just the bare status).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const exportRows = await listExports(id, session.user.id);
    return apiSuccess({ exports: exportRows });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("GET /api/editor/projects/[id]/exports failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
