import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listFavorites } from "@/lib/video-editor/favorites";

// GET /api/editor/favorites
export async function GET() {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  try {
    const assets = await listFavorites(session.user.id);
    return apiSuccess({ assets });
  } catch (err) {
    console.error("GET /api/editor/favorites failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
