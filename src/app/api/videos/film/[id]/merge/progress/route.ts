import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getMergeExportProgress } from "@/lib/scenes/merge-via-editor";
import { requireOwnedFilmProject } from "@/lib/film/access";

// GET /api/videos/film/[id]/merge/progress — real-progress polling for the
// Merge screen (2026-07-23). The actual merge (POST .../merge) is still one
// blocking call — real per-frame progress was already tracked on
// EditorExport.progress the whole time, just invisible to the frontend
// behind that single request. This is a read-only, additive sibling: the
// frontend fires this concurrently with the merge POST to show real
// percentage instead of a silent multi-minute wait that looks hung.
// Returns `found: false` before the merge has created its export row yet
// (the first few seconds) — the frontend falls back to an elapsed-time
// message for that window.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  const project = await requireOwnedFilmProject(session.user.id, id);
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
  }

  const progress = await getMergeExportProgress(session.user.id, id);
  if (!progress) {
    return apiSuccess({ found: false });
  }

  return apiSuccess({ found: true, ...progress });
}
