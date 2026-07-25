import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createEditorExportPresetSchema } from "@/lib/validations/video-editor";
import { createExportPreset, listExportPresets } from "@/lib/video-editor/export-presets";
import { InvalidStateError } from "@/lib/video-editor/errors";

// GET /api/editor/export-presets — the current user's saved export-settings
// presets (Render Queue polish).
export async function GET() {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  try {
    const presets = await listExportPresets(session.user.id);
    return apiSuccess({ presets });
  } catch (err) {
    console.error("GET /api/editor/export-presets failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// POST /api/editor/export-presets — save the current export panel settings
// under a name for reuse across any future project.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  try {
    const body = createEditorExportPresetSchema.parse(await req.json());
    const preset = await createExportPreset({ userId: session.user.id, ...body });
    return apiSuccess({ preset }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the preset settings and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/editor/export-presets failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
