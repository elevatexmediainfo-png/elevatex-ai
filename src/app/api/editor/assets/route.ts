import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listEditorAssets } from "@/lib/video-editor/assets";

const VALID_KINDS = new Set(["VIDEO", "AUDIO", "IMAGE", "FONT"]);

// GET /api/editor/assets?kind=VIDEO&projectId=... — Media Library listing.
// Fix (2026-07-12) — `projectId` is optional and, when omitted, preserves
// the exact prior (cross-project) behavior every non-Uploads-tab caller
// still relies on (see listEditorAssets' own doc comment for why that's
// intentional, not the bug). No separate ownership check on `projectId`
// itself is needed: listEditorAssets already filters by `userId` too, so a
// mismatched/foreign project id can only ever yield zero rows, never
// another user's data.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const kindParam = req.nextUrl.searchParams.get("kind");
  if (kindParam && !VALID_KINDS.has(kindParam)) {
    return apiError("ERR_VALIDATION", "kind must be one of VIDEO, AUDIO, IMAGE, FONT.", 400);
  }
  const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;

  const assets = await listEditorAssets(session.user.id, kindParam as "VIDEO" | "AUDIO" | "IMAGE" | "FONT" | undefined, 200, projectId);
  return apiSuccess({ assets });
}
