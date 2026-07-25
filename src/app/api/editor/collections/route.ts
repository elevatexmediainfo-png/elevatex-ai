import { NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createCollection, listCollections } from "@/lib/video-editor/collections";

const createCollectionSchema = z.object({ name: z.string().trim().min(1).max(100) });

// GET /api/editor/collections
export async function GET() {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const collections = await listCollections(session.user.id);
  return apiSuccess({ collections });
}

// POST /api/editor/collections
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  try {
    const body = createCollectionSchema.parse(await req.json());
    const collection = await createCollection(session.user.id, body.name);
    return apiSuccess({ collection }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please provide a collection name.", 400, { issues: err.issues });
    }
    console.error("POST /api/editor/collections failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
