import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createEditorVersionSchema } from "@/lib/validations/video-editor";
import { createVersionSnapshot, listVersions } from "@/lib/video-editor/versions";

// GET /api/editor/projects/[id]/versions — Version History panel's list.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Project not found.", 404);
  }

  const versions = await listVersions(id);
  return apiSuccess({ versions });
}

// POST /api/editor/projects/[id]/versions — Module 5's autosave hook calls
// this on its periodic-or-every-N-commands timer (see use-autosave.ts); a
// no-op (204-equivalent `{ created: false }`) if the snapshot would be
// identical to the most recent one (see createVersionSnapshot's dedupe).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = createEditorVersionSchema.parse(await req.json().catch(() => ({})));

    const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Project not found.", 404);
    }

    const version = await createVersionSnapshot(id, { label: body.label });
    return apiSuccess({ created: version !== null, version }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/editor/projects/[id]/versions failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
