import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createFolderSchema } from "@/lib/validations/video-editor";
import { createFolder, listFolders } from "@/lib/video-editor/folders";
import { InvalidStateError } from "@/lib/video-editor/errors";

// GET /api/editor/folders — Project Browser's folder tree (flat list; the
// client groups by parentId).
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const folders = await listFolders(session.user.id);
  return apiSuccess({ folders });
}

// POST /api/editor/folders — "New Folder".
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const body = createFolderSchema.parse(await req.json());
    const folder = await createFolder(session.user.id, body);
    return apiSuccess({ folder }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the folder fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/folders failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
