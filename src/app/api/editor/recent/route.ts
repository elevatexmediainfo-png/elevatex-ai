import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listRecentAssets } from "@/lib/video-editor/recent-assets";

// GET /api/editor/recent
export async function GET() {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  try {
    const assets = await listRecentAssets(session.user.id);
    return apiSuccess({ assets });
  } catch (err) {
    console.error("GET /api/editor/recent failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
