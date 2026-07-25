import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listRecentReferences } from "@/lib/design-intelligence/search";

// GET /api/design-intelligence/recent-references
// Creative Studio's "Recent references" picker — the user's own previously
// analyzed reference uploads, reusable without re-uploading.
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const references = await listRecentReferences(session.user.id);
  return apiSuccess({ references });
}
