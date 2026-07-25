import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createProjectSchema } from "@/lib/validations/video-editor";
import { createProject, listProjects } from "@/lib/video-editor/projects";
import { InvalidStateError } from "@/lib/video-editor/errors";

// GET /api/editor/projects?folderId=... — Project Browser's project grid.
// Omitting folderId returns every project regardless of folder; passing an
// empty string means "root only" (folderId: null).
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const folderIdParam = req.nextUrl.searchParams.get("folderId");
  const folderId = folderIdParam === null ? undefined : folderIdParam === "" ? null : folderIdParam;

  const projects = await listProjects(session.user.id, folderId);
  return apiSuccess({ projects });
}

// POST /api/editor/projects — New Project dialog.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const body = createProjectSchema.parse(await req.json());
    const project = await createProject(session.user.id, body);
    return apiSuccess({ project }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the project fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/projects failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
